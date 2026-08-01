---
title: 'Whisper vs faster-whisper: What Actually Changes'
description: 'Same weights, same accuracy target, a completely different runtime underneath. Here is what CTranslate2 actually buys you over stock openai-whisper, and where the win comes from.'
pubDate: 2023-01-26
tags: ['asr', 'ml', 'whisper']
---

Swap `import whisper` for `from faster_whisper import WhisperModel`,
point it at the same `large-v2` checkpoint, transcribe the same file, and
the GPU memory graph drops by roughly half while the run finishes in a
fraction of the time. Nothing about the transcript changes in any way you
can hear. That's the whole pitch, and it's worth understanding *why*
before you build an API around it, because the two projects are not
interchangeable everywhere.

## Same weights, different engine

`openai-whisper` runs on PyTorch, straight from the reference
implementation. `faster-whisper` takes the same trained weights and runs
them through **CTranslate2**, a C++ inference engine built specifically
for transformer-style sequence models — the kind of thing that exists to
do one job (run this graph fast, in low precision, with a tight memory
footprint) instead of PyTorch's job of doing everything.

The weights are converted once, offline, into CTranslate2's own format,
usually quantized to int8 or float16 in the process. Nothing about the
model's architecture changes — same encoder, same decoder, same attention
— but the arithmetic runs in a runtime built to avoid PyTorch's general-
purpose overhead: fused ops, better memory reuse, no Python-side
dispatch cost per layer.

```python
# openai-whisper
import whisper
model = whisper.load_model("large-v2")
result = model.transcribe("call.wav")

# faster-whisper — same checkpoint, CTranslate2 underneath
from faster_whisper import WhisperModel
model = WhisperModel("large-v2", device="cuda", compute_type="float16")
segments, info = model.transcribe("call.wav")
text = " ".join(s.text for s in segments)
```

The API difference is small on purpose. The runtime difference under it
is not.

## Where the memory actually goes

The VRAM drop isn't a rounding error, and it isn't magic — it's mostly
quantization plus a leaner runtime that isn't keeping PyTorch's full
autograd machinery and general tensor-op graph resident for a model that
will never need to backpropagate through it. Inference doesn't need
gradients, doesn't need the training-time memory overhead, and CTranslate2
was built assuming that from the start instead of retrofitting an
inference mode onto a training framework.

Quantization does cost something: `int8` shaves memory and increases
throughput further than `float16`, but on some audio you'll notice a
slightly higher error rate on names and rare words, the tokens closest to
the model's decision boundary. `float16` is usually the sweet spot —
close enough to full precision that I've never needed to A/B it on a
production transcript, meaningfully lighter than `float32`.

## Where faster-whisper doesn't help

It doesn't make the model smarter. Accuracy is bounded by the checkpoint,
not the runtime — a `large-v2` run through CTranslate2 makes the same
kind of mistakes a `large-v2` run through PyTorch makes, just faster. If
your transcripts are wrong in a specific way — homophones, code-switching,
domain jargon — switching runtimes won't touch that. That's a model
choice or a fine-tuning problem, not an inference-engine problem.

It also doesn't help you if you're not GPU-bound. On CPU-only boxes the
gap narrows, though CTranslate2 still generally wins there too since its
CPU kernels were written for this workload specifically rather than
inherited from a general-purpose framework.

## What I learned

The honest way to think about faster-whisper is: same brain, faster
plumbing. If your bottleneck is GPU memory or wall-clock time per file —
which it usually is, the moment you're serving more than one request at
once — swap the runtime and keep the checkpoint. If your bottleneck is
transcript quality, don't waste time benchmarking runtimes; go pick a
better model or clean up your audio pipeline instead.
