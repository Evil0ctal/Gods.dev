---
title: 'Backpressure: The Word That Saves Your Queue'
description: 'Why an unbounded asyncio.Queue is a memory leak wearing a producer/consumer costume, and what bounding it actually buys you.'
pubDate: 2022-10-26
tags: ['python', 'async', 'reliability']
---

`asyncio.Queue()` with no arguments looks harmless. It's the default
everyone reaches for, and it works fine right up until the producer gets
faster than the consumer — and then it becomes an unbounded list that
grows until the process gets OOM-killed. I've watched a scraper's memory
climb steadily over six hours because of exactly this, with nothing in
the logs to explain it until `dmesg` showed the kernel's side of the
story.

## The setup that hides the problem

A queue with no size limit will happily accept items forever:

```python
import asyncio

queue = asyncio.Queue()  # unbounded — this is the bug

async def producer(urls):
    for url in urls:
        await queue.put(url)  # never blocks, no matter how far behind consumers are

async def consumer():
    while True:
        url = await queue.get()
        await fetch_and_store(url)  # slow: network + disk
```

If `producer` can enqueue faster than `consumer` can drain — which is
almost always true, because producing a URL is cheap and fetching one
isn't — the queue just grows. Nothing errors. Nothing logs a warning.
Memory climbs, quietly, until it doesn't.

## Backpressure is just a size limit with teeth

The fix is one argument:

```python
queue = asyncio.Queue(maxsize=1000)

async def producer(urls):
    for url in urls:
        await queue.put(url)  # now blocks once the queue holds 1000 items
```

`put()` on a bounded queue suspends the producer coroutine once the queue
is full, until a consumer calls `get()` and frees a slot. That suspension
*is* backpressure — it's the queue pushing back on whatever's feeding it,
converting "unlimited growth" into "producer waits its turn." The
producer coroutine isn't burning CPU while it waits; it's parked, exactly
like any other `await`, and the event loop is free to run other work.

The failure mode changes shape entirely: instead of unbounded memory
growth, you get a producer that's throttled to the consumer's actual
pace. That's a much better failure to have, because it's visible —
you can watch queue occupancy and producer latency as real metrics — and
it can't OOM the process.

## Sizing the bound, and watching it

`maxsize` isn't a number to guess once and forget. Too small and the
producer stalls constantly even under normal load, which just moves the
bottleneck upstream without fixing anything. Too large and you're back to
the same slow-motion memory problem, just with a longer fuse. I size it
against how much in-flight work I'm comfortable losing if the process
dies mid-run — 1000 pending URLs at a few hundred bytes each is a
tolerable loss; a queue sized to hold a day's worth of work is not.

```python
async def report_queue_depth(queue: asyncio.Queue, interval: float = 5.0):
    while True:
        await asyncio.sleep(interval)
        depth = queue.qsize()
        if depth > queue.maxsize * 0.8:
            print(f"[warn] queue at {depth}/{queue.maxsize} — consumers falling behind")
```

A queue that's *consistently* near full isn't a sizing problem, it's a
throughput problem — it means consumers are structurally too slow for
the producer rate, and no `maxsize` fixes that. The bound's job is only
to make that condition visible and safe, not to solve it. Once you see
it, the actual fix is adding consumer concurrency or slowing the
producer's rate at the source.

## What I learned

An unbounded queue isn't a design decision, it's the absence of one —
it just defers the failure from "the producer waits" to "the process gets
killed," and defers the debugging from "watch a metric" to "read kernel
logs after the fact." Bounding a queue doesn't add complexity, it moves
an implicit, invisible failure mode into an explicit, observable one.
That trade is almost always worth making, and it's cheap enough that I
now treat an unbounded `asyncio.Queue()` in review the same way I'd treat
a bare `except:` — technically legal, almost always a mistake.
