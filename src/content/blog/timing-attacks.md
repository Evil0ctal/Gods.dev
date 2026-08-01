---
title: 'Timing Attacks and the constant-time Fix'
description: 'A string comparison that returns early on the first mismatched byte leaks how many characters you got right. Here is why that matters for secrets, and what compare_digest actually does about it.'
pubDate: 2025-10-08
tags: ['security', 'cryptography']
---

Here's a comparison function nobody thinks twice about:

```python
def check_token(provided: str, expected: str) -> bool:
    return provided == expected
```

That's correct. It's also a side channel, if `expected` is a secret and
an attacker can measure how long the check takes. Python's `==` on
strings compares byte by byte and bails out the instant it finds a
mismatch. That means a guess that gets the first byte right takes
measurably longer to reject than a guess that gets the first byte
wrong — not because anyone wrote code to leak that, but because "stop
early when you already know the answer" is the natural, efficient way
to write a comparison.

## Why a nanosecond difference is exploitable

One comparison's timing difference is noise — network jitter alone
swamps it. The attack works because you don't need one measurement, you
need thousands, averaged. Send the same guess a few hundred times, take
the median or trim the outliers, and the underlying signal survives the
noise. This is a real, well-documented class of attack against
network services, not just a theoretical worry for people running
benchmarks on bare metal.

The attack loop looks roughly like this: try every possible byte in
position 0, keep the one that's slowest on average (because a correct
first byte means the comparison proceeds to check byte 1, which takes
slightly longer than immediately returning False). Lock that byte in,
move to position 1, repeat.

```python
import time

def timed_attempt(guess: str, check) -> float:
    start = time.perf_counter()
    check(guess)
    return time.perf_counter() - start

def crack_byte(prefix: str, alphabet: str, check, samples: int = 200) -> str:
    best_char, best_time = None, -1.0
    for ch in alphabet:
        guess = prefix + ch
        total = sum(timed_attempt(guess, check) for _ in range(samples))
        avg = total / samples
        if avg > best_time:
            best_char, best_time = ch, avg
    return best_char
```

That turns an *n*-character secret with *k* possible characters per
position from a `k^n` brute force into roughly `k * n` timed guesses —
an exponential problem reduced to a linear one, purely because the
comparison function told you, one byte at a time, "you're getting
warmer."

## What actually needs constant time

Not every comparison. The threat only exists when three things are all
true: the value being compared is secret, an attacker controls one side
of the comparison, and the attacker can measure timing precisely enough
(directly, or statistically over many requests) to extract signal.
Comparing two non-secret strings — say, checking if a URL path matches
a route — gets nothing from constant time and just wastes cycles.

The cases that matter, concretely:

- API key / auth token validation
- HMAC signature verification (webhook signatures, signed URLs, CSRF
  tokens)
- Password hash comparison (though you should be comparing hashes, not
  plaintext — see below)
- Session cookie / API secret comparison of any kind

## The fix, and why it's not "just add a delay"

The instinct to fix this with `time.sleep(random())` is understandable
and wrong — it adds noise, not a floor, and enough samples average
noise away just like it averages away network jitter. The actual fix is
a comparison that takes the *same* number of operations regardless of
where or whether a mismatch occurs.

```python
import hmac

def check_token(provided: str, expected: str) -> bool:
    return hmac.compare_digest(provided, expected)
```

`hmac.compare_digest` (and equivalents in every serious standard
library — Go's `subtle.ConstantTimeCompare`, Node's
`crypto.timingSafeEqual`) walks the full length of both inputs no
matter what, XOR-ing and accumulating a difference flag instead of
returning the instant it sees a mismatch. Same instruction count for a
totally wrong guess and a guess that's off by one byte at the end.
That's the entire fix — not a smarter cipher, not more entropy, just
refusing to let the *shape of the computation* depend on secret data.

One thing it does not fix: length. Comparing strings of different
lengths still short-circuits in most implementations, which leaks
length, not content. That's usually an acceptable leak (token lengths
are rarely secret) but worth knowing rather than assuming away.

## What I learned

The bug here was never in the cryptography — HMAC-SHA256 is fine, the
key is fine, the algorithm is fine. The bug is in the four characters
`== e`. Timing attacks are a good reminder that "secure algorithm,
insecure plumbing" is the default state of most systems: the interesting
crypto gets reviewed, the boring comparison right after it doesn't. Grep
your codebase for `== ` next to anything called `token`, `secret`,
`signature`, or `password_hash`, and replace what you find. It's a
five-minute fix for a bug that otherwise takes months to notice and an
afternoon to exploit.
