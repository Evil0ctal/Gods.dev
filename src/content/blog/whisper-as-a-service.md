---
title: 'Running Whisper as a service: a producer-consumer model for multi-GPU ASR'
description: 'A single Whisper call is easy. Turning it into an API that keeps N GPUs busy without melting under load is a scheduling problem. Here is the producer-consumer design behind the Whisper Services API.'
pubDate: 2026-07-26
tags: ['python', 'asyncio', 'whisper', 'gpu']
---

Transcribing one file with Whisper is four lines. Serving transcription to
many users, over HTTP, without letting requests trample each other or
leaving expensive GPUs idle, is a different animal. That gap is the whole
reason `Fast-Powerful-Whisper-AI-Services-API` exists.

The naive version fails in a way that's worth understanding before the
real design makes sense.

## Why "just call the model in the handler" falls over

Here's the tempting version. It's also a trap.

```python
@app.post("/transcribe")
async def transcribe(file: UploadFile):
    return model.transcribe(await file.read())   # 30s of GPU, inside the request
```

Two problems, both fatal under load:

1. **The model is a shared, stateful, GPU-bound resource.** Whisper
   inference is not thread-safe to fire concurrently on one model
   instance, and one transcription can hold the GPU for tens of seconds.
   Ten requests arriving at once don't run ten times faster — they fight
   over the same device and fall over.
2. **The request is hostage to the work.** A long file means a long-held
   HTTP connection. Timeouts, retries, and dropped uploads pile up while
   the client waits with nothing to show.

The fix is to stop doing the work *inside* the request at all.

## Producer and consumer, with a queue between them

Split the system in two.

The **producer** is the API layer. Its only job is to accept a request,
validate it, drop a task onto a queue, and immediately hand back a task
id. Fast, cheap, never GPU-bound.

The **consumers** are workers pulling from that queue. Each consumer owns a
Whisper model instance and does the slow inference. The number of
consumers is the number of models you can fit — which, on a multi-GPU box,
is one (or more) per device.

```text
   HTTP request                         task queue
   ────────────►  producer  ──push──►  [ t1 t2 t3 ... ]
                  (returns id)               │
                                             ├─► consumer → GPU 0
                                             ├─► consumer → GPU 1
                                             └─► consumer → GPU 2
```

The queue is the whole trick. It decouples *arrival rate* from *service
rate*. Requests can burst; the workers drain the backlog at whatever pace
the hardware allows. Nothing is dropped, nothing overlaps on the same
GPU, and the API stays responsive because it never blocks on inference.

## The model pool: the part that keeps the GPUs hot

A worker per GPU is the idea. An **async model pool** is how you make it
real without hand-rolling thread management.

The pool holds a set of ready model instances. A consumer *acquires* one,
runs a transcription, and *releases* it back. Because acquisition is an
async operation, a worker that's waiting for a model to free up doesn't
block the event loop — it yields, and the loop keeps accepting new uploads
and reporting task status the whole time.

Two details make this pay off:

- **Faster Whisper over vanilla Whisper.** The Faster Whisper backend runs
  the same model through a CTranslate2 inference engine — materially faster
  per transcription at near-identical accuracy. Faster inference means each
  GPU clears its queue quicker, which raises the throughput of the whole
  pool, not just one request.
- **The whole stack is async.** Built on Python 3.11's `asyncio`, the HTTP
  layer, file I/O, and database writes all yield instead of blocking. The
  GPUs are the scarce resource; everything else gets out of their way.

## Poll for the result

Because the producer returned a task id instead of the transcript, the
client comes back for the answer.

```text
POST /transcribe   →  { "task_id": "a1b2c3" }        # instant
GET  /task/a1b2c3  →  { "status": "processing" }      # a moment later
GET  /task/a1b2c3  →  { "status": "done", "text": ... }
```

This is the same pattern every serious long-job API converges on — CI
runs, video encoders, batch ML. Accept the job, return a handle, let the
client poll. It feels like more moving parts than a synchronous call, and
it is. It's also the only version that survives real traffic.

## Takeaways

1. **Never run the expensive thing inside the request handler.** Enqueue
   it and return a handle. The API layer should be fast and dumb.
2. **A queue turns a load spike into a backlog, not an outage.** Arrival
   rate and service rate should never be the same number.
3. **Size your consumers to your accelerators.** One model instance per
   GPU, managed by a pool, keeps every device busy without letting two
   jobs collide on one.
4. **Pick the faster backend.** Faster Whisper's CTranslate2 engine lifts
   throughput across the whole pool for free.

A single model call is a demo. The service is the scheduler around it —
and the scheduler, not the model, is where the engineering lives.
