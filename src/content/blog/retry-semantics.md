---
title: 'Retry Semantics: Idempotency, Deadlines, Poison Messages'
description: 'A retry loop with no idempotency check and no deadline does not make your system more reliable — it just fails louder, later, and sometimes twice. Here is how to retry on purpose.'
pubDate: 2023-06-24
tags: ['scraping', 'reliability']
---

A worker in a pipeline I ran once retried a "create order" call three
times because the connection dropped mid-response, after the server had
already committed the write and before the client got the acknowledgment
back. The retry succeeded. So did the original. Three near-identical
orders landed in the database from one logical request, and the bug
report that reached me read "why do we have duplicate rows," not "why did
the network hiccup" — because from the outside, the retry had worked
perfectly.

## Not every failure means try again

The instinct is to wrap everything in a retry loop, because retries feel
like free reliability. They aren't free. A retry is only safe when you
know two things: that the operation is idempotent, and that the failure
was actually transient.

- A `503` or a connection timeout is transient — retry it.
- A `400` or a `422` is not transient — the request was wrong, and
  sending the same wrong request again gets the same wrong answer while
  burning your rate limit budget on it.
- A `409 Conflict` might mean "someone already did this" — check before
  you retry, don't just retry.

```python
RETRYABLE = {408, 429, 500, 502, 503, 504}

async def call_with_retry(client, method, url, **kw):
    for attempt in range(4):
        try:
            resp = await client.request(method, url, **kw)
        except httpx.TransportError:
            resp = None
        if resp is not None and resp.status_code not in RETRYABLE:
            return resp  # 2xx, or a permanent error — either way, stop
        await asyncio.sleep(2 ** attempt + random.uniform(0, 0.5))
    raise RuntimeError(f"exhausted retries for {method} {url}")
```

## Make the retry itself idempotent

The order-duplication bug wasn't a retry-logic bug, it was a missing
idempotency key. The fix is boring: generate a unique key client-side
before the first attempt, send it on every attempt of that logical
operation, and have the server treat "I've seen this key" as "return the
original result, don't do the work again."

```python
import uuid

idempotency_key = str(uuid.uuid4())
for attempt in range(4):
    resp = await client.post(
        "/orders",
        json=order_payload,
        headers={"Idempotency-Key": idempotency_key},
    )
    if resp.status_code < 500:
        break
```

If you control the server too, this is a small table: key, response body,
timestamp, with a unique constraint on the key. First request with a
fresh key does the work and stores the result. Every subsequent request
with the same key gets the stored result back, no matter how many times
the client retries.

## Deadlines stop a retry loop from outliving its usefulness

A retry loop without a deadline degrades into a slow-motion outage: the
target is down, every worker is now sleeping-and-retrying against it, and
your queue backs up until something else falls over from the backlog. A
deadline on the *whole operation*, not just each attempt, caps that.

```python
deadline = time.monotonic() + 30
while time.monotonic() < deadline:
    resp = await try_once()
    if resp.ok:
        return resp
    await asyncio.sleep(backoff())
raise TimeoutError("gave up before deadline")
```

## Poison messages need an exit, not more retries

Some failures aren't transient and aren't cleanly a 4xx either — a
message that crashes the parser every time, a row shaped in a way you
never anticipated. Retrying it forever just burns cycles and blocks
everything queued behind it. Give it a retry ceiling, and past that
ceiling move it to a dead-letter queue instead of dropping it silently or
looping on it forever. A poison message you can inspect later beats one
that either vanished or wedged your pipeline.

## What I learned

A retry is a claim about the world: this failure is temporary, and doing
the same thing again is safe. Both halves of that claim need to be true
before you write the loop. Get the idempotency half wrong and a retry
turns one write into three. Get the deadline half wrong and a retry turns
one outage into a pileup.
