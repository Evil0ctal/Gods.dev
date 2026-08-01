---
title: 'The One Line That Blocks Your Event Loop'
description: 'One synchronous call inside an async handler stalls every other request on the process, and it rarely announces itself — here is how to actually find it.'
pubDate: 2020-01-28
tags: ['python', 'async', 'performance']
---

A FastAPI service I was running had p50 latency around 40ms and p99
latency around 4 seconds. Not a gradual curve — a cliff. Most requests
were fast, and a fraction were catastrophically slow, and the slow ones
didn't correlate with payload size or endpoint. That shape is almost
always the same bug: something, somewhere, is blocking the event loop,
and every request unlucky enough to be waiting behind it inherits the
delay.

The line turned out to be this:

```python
@app.post("/webhook")
async def webhook(payload: WebhookPayload):
    log_line = json.dumps(payload.dict())
    requests.post(LOG_ENDPOINT, data=log_line)   # <- this one
    return {"status": "ok"}
```

`requests.post` is synchronous. Inside an `async def`, that's not a style
nitpick — it's a blocking system call running on the *only* thread the
event loop has to work with. While it waits on the network, nothing else
on that process runs. Not other coroutines, not other requests, nothing.

## Why "async def" doesn't protect you

The mental model that trips people up: `async def` makes a function
*awaitable*, not automatically non-blocking. Nothing stops you from
calling synchronous code inside it, and Python won't warn you — the
function just runs to completion the normal way when you get to that
line, exactly as if `async` weren't there.

```python
async def handler():
    time.sleep(2)          # blocks the whole event loop for 2 seconds
    return "done"

async def handler_fixed():
    await asyncio.sleep(2)  # yields control back to the loop for 2 seconds
    return "done"
```

Both functions take two seconds. Only one of them lets any other
coroutine make progress during that time. The event loop is
single-threaded and cooperative — every coroutine has to voluntarily
yield with `await` for anything else to get a turn. A blocking call never
yields; it just occupies the thread until it returns.

## Finding it without guessing

Staring at the code and looking for "the blocking call" doesn't scale
past a few files, and the bug is rarely in the file you suspect — mine was
in a logging helper three imports deep, not the handler itself. Two tools
that actually find it:

`asyncio`'s built-in slow-callback warning, turned on with debug mode,
logs any callback that runs longer than a threshold:

```bash
PYTHONASYNCIODEBUG=1 python -X dev app.py
```

```text
Executing <Task ... > took 2.014 seconds
```

That tells you *a* task was slow, not *which line*. For that, `py-spy`
attached to a live process gives you a sampling profiler view without
restarting anything, which matters when the block only shows up under
real production concurrency:

```bash
py-spy dump --pid $(pgrep -f uvicorn)
```

The blocked worker's stack trace will show whatever synchronous call is
sitting at the top — a socket read, a `time.sleep`, a database driver
that doesn't have an async version — and that's your answer without
having to reproduce it locally.

## The fix depends on what's blocking

Not every blocking call has the same fix. Match the tool to the reason
it blocks:

- **A blocking network call** (`requests`, a sync DB driver): swap for
  the async equivalent — `httpx.AsyncClient`, `asyncpg` instead of
  `psycopg2`. This is almost always available and almost always the
  right fix.
- **Genuine CPU work** (parsing, hashing, image resizing): no async
  version exists because the work isn't I/O-bound. Offload it instead:
  `await asyncio.to_thread(cpu_heavy_fn, data)` for GIL-released work, or
  a `ProcessPoolExecutor` if it doesn't release the GIL.
- **A third-party library with no async API**: same answer as CPU
  work — `asyncio.to_thread` wraps it so the blocking call happens on a
  worker thread instead of the event loop's thread, even though the
  library itself never changes.

```python
@app.post("/webhook")
async def webhook(payload: WebhookPayload):
    log_line = json.dumps(payload.dict())
    await asyncio.to_thread(requests.post, LOG_ENDPOINT, data=log_line)
    return {"status": "ok"}
```

## What I learned

The p99 cliff wasn't caused by a slow endpoint. It was caused by a fast
endpoint doing one synchronous thing, which made every *other* endpoint
slow while it ran. Async bugs don't stay local to the function that has
them — that's exactly what makes them worth hunting down instead of
shrugging off as "one flaky call."
