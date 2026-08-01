---
title: 'Reading Code vs Running It'
description: 'A debugger tells you what happened on one path, once — reading the code tells you every path that exists, including the ones your test data never touches.'
pubDate: 2023-08-01
tags: ['essay', 'reverse-engineering']
---

I had a decompiled function once that looked like this, stripped of names,
maybe forty lines of nested branches and a loop with an early exit buried
three levels deep. The fast move was obvious: slap a breakpoint at the
top, run the app, step through, watch the values. I did that for twenty
minutes and learned exactly one thing — what happens when the input is
the one value my test click produced. The other six branches stayed
invisible the whole time. I closed the debugger and read the thing
instead, and had the real picture in ten minutes.

## The trap of running first

Running code is seductive because it gives you *certainty* — you watch a
concrete value flow through a concrete line, and that feels like ground
truth compared to squinting at static text and inferring behavior. It is
ground truth. It's just ground truth about exactly one execution, and
reverse engineering rarely cares about one execution. You care about the
shape of the function: every branch, every early return, every case the
original author thought was worth handling.

A debugger session is a single sample from a distribution. If the
function has a fast path and three error paths, and your test input hits
the fast path, stepping through teaches you the fast path exists and
nothing about the other three. You'd need to manufacture inputs for each
branch to see them all — and to manufacture those inputs, you already
need to know the branches exist, which means you already need to have
read the code. Running only pays off after reading has told you what to
go look for.

## What reading buys you that stepping doesn't

Reading gives you the full control-flow graph in one pass, whether or not
any execution you'll ever produce happens to exercise it. That matters
most exactly where it's most tedious: error handling, validation checks,
the branch that only fires on the 200th call because of some internal
counter. Nobody's test input finds that by accident. Nobody needs to,
if they read it.

```text
func process(buf):
    if len(buf) < 4:            <- never hit by your happy-path test
        return ERR_SHORT
    magic = read_u32(buf, 0)
    if magic != 0x4D5A9000:     <- never hit either
        return ERR_MAGIC
    if counter % 200 == 0:      <- fires once in 200 calls
        return rekey(buf)
    return decode(buf)
```

Step through this with one normal input and you learn `decode` exists.
You do not learn `rekey` exists, and `rekey` is very possibly the
interesting part — the branch an author bothers to write specialized code
for is usually the branch that matters. Reading finds it for free. Running
finds it only if you get lucky or unlucky, two hundred calls in.

Reading also composes across functions in a way that live debugging
doesn't. You can trace a value's entire journey — every function that
touches it, every transform applied — by following references in a
decompiler or an IDE, at your own pace, backtracking freely. A debugger
session is linear and one-directional; if you needed to see what happened
three calls before your current breakpoint, you're restarting the run.

## Where running actually earns its keep

None of this is an argument against running code — it's an argument
against running it *first*. Running is how you confirm a hypothesis
reading gave you, and how you catch the places static analysis lies to
you: obfuscated control flow, runtime-generated code, anything a
decompiler mis-renders because the compiler did something clever. Reading
builds the map. Running is how you check the map against the territory,
targeted at the one or two spots where you have a specific question —
not a general fishing expedition with a breakpoint at the top of a
function you don't understand yet.

The order matters because it changes what a debugger session teaches you.
Step through code you understand and every value you see either confirms
or refutes something specific. Step through code you don't understand yet
and you're just watching numbers change, building a story after the fact
about why. Read first, and the debugger stops being an exploration tool
and starts being a verification tool — which is a much better use of it.
