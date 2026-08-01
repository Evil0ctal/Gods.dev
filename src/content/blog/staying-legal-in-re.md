---
title: 'Staying Legal in Reverse Engineering'
description: 'The line that actually matters is not technical skill, it is three boring questions asked before you open a debugger: authorized for what, scoped to where, and shared with whom.'
pubDate: 2020-04-29
tags: ['essay', 'reverse-engineering', 'ethics']
---

Someone once asked me to help pull the paid content out of an app they
didn't have a subscription to, framed as "just curious how it's built."
The technical part would have taken an evening. I said no in about ten
seconds, and the reason had nothing to do with difficulty. It's the same
reason I turn down a chunk of requests that land in my inbox: the
technique is identical whether you're doing security research or
committing theft, and the only thing that separates them is a set of
questions that have nothing to do with skill.

## Authorization is the first fork in the road

The first question is not "can I" — with enough time, almost always yes.
The first question is "was I authorized to look at this, and by whom."
Authorization on your own property, your own purchased device, your own
account: straightforward, nobody else's call to make. Authorization on
someone else's system, someone else's app, someone else's users' data:
you need it explicitly, and "the terms of service didn't say I couldn't"
is not authorization, it's the absence of a specific prohibition, which
is a very different and much weaker thing.

This is also where "research" as a label stops doing any work. Calling
something research doesn't change what you did to a system you weren't
authorized to touch. It changes how it sounds when you explain it
afterward, which is not the same thing as changing whether it was legal.
If the honest description of what you're about to do would need the word
"research" to sound acceptable, that's worth noticing before you start,
not after.

## Scope creep is where people get hurt

Plenty of reverse engineering starts with clean, defensible authorization
and drifts somewhere else entirely. You're authorized to analyze your own
purchased device's firmware. Somewhere in that firmware is a shared
library, and that library talks to a cloud API, and now you're one
curious step from probing a server you were never authorized to touch,
using access the device itself doesn't need to have. Nobody decided to
cross that line — it happened because "keep going" is the default motion
of investigation and nothing forced a checkpoint.

The discipline that actually holds the line is asking, at every hop,
whether the authorization you started with actually covers the thing
you're about to do next — not whether it's technically adjacent to
something you were allowed to do. Analyzing your own device's firmware
does not automatically authorize probing the server it talks to. Those
are two different systems with two different owners, and the fact that
one leads naturally to the other in a debugger session doesn't merge
their permission structures.

## The redistribution trap

This is the mistake that turns legitimate analysis into something else
entirely, and it's the easiest one to make because it feels like the
natural, generous last step: you figured something out, so you want to
share the proof. Sharing *that something works* — a writeup, a technique,
even working code that reproduces the method on data you're authorized to
use — is usually fine and is how the field advances. Sharing *the actual
protected content you extracted* — the video, the paid chapter, the
proprietary file — is a different act entirely, even if the analysis that
got you there was completely legitimate.

The tell I use on myself: would this artifact let someone who did none of
the work get the thing they weren't authorized to have? A tool that
reimplements a decryption algorithm is knowledge. The decrypted file
itself, posted next to it, is distribution of content you didn't have
rights to distribute — the legitimacy of the research doesn't transfer to
the output the research happened to produce.

## Where this actually leaves you

None of this requires a law degree, and none of it makes reverse
engineering itself illegal — most of what I do is squarely legitimate,
and staying that way is mostly a matter of asking three boring questions
before touching a debugger: am I authorized for this specific system, am
I still inside the scope that authorization covers, and am I about to
share something I extracted rather than something I learned. Skill gets
you through the technical part. Those three questions are what keep the
technical part defensible.
