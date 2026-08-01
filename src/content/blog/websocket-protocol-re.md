---
title: 'Reverse Engineering a WebSocket Protocol'
description: 'How to go from an opaque WebSocket byte stream to a working client, using frame headers and opcodes as the only map you get.'
pubDate: 2020-03-21
tags: ['reverse-engineering', 'protocol']
---

Open DevTools on a chat app, click the Network tab, filter to WS, and
click a message. What you get is a hex dump like this:

```text
81 8a 3f 2a 91 7c 5c 47 f0 08 5c 47 f0 08
```

No field names, no JSON pretty-printer, nothing that says "this is a
chat message." Just bytes over an upgraded HTTP connection. Reconstructing
the protocol from here is a small, satisfying exercise, and it's the same
exercise every time regardless of what app you're looking at — because
under the hood, it's still just WebSocket framing.

## The frame header is a spec you already have

WebSocket framing is standardized (RFC 6455), so the first several bytes
of *every* frame follow the same layout no matter what app sent it. That's
the part you don't have to reverse — you just have to remember it.

```text
byte 0: FIN(1) RSV(3) OPCODE(4)
byte 1: MASK(1) PAYLOAD_LEN(7)
...extended length, masking key, payload
```

Decoding the example above: `0x81` is `FIN=1, opcode=0x1` (text frame).
`0x8a` is `MASK=1, len=10` — ten bytes of payload, masked, because
client-to-server frames are always masked. The next four bytes are the
masking key, and the rest is the masked payload:

```python
def unmask(payload: bytes, key: bytes) -> bytes:
    return bytes(b ^ key[i % 4] for i, b in enumerate(payload))

frame = bytes.fromhex("818a3f2a917c5c47f0085c47f008")
mask_key, masked = frame[2:6], frame[6:]
print(unmask(masked, mask_key))
```

Once you've XOR-ed against the masking key, you have the raw application
payload — and *that's* where the app-specific reversing starts, because
the wire framing was never the secret. It's just a container.

## The payload is where the app has opinions

Text frames are usually JSON, and JSON is the easy case — read a few
messages, and the field names tell you most of the story:

```json
{"t": "msg", "room": "42", "from": "u_881", "body": "hey", "ts": 1584700000}
```

Binary frames (`opcode=0x2`) are the harder case, and this is where a lot
of higher-throughput protocols land — game state, live cursors, trading
data. No field names, just a packed struct. The move is the same one you'd
use on any binary format: collect ten or twenty frames, diff them
byte-by-byte, and look for what changes together.

```text
frame A: 02 00 2a 00 00 01 3f 8c 00 00
frame B: 02 00 2a 00 00 01 40 12 00 00
                          ^^ ^^ -- this pair moves every frame; likely a coordinate
```

A field that increments steadily across frames is probably a timestamp or
sequence number. A field that only changes when you take an action in the
UI is tied to that action — trigger the action deliberately and watch
which bytes move. That correlation, done patiently over enough frames, is
most of what "reversing a binary protocol" actually is.

## Rebuilding a client

Once you can parse incoming frames, encoding outgoing ones is the same
process run backward — pack the fields into the same byte layout, and
remember client frames need the mask bit set with a real masking key,
even a throwaway random one, or a spec-compliant server will reject them:

```python
import os, struct

def encode_text_frame(payload: bytes) -> bytes:
    key = os.urandom(4)
    masked = bytes(b ^ key[i % 4] for i, b in enumerate(payload))
    header = bytes([0x81, 0x80 | len(payload)])  # assumes len < 126
    return header + key + masked
```

That's enough to hold a real conversation with the server using nothing
but a socket library — no app SDK, no reverse-engineered JS client,
just the protocol you rebuilt from watching frames go by.

## What I learned

The WebSocket spec does more of the work than it feels like it will. The
framing layer is fixed and documented, which means the actual unknown is
always smaller than the hex dump makes it look — usually a handful of
fields inside a payload, not an opaque binary blob. Diffing frames
side-by-side beats staring at one frame and guessing, every time. And the
real tell that you've got it right isn't that the fields *look*
plausible — it's that your own encoded frame gets a real response back
from the server.
