---
title: 'Streaming ASR Without Melting the GPU'
description: 'Real-time captions do not mean transcribing one word at a time. They mean chunking audio with overlap, gating on silence, and accepting that latency and accuracy pull in opposite directions.'
pubDate: 2026-05-03
tags: ['asr', 'ml', 'whisper']
---

The first version of a "live captions" feature I built pushed the whole
growing audio buffer through Whisper every two seconds — transcribe
everything from the start of the call up to now, discard the previous
result, repeat. It worked for about ninety seconds of audio and then the
GPU queue backed up, because every pass got more expensive than the last
while the deadline between passes stayed fixed at two seconds. Streaming
ASR isn't "run the model more often." It's a different shape of pipeline
entirely.

## Chunk it, and pad the seams with overlap

Whisper wasn't trained to transcribe an infinite stream — it was trained
on fixed-length windows, 30 seconds by convention. So the real move is to
cut incoming audio into fixed chunks and transcribe each chunk on its
own, which immediately creates a new problem: a word that straddles a
chunk boundary gets cut in half and the model either mangles it or drops
it.

The fix is overlap. Each chunk includes a couple of seconds from the tail
of the previous one, so any word that landed on a boundary gets
transcribed cleanly in at least one of the two chunks that contain it.

```python
CHUNK_SECONDS = 8
OVERLAP_SECONDS = 2
SAMPLE_RATE = 16_000

def make_chunks(audio: np.ndarray):
    step = (CHUNK_SECONDS - OVERLAP_SECONDS) * SAMPLE_RATE
    window = CHUNK_SECONDS * SAMPLE_RATE
    for start in range(0, len(audio), step):
        yield audio[start:start + window], start / SAMPLE_RATE
```

Transcribing the overlap twice means you now have to reconcile two
versions of the same words. The simplest working approach: trust the
*earlier* chunk's version for the overlapped region and only take new
text from the *non-overlapping* tail of each chunk, stitching transcripts
together by timestamp rather than by string-diffing two nearly-identical
sentences.

## Don't chunk on a fixed clock — chunk on silence

Cutting exactly every 8 seconds means you will, with total certainty,
sometimes cut mid-word or mid-phoneme regardless of overlap. A better
boundary is wherever the speaker actually paused. Run a cheap voice
activity detector over the incoming stream and only close a chunk at a
silence gap, with a max-length cap so a run-on sentence doesn't grow the
chunk unboundedly.

```python
def next_boundary(vad_frames: list[bool], max_len: int) -> int:
    # find the first sustained silence after some minimum chunk length
    for i in range(max_len // 2, len(vad_frames)):
        if not any(vad_frames[i:i + 10]):  # ~0.3s of silence
            return i
    return max_len  # no natural pause found, cut anyway
```

This alone fixes most of the "half a word at the edge" artifacts that
plain fixed-interval chunking produces, and it costs almost nothing —
VAD is orders of magnitude cheaper than a transcription pass.

## Latency and accuracy are the same knob, pointed opposite ways

Every lever in a streaming pipeline is a trade between the two. Shorter
chunks mean lower latency before the caption appears, but less context
for the model, and Whisper's accuracy visibly degrades on very short
windows — it loses the surrounding words that disambiguate homophones and
proper nouns. Longer chunks mean better accuracy and a viewer staring at
a blank caption bar for four extra seconds.

There's no chunk length that's correct in general. A live-captioning use
case wants low latency and will tolerate more correction-in-place. A
"generate a transcript for later" batch job should just use the longest
window your memory budget allows and skip streaming complexity
altogether — none of this is worth building if you don't actually need
sub-second responsiveness.

## What I learned

Streaming ASR is a scheduling problem wearing an ML problem's clothes.
The model doesn't change; what changes is how you carve up audio, how you
stitch overlapping transcripts back together, and how honestly you pick a
chunk size for the latency your product actually needs instead of the
smallest number that sounds impressive in a demo.
