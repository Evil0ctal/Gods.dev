---
title: 'Rate Limiting Your Own Endpoints'
description: 'A hosted demo with no throttle is a free proxy for whoever finds it first. A token bucket at the edge, keyed correctly, is the cheapest insurance you can buy for a public API.'
pubDate: 2025-03-26
tags: ['backend', 'security']
---

I once left a demo endpoint unthrottled for about a day. It was a small
FastAPI wrapper around a scraper, meant for people to try before
self-hosting. Within hours it was fielding thousands of requests a
minute from a handful of IPs, and my outbound bandwidth to the upstream
site looked like a denial-of-service attack I was running against
myself. Nobody was attacking me maliciously — someone had just found a
free API and pointed a script at it. That's the default outcome of any
endpoint with no rate limit: it becomes whatever the least considerate
caller wants it to be.

## The token bucket, because it matches how bursts actually behave

A fixed "N requests per minute, reset on the minute" counter has an ugly
edge case: a client can burn its whole budget in the last second of one
window and the first second of the next, giving you 2x the intended
rate for a brief moment. A token bucket avoids that by tracking
continuous capacity instead of resetting on a clock edge.

```python
import time
import threading

class TokenBucket:
    def __init__(self, rate: float, capacity: int):
        self.rate = rate          # tokens added per second
        self.capacity = capacity  # bucket size = max burst
        self.tokens = capacity
        self.last_refill = time.monotonic()
        self.lock = threading.Lock()

    def allow(self, cost: int = 1) -> bool:
        with self.lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_refill = now
            if self.tokens >= cost:
                self.tokens -= cost
                return True
            return False
```

A bucket that refills at `rate` tokens/second and holds up to `capacity`
lets a client burst up to `capacity` requests instantly, then throttles
back to the steady rate — which matches how real traffic behaves far
better than a hard reset window. Someone loading a page that fires five
requests at once isn't a bad actor; someone doing that every second,
forever, is.

## Key by the right thing, or you're limiting nobody

The bucket itself is the easy part. The part that actually matters is
what you key it on, and getting this wrong is the most common way rate
limiting fails silently.

- **By IP** is the default and it's fine until your users sit behind a
  shared NAT or corporate proxy — then one office shares one bucket and
  legitimate users start getting throttled by their coworkers.
- **By API key** is right once you have auth, because it follows the
  actual client regardless of network path.
- **By nothing** (a single global bucket) protects your infrastructure
  as a whole but lets one abusive client starve every other user of
  their share.

For a public, unauthenticated demo, IP plus a much stricter global
ceiling is the pragmatic answer — the global cap is your last line of
defense against distributed abuse that spreads across IPs to dodge the
per-IP limit.

```python
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
buckets: dict[str, TokenBucket] = {}
global_bucket = TokenBucket(rate=50, capacity=100)

def get_bucket(key: str) -> TokenBucket:
    if key not in buckets:
        buckets[key] = TokenBucket(rate=1, capacity=5)
    return buckets[key]

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    ip = request.client.host
    if not global_bucket.allow():
        raise HTTPException(429, "service is at capacity, try again shortly")
    if not get_bucket(ip).allow():
        raise HTTPException(429, "rate limit exceeded, slow down")
    return await call_next(request)
```

That in-memory dict works for one process. The moment you run more than
one worker, buckets need to live somewhere shared — Redis, with a small
Lua script to make the check-and-decrement atomic — or each worker
enforces its own limit and the effective rate is `limit × worker_count`,
which defeats the point.

## 429 is a response, not a dead end

The point of a 429 isn't just to reject the request — it's to tell a
well-behaved client exactly when to come back. Skip the `Retry-After`
header and you're relying on the caller to guess a backoff, and most
won't bother; they'll just hammer you again immediately.

```python
raise HTTPException(429, "rate limit exceeded", headers={"Retry-After": "2"})
```

Any client using standard backoff — including your own scrapers calling
someone else's API, which is the mirror image of this problem — will
read that header and back off correctly. It costs one line and turns a
hostile-feeling rejection into a coordinated one.

## What I learned

Rate limiting isn't about being stingy with your API. It's about making
sure one caller's burst doesn't become everyone else's outage — including
yours, when the "caller" is your own bandwidth bill. Key it by something
that actually identifies the client, use a bucket that tolerates
legitimate bursts, and always tell the rejected caller when to try again.
The alternative is finding out your rate limit policy by watching your
egress graph turn into a cliff.
