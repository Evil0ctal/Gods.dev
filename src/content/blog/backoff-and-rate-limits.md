---
title: 'Backoff, Jitter, and Not Getting Banned'
description: 'A retry loop without jitter synchronizes every one of your workers into the same retry storm — the fix is three lines of randomness and reading the Retry-After header you already ignored.'
pubDate: 2025-05-21
tags: ['scraping', 'python']
---

A scraper of mine started getting `429`s in bursts — a clean run, then
forty rejected requests in the same second, then quiet again. Not a
gradual degradation, a pattern. The cause was my own retry logic: every
worker that got rate-limited waited exactly two seconds and retried at
exactly the same moment, hit the limit again, waited exactly two seconds
again. I'd built a synchronized flood, and I was the one flooding it.

## Why naive backoff synchronizes instead of spreading out

The textbook exponential backoff looks fine in isolation:

```python
async def fetch_with_backoff(client, url, max_attempts=5):
    for attempt in range(max_attempts):
        resp = await client.get(url)
        if resp.status_code != 429:
            return resp
        wait = 2 ** attempt  # 1, 2, 4, 8, 16
        await asyncio.sleep(wait)
    resp.raise_for_status()
```

Run one worker and it's fine. Run fifty workers that all got rate-limited
in the same 100ms window, and they all compute the same `wait`, all sleep
the same duration, and all wake up and retry in the same instant — a
thundering herd against a server that just told you to slow down. The
fix everyone eventually reaches for is jitter: randomize the wait so
retries spread out in time instead of clustering.

```python
import random

async def fetch_with_backoff(client, url, max_attempts=5, base=1.0, cap=30.0):
    for attempt in range(max_attempts):
        resp = await client.get(url)
        if resp.status_code != 429:
            return resp
        # full jitter: uniform random between 0 and the exponential cap
        wait = random.uniform(0, min(cap, base * 2 ** attempt))
        await asyncio.sleep(wait)
    resp.raise_for_status()
```

This is AWS's "full jitter" formula, and it's not overkill for a
two-machine scraper — the same math that prevents a cloud service's
retry storm prevents yours, just at a smaller scale. `random.uniform(0,
cap)` rather than `cap ± some noise` matters too: capped-but-uniform
spreads retries across the entire window instead of clustering near the
top of it, which is a subtler version of the same synchronization bug.

## Retry-After exists, and servers mean it

The part I skipped for too long: a well-behaved `429` or `503` response
often comes with a `Retry-After` header — either a number of seconds or
an HTTP date — and it's the server telling you exactly how long to back
off, no guessing required.

```python
def parse_retry_after(resp) -> float | None:
    value = resp.headers.get("Retry-After")
    if value is None:
        return None
    if value.isdigit():
        return float(value)
    # it's an HTTP-date instead of a delta-seconds
    from email.utils import parsedate_to_datetime
    target = parsedate_to_datetime(value)
    delta = (target - datetime.now(timezone.utc)).total_seconds()
    return max(delta, 0.0)
```

Prefer this over your own exponential guess whenever it's present — it's
not a suggestion, it's the server describing its own recovery window, and
ignoring it in favor of your own backoff schedule is how you keep getting
`429`s after the server already told you when it'll be ready. Fall back
to jittered exponential backoff only when the header is absent.

## Backoff isn't a substitute for a rate limit you set yourself

The retry loop is a safety net, not a strategy. If you're relying on
`429` responses to discover your own throughput ceiling, you're finding
it the expensive way — after you've already been throttled or flagged.
A token bucket on the client side, sized under what you *expect* the
target tolerates, means you rarely hit the retry path at all:

```python
class TokenBucket:
    def __init__(self, rate: float, capacity: float):
        self.rate, self.capacity = rate, capacity
        self.tokens, self.updated = capacity, time.monotonic()

    async def acquire(self):
        while True:
            now = time.monotonic()
            self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
            self.updated = now
            if self.tokens >= 1:
                self.tokens -= 1
                return
            await asyncio.sleep((1 - self.tokens) / self.rate)
```

Retries then handle the exceptions — a flaky connection, a target having
a bad minute — instead of doing the job of pacing your entire fleet.

## What I learned

Three things ship together or the fix is incomplete: jitter, so retries
don't resynchronize into another herd; `Retry-After`, because the server
already computed the right wait and guessing is worse than reading; and a
client-side rate limit, so backoff is the exception path and not the
mechanism holding your throughput under the target's threshold. I had
jitter and thought I was done. I wasn't — I still hit the same wall every
few minutes until I added the bucket, because backoff only tells you what
to do *after* you've already been too fast.
