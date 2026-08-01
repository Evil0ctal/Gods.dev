---
title: 'a_bogus, End to End'
description: 'One query parameter has eaten more of my time than the rest of my scraper codebase combined — a walk through finding, porting, and living with an anti-bot request signature.'
pubDate: 2021-10-06
tags: ['reverse-engineering', 'anti-bot', 'python']
---

In the async scraping project I maintain, one query parameter has eaten
more of my time than every other part of the codebase combined:
`a_bogus`. It's a signature that a well-known short-video platform's web
client attaches to requests, and if you get it wrong — or leave it off —
you don't get an error, you get a 200 with an empty result list. That's
worse than a 403, because from the outside it looks like success.

## Why "just call the API" doesn't work

The endpoint itself is trivial: a GET with query params anyone can read
from the network tab. What isn't trivial is that the server checks one
of those params against a value it can recompute from the request, and
if the two don't match, it quietly returns nothing. The actual work of a
scraper against a protected endpoint like this was never the HTTP call.
It's reproducing whatever computed that one parameter, exactly, every
time, and keeping that reproduction working as the algorithm shifts
under you. The internals of a signer like this move fast enough that
stating them precisely here would be wrong by the time anyone read it —
what's stable is the *process* for finding and maintaining one.

## Isolating the signer without reading the whole bundle

The signature is produced somewhere inside a large, obfuscated JS bundle
loaded alongside the page — and the bundle's own URL changes often
enough that bookmarking it is pointless. The reliable way in is the same
one that works on any signer: search the page's loaded sources for the
literal parameter name, then set a breakpoint on the network call and
walk the call stack upward from there until you land on the function
that actually assembles the value. It's slower than it sounds the first
time and fast every time after, because the shape of the search doesn't
change even when the bundle does.

## Execute vs. reimplement — the decision that matters more than the algorithm

Once you've isolated the function, there are two working strategies, and
picking between them matters more than getting the algorithm details
right on the first attempt.

**Extract and execute the real JS.** Pull the exact function (and its
dependencies) out of the bundle and run it in a real JS engine from
Python — a Node subprocess is the simplest version. It survives internal
algorithm tweaks as long as the function's calling convention doesn't
change, at the cost of a JS runtime dependency and a slower per-request
call.

**Fully reimplement in Python.** Faster per call, no external runtime,
but brittle: any internal change to the hashing or mixing steps breaks
the port silently — you get a *wrong* signature, not a crash — until you
notice your success rate has quietly dropped.

```python
# a minimal execute-the-real-JS bridge, used as the fallback path
import json
import subprocess

def sign_via_node(params: dict) -> str:
    payload = json.dumps(params)
    proc = subprocess.run(
        ["node", "signer_bridge.js", payload],
        capture_output=True, text=True, check=True,
    )
    return proc.stdout.strip()
```

In practice I run a hybrid: the Python reimplementation is the default
path for speed, and the Node bridge sits behind a feature flag as a
fallback I can flip the moment the reimplementation starts failing,
which buys time to re-derive it without the whole service going down.

## Maintaining it is the actual job

The end-to-end lesson isn't the algorithm, it's the operational loop
around it. I track signature validity as a metric — a small percentage
of requests going out with a signature I *expect* to be wrong, so a drop
in the success rate for those shows up before real traffic is affected.
A silent drop in validity gets treated as an outage, not a bug ticket,
because for anyone depending on the batch endpoint, it is one.

None of this is a walkthrough of any specific service's current
defenses — the internals move too fast for that to stay accurate, let
alone useful, by the time you'd read it. It's a description of a
process — isolate, decide execute-or-reimplement, prove it against
fresh captures, monitor for drift — that outlives any single algorithm,
because the algorithm is guaranteed to change and the process is the
only part you actually get to keep.
