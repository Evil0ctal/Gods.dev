---
title: 'int8 Quantization: Cheaper Inference, Honest Tradeoffs'
description: 'Quantizing a model to int8 cuts memory and often speeds up inference, but the accuracy cost is real and calibration-dependent — here is what actually changes under the hood.'
pubDate: 2021-04-09
tags: ['ml', 'performance']
---

Loading a model in fp32 costs 4 bytes per parameter. The same model in
int8 costs 1. A 300M-parameter model that needed 1.2 GB of weights alone
now needs 300 MB, and on a GPU where memory bandwidth is usually the
bottleneck — not raw compute — that shrink often speeds up inference too,
not just the memory footprint. That's the pitch, and it's true. What gets
skipped is *how* you get from a float to an integer without the model's
output quietly degrading, and where that degradation shows up first.

## What quantization actually does

A float32 weight has a huge dynamic range and 24 bits of mantissa
precision. int8 has exactly 256 distinct values, full stop. Quantization
is the process of mapping a tensor's float range onto those 256 integers
with a scale factor, so you can reconstruct an approximation of the
original value later:

```python
import numpy as np

def quantize(tensor: np.ndarray, scale: float) -> np.ndarray:
    # map float values onto the int8 range using a per-tensor scale
    q = np.round(tensor / scale).clip(-128, 127)
    return q.astype(np.int8)

def dequantize(q: np.ndarray, scale: float) -> np.ndarray:
    return q.astype(np.float32) * scale
```

The scale is the whole game. Pick it too large and small weights all
round to zero — you've thrown away the fine detail that mattered. Pick it
too small and large weights clip at ±127, flattening your outliers into
identical bins. Calibration is the process of choosing that scale by
running representative data through the model and observing the actual
range of activations and weights, rather than guessing.

## Where the error actually shows up

The mean error from quantization is usually small and boring — it's the
tail that bites you. A weight distribution is rarely uniform; it's often
tightly clustered near zero with a handful of much larger outlier values.
A single per-tensor scale calibrated to cover those outliers wastes most
of its 256 buckets on a range the bulk of the weights never use:

```python
weights = np.random.laplace(0, 0.02, size=10_000)
weights[:5] = [0.8, -0.75, 0.9, -0.6, 0.7]   # a handful of outliers

scale = np.abs(weights).max() / 127
# scale is dominated by 5 outliers out of 10,000 weights —
# the other 9,995 values get crushed into a handful of buckets
```

This is why per-channel quantization (a separate scale per output
channel, instead of one scale for the whole tensor) consistently beats
per-tensor quantization on the same model: it isolates an outlier channel
instead of letting it blow out the scale for everyone else.

## The honest tradeoff

int8 post-training quantization on a well-behaved model — transformer
encoder layers, convolutional backbones — typically costs a small,
often-imperceptible amount of task accuracy in exchange for the memory
and latency win. That's the case worth taking almost every time.

Where it stops being a good trade:

- **Small models are less robust to it.** A model with fewer redundant
  parameters has less slack to absorb quantization error; the same int8
  pass that's invisible on a large model can be visible on a small one.
- **Layers with wide dynamic range degrade first.** Softmax inputs,
  layer norms, and attention scores tend to have activation ranges that
  don't compress cleanly — leaving those in fp16/fp32 (mixed-precision
  quantization) while quantizing the matmul-heavy layers is usually a
  better split than quantizing everything uniformly.
- **Quantization-aware training closes most of the remaining gap**, if
  you can afford to retrain. It simulates the rounding during the forward
  pass so the model learns weights that are robust to it, instead of
  quantizing a model that was never trained to expect it.

None of this is a reason to skip quantization. It's a reason to *measure*
after applying it — task accuracy on a held-out set, not just "the model
still loads and outputs something plausible."

## What I learned

int8 quantization is not a free 4x. It's a real accuracy-for-resources
trade, and the size of that trade depends entirely on calibration
quality and where the model's weight distribution has outliers. The
teams that get burned are the ones that quantize, spot-check three
outputs, and ship. The ones that don't get burned run the eval suite
before and after, and quantize the layers that can afford it instead of
the whole model uniformly.
