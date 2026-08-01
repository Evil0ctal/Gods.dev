---
title: 'faster-whisper in Production: The Rough Edges'
description: 'faster-whisper is a genuine speedup over the reference Whisper implementation, but the README stops well short of what you need to run it reliably behind an API.'
pubDate: 2026-07-01
tags: ['asr', 'ml']
---

`faster-whisper` is a CTranslate2 reimplementation of Whisper, and the
speedup claim in the README is real — I've seen four to five times faster
transcription on the same hardware, same model size, same audio. That's
not the part anyone gets burned by. The part that burns you is everything
the README doesn't mention because it's out of scope for a library README
and squarely in scope for a service you run.

## Model loading is not free, and it's not thread-safe by default

The first surprise: loading a `WhisperModel` at import time and sharing it
across request handlers works fine for one worker, and then falls over
the moment you add a second Uvicorn worker process, because each process
loads its own full copy of the model into GPU memory:

```python
from faster_whisper import WhisperModel

# loaded once per PROCESS, not once per machine
model = WhisperModel("large-v3", device="cuda", compute_type="float16")
```

Run `uvicorn app:app --workers 4` and you've just asked for four copies of
a large-v3 model on one GPU, which OOMs before it serves a single request.
The fix is one model, one process, and either a single worker with an
internal queue (see the producer/consumer pattern — one model, one GPU,
one consuming task) or a dedicated inference process that request workers
talk to over a socket or a queue. `--workers` is an anti-pattern here, not
a scaling knob.

## `compute_type` is not a purely cosmetic flag

The compute type controls precision, and the README's own benchmark table
undersells how much it also affects *stability*, not just speed:

```python
# float16 — fast on most GPUs, occasional numerical edge cases on long silence
model = WhisperModel("large-v3", device="cuda", compute_type="float16")

# int8_float16 — smaller footprint, mixed precision internally
model = WhisperModel("large-v3", device="cuda", compute_type="int8_float16")

# int8 — smallest, works on CPU too, most tolerant of shaky hardware
model = WhisperModel("large-v3", device="cpu", compute_type="int8")
```

`float16` is the fast default, and it is genuinely fast. What I didn't
expect: on audio with long stretches of silence or non-speech noise, I
occasionally got transcripts with repeated tokens or truncated segments
that `int8_float16` on the same input handled cleanly. Not a documented
bug, not something I can point to a GitHub issue for — just a pattern I
noticed after enough production traffic that I now run `int8_float16` as
the default and reserve `float16` for cases where I've validated the
input distribution.

## VAD is bolted on, and its defaults are aggressive

`faster-whisper` ships with an optional VAD (voice activity detection)
filter to skip silence, and it's worth using — silence is wasted GPU
time. But the default parameters are tuned for clean speech, and on
noisy or accented audio the default VAD will happily drop the first
word of an utterance along with the silence before it:

```python
segments, info = model.transcribe(
    "call.wav",
    vad_filter=True,
    vad_parameters=dict(
        min_silence_duration_ms=500,   # default is 2000; too generous for
        speech_pad_ms=200,             # fast speech, clips word onsets
    ),
)
```

I run every new audio source through a manual pass with `vad_filter=False`
first to see the raw segments before trusting the VAD's cuts on
production traffic. It's the difference between "the API sometimes drops
the first word" being a bug I find in testing versus a bug users find in
production.

## Word timestamps cost more than they advertise

`word_timestamps=True` is one keyword argument, and it roughly doubles
inference time on longer audio because it forces an additional
alignment pass per segment. If your API's default response doesn't need
word-level timing, don't ask for it by default — make it an opt-in query
parameter, because half your callers will never use it and all of them
will pay for it if it's on by default.

## What I learned

`faster-whisper` earns its name. It does not earn the assumption that the
reference-implementation mental model — one process, one model, sane
defaults — transfers cleanly to a multi-worker API. Every rough edge I
hit was a gap between "library that runs a model fast" and "service that
runs reliably under concurrent load," and that gap is exactly the part no
model card is going to cover for you.
