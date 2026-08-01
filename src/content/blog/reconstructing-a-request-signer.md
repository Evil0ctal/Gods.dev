---
title: 'Signing the Unsignable: Reconstructing a Request Signer'
description: 'Anti-bot signature parameters look like secrets but behave like pure functions — how to isolate one from a minified bundle, port it, and prove the port against captures it never saw.'
pubDate: 2024-12-23
tags: ['reverse-engineering', 'anti-bot', 'python']
---

Hit an endpoint with correct-looking params and get a 200 back — except
the body is empty, or it's a risk-control style JSON error instead of
data. The request looks identical to the one in the browser's network
tab, except for one query parameter that's forty-odd characters of what
reads like base64 noise.

## A signer is a pure function wearing a disguise

Strip away the marketing language around "anti-bot protection" and
you're almost always looking at a deterministic function: feed it the
same URL, params, and a bit of client state, and it produces the same
signature every time. That's the load-bearing fact, because it means the
problem is tractable — you're not defeating a secret, you're
reimplementing a function whose inputs and output you can both observe.

```text
signature = f(url, params, timestamp, ua, some_client_state)
```

The "state" part is what makes these annoying rather than trivial — it's
rarely just the request. It's commonly folded together with things like
a rolling counter incremented per request, a canvas or WebGL fingerprint
hash computed once per session, or a value stashed in a cookie or local
storage on a previous page load. None of that is secret in the
cryptographic sense. All of it is observable if you know where to look.

## Finding the function, not guessing at it

Don't read the whole bundle. Set a breakpoint on the network layer and
walk *backwards* from there:

- Break on `XMLHttpRequest.prototype.send` or `window.fetch`, conditioned
  on the URL containing the endpoint you care about.
- When it hits, the call stack above you is the chain that built the
  request. Walk up frame by frame — most of it is unrelated plumbing
  (retry wrappers, interceptors, logging), and one or two frames are the
  actual signer.
- Set a watch expression on the parameter object instead if the stack is
  too deep to walk by hand — a watch on `params.signature` (or whatever
  the field is called) pauses exactly when it's assigned, which is a
  much shorter jump to the function that computed it.

Once you're standing inside the signer function itself, don't try to
read it top to bottom in a minified file. Copy the function out, paste it
somewhere with real formatting, and rename the obfuscated locals as you
understand them — `_0x4a2b` becomes `timestamp_str` the moment you know
what it holds. You are not reading obfuscated code faster. You are
converting it to readable code as you go, one variable at a time, and
you never re-read the unreadable version twice.

## The two things worth separating early

Signers tend to have two very different kinds of logic tangled together,
and separating them early saves a lot of wasted effort.

**Environment collection** — canvas hashes, plugin enumeration, screen
dimensions, timing jitter. This is usually there to make the signature
session-specific and annoying to replay across machines, not to add real
cryptographic strength. You often don't need to understand *why* each
value is collected — you need to know you can capture it once, live,
from a real browser context, and feed it into your port as an opaque
blob.

**The actual signing transform** — some combination of concatenation, a
hash function, and an encoding step (base64, hex, or a custom alphabet).
This is the part actually worth reversing carefully, because it changes
request to request and you can't just capture and replay it.

Treating those as separate problems means you get a working port faster:
hardcode or live-capture the environment blob first, get the transform
right against known input/output pairs, and only go back to understand
where the environment values come from if you need to generate fresh
ones yourself.

## Rebuilding it in Python, and proving it

The Python port is only trustworthy once it's been checked against pairs
it didn't see during development:

```python
def verify_signer(python_fn, captured_pairs):
    mismatches = []
    for params, expected_sig in captured_pairs:
        got = python_fn(**params)
        if got != expected_sig:
            mismatches.append((params, expected_sig, got))
    return mismatches

# captured_pairs: real (params, signature) pairs pulled from a live capture,
# never ones the port was tuned against — that's the whole point of the check
```

If `verify_signer` comes back empty against a batch of pairs you didn't
look at while writing the function, you're done — for now. The signer
will change eventually, because it always does, and the same
breakpoint-and-walk process is how you find the new one. The work was
never "solve it once." It's "have a fast, repeatable way to solve it
again."
