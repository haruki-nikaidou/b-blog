---
title: "A Hybrid Transactional Outbox Event Delivery Pattern"
description: 'This article presents a hybrid event delivery pattern that combines three strategies within a single outbox table: eager publishing with fallback scanning for latency-sensitive events, scheduled polling for time-based events, and simple polling for high-volume aggregations.'
tags:
  - Distributed System
  - Coding
pubDate: 'Oct 5 2025'
heroImageId: 'ddf2d009-5622-4e40-fc9a-f84aacbe0f00'
draft: true
---

## The Problem: Reliable Event Publishing is Hard

In distributed systems, publishing events reliably is deceptively difficult. You need to atomically:
1. Update your database
2. Publish an event to a message queue

But these are two separate systems. What happens when your database transaction succeeds but the message queue is down? You lose events. What if the message publishes but the database rolls back? You get phantom events.

This is the **dual-write problem**, and it's the bane of event-driven architectures.

## Real-World Example: Multi-Provider AI Chat Platform

Let's ground this in a concrete example: building a chat platform that supports multiple AI providers (OpenAI, Anthropic, Google, etc.). This system needs to handle:

- **User subscriptions** that expire at specific times
- **Token usage tracking** across millions of API calls
- **Payment processing** that triggers service activation
- **AI responses** cached in Redis that need eventual persistence

Each of these has different consistency and latency requirements, making it a perfect case study for our hybrid pattern.

## Transactional Outbox

The Transactional Outbox pattern solves this by:
1. Writing events to an outbox table within the same database transaction
2. A separate process reads the outbox and publishes to the message queue
3. Events are marked as published after successful delivery

This works, but it comes with trade-offs:
- **Polling adds latency**: Checking the database every few seconds delays event delivery
- **Change Data Capture is complex**: Real-time CDC solutions like Debezium are powerful but add operational overhead
- **Large payloads in MQ**: Full event data flows through the message queue

## A Better Approach: Hybrid Outbox with Claim Check

In a production AI chat platform, I implemented a hybrid pattern that combines the reliability of the Transactional Outbox with the performance of eager publishing. The key insight: **different event types have different requirements**.

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Chat Service                        │
└───┬─────────────┬─────────────┬──────────────┬──────────────┘
    │             │             │              │
    │ 1. Write    │ 2. Eager    │ 3. Schedule  │ 4. Poll-only
    │ Transaction │ Publish     │ Future Event │ Events
    ▼             ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Outbox Table                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Hybrid Events: AI Response Sync, Payment Processing  │   │
│  │   → Eager publish + 30s scanner fallback             │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Scheduled Events: Subscription Expiry                │   │
│  │   → Only polling, no eager publish                   │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Poll-Only Events: Token Usage Accumulation           │   │
│  │   → Simple polling every 5 minutes, no MQ at all     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
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

The beauty of this pattern is **choosing the right delivery mechanism for each use case**.

### Hybrid Events (Hot Path): AI Response Persistence

When a user sends a message, the AI response is initially cached in Redis for instant retrieval. We need to persist it to PostgreSQL for:
- Long-term storage and search
- Analytics and training data
- Audit trails

This is **latency-sensitive** but not critical—if eager publish fails, a 30-second delay is acceptable.

```rust
#[derive(Debug, Serialize, Deserialize)]
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

async fn save_ai_response(
    pool: &PgPool,
    mq: &MessageQueue,
    response: AiResponse,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    
    // Store response metadata in database
    sqlx::query!(
        "INSERT INTO messages (id, conversation_id, role, created_at) 
         VALUES ($1, $2, $3, NOW())",
        response.message_id,
        response.conversation_id,
        "assistant",
    )
    .execute(&mut *tx)
    .await?;
    
    // Cache full response in Redis (fast, temporary)
    redis_client.set_ex(
        &response.redis_key,
        &response.content,
        3600, // 1 hour TTL
    ).await?;
    
    // Create outbox event for persistence
    let event = sqlx::query_as!(
        OutboxEvent,
        r#"
        INSERT INTO outbox (event_type, payload, status)
        VALUES ($1, $2, $3)
        RETURNING id, event_type, payload, status as "status: EventStatus",
                  created_at, scheduled_at, sent_at, processed_at
        "#,
        "ai_response_ready",
        json!({
            "conversation_id": response.conversation_id,
            "message_id": response.message_id,
            "redis_key": response.redis_key,
            "provider": response.provider,
            "model": response.model,
            "tokens_used": response.tokens_used,
        }),
        EventStatus::Pending as EventStatus,
    )
    .fetch_one(&mut *tx)
    .await?;
    
    tx.commit().await?;
    
    // Eager publish (non-blocking)
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

// Consumer: Sync Redis to PostgreSQL
async fn handle_ai_response_event(
    pool: &PgPool,
    redis: &RedisClient,
    event: OutboxEvent,
) -> Result<()> {
    let payload: EventPayload = serde_json::from_value(event.payload)?;
    
    if let EventPayload::AiResponseReady { 
        message_id, 
        redis_key, 
        tokens_used,
        .. 
    } = payload {
        // Fetch full content from Redis
        let content: Option<String> = redis.get(&redis_key).await?;
        
        let content = match content {
            Some(c) => c,
            None => {
                tracing::warn!("Redis key expired: {}", redis_key);
                // Could fetch from backup or skip
                return Ok(());
            }
        };
        
        // Persist to PostgreSQL
        sqlx::query!(
            "UPDATE messages SET content = $1, tokens_used = $2 WHERE id = $3",
            content,
            tokens_used,
            message_id,
        )
        .execute(pool)
        .await?;
        
        // Clean up Redis (optional, TTL will handle it)
        redis.del(&redis_key).await?;
    }
    
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
    
    // Schedule expiry event
    sqlx::query!(
        r#"
        INSERT INTO outbox (event_type, payload, status, scheduled_at)
        VALUES ($1, $2, $3, $4)
        "#,
        "subscription_expiry",
        json!({
            "subscription_id": subscription.id,
            "user_id": user_id,
        }),
        EventStatus::Scheduled as EventStatus,
        expires_at,
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
        OutboxEvent,
        r#"
        SELECT id, event_type, payload, status as "status: EventStatus",
               created_at, scheduled_at, sent_at, processed_at
        FROM outbox
        WHERE status = $1 AND scheduled_at <= $2
        LIMIT 100
        "#,
        EventStatus::Scheduled as EventStatus,
        now,
    )
    .fetch_all(pool)
    .await?;
    
    for event in due_events {
        publish_event(pool, mq, event.id).await?;
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
// Don't even use MQ for this - just polling!
async fn record_token_usage(
    pool: &PgPool,
    user_id: Uuid,
    tokens: i32,
    model: String,
) -> Result<()> {
    // Simple insert, no event publishing
    sqlx::query!(
        r#"
        INSERT INTO outbox (event_type, payload, status)
        VALUES ($1, $2, $3)
        "#,
        "token_usage",
        json!({
            "user_id": user_id,
            "tokens": tokens,
            "model": model,
            "recorded_at": Utc::now(),
        }),
        EventStatus::Pending as EventStatus,
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

// Background job runs every 5 minutes
async fn accumulate_token_usage(pool: &PgPool) -> Result<()> {
    // Find all pending token usage events
    let usage_events = sqlx::query_as!(
        OutboxEvent,
        r#"
        SELECT id, event_type, payload, status as "status: EventStatus",
               created_at, scheduled_at, sent_at, processed_at
        FROM outbox
        WHERE event_type = 'token_usage' AND status = $1
        LIMIT 10000
        "#,
        EventStatus::Pending as EventStatus,
    )
    .fetch_all(pool)
    .await?;
    
    if usage_events.is_empty() {
        return Ok(());
    }
    
    // Group by user_id and sum tokens
    use std::collections::HashMap;
    let mut usage_by_user: HashMap<Uuid, i32> = HashMap::new();
    
    for event in &usage_events {
        if let Ok(payload) = serde_json::from_value::<serde_json::Value>(event.payload.clone()) {
            if let (Some(user_id), Some(tokens)) = (
                payload.get("user_id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()),
                payload.get("tokens").and_then(|v| v.as_i64()),
            ) {
                *usage_by_user.entry(user_id).or_insert(0) += tokens as i32;
            }
        }
    }
    
    // Batch update user quotas
    let mut tx = pool.begin().await?;
    
    for (user_id, total_tokens) in usage_by_user {
        sqlx::query!(
            "UPDATE users SET tokens_used = tokens_used + $1 WHERE id = $2",
            total_tokens,
            user_id,
        )
        .execute(&mut *tx)
        .await?;
    }
    
    // Mark all events as processed
    let event_ids: Vec<Uuid> = usage_events.iter().map(|e| e.id).collect();
    sqlx::query!(
        r#"
        UPDATE outbox 
        SET status = $1, processed_at = NOW() 
        WHERE id = ANY($2)
        "#,
        EventStatus::Processed as EventStatus,
        &event_ids,
    )
    .execute(&mut *tx)
    .await?;
    
    tx.commit().await?;
    
    tracing::info!(
        "Accumulated {} token usage events for {} users",
        usage_events.len(),
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

Using MQ here would be wasteful. The outbox table acts as a **simple accumulator buffer**, and periodic polling aggregates efficiently.

### Summary: Choose the Right Tool

| Use Case | Pattern | Latency | Why |
|----------|---------|---------|-----|
| AI Response Sync | Hybrid (eager + scanner) | <1s (99%), <30s (100%) | User-facing analytics need speed |
| Payment Processing | Hybrid (eager + scanner) | <1s (99%), <30s (100%) | Service activation should be quick |
| Subscription Expiry | Scheduled (poll-only) | ~60s | Exact timing doesn't matter |
| Token Usage | Poll-only (no MQ) | ~5 min | High volume, not time-sensitive |

## Why This Design Works

Different events have different requirements. The hybrid approach lets you choose the right delivery mechanism:
- **Hybrid delivery** for user-facing features that benefit from low latency
- **Scheduled polling** for time-based events with known trigger times  
- **Simple polling** for high-volume, latency-insensitive aggregations

Even in the worst case (MQ failure, process crash, network partition), all events eventually get processed. The database transaction ensures events are never lost.

Since consumers fetch events by ID and check status, duplicate deliveries are naturally handled. This is critical when the scanner republishes events that were actually already sent.

And, since there is no need for complex CDC infrastructure, maintenance is quite easy.

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
- Consider partitioning the outbox table by event_type

### Event Cleanup Strategy
Old events accumulate and slow down queries. Implement retention policies:

```rust
// Archive processed events older than 30 days
sqlx::query!(
    r#"
    DELETE FROM outbox
    WHERE status = $1 
      AND processed_at < NOW() - INTERVAL '30 days'
    "#,
    EventStatus::Processed as EventStatus,
)
.execute(pool)
.await?;

// For token usage, clean up immediately after aggregation
// (they're already aggregated into user quotas)
```

For high-volume systems like token tracking, consider:
- Cleaning up poll-only events immediately after processing
- Using separate tables for different event types
- Archiving to cheaper storage (S3, cold database)

### Scanner Interval Tuning
The 30-second backlog threshold and 5-minute token accumulation intervals are design choices. Tune based on your requirements:

| Event Type | Interval | Rationale |
|------------|----------|-----------|
| Hybrid backlog scanner | 30-60s | Balance between latency and database load |
| Scheduled event scanner | 1 min | Subscription expiry doesn't need sub-minute precision |
| Token accumulator | 5-10 min | High volume, users check quotas infrequently |

**Pro tip**: Start with longer intervals and decrease based on actual user needs. Premature optimization wastes resources.

## Why Rust Makes This Pattern Better

Beyond the code examples above, Rust provides unique advantages for this architecture:

### Compile-Time Database Schema Validation

This is the killer feature. When you run `cargo build`, sqlx:
1. Connects to your development database
2. Validates every query against the actual schema
3. Generates type-safe Rust structs
4. Catches mismatches before deployment

```bash
$ cargo sqlx prepare
Connecting to database...
Building query metadata for 47 queries...
Successfully saved query metadata to .sqlx/

$ cargo build
   Compiling outbox-service v0.1.0
    Finished dev [unoptimized + debuginfo] target(s) in 3.42s
```

If you change the database schema, queries break at compile time:
```bash
$ cargo build
error: error returned from database: column "scheduled_for" does not exist
  --> src/scanner.rs:23:5
```

This eliminates an entire class of production bugs.

### Type-Safe Schema and Event State

Use strong typing for event payloads with `serde` eliminate all kinds of serialization and deserialization vulnerability while also enable a graceful way with ADT and pattern matching to handle enumerate data.

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "event_status", rename_all = "lowercase")]
pub enum EventStatus {
    Pending,    // Awaiting delivery
    Scheduled,  // Future-dated event
    Sent,       // Published to MQ
    Processed,  // Consumer completed
    Failed,     // Permanent failure
}
```

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventPayload {
    OrderCreated {
        order_id: Uuid,
        user_id: Uuid,
        total_amount: Decimal,
    },
    PaymentProcessed {
        payment_id: Uuid,
        order_id: Uuid,
        amount: Decimal,
    },
    ShipmentDispatched {
        shipment_id: Uuid,
        order_id: Uuid,
        tracking_number: String,
    },
}

// Store as JSONB in PostgreSQL
#[derive(Debug, sqlx::FromRow)]
pub struct OutboxEvent {
    pub id: Uuid,
    pub event_type: String,
    pub payload: sqlx::types::Json<EventPayload>,
    pub status: EventStatus,
    pub created_at: DateTime<Utc>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub sent_at: Option<DateTime<Utc>>,
    pub processed_at: Option<DateTime<Utc>>,
}
```

### When to Use This Pattern

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

### Further Reading

- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html) - Chris Richardson's original pattern description
- [Claim Check Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check) - Enterprise Integration Patterns
- [sqlx Documentation](https://github.com/launchbadge/sqlx) - Compile-time SQL verification in Rust
- [Designing Data-Intensive Applications](https://www.amazon.com/Designing-Data-Intensive-Applications-Reliable-Maintainable/dp/1449373321) - Deep dive into consistency patterns