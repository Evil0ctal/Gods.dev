---
title: 'A Distributed Crawler with Redis as the Spine'
description: 'Four Redis data structures — a list for the frontier, a set for dedup, a sorted set for scheduling, a hash for state — coordinate a crawler across machines without a message broker in sight.'
pubDate: 2022-08-24
tags: ['scraping', 'redis', 'python']
---

The moment a crawler outgrows one machine, the interesting problem stops
being "how do I fetch faster" and becomes "how do multiple processes
agree on what's left to do without stepping on each other." I've built
this twice with a message broker (RabbitMQ once, SQS once) and both times
it was more infrastructure than the problem needed. The version that's
stuck is four Redis data structures doing the whole job — no separate
broker, no coordinator process, just primitives that happen to be exactly
shaped like the problem.

## The frontier is a list, and BLPOP is the whole coordination story

The frontier — URLs discovered but not yet fetched — is just a Redis
list, pushed to with `RPUSH` and popped from with `BLPOP`, which blocks
until an item's available instead of polling.

```python
import redis.asyncio as redis

r = redis.Redis(host="localhost", decode_responses=True)

async def enqueue(url: str):
    await r.rpush("frontier", url)

async def worker(client):
    while True:
        _, url = await r.blpop("frontier")
        html = await client.get(url)
        for link in extract_links(html):
            await maybe_enqueue(link)
```

Every worker on every machine calls `BLPOP` against the same key. Redis
guarantees each pushed item goes to exactly one blocked caller — that
guarantee is the entire distributed-coordination story. No leader
election, no partitioning scheme, no worker needs to know another worker
exists.

## Dedup: a set, until it's too big to be a set

Before enqueueing a discovered URL, you need to know if you've seen it.
A Redis `SET` with `SADD` returning whether the element was new is the
obvious answer:

```python
async def maybe_enqueue(url: str):
    normalized = normalize_url(url)  # strip tracking params, sort query, lowercase host
    is_new = await r.sadd("seen", normalized)
    if is_new:
        await r.rpush("frontier", normalized)
```

`SADD` is atomic — two workers racing to enqueue the same URL at the same
instant still only get one `RPUSH`, because the set membership check and
insert happen as one operation on the Redis side. That atomicity is
worth more than it looks: it's the difference between "dedup" and
"dedup, usually."

The catch is memory. A `SET` holding hashes or full URLs for tens of
millions of pages gets expensive — full strings cost real bytes, and
Redis is keeping it all in RAM. Past a few million URLs I'd reach for a
Redis-backed Bloom filter (`BF.ADD`/`BF.EXISTS` via the RedisBloom
module) instead: fixed memory regardless of scale, at the cost of a
small, tunable false-positive rate — you'll occasionally skip a URL you
hadn't actually seen. For most crawls, missing a fraction of a percent of
pages is a fine trade for not running out of memory.

## Politeness needs a schedule, not just a queue

A plain list has no notion of *when*. If you want to enforce "no more
than one request per host every 2 seconds" across a fleet of workers
that don't otherwise talk to each other, a sorted set keyed by
ready-time does it:

```python
import time

async def enqueue_scheduled(url: str, host: str, delay: float = 2.0):
    ready_at = await r.zscore("host_ready", host) or 0
    next_ready = max(ready_at, time.time()) + delay
    await r.zadd("host_ready", {host: next_ready})
    await r.zadd("scheduled", {url: next_ready})

async def due_urls(limit=50):
    now = time.time()
    urls = await r.zrangebyscore("scheduled", 0, now, start=0, num=limit)
    if urls:
        await r.zrem("scheduled", *urls)
    return urls
```

`host_ready` tracks the next allowed request time per host; `scheduled`
tracks when each queued URL becomes fetchable. Workers poll
`due_urls()`, and because the score computation reads and writes through
Redis, every worker on every machine respects the same per-host pacing
without a coordinator.

## State lives in a hash, so a crashed worker isn't a lost job

The last piece: a worker dies mid-fetch (OOM-killed, deploy restart,
network partition) and the URL it `BLPOP`'d is just gone — Redis already
handed it off and forgot about it. A `HASH` tracking in-flight jobs with
a timestamp, swept by a periodic requeue job, catches that:

```python
async def claim(url: str):
    await r.hset("inflight", url, time.time())

async def requeue_stale(timeout=120):
    now = time.time()
    stale = [u for u, t in (await r.hgetall("inflight")).items()
             if now - float(t) > timeout]
    for url in stale:
        await r.hdel("inflight", url)
        await r.rpush("frontier", url)
```

## What I learned

Four structures, four jobs: `LIST` for the frontier because `BLPOP` gives
you free distributed coordination, `SET` (or a Bloom filter past a few
million URLs) for dedup because `SADD`'s atomicity is the correctness
guarantee, `ZSET` for scheduling because a schedule is fundamentally
"sorted by ready-time," and `HASH` for in-flight tracking because
crash-safety needs an expiry sweep somewhere. None of it needed a message
broker — Redis's primitives already have the right shape, and reaching
for RabbitMQ before checking that felt, in hindsight, like bringing a
crane to move a box I could carry.
