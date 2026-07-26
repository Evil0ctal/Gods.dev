---
title: "Reversing WeChat Channels: XOR, Isaac64, and a WASM module that didn't want to be read"
description: 'The encrypted videos in WeChat Channels are not protected by strong crypto. They are XOR-ed against a keystream from a WebAssembly PRNG. Here is how you find that out, and why it matters.'
pubDate: 2026-07-26
tags: ['reverse-engineering', 'wasm', 'wechat', 'cryptography']
---

Play a video in WeChat Channels and let it cache to disk. Open the cached
file. It is not an MP4. The bytes are noise — no `ftyp` box at the front,
no recognizable structure. It looks encrypted.

It mostly isn't. It's XOR-ed. That distinction is the whole story, and
finding it is a clean case study in how to reverse a format that was
never meant to be read from the outside.

## First rule: measure before you theorize

A file that "looks encrypted" tells you almost nothing on its own. The
first move is not a debugger — it's entropy.

Real encryption (AES, ChaCha) produces output that is statistically
indistinguishable from random: entropy pinned at ~8 bits per byte, flat
byte histogram, no structure anywhere. A keystream cipher like XOR against
a PRNG *also* looks random — until you have a hint of the plaintext.

And here you do. You know the plaintext is an MP4. You know the first
bytes of almost every MP4 are the `ftyp` box header. If you XOR the
first ciphertext bytes against the *known* first plaintext bytes, you
recover the first bytes of the keystream for free. That's a known-
plaintext attack, and a stream cipher with a predictable keystream folds
to it instantly.

```text
plaintext[0..n]  XOR  ciphertext[0..n]  =  keystream[0..n]
```

If that keystream is short and repeats, it's a Vigenère-style toy. If it's
long and never repeats, something is *generating* it. That's the question
that sends you into the client.

## Follow the keystream to its source

The client has to produce the same keystream to decrypt what it encrypted.
So somewhere in the app, code turns a seed into that byte stream. The job
is to find it.

Modern WeChat does a lot of its heavy lifting in **WebAssembly**. That is
both good and bad news. Bad: WASM disassembly is a wall of `i32.load`,
`i64.xor`, and stack shuffles with no symbol names. Good: WASM is
sandboxed and deterministic. It has no syscalls hiding the logic — the
algorithm is *all there*, in the module, if you're willing to read it.

Reading it, the shape emerges: a seed goes in, and out comes a long,
non-repeating stream of 64-bit words, XOR-ed byte by byte over the video.
The generator is **Isaac64** — Bob Jenkins' fast cryptographic PRNG, the
64-bit variant. You can recognize it by its skeleton: a 256-word state
array, the `mix`/`shift` round, and the way it refills a results buffer in
batches before handing bytes back.

## Why this is XOR, not "encryption"

Once you know it's Isaac64 keystream XOR-ed against the file, the security
model collapses to a single question: **can you recover the seed?**

If the seed is derived from something you can observe — a file id, a
timestamp, a value that travels with the media — then the "encryption" is
really obfuscation. Anyone who can reproduce the seed can regenerate the
exact keystream and XOR the file straight back to a clean MP4. No key
exchange, no asymmetric crypto, no secret you don't already hold.

So the tool doesn't "break" anything. It reimplements Isaac64, feeds it
the seed the client would have used, and runs the same XOR the client runs
— just in the other direction.

```python
# the entire decrypt, once you have the seed
keystream = isaac64(seed)
plaintext = bytes(c ^ k for c, k in zip(ciphertext, keystream))
```

That five-line core is the payoff of all the WASM reading. Reverse
engineering rarely ends in a heroic exploit. It ends in a boring loop that
proves you understood the format.

## What I actually learned

- **Entropy first, debugger second.** A five-minute histogram tells you
  whether you're facing real crypto or a keystream you can peel with
  known plaintext. Skip it and you'll waste a day.
- **Known plaintext is a superpower.** File formats have fixed headers.
  Fixed headers are free keystream. Any XOR scheme over a known format is
  already half-broken before you open the disassembler.
- **WASM hides the *names*, not the *logic*.** It's tedious, not opaque.
  Pattern-match the algorithm's skeleton — state size, round structure —
  and identify it instead of tracing every instruction.
- **"Encrypted" is a claim, not a fact.** XOR against a recoverable
  keystream is obfuscation wearing encryption's clothes. The interesting
  question is never "is it encrypted," it's "where does the key come
  from."

The most useful reflex I have from this: when a vendor says content is
"encrypted," ask where the client gets the key. If the answer is "from
something the client already has," you're looking at obfuscation, and
obfuscation is a reading problem, not a cryptography one.

*Do this only on media and devices you're authorized to analyze. The point
here is understanding a format, not redistributing anyone's content.*
