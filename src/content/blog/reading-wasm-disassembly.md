---
title: 'Reading WASM Disassembly: A Field Guide'
description: 'A wall of i32.load and i64.xor with no symbol names is not a translation problem, it is a pattern-recognition problem — here is how to read the shape instead of the instructions.'
pubDate: 2023-05-14
tags: ['reverse-engineering', 'wasm']
---

Run `wasm2wat module.wasm` on almost anything real and you get a wall like this:

```text
(func $sub_4a2 (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32) (local $3 i64)
  local.get $0
  i32.load offset=8
  local.get $1
  i32.load offset=12
  i32.xor
  local.set $2
  ...
```

No names. No comments. Every function is `$sub_4a2` or worse, a bare index
number, and there are two hundred more just like it. The instinct is to
read top to bottom like source code. That instinct will burn a day and
leave you with nothing you can use.

## Structure before semantics

Before reading a single instruction, read the *module*, not the function.
`wasm2wat --generate-names` or `wasm-objdump -x` gives you the skeleton
for free: the import list, the export list, the function table, the
number of memories, the data section. That skeleton answers real
questions before you've traced anything:

- What does the host give this module? (imports — usually a handful:
  `env.memory`, maybe a couple of `env.abort`/`env.log` stubs)
- What does the module give back? (exports — this is your entry-point
  shortlist)
- How much state does it carry? (`(memory (export "memory") 2 16)` tells
  you baseline memory in 64KB pages, min and max)

A module with three exports and forty internal functions has a triage
problem, but it's a small one: you only need to understand three call
graphs, and everything unreachable from those three exports is dead
weight you can ignore entirely.

## Read for shape, not meaning

Once you have an entry point, resist the urge to understand every
instruction. Read for *shape*. A function's shape usually tells you its
job before you know a single variable name:

- **A tight loop bounded by a small constant, full of `i32.shl`/`i32.shr_u`
  and `i32.xor`** — almost always a hash, checksum, or PRNG mix step.
- **A loop over `i32.load`/`i32.store` at increasing offsets with no
  branching** — a memcpy or a buffer fill, not logic worth your time.
- **A function indexing into a big literal table in the data section** —
  an S-box, a lookup-based hash, or a compressed constant table (fonts,
  unicode ranges, static JSON).
- **Repeated calls to the same small function with different offsets** —
  a round function. Count the calls; the count is often a named constant
  somewhere (10 rounds, 16 rounds), and that count is a fingerprint you
  can search for.

None of that requires understanding the algorithm. It requires
pattern-matching the *silhouette* against algorithm families you already
know, the same way you'd recognize a for-loop is a for-loop without
reading its body line by line.

## Landmarks that save you days

Two habits consistently cut hours off a WASM reversing session.

**Magic constants.** `0x9e3779b9` is the golden-ratio fixed-point constant
that shows up in dozens of hash and PRNG designs. `0x5bd1e995` is
MurmurHash2's multiplier. Grep the disassembly text for hex literals and
cross-reference known constant lists before you trace a single branch.

**Memory layout, not instruction flow.** WASM has one flat memory space.
Once you know a struct lives at a fixed offset — say, PRNG state at
offset `0x120`, 2048 bytes long — you can read it from a live instance
and watch it change across calls, with no need to trace the code that
mutates it at all.

```javascript
// dump a 2048-byte state block after N calls — no disassembly required
const buf = new Uint8Array(instance.exports.memory.buffer, 0x120, 2048);
console.log(Buffer.from(buf).toString('hex'));
```

That one line has told me more about a PRNG's state size than an hour of
stepping through `i64.xor` in a debugger ever did.

## What actually works

Reading WASM disassembly is not a translation problem, it's a
pattern-recognition problem. You're not trying to understand every
instruction — you're trying to recognize the *family* the code belongs
to (hash, PRNG, cipher, codec) from its shape, then confirm the guess by
watching memory instead of tracing control flow. The wall of `i32.load`
and `i64.xor` stays a wall right up until you stop reading it like prose
and start reading it like a floor plan.
