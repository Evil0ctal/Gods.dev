---
title: 'VAD: The Unsung Hero of a Good Transcript'
description: 'Half of a typical call recording is hold music, dead air, or someone breathing near a live mic. Voice activity detection skips it before the ASR model ever sees it — and the transcript gets better, not just cheaper.'
pubDate: 2025-02-12
tags: ['asr', 'ml']
---

I profiled a batch transcription job once and found that of the GPU-
seconds it spent, close to forty percent went to audio that had no speech
in it at all — hold music while a customer waited on a support line,
silence after someone hung up but before the recorder noticed, a good
ninety seconds of a conference call where everyone was on mute. The model
dutifully transcribed all of it. Some of it became hallucinated captions
for hold music. None of it was useful, and all of it cost the same as
transcribing real speech.

## Silence isn't free just because it's quiet

The instinct is that empty audio is cheap — nothing to transcribe, so it
should breeze through. It doesn't, because Whisper doesn't know a
30-second window is silent until it's run the encoder over it. Worse,
Whisper is a language model as much as an acoustic one: pointed at pure
noise or music with no speech, it doesn't reliably emit an empty
transcript. It hallucinates — often something plausible-looking that
never came out of anyone's mouth, because the decoder was trained to
always produce fluent text.

Voice activity detection solves both problems at once. Run something
cheap over the audio first, find the spans that actually contain speech,
and only send those spans to the expensive model.

```python
import torch

vad_model, utils = torch.hub.load("snakers4/silero-vad", "silero_vad")
get_speech_timestamps = utils[0]

def speech_only(audio: torch.Tensor, sample_rate: int = 16_000):
    timestamps = get_speech_timestamps(audio, vad_model, sampling_rate=sample_rate)
    return [audio[ts["start"]:ts["end"]] for ts in timestamps]
```

Silero VAD runs comfortably on CPU in real time, so it costs almost
nothing next to a GPU transcription pass — you're trading a few
milliseconds of cheap compute for however many seconds of expensive
compute the silent stretches would have consumed.

## Tune the boundaries, don't trust the defaults blindly

VAD has its own failure modes if you leave every threshold at default. Cut
too aggressively and you clip the soft onset of a word — someone's "well,
I think—" loses the "well" because the detector didn't trigger until the
volume rose. Cut too loosely and hold music with a beat in it gets
classified as speech, and you're back to paying for silence, just
silence with a backbeat.

The fix that mattered most in practice was padding each detected segment
by a couple hundred milliseconds on both sides, plus merging segments
that were close enough together that the gap between them was almost
certainly a breath, not a real pause.

```python
def pad_and_merge(timestamps, pad_ms=200, merge_gap_ms=300, sr=16_000):
    pad = int(pad_ms / 1000 * sr)
    gap = int(merge_gap_ms / 1000 * sr)
    merged = []
    for ts in timestamps:
        start, end = max(0, ts["start"] - pad), ts["end"] + pad
        if merged and start - merged[-1]["end"] < gap:
            merged[-1]["end"] = end
        else:
            merged.append({"start": start, "end": end})
    return merged
```

## The transcript quality win, not just the cost win

The part that surprised me is that VAD didn't just cut cost — it measurably
cut hallucinated text. Every span that never reaches the model is a span
that can't produce a fabricated sentence over hold music. If your product
surfaces the raw transcript to end users, that's not a nice-to-have; it's
the difference between a transcript people trust and one with random
sentences about "thank you for calling" injected into two minutes of a
Muzak loop.

## What I learned

VAD is the least glamorous part of an ASR pipeline and the one with the
best cost-to-effort ratio of anything I've added to one. It's a few
milliseconds of CPU work standing in front of the most expensive part of
the pipeline, and it pays for itself twice — once in GPU-seconds you
never spend, once in hallucinated text your model never gets the chance
to write.
