---
title: 'Redis Patterns Beyond a Cache'
description: 'Redis earns its keep in a stack long after the cache layer is done: distributed locks, streams as a durable queue, and a token bucket that survives a restart.'
pubDate: 2024-10-12
tags: ['redis', 'backend']
---

Most services reach for Redis once, for a cache, and never open the docs
again. That's a shame, because the same in-memory data structure server
with sub-millisecond latency is sitting there doing four other jobs a lot
of stacks pay for separately: a lock, a queue, a rate limiter, and a
pub/sub bus. None of it needs a new piece of infrastructure — just a
different data type on the connection you already have.

## A lock that expires even if you crash

The naive distributed lock — `SET key value NX` to acquire, `DEL key` to
release — has one bad failure mode: if the process holding the lock
crashes before releasing it, the lock is held forever and every other
worker deadlocks behind it.

```python
import redis
import uuid

r = redis.Redis()

def acquire_lock(name: str, ttl_ms: int = 10_000) -> str | None:
    token = str(uuid.uuid4())
    acquired = r.set(f"lock:{name}", token, nx=True, px=ttl_ms)
    return token if acquired else None
```

The `px` TTL is what makes this safe to crash under — the lock releases
itself even if nobody calls unlock. Releasing correctly needs one more
step: only delete the key if it still holds *your* token, so a lock you
already lost to expiry (and someone else has since acquired) doesn't get
yanked out from under its new owner. That has to be atomic, so it's a
small Lua script rather than a check-then-delete from Python:

```python
RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""

def release_lock(name: str, token: str) -> bool:
    return bool(r.eval(RELEASE_SCRIPT, 1, f"lock:{name}", token))
```

## Streams as a durable queue with consumer groups

`LPUSH`/`BRPOP` makes a workable queue, but a message popped off a list is
gone the instant it's read — if the worker crashes mid-processing, that
job is just lost. `XADD`/`XREADGROUP` gives you the queue plus an
acknowledgment step, so an unacknowledged message stays claimable by
another worker:

```python
# producer
r.xadd("jobs", {"url": "https://example.com/page/42"})

# consumer, in a group so multiple workers split the stream
r.xgroup_create("jobs", "workers", id="0", mkstream=True)

def consume():
    while True:
        resp = r.xreadgroup("workers", "worker-1", {"jobs": ">"}, count=10, block=5000)
        for stream, messages in resp or []:
            for msg_id, fields in messages:
                process(fields)
                r.xack("jobs", "workers", msg_id)   # only now is it "done"
```

Anything read but never `XACK`'d shows up in `XPENDING` — that's your
built-in dead-letter inspection, no separate table for "jobs that failed
partway through" required.

## A token bucket rate limiter that survives a restart

An in-process rate limiter (a dict of counters in memory) resets every
time the process restarts and doesn't coordinate across more than one
process anyway. Redis fixes both, and a Lua script keeps the
check-and-decrement atomic under concurrent callers:

```python
TOKEN_BUCKET = """
local key, rate, capacity, now = KEYS[1], tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local bucket = redis.call("hmget", key, "tokens", "ts")
local tokens = tonumber(bucket[1]) or capacity
local ts = tonumber(bucket[2]) or now

tokens = math.min(capacity, tokens + (now - ts) * rate)
if tokens < 1 then
    return 0
end

redis.call("hmset", key, "tokens", tokens - 1, "ts", now)
redis.call("expire", key, 60)
return 1
"""

def allow_request(client_id: str, rate: float = 5.0, capacity: int = 20) -> bool:
    now = time.time()
    return bool(r.eval(TOKEN_BUCKET, 1, f"bucket:{client_id}", rate, capacity, now))
```

The bucket refills continuously based on elapsed time rather than resetting
on a fixed clock tick, which avoids the thundering-herd pattern of
every client's quota resetting at the same second.

## What ties these together

None of it is exotic — a lock is a key with a TTL, a queue is a stream
with acknowledgment, a rate limiter is a counter with a decay function.
What Redis actually buys you is atomicity for cheap: every one of these
patterns needs a check-then-act step to not race under concurrency, and
`SET NX`, `XACK`, and `EVAL` give you that without standing up ZooKeeper
or a second database just to get a mutex. If a pattern needs "atomic
read, decide, write" and you're already paying for Redis as a cache,
you're usually one script away from not needing anything else.
