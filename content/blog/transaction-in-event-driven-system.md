---
title: "A Hybrid Transactional Outbox Event Delivery Pattern"
description: 'This article presents a hybrid event delivery pattern that uses three specialized tables to handle different event delivery requirements: eager publishing with fallback scanning for latency-sensitive events, scheduled polling for time-based events, and batch aggregation for high-volume data.'
tags:
  - Distributed System
  - Coding
pubDate: 'Oct 5 2025'
heroImageId: 'ddf2d009-5622-4e40-fc9a-f84aacbe0f00'
pinned: true
---

## The Problem: Reliable Event Publishing is Hard

In distributed systems, publishing events reliably is deceptively difficult. You need to atomically:
1. Update your database
2. Publish an event to a message queue

But these are two separate systems. What happens when your database transaction succeeds but the message queue is down? You lose events. What if the message publishes but the database rolls back? You get phantom events.

This is the **dual-write problem**, and it's the bane of event-driven architectures.

## Transactional Outbox

The [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html) solves this by:
1. Writing events to an outbox table within the same database transaction
2. A separate process reads the outbox and publishes to the message queue
3. Events are marked as published after successful delivery

This works, but it comes with trade-offs:
- **Polling adds latency**: Checking the database every few seconds delays event delivery
- **Change Data Capture is complex**: Real-time CDC solutions like Debezium are powerful but add operational overhead
- **Large payloads in MQ**: Full event data flows through the message queue

## Real-World Example: Multi-Provider AI Chat Platform

Let's ground this in a concrete example: building a chat platform that supports multiple AI providers (OpenAI, Anthropic, Google, etc.). This system needs to handle:

- User subscriptions that **expire at specific times**
- **Token usage tracking** across millions of API calls
- **Payment processing** that triggers service activation
- AI responses cached in Redis that need eventual **persistence**

Each of these has different consistency and latency requirements, making it a perfect case study for our hybrid pattern.

## A Better Approach: Hybrid Outbox with Claim Check and Buffer

I implemented a pattern that separates different delivery mechanisms into dedicated tables. The key insight: different event types have different requirements and should use optimized storage.

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Chat Service                        │
└───┬─────────────────┬─────────────────┬─────────────────────┘
    │                 │                 │
    │ 1. Eager Event  │ 2. Schedule     │ 3. Accumulate
    │                 │ Future Event    │ High Volume
    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Three Specialized Tables                       │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │ outbox_events: Hybrid (AI Response, Payments)         │  │
│  │   → Eager publish + 30s scanner fallback              │  │
│  │   → Index: (status, created_at) for fast scanning     │  │
│  │   → Cleanup: Archive after 30 days                    │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ scheduled_events: Future triggers (Subscriptions)     │  │
│  │   → Poll for scheduled_at <= NOW()                    │  │
│  │   → Index: (scheduled_at, status) for time queries    │  │
│  │   → Cleanup: Delete after execution                   │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ accumulation_buffer: Batching (Token Usage)           │  │
│  │   → No MQ, direct aggregation every 5 minutes         │  │
│  │   → Index: (user_id, created_at) for grouping         │  │
│  │   → Cleanup: Delete immediately after aggregation     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ { event_id: UUID or series }
                          │
                          ▼
                    ┌──────────┐
                    │    MQ    │
                    └─────┬────┘
                          │
                          ▼
                    ┌──────────┐
                    │ Consumer │
                    └──────────┘
```

Even in the worst case (MQ failure, process crash, network partition), all events eventually get processed. The database transaction ensures events are never lost.

Since consumers fetch events by ID and check status, duplicate deliveries are naturally handled. This is critical when the scanner republishes events that were actually already sent.

And, since there is no need for complex CDC infrastructure, maintenance is quite easy.

The key insight is **different event types need different storage strategies**.

**database schema design decisions:**
- `outbox_events`: No `scheduled_at` column (not needed)
- `scheduled_events`: Requires `scheduled_at` for future triggers
- `accumulation_buffer`: Minimal schema, uses `BIGSERIAL` for fast inserts, no status field needed. Just delete it after processing instead.

### Hybrid Events (Hot Path): AI Response Persistence

When a user sends a message, the AI response is initially cached in Redis for instant retrieval. We need to persist it to PostgreSQL for:
- Long-term storage and search
- Analytics and training data
- Audit trails

This is **latency-sensitive** but not critical. If eager publish fails, a 30-second delay is acceptable.

```rust
async fn save_ai_response(
    pool: &PgPool,
    mq: &MessageQueue,
    response: AiResponse,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    // do something here, then publish the event
    let event = sqlx::query_as!(
        OutboxEvent,
        r#"
        INSERT INTO outbox_events (event_type, payload, status)
        VALUES ($1, $2, $3)
        RETURNING id, event_type, payload, status, created_at, sent_at, processed_at
        "#,
        "ai_response_ready",
        sqlx::types::Json(EventPayload::AiResponseReady { /* ... */ }) as _,
        EventStatus::Pending as EventStatus,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    
    // Eager publish after the commit (non-blocking)
    let event_id = event.id;
    let mq = mq.clone();
    tokio::spawn(async move {
        if let Err(e) = eager_publish(&mq, event_id).await {
            tracing::warn!("Eager publish failed for AI response: {:?}", e);
            // Scanner will catch it within 30 seconds
        }
    });
    
    Ok(())
}
```

**Why hybrid here?** Most AI responses need quick persistence for analytics dashboards showing real-time usage. The eager publish ensures sub-second latency 99% of the time, while the scanner guarantees eventual consistency.

### Scheduled Events (Cold Path): Subscription Expiry

Subscriptions expire at known future times. There's **no need for eager publishing**—just poll for due events.

```rust
async fn create_subscription(
    pool: &PgPool,
    user_id: Uuid,
    plan: SubscriptionPlan,
    duration_days: i32,
) -> Result<Subscription> {
    let mut tx = pool.begin().await?;
    
    let expires_at = Utc::now() + Duration::days(duration_days as i64);
    
    // Create subscription
    let subscription = sqlx::query_as!(
        Subscription,
        "INSERT INTO subscriptions (user_id, plan, expires_at, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
        user_id,
        plan as SubscriptionPlan,
        expires_at,
        SubscriptionStatus::Active as SubscriptionStatus,
    )
    .fetch_one(&mut *tx)
    .await?;
    
    // Schedule expiry event in dedicated table
    sqlx::query!(
        r#"
        INSERT INTO scheduled_events (event_type, payload, scheduled_at, status)
        VALUES ($1, $2, $3, $4)
        "#,
        "subscription_expiry",
        ScheduledEventPayload::SubscriptionExpiry{ /* ... */ },
        expires_at,
        EventStatus::Pending as EventStatus,
    )
    .execute(&mut *tx)
    .await?;
    
    tx.commit().await?;
    
    Ok(subscription)
}

// Scanner runs every minute, checks for due subscriptions
async fn scan_scheduled_events(pool: &PgPool, mq: &MessageQueue) -> Result<()> {
    let now = Utc::now();
    
    let due_events = sqlx::query_as!(
        ScheduledEvent,
        r#"
        SELECT id, event_type, payload, scheduled_at,
               status as "status: EventStatus", sent_at, processed_at
        FROM scheduled_events
        WHERE status = $1 AND scheduled_at <= $2
        LIMIT 100
        "#,
        EventStatus::Pending as EventStatus,
        now,
    )
    .fetch_all(pool)
    .await?;
    
    for event in due_events {
        publish_scheduled_event(pool, mq, event.id)?;
    }
    
    Ok(())
}

// Consumer: Handle subscription expiry
async fn handle_subscription_expiry(
    pool: &PgPool,
    event: OutboxEvent,
) -> Result<()> {
    let payload: EventPayload = serde_json::from_value(event.payload)?;
    
    if let EventPayload::SubscriptionExpiry { subscription_id, user_id } = payload {
        // Update subscription status
        sqlx::query!(
            "UPDATE subscriptions SET status = $1 WHERE id = $2",
            SubscriptionStatus::Expired as SubscriptionStatus,
            subscription_id,
        )
        .execute(pool)
        .await?;
        
        // Revoke API access
        revoke_api_keys(user_id).await?;
        
        // Send notification email
        send_expiry_notification(user_id).await?;
    }
    
    Ok(())
}
```

**Why schedule-only?** Subscription expiry is **never urgent**. Whether it happens at exactly midnight or 60 seconds later doesn't matter. Polling every minute is sufficient, and we avoid the complexity of eager publishing entirely.

### Poll-Only Events (No MQ): Token Usage Accumulation

Every AI API call generates token usage. Tracking this in real-time would overwhelm the system with millions of events per day. Instead, we **accumulate usage locally and batch-update periodically**.

```rust
// Background job runs every 5 minutes
async fn accumulate_token_usage(pool: &PgPool) -> Result<()> {
    // Find all pending token usage from accumulation buffer
    let usage_records = sqlx::query!(
        r#"
        SELECT id, user_id, tokens, model, created_at
        FROM accumulation_buffer
        LIMIT 10000
        "#,
    )
    .fetch_all(pool)
    .await?;
    
    if usage_records.is_empty() {
        return Ok(());
    }
    
    // Group by user_id and sum tokens
    let mut usage_by_user: HashMap<Uuid, i32> = HashMap::new();
    for record in &usage_records {
        *usage_by_user.entry(record.user_id).or_insert(0) += record.tokens;
    }
    
    // Batch update user quotas
    let mut tx = pool.begin().await?;
    // do something here
    tx.commit().await?;
    
    tracing::info!(
        "Accumulated {} token usage records for {} users",
        usage_records.len(),
        usage_by_user.len()
    );
    
    Ok(())
}

// Run accumulator periodically
async fn run_token_accumulator(pool: PgPool) {
    let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
    
    loop {
        interval.tick().await;
        
        if let Err(e) = accumulate_token_usage(&pool).await {
            tracing::error!("Token accumulator error: {:?}", e);
        }
    }
}
```

**Why poll-only?** Token usage tracking is:
- **Not latency-sensitive**: Users check their quota in dashboards, not real-time
- **High volume**: Millions of tiny events per day
- **Naturally batched**: Accumulating every 5 minutes is perfectly fine

Using MQ here would be wasteful. The `accumulation_buffer` table acts as a **simple batching mechanism**, and periodic polling aggregates efficiently.

### Choose the Right Tool

```txt
Should this event use outbox_events, scheduled_events, or accumulation_buffer?

├─ Known future execution time? 
│  └─ YES → scheduled_events
│  
├─ High volume (>1000/sec) + aggregatable?
│  └─ YES → accumulation_buffer
│  
└─ Needs low latency delivery?
   ├─ YES → outbox_events (hybrid)
   └─ NO → classic_outbox (poll-only)
```

| Use Case | Table | Pattern | Latency | Why |
|----------|-------|---------|---------|-----|
| AI Response Sync | `outbox_events` | Hybrid (eager + scanner) | <1s (99%), <30s (99.99%) | User-facing analytics need speed |
| Payment Processing | `outbox_events` | Hybrid (eager + scanner) | <1s (99%), <30s (99.99%) | Service activation should be quick |
| Subscription Expiry | `scheduled_events` | Scheduled (poll-only) | ~60s | Exact timing doesn't matter |
| Token Usage | `accumulation_buffer` | Poll-only (no MQ) | ~5 min | High volume, not time-sensitive |

## Why and Why Not

### Why Not One Table?

Using three dedicated tables provides significant architectural benefits that a single unified table cannot match:

**1. Optimized Indexes**
- `outbox_events`: Index on `(status, created_at)` for fast scanning of recent failures
- `scheduled_events`: Index on `(scheduled_at, status)` for efficient time-based queries
- `accumulation_buffer`: Index on `(user_id, created_at)` for fast grouping during aggregation

A single table would require multiple indexes covering different access patterns, causing index bloat and slower writes.

**2. Independent Cleanup Strategies**
- `outbox_events`: Archive after 30 days (audit trail)
- `scheduled_events`: Delete immediately after execution (no historical value)
- `accumulation_buffer`: Delete after aggregation (already in `users.tokens_used`)

This prevents the table from growing indefinitely and keeps query performance consistent.

**3. Isolated Performance Characteristics**
- High-volume token usage writes don't block latency-sensitive AI response events
- Scheduled event scans don't interfere with outbox scanner performance
- Each table can be tuned independently (vacuum settings, autovacuum thresholds)

**4. Clear Operational Boundaries**
Different teams or services can own different tables:
- Payment team: `outbox_events` (critical path)
- Subscription team: `scheduled_events` (background jobs)
- Analytics team: `accumulation_buffer` (data pipeline)

### Why Only Pass the Event ID?

By only publishing event IDs to the message queue instead of full payloads (also known as [claim check](https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check)), we gain several advantages:

**1. Reduced Message Queue Load**
- Tiny messages (just a UUID) vs potentially large event payloads
- Lower network bandwidth usage between MQ and consumers
- MQ can handle significantly higher throughput with smaller messages

**2. Avoids Message Size Limits**
- Most message queues have size limits (e.g., RabbitMQ 128MB default, SQS 256KB)
- AI responses with embeddings or large context can exceed these limits
- Event payloads are unlimited in PostgreSQL

**3. Single Source of Truth**
- Event data lives only in the database, not duplicated in MQ
- Updates to event processing logic can query the latest data
- No stale payload issues when consumers are slow

**4. Better Resource Utilization**
- Database optimized for storing structured data with indexes
- Message queue optimized for fast delivery, not storage
- Each system does what it's best at

**5. Simplified Debugging**
- Query database directly to inspect event details
- No need to capture messages from MQ for investigation
- Event history preserved independently of MQ retention

The trade-off is an additional database query per event in the consumer, but for our use case with thousands (not millions) of events per second, this is negligible compared to the benefits.

## Trade-offs and Considerations

### Potential Duplicate Deliveries
If eager publishing succeeds but updating the status fails, the scanner will republish. Your consumers **must be idempotent**. For the AI chat platform:
- AI response sync: Check if `content` is already set before updating
- Payment processing: Use payment gateway's idempotency keys
- Token accumulation: Naturally idempotent (already aggregated by ID)

### Additional Database Load
Every hybrid consumer must query the database to fetch event details. For high throughput:
- Use read replicas for consumer queries
- Add connection pooling (e.g., pgBouncer)
- Cache frequently accessed events in Redis

**What three tables helps here:**
- Each table is smaller = better cache hit rates
- Scanners don't compete on the same indexes
- Write-heavy `accumulation_buffer` doesn't block reads on `outbox_events`

### Event Cleanup Strategy
Each table has its own cleanup strategy based on its purpose:

- Cleanup for outbox_events: Archive after 30 days (audit trail)
- Cleanup for scheduled_events: Delete immediately after execution
- Cleanup for accumulation_buffer: Delete after aggregation (see above). This happens inline during the accumulation process.

**Benefits of table-specific cleanup:**
- No "one size fits all" retention policy compromises
- Smaller tables = faster queries and better vacuum performance
- Clear data lifecycle management per use case

### Scanner Interval Tuning
The 30-second backlog threshold and 5-minute token accumulation intervals are design choices. Tune based on your requirements:

| Table | Scanner Type | Interval | Rationale |
|-------|-------------|----------|-----------|
| `outbox_events` | Hybrid backlog scanner | 30-60s | Balance between latency and database load |
| `scheduled_events` | Scheduled event scanner | 1 min | Subscription expiry doesn't need sub-minute precision |
| `accumulation_buffer` | Token accumulator | 5-10 min | High volume, users check quotas infrequently |

**Pro tip**: Start with longer intervals and decrease based on actual user needs. Premature optimization wastes resources.

## Rust Make This Pattern Better

Beyond the code examples above, Rust provides unique advantages for this architecture:

### Type-Safe Schema and Event State

Use strong typing for event payloads with `serde` eliminate all kinds of serialization and deserialization vulnerability while also enable a graceful way with ADT and pattern matching to handle enumerate data.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "event_status", rename_all = "lowercase")]
pub enum EventStatus {
    Pending,    // Awaiting delivery
    Processed,  // Consumer completed
    Failed,     // Permanent failure
}
```

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "event_name")]
pub enum EventPayload {
    AiResponseReady {
        conversation_id: Uuid,
        message_id: Uuid,
        redis_key: String,
        provider: AiProvider,
        model: String,
        tokens_used: i32,
    },
    PaymentCompleted {
        user_id: Uuid,
        payment_id: Uuid,
        plan: SubscriptionPlan,
        amount: Decimal,
    },
    // ... other hybrid events
}
```

```rust
#[derive(Debug, sqlx::FromRow)]
pub struct OutboxEvent {
    pub id: Uuid,
    pub event_type: String,
    pub payload: sqlx::types::Json<EventPayload>,
    pub status: EventStatus,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ScheduledEvent {
    // ...
}

#[derive(Debug, sqlx::FromRow)]
pub struct AccumulationRecord {
    // ...
}
```

### Compile-Time Database Schema Validation

This is the killer feature. When you run `cargo build`, sqlx:
1. Connects to your development database
2. Validates every query against the actual schema
3. Generates type-safe Rust structs
4. Catches mismatches before deployment

```
$ cargo sqlx prepare
Connecting to database...
Building query metadata for 94 queries...
Successfully saved query metadata to .sqlx/

$ cargo build
   Compiling outbox-service v0.1.0
    Finished dev [unoptimized + debuginfo] target(s) in 1.14s
```

If you change the database schema, queries break at compile time:
```
$ cargo build
error: error returned from database: column "scheduled_for" does not exist
  --> src/scanner.rs:23:5
```

This eliminates an entire class of production bugs.

## When to Use This Pattern

**Great fit when you have:**
- Mixed latency requirements across different event types
- High-volume events that don't need MQ overhead
- Time-based events with known schedules
- Need for auditability and event replay
- Rust/TypeScript stack with strong typing requirements

**Not ideal when:**
- All events have identical requirements (use simpler CDC or pure polling)
- You need cross-datacenter replication (consider event streaming platforms)
- Events are truly ephemeral with no persistence needs
- Your team lacks operational capacity for managing scanners
