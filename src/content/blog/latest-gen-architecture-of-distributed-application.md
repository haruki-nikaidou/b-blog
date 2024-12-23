---
title: 'Latest Architecture of Distributed Application'
description: "A modern architecture based on NATS I using in production. It's excellent for middle to large projects."
pinned: true
pubDate: 'Dec 23 2024'
heroImage: 'https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/5ebd2649-12d9-4b1f-6684-0477f1215300/small'
---

Several months ago, I found an amazing message bus named [NATS](https://nats.io/). NATS has some amazing features superior than RabbitMQ or Apache Kafka:

- RPC support: [NATS Service](https://www.youtube.com/watch?v=AiUazlrtgyU&t=449s&pp=ygUMTkFUUyBzZXJ2aWNl). It's look like RabbitMQ's RPC, but it is easier to configure.
- Streaming: [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream). It's like other message queues or Kafka, but it has many fancy features which are commonly used but other MQ don't provide.
- KV Database: [NATS JetStream KV Store](https://docs.nats.io/nats-concepts/jetstream/key-value-store). An alternative of Redis. Unlike in Redis you need to implement distributed lock manually, and scale the Redis painfully, in NATS KV Store, scaling is automated, and it provides out of box version control for some situation like distributed lock.
- Ephemeral Object Storage: [NATS JetStream Object Store](https://docs.nats.io/nats-concepts/jetstream/obj_store). Better than use durable object storage like S3 to store ephemeral data. 

## Avoiding Common Misuse

Many junior developers misuse distributed infrastructure especially redis. 

1. **Do not** use RPC **inside** application. Check [RabbitMQ document](https://www.rabbitmq.com/tutorials/tutorial-six-javascript#a-note-on-rpc) to know why.
2. **Redis's performance is poor**. Redis is not designed for high performance cache but for distributed system, you should **use Memcached instead**. NATS JetStream KV has same issue but more serious. If you need high performance cache, do not use them.
3. **Don't throw everything in Kubernetes.** There are many distributed infrastructure softwares you absolutely should not containerize, like Database, Redis, NATS. 
4. NATS JetStream Object Store is **ephemeral**. Though NATS is good in distributed application, you still should not use it blindly. NATS JetStream Object Store is designed for ephemeral storage, not durable storage. If you store everything in it, you are to lose your data.
5. Distributed system is **not decentralized**. Most of distributed systems, like kubernetes, is just let the workers duplicate and use a master to manage them. As more worker nodes are added, the master reaches full capacity quickly. So do not use too many workers, use master of master to manage masters instead. *OpenAI makes this mistake too.*

I'm not sure about NATS's performance in high concurrent situation, so I cannot grantee it is good in massive project. For new project who has 1k to 1m MAU, NATS is a good choice. Migrate growing small project to NATS is also a good choice for scaling. If you have more than 1M MAU, employ an expert instead of reading this blog. If you have less than 1k MAU, focus on business instead.

## Best Practice

Here is an architecture example of a SaaS (Software as a Service). 

![Architecture diagram](https://imagedelivery.net/6gszw1iux5BH0bnwjXECTQ/6337fb81-6480-4090-4c13-589eaf8c9000/public)

Frontend, containing UI and API gateway, use RPC call to communicate with others. In modern SaaS business, like [Doppler](https://www.doppler.com/), there are always dashboard for user, dashboard for admin, api gateway and marketing page. 

I use next.js, svelte-kit, flask, react icons as example. In my own production I use similar tech-stack too. 

Some senior developers may misunderstand how to use SSR (server side render). They think SSR is conflict with front-end & back-end separation and write business logic in SSR framework. They are wrong because you can write business logic in SSR framework doesn't mean you should. In this example, SSR framework only forward the request to NATS Service.

Basically every thing in frontend need a feedback, so it is very rare for the frontend to push event directly into JetStream. **For tidy code, pushing message is forbidden in frontend.**

Same thing in application. In application, using JetStream which is asynchronous is always better than using RPC which is synchronous, blocking and confusing. So, **RPC is forbidden inside application**.

Inside application, RPC handler can read and write into the database, sometimes push event to event handlers with JetStream. Event handlers always use JetStream and events to communicate with each other.

For database, if you don't have a good reason not using PostgreSQL, you should use PostgreSQL. 

An alternative for PostgreSQL in deploy is [YugabyteDB](https://www.yugabyte.com/). It is compatible with PostgreSQL, but provides features for easier deployment. 

[Prometheus](https://prometheus.io/) is a common-used time series database for metric combine with [Grafana](https://grafana.com/).

### For Smaller Projects

I know you guys only have small project with 100 MAU but still want to use there features.

Using $100 bare mental servers with kubernetes cluster sounds overkill and stupid. Here is a cheaper solution:

- Use [Synadia Cloud](https://www.synadia.com/) for NATS. It's free.
- Use [Vercel](https://vercel.com/) for SSR page, or Cloudflare Worker for static page. It's also free.
- Use [railway](https://railway.com/) for containerized application. It is the most expensive part, spending $5 per month.
- Use [Neon](https://neon.tech/), a free serverless postgresql database.

Grafana with prometheus is also free.

So, you just need $5 for your small projects per month. It is easier to manage than VPS and not expensive. 

~~Performance? You mean your garbage project need a good performance to handle the requests from 10 users?~~