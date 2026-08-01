---
title: 'The MP4 Container for Reverse Engineers'
description: 'MP4 is not a bespoke binary blob — it is a tree of self-describing TLV boxes, and that fixed grammar is what hands you a free known-plaintext crib against anything that scrambles the file.'
pubDate: 2025-12-24
tags: ['reverse-engineering', 'formats']
---

Every MP4 you'll ever see, regardless of what camera or app or CDN
produced it, starts with the same eight bytes in the same shape: a
4-byte big-endian size, followed by the ASCII tag `ftyp`. That's not a
coincidence you can exploit once — it's a guarantee you can lean on
every time, because it's how the format itself is defined.

```text
00 00 00 18  66 74 79 70  69 73 6F 6D  00 00 02 00
└─size=24─┘  └──"ftyp"──┘ └─"isom"───┘ └─version─┘
```

## Boxes are TLV, and TLV is a reverser's best friend

MP4 (and its relatives — MOV, HEIC, anything built on ISO BMFF) is not a
bespoke binary blob. It's a sequence of **boxes** (Apple calls them
atoms), and every box has the same three-part shape:

- 4 bytes: box size, big-endian, including the 8-byte header itself
- 4 bytes: box type, always four printable ASCII characters (`ftyp`,
  `moov`, `mdat`, `free`...)
- the rest: payload, which for container boxes (`moov`, `trak`,
  `mdia`...) is just more boxes, nested

That's the whole grammar. A box with size `1` (not `0`) means "the real
size is a 64-bit value in the next 8 bytes," for files bigger than 4GB.
A size of `0` means "this box runs to the end of the file." Everything
else is exactly what it says on the label.

```python
import struct

def walk_boxes(data: bytes, offset=0, end=None):
    end = len(data) if end is None else end
    while offset < end:
        size, box_type = struct.unpack_from(">I4s", data, offset)
        if size == 1:
            size = struct.unpack_from(">Q", data, offset + 8)[0]
        elif size == 0:
            size = end - offset
        yield box_type.decode("ascii", "replace"), offset, size
        offset += size
```

Fourteen lines, and you can enumerate every top-level box in any
MP4-family file without a library, without knowing anything about video
codecs, and without caring whether the payload is H.264, HEVC, or
something proprietary.

## What actually matters if you don't care about video

Most reversing tasks against MP4 files have nothing to do with decoding
frames. What you usually want:

- **`ftyp`** — the brand tells you what produced the file and what it
  claims to be compatible with. Cheap fingerprinting, first eight bytes,
  zero parsing needed.
- **`moov`** — the metadata tree: track count, durations, sample tables
  (where each frame lives in the file, its size, its timestamp). This is
  almost always *not* the obfuscated part, even in protected files,
  because players need to seek before they decode.
- **`mdat`** — the actual media bytes. This is where an app is most
  likely to apply its own scrambling on top of the standard container,
  because it's the only part a generic player can't make sense of
  without cooperating with the app anyway.

That split — cleartext structure around an obfuscated payload — is
common precisely because breaking the *seekability* of a file is
expensive for the app to deal with (every player, including their own,
needs `moov` to work at all), while the raw sample bytes inside `mdat`
are opaque to any generic decoder to begin with. So apps scramble `mdat`
and leave `moov` alone. Once you know that, you know exactly which box
to skip past and which one to attack.

## Why the fixed header is free plaintext

Here's the payoff for reversing anything that wraps or scrambles an MP4:
you know, with certainty, that a real MP4 has `ftyp` at a small,
predictable offset near the start of the file — the size field ahead of
it varies by a few bytes depending on the brand list, but it's never far
from byte zero. If a file that's supposed to be an MP4 comes out looking
like noise, you already have your first eight known-plaintext bytes
(`66 74 79 70`, literally the ASCII for "ftyp") without opening a
debugger, and often the size field ahead of it too, since common brand
strings (`isom`, `mp42`, `M4V `) produce a short, guessable set of size
values.

That's the whole reason this format matters to a reverser who's never
going to touch a video codec: it's not the box grammar you're
exploiting, it's the fact that the grammar is fixed enough to hand you a
crib for free.

## Takeaway

Learn the box walker once — fourteen lines, no dependencies — and you
can orient yourself in any ISO BMFF file in under a minute: what's
cleartext, what's obfuscated, and exactly which eight bytes you already
know before you've read a single byte of the actual file.
