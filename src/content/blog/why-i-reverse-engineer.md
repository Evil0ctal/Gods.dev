---
title: 'Why I Reverse Engineer'
description: 'Not for the exploit, not for the bragging rights — for the specific, physical relief of watching a black box turn back into a machine.'
pubDate: 2021-12-11
tags: ['essay', 'reverse-engineering']
---

There was an Android app that returned a 200 and a payload that was pure
noise. Not JSON, not protobuf, not gzip with a wrong header — just bytes
with no visible structure, the kind of thing that makes you check whether
you even hit the right endpoint. Most people would shrug and move on. I
spent the rest of that evening on it, and I still remember the exact
moment the noise turned into a length-prefixed field and the whole
response snapped into focus. That feeling is the entire reason I do this.

## The itch is specific, not general

It's not curiosity in the vague, ambient sense people mean when they say
"I like learning new things." It's narrower and more physical than that.
A system that hides its internals is making an implicit claim: *you are
not supposed to understand this.* That claim is what itches. Not the data
behind it, not even necessarily anything useful — the claim itself. An
obfuscated JS bundle, a stripped binary, a proprietary wire format with no
public spec — each one is a small, specific dare, and I have never been
able to leave a dare like that on the table.

Most of what I reverse engineer isn't valuable in any sense a business
would recognize. Nobody needs to know how a particular app derives its
request signature except the six people trying to build the same thing.
The value isn't downstream. The value is in the two hours where the shape
of a black box slowly becomes a machine you can draw a diagram of.

## Systems don't hide by accident

The thing that makes reverse engineering different from, say, reading
open-source code is adversarial intent. Somebody minified that JavaScript
on purpose. Somebody stripped those symbols on purpose. Somebody chose a
binary wire format over a documented JSON API specifically so people like
me would have a worse afternoon.

That changes the posture. Reading open code is comprehension. Reversing
closed code is comprehension *against resistance*, and resistance is
where the actual signal is. Obfuscation isn't random — a function that
got extra-mangled probably guards something the author cared about
protecting. A field that's suspiciously padded, an endpoint that's
suspiciously undocumented — the effort spent hiding a thing is itself
information about how important that thing is. You end up reading the
defense as much as the system.

## It stays interesting because it never repeats

A REST API you build yourself gets boring once the pattern is set — CRUD
is CRUD. A system you're reversing never settles into a pattern you
already know, because every author made different, uncoordinated
decisions about what to hide and how. One app rolls its own XOR cipher
with a predictable seed. Another leans on a real cryptographic library
used badly. A third does nothing clever at all and the only "protection"
is that nobody bothered to look. You can't get bored of that variety
because it isn't one problem, it's a different puzzle wearing the same
hat every time.

There's also a kind of honesty to it that I don't get from most software
work. When you write code, you're negotiating with product requirements,
with taste, with what "good" even means for this particular feature. When
you reverse code, there is exactly one correct answer, and the system
itself is the arbiter. It either does what you think it does or it
doesn't. You test the hypothesis and the system tells you, flatly, if
you're wrong. No stakeholder to convince, no taste to argue about — just
a machine and whether your model of it is accurate.

## What it actually gives you

Not exploits, mostly. Not bragging rights — most of what I reverse never
gets written up, let alone shipped as a tool. What it gives me is a small,
repeatable proof that opacity is a design choice, not a law of physics.
Every closed system I've taken apart makes the next one look less
intimidating, because the pattern repeats: something looks impossible
from the outside and turns out to be a stack of ordinary decisions nobody
explained.

That's the whole appeal, stated plainly: I want to know how the thing
actually works, not how it's described as working. Reverse engineering is
just the only discipline built entirely around answering that question
when the answer wasn't offered to you.
