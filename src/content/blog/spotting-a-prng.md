---
title: 'Spotting a PRNG in the Wild: Isaac64''s Fingerprints'
description: 'A PRNG and a stream cipher can look identical in their output. The tell is in the inputs, the state size, and the refill pattern — here is how to name one on sight.'
pubDate: 2021-06-18
tags: ['reverse-engineering', 'wasm', 'cryptography']
---

A function called once at startup with a small seed, then called millions
of times with no arguments, each time returning a fresh 8-byte value that
never repeats across a multi-gigabyte capture. Nothing in the trace reads
a syscall, a clock, or a device. That's the signature of a PRNG, not a
cipher, and it changes how you attack it.

## Real crypto asks for randomness. A PRNG asks for a seed.

The tell isn't in the output — a good PRNG's output is statistically
indistinguishable from a stream cipher's. The tell is in the *inputs*.
Watch what the seeding function touches:

- **Cryptographic RNGs** pull from an OS entropy source (`getrandom`,
  `/dev/urandom`, `CryptGenRandom`) or hash live system state. You'll see
  a syscall or an import in that family.
- **A PRNG** takes one small, fully observable seed — a 32-bit or 64-bit
  integer, sometimes a short byte array — and from that point on touches
  nothing external at all. Every later output is a pure function of
  internal state.

If you can seed it yourself and get byte-for-byte identical output to the
target, you're not looking at a cryptographic primitive. You're looking
at a generator, and generators can be reimplemented, not just observed.

## State size is the fingerprint

Before reading a single round function, measure the state. Dump the
memory region the seed function initializes and just look at its size.

| Generator | State size | Tell |
|---|---|---|
| xorshift32/64 | 4–8 bytes | almost no init work, 3 shift+xor ops per call |
| PCG32 | 16 bytes | 64-bit LCG step + xorshift output permutation |
| Mersenne Twister (MT19937) | 2496 bytes (624 × 32-bit words) | tempering step with constants `0x9d2c5680`, `0xefc60000` |
| Isaac / Isaac64 | 2048 bytes (256 × 64-bit words) | batch refill of a results array before handing bytes back |

That table alone resolves most cases before you trace anything. A
2048-byte state block that gets refilled in one big burst every 256
calls, rather than touched incrementally on every call, is close to
diagnostic for Isaac64 on its own.

## Isaac64's specific skeleton

Isaac64 (Bob Jenkins' design) has a shape that's easy to recognize once
you've seen it:

- a 256-word `mm[]` array — the state,
- a 256-word `randrsl[]` results buffer, refilled in one pass whenever
  it's exhausted,
- a mix step per word using a fixed sequence of rotations applied to
  eight temporary values before the results buffer gets written.

You don't need to memorize the exact rotation constants to recognize the
algorithm. You need to notice that there *are* eight distinct rotation
amounts applied in sequence, inside a loop that runs exactly 256 times
per refill. That loop count, and "eight rotations, one full pass" as the
per-refill shape, is closer to a fingerprint than any single constant.

```python
# the recognizable skeleton, not the real constants — what you're looking for
def refill(state):                 # runs once per 256 outputs
    for i in range(256):
        a = mix_step(state, i)      # eight internal rotations happen here
        state[i] = a
    return state
```

## Why naming it matters

Naming the generator turns a reversing task into a porting task. "Some
PRNG, 2048 bytes of state, unknown internals" means you're stuck reading
disassembly line by line. "Isaac64" means you go get a reference
implementation, feed it the seed you already recovered from the trace,
and diff its output against the target byte for byte. One of those paths
is hours; the other is days.

## What I actually check, in order

1. Does the generator ever touch anything outside its own state after
   seeding? If no, it's a PRNG, not a CSPRNG — attackable.
2. What's the state size, in bytes, right after init?
3. Does it refill in bursts or mutate per call?
4. What's the loop count on the refill, and how many distinct operations
   happen per element?

Four questions, in that order, and most PRNGs you'll meet in the wild —
genuinely, almost all of them, because there are only a handful of
designs anyone actually ships — resolve by the third one.
