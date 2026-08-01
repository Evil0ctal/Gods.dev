---
title: 'Entropy First: Telling Encryption From Obfuscation in Five Minutes'
description: 'A byte-histogram check you can run before opening a debugger, to know whether a blob is real crypto, a weak cipher, or plain compression.'
pubDate: 2023-11-18
tags: ['reverse-engineering', 'cryptography']
---

Somebody hands you a blob of bytes with no header, no magic number, and
says "this is encrypted." Before opening a disassembler, I run one
command:

```bash
python3 -c "
import collections, math, sys
data = open(sys.argv[1], 'rb').read()
counts = collections.Counter(data)
n = len(data)
entropy = -sum((c/n) * math.log2(c/n) for c in counts.values())
print(f'{entropy:.3f} bits/byte over {n} bytes')
" blob.bin
```

That number tells you more about what you're dealing with than an hour of
staring at a debugger would, and it costs five seconds to compute.

## What the number means

Entropy measures how close the byte distribution is to uniform random.
The scale runs 0 to 8 bits per byte:

```text
~1-3 bits/byte   plain text, structured formats (JSON, XML)
~4-6 bits/byte   weakly obfuscated data — XOR against a short key, custom encoding
~7.9-8.0 bits/byte  compressed OR genuinely encrypted OR both
```

Real ciphers — AES, ChaCha20, any modern stream or block cipher used
correctly — produce output that is statistically indistinguishable from
random noise. That's not incidental, it's the design goal: if a cipher's
output had *any* detectable bias, that bias would be a foothold for
cryptanalysis. So "entropy pinned at ~8.0" is consistent with real
encryption, but it does not prove it — and that caveat is the whole point
of this post.

## The trap: compression looks identical to encryption

gzip, zlib, LZ4 — anything that removes redundancy — also pushes entropy
up near 8 bits/byte, because removing redundancy is mathematically close
to removing predictability. A blob that's just `zlib.compress()`'d JSON
reads exactly the same on an entropy scan as a blob that's been through
AES. The histogram alone can't tell you which.

The tiebreaker is magic bytes and structure at fixed offsets:

```python
import zlib

MAGIC = {
    b"\x1f\x8b": "gzip",
    b"\x78\x9c": "zlib (default compression)",
    b"\x78\x01": "zlib (low compression)",
    b"\x04\x22\x4d\x18": "lz4",
}

def guess(blob: bytes) -> str:
    for sig, name in MAGIC.items():
        if blob.startswith(sig):
            return name
    try:
        zlib.decompress(blob)
        return "zlib (no header match, but it decompresses)"
    except zlib.error:
        return "no known compression signature"
```

If a "high entropy, must be encrypted" blob decompresses cleanly, you
just saved yourself from reverse engineering a key schedule that doesn't
exist. This has happened to me more than once — a blob I assumed was
encrypted turned out to be a compressed JSON payload, and the actual
"decryption" function I needed to find was `inflate`.

## What a *weak* cipher looks like instead

Not everything calling itself "encrypted" clears 7.9 bits/byte. XOR
against a short repeating key, a Caesar-style substitution, a home-rolled
"obfuscation" pass — these all leave detectable structure, because a
short-period keystream can't erase the redundancy already in the
plaintext. If you see entropy sitting around 4-6 bits/byte on something
claimed to be "encrypted," that's the tell to go looking for a repeating
XOR key instead of assuming you need to reverse a cipher implementation.
A quick check: split the blob into blocks matching candidate key lengths
and compare each block's byte distribution — if blocks at some period
line up statistically, you've found the key length before writing a
single line of decryption code.

## What I learned

Entropy is a five-second triage step, not a proof. High entropy narrows
your hypothesis to {real cipher, compression, both}; it does not confirm
"real cipher," and treating it as confirmation is how people end up
reverse-engineering a nonexistent key schedule for what was actually
`zlib.compress`. Low-to-mid entropy is the more useful signal in
practice — it tells you, fast, "don't reach for a debugger yet, reach for
a known-plaintext XOR recovery instead," and that's usually the cheaper
path to the answer.
