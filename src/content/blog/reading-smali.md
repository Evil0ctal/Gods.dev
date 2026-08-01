---
title: 'Reading Smali Without Losing Your Mind'
description: 'Smali looks like assembly and reads like it once you stop treating registers as mysterious and start tracking them like variables with ugly names.'
pubDate: 2021-07-12
tags: ['reverse-engineering', 'android', 'dalvik']
---

jadx choked on a method — decompilation failed, and it dumped the raw
smali instead of Java. The first reaction is always the same: a wall of
`v0`, `p1`, `invoke-virtual`, and `move-result-object` that looks like
it belongs on a chalkboard in a compilers class. It isn't that bad. It
reads like assembly because it basically is assembly for a register
machine — you just have to learn what the registers mean and stop
expecting curly braces.

## Registers: locals and parameters, that's the whole taxonomy

Every method has a fixed set of registers, split into two groups by
naming convention alone:

- `v0`, `v1`, `v2`, … — **locals**, the method's own scratch space.
- `p0`, `p1`, `p2`, … — **parameters**, what got passed in.

`p0` on an instance method is always `this` — smali doesn't hide the
implicit receiver the way Java source does. If a method takes two
explicit `int` arguments, they land in `p1` and `p2`, with `p0` still
reserved for the instance.

```smali
.method private checkPin(I)Z
    .registers 3
    # p0 = this, p1 = the int argument
    # v0..v? are the locals this method needs

    const/16 v0, 0x3039      # v0 = 12345
    if-ne p1, v0, :fail

    const/4 v0, 0x1
    return v0

    :fail
    const/4 v0, 0x0
    return v0
.end method
```

`.registers 3` at the top isn't "3 locals" — it's the *total* register
count, locals and parameters combined, allocated by the compiler
counting backward from the end. Reading that line tells you immediately
how much scratch space the method actually has before you've parsed a
single instruction.

## invoke-* and reading a call before you read its target

Every method call in smali spells out both *how* it dispatches and
*what* it returns, right there in the mnemonic and the signature:

- `invoke-virtual` — a normal polymorphic call, resolved at runtime
  based on the object's actual class.
- `invoke-direct` — constructors and private methods, resolved
  statically, no virtual dispatch.
- `invoke-static` — no receiver at all.
- `invoke-super` — explicitly calls the parent class's implementation.

```smali
invoke-virtual {p0, p1}, Lcom/example/App;->checkPin(I)Z
move-result v1
```

The call itself never returns a value into a register directly — the
result sits in a holding area until the very next `move-result` (or
`move-result-object`, or `move-result-wide` for 64-bit values) pulls it
into a named register. If you see an `invoke-*` with no `move-result`
after it, the return value is simply discarded — which itself tells you
something: the method was called for a side effect, not its answer.

## Control flow without curly braces

There's no `if { } else { }` block structure — there are conditional
jumps and labels, and you reconstruct the shape of the branch yourself:

```smali
if-eqz p1, :else_branch
    const-string v0, "granted"
    goto :end
:else_branch
    const-string v0, "denied"
:end
invoke-virtual {p0, v0}, Lcom/example/App;->log(Ljava/lang/String;)V
```

`if-eqz` branches when the register is zero (`false`, `null`, or the
integer `0` — smali doesn't distinguish); `if-nez` is its opposite.
The pattern above — test, jump past the "then" arm's `goto`, land in
the "else" arm, converge at a shared label — is the smali skeleton for
every `if/else` you'll see. Loops are the same conditional jump, just
pointed backward at a label above the current instruction instead of
below it.

## What I learned

Smali stops being intimidating the moment you stop reading it
top-to-bottom like prose and start tracking two things as you go:
what's currently in each register, and where each label can jump from.
Sketch it on paper for the first few methods — a column per register,
updated line by line — and the "wall of assembly" turns into
something closer to a spreadsheet. jadx failing to decompile a method
isn't a dead end. It's just a prompt to read one level lower than
you're used to.
