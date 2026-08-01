---
title: 'GPU Batching for an ASR API'
description: 'One request at a time, a GPU transcription endpoint leaves most of the card idle between requests. Dynamic batching fixes that — the tradeoff is a small, tunable slice of added latency.'
pubDate: 2022-04-21
tags: ['asr', 'ml', 'performance']
---

`nvidia-smi` on a transcription server handling one request at a time
told the real story: utilization spiking to 90% for the duration of each
inference call, then dropping to single digits while the API waited for
the next request to arrive. The GPU was busy maybe a third of the time it
was reserved. Requests weren't slow because the model was slow — they
were slow because ninety-nine requests were queued behind whichever one
happened to be running, one at a time, on hardware built to chew through
many of them at once.

## The GPU wants a batch, the API gets one request

A GPU's whole advantage is doing the same operation across many inputs in
parallel. Feed it one 8-second audio clip and it does that clip's worth
of matrix multiplies while most of its compute units sit idle — the same
kernel launch could have processed sixteen clips for barely more wall-
clock time, because the bottleneck for small batches is overhead and
memory bandwidth, not raw compute.

An API, on the other hand, naturally hands you one request at a time as
they arrive. The gap between those two facts is exactly where dynamic
batching lives: collect requests that arrive close together in time, run
them through the model as one batch, then split the results back out to
the individual callers who are each still waiting on their own request.

## The pattern: a queue, a window, and a batch call

```python
import asyncio
import time

class BatchingTranscriber:
    def __init__(self, model, max_batch=16, max_wait_ms=50):
        self.model = model
        self.max_batch = max_batch
        self.max_wait = max_wait_ms / 1000
        self.queue: asyncio.Queue = asyncio.Queue()
        asyncio.create_task(self._worker())

    async def transcribe(self, audio):
        fut = asyncio.get_event_loop().create_future()
        await self.queue.put((audio, fut))
        return await fut

    async def _worker(self):
        while True:
            audio, fut = await self.queue.get()
            batch = [(audio, fut)]
            deadline = time.monotonic() + self.max_wait
            while len(batch) < self.max_batch:
                timeout = deadline - time.monotonic()
                if timeout <= 0:
                    break
                try:
                    item = await asyncio.wait_for(self.queue.get(), timeout)
                    batch.append(item)
                except asyncio.TimeoutError:
                    break

            audios = [a for a, _ in batch]
            results = self.model.transcribe_batch(audios)
            for (_, fut), result in zip(batch, results):
                fut.set_result(result)
```

The `max_wait_ms` window is the entire tuning surface. Every request now
pays up to that much latency waiting for friends to join its batch,
whether or not any friends show up — a request that arrives alone still
waits out the window before running solo. Set it too low and you rarely
batch at all; set it too high and you've traded throughput for a
noticeably slower single-request path.

## Padding costs real compute too

Audio clips in a batch aren't the same length, and the model needs a
rectangular tensor, so shorter clips get padded to match the longest one
in the batch. A batch with one 30-second call and fifteen 3-second clips
pads all fifteen short ones out to 30 seconds — you're now spending
compute on silence you added yourself. Sorting the queue by audio length
before forming a batch, so similarly-sized clips end up together, cuts
that waste substantially without touching the batching logic itself.

## What I learned

Dynamic batching is a latency-for-throughput trade you get to tune with
one number, and the right value for that number depends entirely on
whether your traffic is bursty enough to fill a batch quickly or sparse
enough that every request will end up waiting out the full window alone.
Measure your actual request-arrival pattern before picking a window —
guessing gets you either an idle GPU or a slow API, and it's easy to land
on the wrong one by accident.
