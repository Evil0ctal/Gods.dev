---
title: 'Reversing an Undocumented Protobuf Wire Format'
description: 'No .proto file, no schema, just a binary POST body from mitmproxy — how to walk a protobuf message byte by byte using nothing but the wire format''s own self-describing tags.'
pubDate: 2020-03-01
tags: ['reverse-engineering', 'protobuf']
---

A mitmproxy capture of a binary POST body, `Content-Type:
application/x-protobuf`, no `.proto` file anywhere in the decompiled app.
Just bytes:

```text
0a 05 68 65 6c 6c 6f 10 2a 1a 03 08 01 10 02
```

No schema needed to start. The wire format is self-describing enough to
walk mechanically before you understand a single field's meaning.

## Varints: read one byte, ask one question

Every field in protobuf's wire format starts with a **varint** — a
variable-length integer where each byte contributes 7 bits, and the top
bit says "there's more." Decode it the same way every time:

```python
def read_varint(data: bytes, pos: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while True:
        b = data[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7
```

Everything else in the format is built out of this one primitive, which
is worth internalizing first: field tags are varints, field lengths are
varints, and small integer field values are varints. If you can read a
varint by hand from a hex dump, you can bootstrap the rest of the format
without a `.proto` file at all.

## The tag tells you the field number and how to read what follows

The first varint in every field is a **tag**, and a tag packs two things
into one number: `tag = (field_number << 3) | wire_type`. Unpack it and
you know exactly how much to consume next, with no ambiguity:

| wire_type | meaning | how to read the payload |
|---|---|---|
| 0 | varint | read another varint |
| 1 | 64-bit | read 8 fixed bytes (double, fixed64) |
| 2 | length-delimited | read a varint length, then that many bytes (string, bytes, nested message) |
| 5 | 32-bit | read 4 fixed bytes (float, fixed32) |

Take the capture above: `0a` is `0b00001010` → field number `1`, wire
type `2` (length-delimited). The next byte, `05`, is the length: five
bytes follow — `68 65 6c 6c 6f`, which is `"hello"` in ASCII. Field 2
comes next: `10 2a` → tag `0x10` is field `2`, wire type `0` (varint),
value `0x2a` = 42.

```python
def walk_fields(data: bytes, pos=0, end=None):
    end = len(data) if end is None else end
    while pos < end:
        tag, pos = read_varint(data, pos)
        field_no, wire_type = tag >> 3, tag & 0x7
        if wire_type == 0:
            value, pos = read_varint(data, pos)
        elif wire_type == 2:
            length, pos = read_varint(data, pos)
            value, pos = data[pos:pos + length], pos + length
        elif wire_type == 1:
            value, pos = data[pos:pos + 8], pos + 8
        elif wire_type == 5:
            value, pos = data[pos:pos + 4], pos + 4
        else:
            raise ValueError(f"unhandled wire type {wire_type}")
        yield field_no, wire_type, value
```

That loop needs zero knowledge of the actual schema and correctly walks
any valid protobuf message, because the wire format is fully
self-describing at the byte level — what it can't tell you is what each
field number *means*, which is the part you have to infer.

## Reconstructing a schema by inference, not decompilation

Once you can walk the fields mechanically, building a usable schema is a
matter of comparing patterns across many captures, not reading any
single one closely:

- **Capture the same request shape repeatedly** — same endpoint,
  different inputs — and watch which field numbers stay present versus
  which appear only sometimes. Optional fields drop out; required ones
  don't.
- **Nested length-delimited fields are themselves valid protobuf** more
  often than not. If a field-2 payload doesn't decode as clean UTF-8
  text, try running the walker recursively on it before assuming it's
  raw bytes.
- **Field numbers stay stable across app versions far more than field
  names ever were** — protobuf's whole compatibility model depends on
  this — so a schema you infer from an old capture usually still lines
  up against a newer one, which is a nice property when the app updates
  faster than you can re-derive things.
- `protoc --decode_raw < capture.bin` does everything above for you if
  you just want field numbers and wire types without writing the walker
  yourself. Worth reaching for before you write your own, and worth
  understanding by hand anyway so you're not stuck when it guesses wrong
  on a nested message.

## What's actually hard here

Nothing in the wire format is hard — it's four wire types and one
integer encoding. What's hard is naming: field 7 being `user_id` versus
`session_token` is not recoverable from the bytes, only from context
(what values it holds, when it appears, what the response looks like
when you vary it). The wire format gives you structure for free.
Semantics you still have to earn.
