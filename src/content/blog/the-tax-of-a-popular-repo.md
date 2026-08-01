---
title: 'The Tax of a Popular Repo'
description: 'Most issues filed against a scraping tool are not bugs in the tool — they are the upstream platform rate-limiting a user, filed by someone who has no way to tell the difference.'
pubDate: 2026-01-22
tags: ['essay', 'open-source']
---

A typical issue title: "API returns empty result, please fix." No stack
trace, no request that reproduces it, no mention of which endpoint. Nine
times out of ten the actual cause is that the platform being scraped
started rate-limiting that person's IP an hour ago, the tool is behaving
exactly as designed, and the fastest path to a resolved issue is
explaining that to someone who is certain it's a bug because the thing
that used to work stopped working. That message, in some form, is most of
what a popular repo's inbox looks like.

## Stars don't cost anything. Issues do.

Nobody warns you about this ratio going in: the growth that makes a repo
feel successful is the same growth that fills the inbox with reports you
can't act on. A tool with ten users gets ten informed bug reports. A tool
with ten thousand users gets the same rate of real bugs, plus a long tail
of "it's not working" from people who have never opened the source, never
checked the closed issues, and have no framework for distinguishing "the
library has a bug" from "the website changed" from "I'm being rate
limited" from "I typed the URL wrong." The tool didn't get worse. The
population reporting on it got much less selected for technical context.

## Where rate limits actually bite

This is the specific failure mode that eats the most triage time on a
scraping project, because it looks identical from the user's side to a
real bug and requires platform-specific knowledge to diagnose from the
maintainer's side.

The target platform enforces limits per IP, per account, sometimes per
signature-derivation pattern if it thinks it's seeing automated traffic.
A user with the exact same code, run at a different time of day or from a
different network, gets a completely different result. So the same
symptom — empty response, sudden 403, a field that comes back null —
shows up in the tracker attached to wildly different root causes, and
sorting them means asking the same three questions on every single issue:

```text
1. What's the exact URL or ID you passed?
2. What's the full response body and status code, not just "it failed"?
3. Does it work if you wait ten minutes and retry?
```

Half the queue resolves itself at question 3. The other half turns out to
be something worth fixing. There's no way to tell which half you're in
without asking, and asking, waiting for a reply, and following up is
the actual maintenance cost — not the code fix, the conversation required
to get to a state where a code fix is even possible.

## What triage actually looks like

The move that keeps this sustainable isn't heroics, it's a filter applied
consistently. An issue template that forces the reporter to paste the
actual request and response before the issue can even be filed removes a
meaningful fraction of the ambiguous cases up front — people who won't
fill it out usually didn't have a reproducible bug to begin with. A pinned
FAQ entry for "getting empty results" that explains rate limiting in
plain language, linked as the very first reply to anything matching that
shape, turns a diagnosis into a copy-paste.

None of that eliminates the volume. It just moves the cost from "read and
diagnose every report individually" to "maintain one good template and
one good canned answer, and spend the saved time on the reports that
survive the filter" — which are usually the ones worth having.

## The actual tradeoff

A popular repo is a standing obligation, not a one-time achievement, and
the size of that obligation scales with adoption in a way that has
nothing to do with how good the code is. The lesson isn't "don't build
popular things." It's that the maintainer inbox is a second, unpaid job
that comes bundled with success, and the only sustainable answer is
building infrastructure — templates, FAQs, bots that close stale issues —
that does the repetitive part of triage so a person only has to look at
what's left.
