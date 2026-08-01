---
title: 'From Jupyter Notebook to Real Service'
description: 'The notebook that transcribes audio in six cells is not the API that serves ten users at once — a concrete list of what breaks in the gap and how to close it.'
pubDate: 2025-06-09
tags: ['python', 'backend', 'ml']
---

The notebook was six cells: load the Whisper model, load an audio file,
run `model.transcribe(path)`, print the text. It worked perfectly, every
time, for one file, run by one person, on one machine. Turning that into
an API that ten people could hit at once broke almost every assumption
those six cells were quietly making, and none of the breakage showed up
until it was running for real.

## Global state that only works for one caller at a time

```python
# notebook cell
model = whisper.load_model("base")
result = model.transcribe("sample.wav")
print(result["text"])
```

Wrapped naively in a FastAPI endpoint, that global `model` becomes a
single object every concurrent request shares:

```python
# WRONG: reload the model every request, or race on a shared one
model = whisper.load_model("base")

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    audio = await file.read()
    result = model.transcribe(audio)   # not request-safe, not concurrency-safe
    return {"text": result["text"]}
```

Loading it once at import time is right — reloading a Whisper model per
request would be absurd, seconds of dead time on every call. But calling
`transcribe` directly from a request handler with no coordination means
two concurrent requests both try to use the same GPU context at once.
The fix isn't a new model per request, it's a queue in front of the one
model:

```python
import asyncio

model = whisper.load_model("base")
job_queue: asyncio.Queue = asyncio.Queue()

async def worker():
    while True:
        audio, future = await job_queue.get()
        try:
            result = await asyncio.to_thread(model.transcribe, audio)
            future.set_result(result["text"])
        except Exception as e:
            future.set_exception(e)

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    audio = await file.read()
    future = asyncio.get_event_loop().create_future()
    await job_queue.put((audio, future))
    return {"text": await future}
```

One worker pulling from a queue serializes access to the model without
serializing the whole API — requests still queue and return
concurrently, they just don't stomp on the same GPU context
simultaneously.

## "It worked on my file" is not error handling

The notebook only ever saw `sample.wav`, hand-picked, known-good. A
public endpoint sees a truncated upload, a 200MB file someone meant to
compress first, a `.wav` extension on an actual `.mp3`, and an empty
file from a browser tab someone closed mid-upload. None of those raise a
clean error inside `model.transcribe` — they raise whatever obscure
exception the audio-decoding library happens to throw, three layers
down.

```python
from fastapi import HTTPException

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    audio = await file.read()
    if not audio:
        raise HTTPException(400, "empty file")
    if len(audio) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "file too large")
    try:
        duration = probe_duration(audio)
    except Exception:
        raise HTTPException(400, "unrecognized or corrupt audio")
    if duration > 600:
        raise HTTPException(413, "audio exceeds 10 minute limit")
    ...
```

Validate at the edge, before the expensive work starts, with errors a
caller can act on — not a 500 with a traceback about an internal decoder
that means nothing to whoever's calling your API.

## Config was your editor, not a file

Notebook code hardcodes paths and constants because there's one user:
you, right now, in this session. `model = whisper.load_model("base")`,
a hardcoded `/Users/you/Downloads/sample.wav`, a `device="mps"` because
that's what your laptop has. A service needs those to come from outside
the code:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    model_size: str = "base"
    device: str = "cuda"
    max_upload_bytes: int = 25 * 1024 * 1024
    max_duration_seconds: int = 600

settings = Settings()  # reads from env vars / .env
model = whisper.load_model(settings.model_size, device=settings.device)
```

Now the same code runs on a GPU box in production and a CPU-only
laptop for local dev, with no line changed — just an environment
variable.

## Nothing was logged because nothing needed to be

A failed transcription in a notebook is a red traceback right there on
screen. A failed transcription in a service running on someone else's
machine is silence, unless you deliberately captured it:

```python
import logging
import time
import uuid

logger = logging.getLogger("transcribe")

@app.post("/transcribe")
async def transcribe(file: UploadFile):
    request_id = str(uuid.uuid4())
    start = time.monotonic()
    try:
        audio = await file.read()
        text = await do_transcribe(audio)
        logger.info("transcribe ok", extra={
            "request_id": request_id,
            "bytes": len(audio),
            "elapsed_ms": int((time.monotonic() - start) * 1000),
        })
        return {"text": text, "request_id": request_id}
    except Exception:
        logger.exception("transcribe failed", extra={"request_id": request_id})
        raise
```

The `request_id` is what actually matters here — without it, "a
transcription failed" and "which one, for which caller, with what
input" are two different investigations instead of one grep.

## What I learned

Every gap between notebook and service is a hidden assumption the
notebook got to make because it only ever had one user: you, watching
it, ready to re-run a cell by hand. Concurrency, malformed input,
environment differences, and silent failure are all things "it worked
when I ran it" never has to face. The rewrite isn't really about the
model or the transcription logic — that part was already right. It's
about writing all the code around it that a lone notebook never needed.
