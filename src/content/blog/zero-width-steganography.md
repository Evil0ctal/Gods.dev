---
title: 'Hiding Data in Plain Sight with Zero-Width Characters'
description: 'A paragraph of ordinary text can carry a payload nobody sees, because U+200B and friends render as nothing. Here is how the encoding works and how to catch it.'
pubDate: 2026-02-21
tags: ['security', 'steganography']
---

Copy this sentence into a hex viewer and count the bytes: "Hello there."
Now copy it from somewhere you don't fully trust and do the same thing.
If the byte count doesn't match the character count you expect, you've
probably found a zero-width character — and if there are several of them
placed non-randomly, you've probably found a payload.

Unicode has a small set of code points defined to render as literally
nothing: no glyph, no width, no visual trace. `U+200B` (zero width
space), `U+200C` (zero width non-joiner), `U+200D` (zero width joiner),
`U+FEFF` (originally a byte-order mark, now often repurposed). Browsers,
editors, and terminals all happily render text containing them as if
they weren't there. Which means you can use them as a two-symbol
alphabet and smuggle a bitstream through any text field that doesn't
strip them.

## The encoding is embarrassingly simple

Pick two zero-width characters to stand for 0 and 1. Convert your
payload to bits. Interleave the resulting zero-width sequence between
the visible characters of a cover text — after every word, at the end,
wherever you like, as long as the position is decodable on the other
end.

```python
ZW0 = "​"  # zero width space  -> bit 0
ZW1 = "‌"  # zero width non-joiner -> bit 1

def encode(cover: str, payload: bytes) -> str:
    bits = "".join(f"{byte:08b}" for byte in payload)
    hidden = "".join(ZW1 if b == "1" else ZW0 for b in bits)
    # tuck the whole payload at the end — simplest placement, not stealthiest
    return cover + hidden

def decode(text: str) -> bytes:
    bits = "".join("1" if ch == ZW1 else "0" for ch in text if ch in (ZW0, ZW1))
    n = len(bits) - (len(bits) % 8)
    return bytes(int(bits[i:i+8], 2) for i in range(0, n, 8))
```

Run `encode("Meet me at noon.", b"hi")` and paste the result into
Slack, a GitHub comment, a tweet. It reads as "Meet me at noon." to
every human who looks at it. Run `decode` on the copy-pasted string and
you get `b"hi"` back, assuming the platform didn't normalize the text
on the way through — which is the whole game, and I'll get to that.

## Why anyone actually does this

The obvious use is a covert channel: two parties who can only exchange
plain-looking text — a support ticket, a public comment thread, a forum
post — pass a few bytes back and forth without anyone glancing at the
thread noticing anything odd. It's not high-bandwidth. It's low-and-slow
by design.

The less obvious use, and the one that shows up more in practice, is
**watermarking**. If you generate text — AI output, a leaked internal
document, a licensed dataset sample — you can zero-width-encode a
tracking id into every copy you hand out. Nobody sees it. If a copy
leaks, you decode the zero-width characters out of the leaked text and
know exactly which recipient it came from. This is a real, deployed
technique, and it's a good reason to habitually strip zero-width
characters from any text you paste from an untrusted source before you
trust it not to be tagged.

## How to actually find it

You don't need anything exotic. Zero-width characters are just
Unicode code points; any language's standard string handling can spot
them.

```python
import unicodedata

ZERO_WIDTH = {"​", "‌", "‍", "‎", "‏", "﻿"}

def suspicious(text: str) -> bool:
    hits = sum(ch in ZERO_WIDTH for ch in text)
    return hits > 0

def strip_zero_width(text: str) -> str:
    return "".join(ch for ch in text if ch not in ZERO_WIDTH)
```

For a quick manual check on a specific string, `len(text.encode("utf-8"))`
versus what you'd expect from the visible characters is often enough of
a tell to send you looking closer. For anything you're pasting into a
codebase — README content, a scraped product description, a config
value copied from a chat message — running it through a strip function
before it lands in source control costs nothing and closes off a class
of "invisible character changed the meaning of this line" bugs that
have nothing to do with steganography and everything to do with copy-
paste from rendered web pages.

## What I learned

Zero-width steganography isn't clever cryptography — there's no key,
no real secrecy once someone thinks to look, and any text pipeline that
normalizes Unicode (NFKC normalization strips several of these) breaks
it by accident. Its power is entirely social: nobody looks, because
there's nothing to look at. That's also its ceiling. Treat it the way
you'd treat any obscurity-based scheme — fine for watermarking and
casual signaling, not a substitute for an actual authenticated channel
when it matters who sent what.
