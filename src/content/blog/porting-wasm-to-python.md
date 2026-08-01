---
title: 'Porting a WASM Routine to Python, Byte for Byte'
description: 'Understanding an algorithm on paper is not the same as reproducing its exact output — a walkthrough of flattening a stack machine into Python and proving the port with a boring diff loop.'
pubDate: 2024-06-22
tags: ['reverse-engineering', 'wasm', 'python']
---

You've read the WASM. You understand the algorithm on paper. Now you have
to write Python that produces the *exact* same bytes, not "morally
equivalent" bytes. This is where reversing projects quietly die — the
port looks right, runs, produces plausible-looking output, and is wrong
in the ninth byte of every hundredth call because of an overflow you
didn't carry over.

## A stack machine wants to be flattened, not translated line by line

WASM is a stack machine: values get pushed, operators pop two and push
one, `local.get`/`local.set` move things to and from named slots. Reading
it as a stack trace and typing the mirror image into Python usually
produces something that runs but is unreadable, and easy to get subtly
wrong on operator order — `a - b` on a stack is "pop b, pop a, push
a-b"; get that backwards once and every third value downstream looks
close but wrong.

The move that pays off: don't translate instruction by instruction.
Replay the stack by hand once, on paper or in a scratch file, until you
have a small set of explicit named intermediates, then write *that* as
straight-line Python. Slower up front, and it's the difference between
code you can debug in six months and code you can only ever rewrite from
scratch.

```text
;; WASM: (a >> 13) ^ a, then multiply into state
local.get $a
i32.const 13
i32.shr_u
local.get $a
i32.xor
i32.const 0x9e3779b9
i32.mul
```

```python
# flattened, explicit, matches the reading above one-to-one
def mix(a: int) -> int:
    t = (a >> 13) ^ a
    return (t * 0x9e3779b9) & 0xFFFFFFFF   # note the mask — see below
```

## The mask is not optional

This is the single most common bug in a WASM-to-Python port: Python
integers don't overflow. WASM's `i32`/`i64` arithmetic wraps silently at
32 or 64 bits on every add, multiply, and shift. Forget one
`& 0xFFFFFFFF` after a multiply and your output matches the reference for
a while — sometimes for hundreds of calls, if the high bits you're
dropping happen not to matter yet — and then diverges with no obvious
cause.

The fix is mechanical, not clever: mask after every operation that can
overflow the width you're emulating, every time, even when it looks
redundant.

```python
MASK32 = 0xFFFFFFFF
MASK64 = 0xFFFFFFFFFFFFFFFF

def add32(a: int, b: int) -> int:
    return (a + b) & MASK32

def rotl32(a: int, n: int) -> int:
    a &= MASK32
    return ((a << n) | (a >> (32 - n))) & MASK32
```

Write these four or five helpers once, use them everywhere, and stop
trusting yourself to remember the mask inline in the middle of a
fifteen-line function.

## The proof is a diff, not a vibe

"It looks right" is not verification. The way to actually know your port
is correct is to run the *real* WASM module and your Python port side by
side on the same inputs and diff the outputs, not eyeball them.

`wasmtime`'s Python bindings, or a small Node harness calling the
compiled module, both work — the point is you keep the ground truth
executable and callable, and you never delete it once your port "seems
to work." It's your test oracle for as long as the port matters.

```python
import wasmtime

store = wasmtime.Store()
module = wasmtime.Module.from_file(store.engine, "target.wasm")
instance = wasmtime.Instance(store, module, [])
wasm_fn = instance.exports(store)["mix"]

import random
for _ in range(100_000):
    a = random.getrandbits(32)
    assert wasm_fn(store, a) == mix(a), f"mismatch at input {a:#x}"
```

A hundred thousand random inputs, one assert, run it and walk away.
That's a boring loop, and boring is exactly the point — it either passes
silently or it points at the exact input where your understanding of the
algorithm was wrong.

## What the loop actually buys you

Passing that loop is the only thing that lets you delete the WASM
dependency and ship the Python version standalone. Anything short of it
is a port you're hoping is right, and hope is not something you want
load-bearing in code that has to reproduce someone else's byte stream
exactly. The reversing was the hard part. The proof is supposed to be
boring — if it isn't, you haven't actually finished porting yet.
