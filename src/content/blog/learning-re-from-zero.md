---
title: 'Learning Reverse Engineering From Zero'
description: 'Skip the disassembler for the first month — a hex editor, your own network traffic, and a toy cipher teach the actual mental model faster than staring at x86.'
pubDate: 2022-03-04
tags: ['essay', 'reverse-engineering']
---

Every guide I read starting out opened with a disassembler — install
Ghidra, load a binary, here's the `.text` section. I did that, stared at
a screen full of `mov` and `cmp` with no idea what any of it was *for*,
and closed the laptop more discouraged than when I started. The thing
that actually got me moving was much dumber: a hex editor and my own
phone's network traffic, going after questions small enough that a wrong
answer cost me nothing.

## Skip the disassembler, start with the format

A disassembler answers "what does this instruction do," which is useless
if you don't yet have a feel for "what is this file even trying to be."
Start one level up, with structure you can see without decoding a single
opcode. Open any file you're curious about in a hex editor and just look
— a PNG announces itself in the first eight bytes, a ZIP has a
recognizable local file header, most formats put a magic number and a
length field right at the front because that's the boring, universal
pattern every format author reaches for.

```python
with open("mystery.bin", "rb") as f:
    header = f.read(16)
print(header.hex(" "))
# 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52
#  \_____ PNG magic ____/         \_ IHDR chunk starts here
```

That's reverse engineering. No disassembler touched. The skill being
built — noticing structure, recognizing that a length field precedes the
data it describes, learning to spot a magic number — transfers directly
to every binary format you'll ever open, including the ones that do need
a disassembler eventually.

## Intercept your own traffic before anyone else's

The next step that actually builds intuition, and costs nothing legally
or technically, is watching an app you own talk to a server you don't
control, using a proxy on your own device. Point your phone's traffic
through `mitmproxy`, open an app you actually use, and just read what
goes over the wire.

```bash
mitmproxy --mode regular --listen-port 8080
# then point the device's proxy settings at your machine
# and watch requests and responses scroll by, unmodified, just observed
```

Most of it will be boring — analytics pings, image loads. Some of it
won't be: a request that carries an extra header you didn't expect, a
response that's clearly JSON but arrives with a content-type that lies
about it, a field that's obviously an ID but doesn't look like the ID
shown in the UI. Finding that stuff on an app you use every day, on
traffic you're fully authorized to observe because it's your own device
and your own account, is where you build pattern recognition for "this
is worth looking at closer" without any of the legal ambiguity of
pointing a proxy at someone else's system.

## Build the toy version before the real version

Before Isaac64 keystreams or custom TLS-adjacent obfuscation, build and
break something you wrote yourself. Write a XOR cipher against a
repeating key, encrypt a short known text, then write the code that
recovers the key from ciphertext and a guessed crib — no library, twenty
lines, and it teaches the exact reasoning move that scales up later.

```python
def xor_recover_key(ciphertext: bytes, known_plaintext: bytes) -> bytes:
    # if plaintext[i] ^ key[i % n] == ciphertext[i], then
    # key[i % n] == ciphertext[i] ^ plaintext[i]
    return bytes(c ^ p for c, p in zip(ciphertext, known_plaintext))
```

That's the entire idea behind known-plaintext attacks on real keystream
ciphers, just at toy scale where you can see every step. Do this once
against your own cipher and the same move stops feeling like magic the
first time you see it applied to something real — it's the same five
lines, just with a keystream generator you had to identify first instead
of one you wrote yourself.

## Where the disassembler actually earns its place

None of this replaces learning to read disassembly eventually — plenty of
real problems live at the instruction level and there's no shortcut
around that once you're there. But arriving at a disassembler already
knowing what a length-prefixed field looks like, already comfortable
reading a hex dump, already having recovered one key from one ciphertext
with your own hands, means the disassembler is teaching you one new
thing — instructions — on top of a mental model you already have, instead
of trying to teach you everything at once. Start small enough that being
wrong costs nothing, and the intimidating stuff stops being the
starting line.
