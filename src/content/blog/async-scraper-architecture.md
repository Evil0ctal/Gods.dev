---
title: 'The Shape of an Async Scraper That Doesn''t Fall Over'
description: 'A working async scraper is three queues and a promise about backpressure, not a pile of asyncio.gather calls — here is the shape that survives contact with a real target.'
pubDate: 2025-08-15
tags: ['scraping', 'python', 'async']
---

The first version of every async scraper I've written looks like this:

```python
async def scrape_all(urls):
    async with httpx.AsyncClient() as client:
        return await asyncio.gather(*(fetch(client, u) for u in urls))
```

It works great on 200 URLs. It falls over on 200,000, because
`asyncio.gather` has no concept of "enough." It schedules every coroutine
at once, opens every connection at once, and holds every response in
memory at once. The target site rate-limits you into oblivion, your
process's file descriptor limit gets hit, and somewhere around URL 40,000
you get a `MemoryError` you don't have a stack trace for anymore because
it happened in a task that finished ten minutes ago.

The fix isn't a smarter `gather`. It's admitting the scraper is a small
distributed system with three moving parts: a queue, a bounded pool of
workers, and a place for backpressure to go when the pipeline downstream
gets slow.

## Queue in, queue out

A scraper that fetches and parses and writes to disk in one coroutine
couples three things that fail independently. If the database write
stalls, you want fetching to keep going and buffer, not stop. If parsing
is slow, you don't want to keep opening more sockets. Two queues fix
this cleanly:

```python
import asyncio

async def fetch_worker(url_queue, page_queue, client, sem):
    while True:
        url = await url_queue.get()
        try:
            async with sem:
                resp = await client.get(url, timeout=10)
            await page_queue.put((url, resp.text))
        except httpx.HTTPError as exc:
            await page_queue.put((url, None))  # let the parser log/skip
        finally:
            url_queue.task_done()

async def parse_worker(page_queue, results):
    while True:
        url, body = await page_queue.get()
        if body is not None:
            results.append(parse(body))
        page_queue.task_done()
```

Fetchers only fetch. Parsers only parse. Each stage has its own
concurrency limit, and a slow parser doesn't block a fast network — it
just makes `page_queue` grow, which is exactly the signal you want.

## Backpressure is the whole point

Here's the part the `gather` version has no answer for: what happens when
downstream is slower than upstream? Without a bound, `page_queue` grows
without limit and you've just moved the memory problem one hop over.

The fix is `asyncio.Queue(maxsize=...)`. A bounded queue makes `put()`
block once it's full, which quietly throttles the fetch workers to match
whatever the parse/write stage can actually keep up with. No manual rate
math, no polling loop checking queue depth — the `await` just doesn't
return until there's room.

```python
url_queue = asyncio.Queue(maxsize=500)
page_queue = asyncio.Queue(maxsize=200)
sem = asyncio.Semaphore(50)   # concurrent in-flight requests, separate from queue depth
```

Note the semaphore is a second, independent limit: queue size bounds how
much *work* is buffered, the semaphore bounds how many requests are *in
flight* at once. Conflating the two means either you overwhelm the
target's rate limit trying to keep a big queue fed, or you starve a
patient target because your queue is small. They're solving different
problems and deserve different numbers.

## Where things actually break

In practice, three failure modes account for almost everything:

- **A worker dies silently.** An unhandled exception inside a `while
  True` worker loop kills that one task and nothing tells you. Wrap the
  loop body, not the loop — catch, log with the URL, `continue`. A
  worker that's alive but stuck is invisible in logs; a worker that's
  dead and gone is worse, because your queue depth just quietly stops
  draining and you won't notice until the queue fills.
- **`task_done()` gets forgotten on an early return.** Miss one and
  `queue.join()` never returns, and your "wait until finished" call hangs
  forever with no error. Put it in `finally`, always.
- **Fan-out without fan-in shutdown.** Workers loop forever on
  `queue.get()`; nothing tells them to stop when the queue is drained.
  The usual fix is a sentinel value (`None`) pushed once per worker after
  the last real item, or cancelling the worker tasks once `queue.join()`
  returns.

```python
async def run(urls):
    url_queue, page_queue = asyncio.Queue(maxsize=500), asyncio.Queue(maxsize=200)
    for u in urls:
        url_queue.put_nowait(u)

    fetchers = [asyncio.create_task(fetch_worker(url_queue, page_queue, client, sem))
                for _ in range(50)]
    parsers = [asyncio.create_task(parse_worker(page_queue, results))
               for _ in range(10)]

    await url_queue.join()
    await page_queue.join()
    for t in fetchers + parsers:
        t.cancel()
```

## What I learned

The `gather` version isn't wrong, it's just a scraper with no volume
control — it will do exactly as much at once as you ask, including too
much. Queues plus bounded sizes plus a separate concurrency semaphore
turn "as fast as possible" into "as fast as the slowest honest stage can
handle," which is the only speed that survives a multi-hour run against a
real target. The failures you actually see in production aren't
exotic — they're a swallowed exception, a missing `task_done()`, and a
queue with no ceiling. Fix those three and the architecture mostly
takes care of itself.
