---
title: 'Background Tasks: When ''await'' Isn''t Enough'
description: 'A request handler that sends an email before returning is a handler waiting on someone else''s SMTP server. Background tasks and queues get the response out the door and the slow work off the critical path.'
pubDate: 2025-11-26
tags: ['python', 'async', 'backend']
---

A transcription API I ran had a handler that looked reasonable on
paper: accept the audio, run Whisper, write the transcript to Postgres,
send a webhook notifying the caller, return 200. Every step was
`await`-ed correctly. The problem was that "correctly awaited" and
"appropriate to do before responding" are different questions. The
caller's HTTP client was sitting there for however long transcription
plus a webhook POST to their server took — sometimes fast, sometimes not
their fault at all if their webhook endpoint was slow that day.

`await` doesn't mean "fast." It means "wait here until this finishes,
whatever that costs." Some of that cost belongs after the response, not
before it.

## The line: does the caller need this to answer their request?

The webhook doesn't. The caller's client wants "your request is queued,"
not "here's confirmation that a third-party server accepted my POST."
Split the work along that line — what the response is actually about,
versus what happens as a consequence of it.

FastAPI's `BackgroundTasks` is the simplest version of this: it runs
after the response has been sent, in the same process.

```python
from fastapi import FastAPI, BackgroundTasks

app = FastAPI()

def notify_webhook(url: str, payload: dict) -> None:
    import httpx
    httpx.post(url, json=payload, timeout=10)

@app.post("/transcribe")
async def transcribe(audio: UploadFile, webhook_url: str, tasks: BackgroundTasks):
    transcript = await run_whisper(audio)
    await save_transcript(transcript)
    tasks.add_task(notify_webhook, webhook_url, {"transcript": transcript})
    return {"status": "complete", "transcript": transcript}
```

The client gets its response the moment the transcript exists. The
webhook fires afterward, in the background, and a slow or dead endpoint
on the caller's side no longer holds the connection open.

## Where BackgroundTasks stops being enough

That's fine for "fire and mostly forget" work that can tolerate being
lost if the process crashes a moment later — it runs in-process, with
no retry, no persistence, no visibility if it fails. The transcription
itself is the wrong candidate for it: that's the actual expensive work,
it needs to survive a restart, and the caller needs a way to check on
it rather than hold a connection open for ninety seconds.

That's the point where you want a real queue instead of an in-process
task. The response becomes "accepted, here's a job id," and a separate
worker process pulls the job and does the slow part.

```python
import redis
from rq import Queue

redis_conn = redis.Redis()
queue = Queue("transcription", connection=redis_conn)

@app.post("/transcribe")
async def transcribe(audio: UploadFile):
    audio_path = await save_upload(audio)
    job = queue.enqueue(run_whisper_job, audio_path)
    return {"job_id": job.id, "status": "queued"}

@app.get("/transcribe/{job_id}")
async def check_status(job_id: str):
    job = queue.fetch_job(job_id)
    if job is None:
        raise HTTPException(404)
    return {"status": job.get_status(), "result": job.result}
```

Now the API process stays thin and fast — it just accepts uploads and
enqueues — while workers doing the actual GPU-bound Whisper inference
scale independently, restart independently, and retry independently of
whether any particular HTTP connection is still open.

## Fire-and-forget isn't a real strategy

The tempting shortcut is `asyncio.create_task()` for anything that
feels like it can happen "in the background" without setting up a
queue. It's a trap for anything you actually care about completing,
because nothing holds a reference to that task or checks whether it
raised.

```python
# looks fine, silently loses errors
asyncio.create_task(notify_webhook(url, payload))
```

If `notify_webhook` throws, that exception goes nowhere. It doesn't
crash the request — the response already went out — but it doesn't log
anywhere useful either, unless you've set an exception handler on the
event loop. The task object gets garbage collected and the failure
evaporates with it.

```python
tasks: set[asyncio.Task] = set()

def fire_and_forget(coro):
    task = asyncio.create_task(coro)
    tasks.add(task)
    task.add_done_callback(lambda t: (tasks.discard(t), t.exception()))
    return task
```

Keeping a reference until the task finishes, and explicitly checking
`.exception()` in the done callback, is the minimum to avoid a webhook
failure just vanishing into the log-nothing void.

## What I learned

"Background" is not one thing — it's a spectrum from "can be lost, runs
in-process, fine" to "must survive a restart, needs its own worker and
its own retry policy." Match the mechanism to where the work actually
sits on that spectrum: `BackgroundTasks` for genuinely disposable
side effects, a real queue for anything the caller will ask about later,
and never bare `create_task()` for something you'd be upset to lose
silently.
