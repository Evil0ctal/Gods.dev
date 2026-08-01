---
title: 'A Producer/Consumer Queue Behind an ASR API'
description: 'FastAPI accepts an upload in milliseconds; Whisper needs the GPU for seconds. Decoupling the two with a bounded queue is what keeps the API responsive under load.'
pubDate: 2026-03-20
tags: ['asr', 'python', 'async']
---

The first version of my Whisper API called the model straight from the
request handler:

```python
@app.post("/transcribe")
async def transcribe(file: UploadFile):
    audio = await file.read()
    result = model.transcribe(audio)   # blocks for 2-30s depending on length
    return result
```

It worked for one request at a time. Send two at once and the second sat
frozen on the socket for the full duration of the first, because the GPU
can only run one transcription at a time and the handler was holding the
connection open while it waited its turn inside `model.transcribe`. FastAPI
looked concurrent from the outside. Underneath, everything funneled
through one GPU with no queue, no ordering, and no way to tell a client
"you're number 4, hang on."

The fix wasn't a faster model. It was admitting the request path and the
inference path have completely different rhythms and should stop
pretending to be the same function call.

## Two rhythms, one endpoint

Accepting an upload, validating the format, and writing bytes to a temp
file takes single-digit milliseconds. Running Whisper against thirty
seconds of audio takes seconds, sometimes tens of seconds, and it wants
the GPU to itself. Cramming both into one coroutine means the fast part
inherits the slow part's latency for every caller queued behind it.

The producer/consumer split treats them as two systems joined by a queue:

```python
import asyncio
from dataclasses import dataclass, field

@dataclass
class Job:
    audio_path: str
    future: asyncio.Future = field(default_factory=asyncio.get_event_loop().create_future)

job_queue: asyncio.Queue[Job] = asyncio.Queue(maxsize=200)

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    path = await save_upload(file)
    job = Job(audio_path=path)
    await job_queue.put(job)          # blocks the *caller*, not the worker, once full
    return await job.future           # resumes when the consumer resolves it

async def gpu_worker():
    while True:
        job = await job_queue.get()
        try:
            result = await asyncio.to_thread(model.transcribe, job.audio_path)
            job.future.set_result(result)
        except Exception as exc:
            job.future.set_exception(exc)
        finally:
            job_queue.task_done()
```

The handler is now a producer: it does cheap I/O, drops a job on the
queue, and awaits a `Future` that some other coroutine will resolve. One
`gpu_worker` task — started once at app startup — is the consumer, pulling
jobs off the queue and feeding the model one at a time. `asyncio.to_thread`
keeps the blocking `model.transcribe` call from stalling the event loop
that everything else, including the queue itself, depends on.

## Why the queue has to be bounded

`asyncio.Queue()` with no `maxsize` will happily accept ten thousand
uploads while the GPU chews through job one. That's not resilience, it's
a slow-motion OOM: every queued job is holding a temp file and a live
`Future` in memory, and the pile grows until the process falls over.

A bounded queue turns that failure into an explicit, cheap decision.
`await job_queue.put(job)` on a full queue suspends the caller instead of
accepting unbounded work, and you can wrap it with `asyncio.wait_for` to
turn "queue's full" into a proper `503` instead of a client that hangs:

```python
try:
    await asyncio.wait_for(job_queue.put(job), timeout=2.0)
except asyncio.TimeoutError:
    raise HTTPException(status_code=503, detail="transcription queue is full, retry shortly")
```

That single change is the difference between "the API is slow" and "the
API is down." Slow is recoverable. Down means the process ran out of
memory and every in-flight request died with it.

## Scaling the consumer side

One worker coroutine maps to one GPU. If you have two GPUs, run two
worker tasks, each pinned to a device, both pulling from the same queue —
the queue is already the coordination point, so scaling out is adding
consumers, not rearchitecting anything:

```python
@app.on_event("startup")
async def start_workers():
    for device_id in range(torch.cuda.device_count()):
        asyncio.create_task(gpu_worker(device=device_id))
```

Batching is the next lever, but it belongs to the consumer, not the
queue. The queue's only job is to hold jobs and hand them out in order;
whether the worker processes one at a time or drains several into a
batched inference call is an internal decision the producers never need
to know about.

## What I learned

The bug wasn't that the model was slow — Whisper is always going to take
real GPU time. The bug was that the request handler and the inference
call were the same span of code, so every caller inherited the full
latency of whoever was ahead of them with no visibility into why. Splitting
producer from consumer didn't make transcription faster. It made the
slowness legible: a queue depth you can log, a timeout you can tune, and
a `503` instead of a hang when the system is genuinely out of capacity.
