---
title: 'Known Plaintext Is a Superpower'
description: 'You do not need to know a cipher to break it if you already know part of the plaintext — how a fixed file header turns "reverse this obfuscation" into a five-minute XOR.'
pubDate: 2025-09-27
tags: ['reverse-engineering', 'cryptography']
---

I had a scraper that cached raw API responses to disk before parsing
them — cheap insurance against re-hitting rate limits while I iterated on
the parser. One day I opened a cache file to double-check a response and
got garbage. Not truncated, not corrupted — the exact same byte count as
a JSON response, just noise. Something upstream had started obfuscating
what used to be plaintext.

## The crib you already have

You don't need to know the cipher to break a keystream scheme if you know,
or can guess, a chunk of the plaintext underneath it. Cached JSON
responses start almost identically every time — `{"status":` or
`{"code":200,"data":`. That's a **crib**: a known plaintext fragment
aligned at a known offset.

XOR a keystream cipher against known plaintext and the cipher cancels out
immediately:

```text
ciphertext[i] = plaintext[i] XOR keystream[i]
=> keystream[i] = ciphertext[i] XOR plaintext[i]
```

You don't need to know *how* the keystream was generated to compute this.
You need exactly two things: the ciphertext, and a guess at the plaintext
underneath it, aligned correctly.

## Finding a crib when you don't already know the format

Fixed-format files hand you cribs for free:

- Any JSON API response worth caching starts with `{"` and a small, fixed
  set of top-level keys.
- Any file format with a magic number (`PK\x03\x04` for zip, `\x89PNG`
  for PNG, `ftyp` a few bytes into an MP4) hands you 4–8 bytes of
  guaranteed plaintext at a known offset.
- Data derived from HTTP often has predictable field ordering — a
  `Content-Type` value almost always appears in a fixed place, if you
  have the wrapping request or response too.

```python
def recover_keystream(ciphertext: bytes, known_plaintext: bytes) -> bytes:
    n = len(known_plaintext)
    return bytes(c ^ p for c, p in zip(ciphertext[:n], known_plaintext))

keystream_prefix = recover_keystream(cache_bytes, b'{"code":200,"data":')
```

Twenty bytes of crib buys you twenty bytes of confirmed keystream — and,
more importantly, confirms you're actually dealing with XOR and not
something structurally different, before you invest more time.

## Extending the crib past the header

Twenty bytes of keystream is a start, not a finish. Two things happen
next, and they tell you what kind of scheme you're actually facing.

**The keystream repeats.** Slide your recovered bytes further into the
ciphertext and look for the same pattern reappearing at a fixed period —
this is Kasiski examination, over a century old and still the fastest
way to size a repeating-key XOR. Once you have the period, you can
recover the entire key from enough ciphertext, no further plaintext
needed.

**The keystream never repeats.** Then something is generating it — a
PRNG seeded per file or per session. Recovering twenty bytes doesn't
finish the job, but it gives you a target: reverse the generator, find
what seeds it, and confirm your generator's first twenty bytes of output
match the keystream you already recovered by hand. That match is your
proof the reversing worked, before you've decoded a single full file.

## Where this stops working

Known plaintext against real block or stream ciphers used correctly
(AES-GCM, ChaCha20-Poly1305 with a fresh nonce per message) hands you
nothing — recovering twenty bytes of keystream tells you nothing about
the next twenty. This technique works specifically because XOR-based
schemes reuse or predictably derive their keystream. If you try this on
a properly implemented cipher and it works anyway, that's not a
superpower, that's a vulnerability, and a much bigger finding than the
one you were looking for.

## The habit worth keeping

Before reaching for a debugger on any "encrypted" file, ask what you
already know must be inside it. A config file has known keys. A media
container has a known header. An API response has a known shape. That
knowledge is free ciphertext-to-plaintext alignment, and it turns
"reverse this obfuscation scheme" into "solve for one XOR," which is a
five-minute problem instead of a five-day one.
