---
title: 'Five Async Pitfalls That Bit Me'
description: 'A fire-and-forget task that silently vanished, a shared session that leaked connections, an exception that never surfaced — five specific async bugs, each with the fix that actually held.'
pubDate: 2021-02-10
tags: ['python', 'async']
---

A background task in a scraper API stopped running one day, no error, no
log line, nothing. It had been silently garbage collected mid-flight
weeks earlier and only happened to matter the day it needed to fire. That
bug taught me more about `asyncio` than any tutorial. Here are five like
it, each one I hit for real, each one with a fix I still use.

## 1. Fire-and-forget tasks that get garbage collected

```python
# WRONG
async def handle_upload(file_id: str):
    asyncio.create_task(process_thumbnail(file_id))  # nothing holds a reference
    return {"status": "accepted"}
```

`asyncio.create_task` schedules the coroutine but returns immediately.
If nothing keeps a reference to the returned `Task` object, the event
loop's internal weak reference is the only thing pointing at it, and it
can be garbage collected before it finishes — sometimes mid-execution,
with a `Task was destroyed but it is pending!` warning that's easy to
miss in a busy log stream.

```python
# RIGHT
_background_tasks: set[asyncio.Task] = set()

async def handle_upload(file_id: str):
    task = asyncio.create_task(process_thumbnail(file_id))
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return {"status": "accepted"}
```

The module-level set holds a strong reference until the task finishes,
then the callback cleans it up. This is straight from the `asyncio`
docs' own warning — I read it after the bug, not before.

## 2. `asyncio.gather` swallowing the first exception's siblings

```python
results = await asyncio.gather(
    fetch(url1), fetch(url2), fetch(url3),
)
```

Default `gather` cancels nothing when one coroutine raises — it just
propagates the first exception once all coroutines are done, and if you
don't handle it carefully you never see which of the other two also
failed, or whether they even completed. For a batch job I needed to know
*all* the failures, not just the first one:

```python
results = await asyncio.gather(
    fetch(url1), fetch(url2), fetch(url3),
    return_exceptions=True,
)
for url, result in zip(urls, results):
    if isinstance(result, Exception):
        log.warning("fetch failed", url=url, error=str(result))
```

`return_exceptions=True` turns exceptions into ordinary return values
instead of raising, so you decide what "one failure" means for the
batch instead of `gather` deciding for you.

## 3. A shared `httpx.AsyncClient` created per request

```python
# WRONG: new client, new connection pool, every single call
async def fetch(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        return r.json()
```

This throws away connection pooling and TLS session reuse on every
call — a scraper doing this against the same host on every request pays
a fresh TCP handshake and TLS negotiation each time, which shows up as
mysteriously slow throughput that no amount of `asyncio.gather` fanout
fixes.

```python
# RIGHT: one client, reused, its pool doing the work it's built for
client = httpx.AsyncClient(limits=httpx.Limits(max_connections=100))

async def fetch(url: str) -> dict:
    r = await client.get(url)
    return r.json()

# close it on shutdown
async def shutdown():
    await client.aclose()
```

## 4. Blocking calls hiding inside "async" functions

```python
async def process_batch(items: list[dict]):
    for item in items:
        cached = redis_client.get(item["key"])   # sync redis client!
        ...
```

An `async def` function is not automatically non-blocking — it's just a
function the event loop *can* suspend. If the body calls a synchronous
library (a blocking Redis client, `requests`, `time.sleep`), that call
still blocks the whole event loop for its duration, stalling every other
concurrent task. The bug is invisible under low load and brutal under
high load, which is exactly when you can least afford to debug it.

```python
async def process_batch(items: list[dict]):
    for item in items:
        cached = await redis_client.get(item["key"])  # async client
```

If there's no async version of the library, wrap the call:
`await asyncio.to_thread(redis_client.get, item["key"])`.

## 5. `try/except` around an `await` that swallows cancellation

```python
async def worker():
    try:
        await do_work()
    except Exception:
        log.error("work failed")   # catches CancelledError too, pre-3.8 style bugs still show up
```

`asyncio.CancelledError` inherits from `BaseException`, not `Exception`,
in modern Python — so a bare `except Exception` won't catch it. But a
lot of code ported from older patterns, or written defensively with
`except (Exception, asyncio.CancelledError)`, does catch it, and that
silently defeats task cancellation: the worker logs "work failed" and
keeps running instead of actually stopping when the caller cancels it.

```python
async def worker():
    try:
        await do_work()
    except asyncio.CancelledError:
        raise   # always let cancellation propagate
    except Exception:
        log.error("work failed")
```

## What I learned

Every one of these passes code review at a glance — they all look like
reasonable async code. The bugs only show up under concurrency, under
load, or under cancellation, which is exactly the set of conditions that
don't show up in a quick manual test. Hold a reference to every task you
create. Decide on purpose what `gather` does with partial failures.
Reuse your clients. Audit every library call inside an `async def` for
whether it's actually async. And never let a bare `except` eat a
`CancelledError`.
