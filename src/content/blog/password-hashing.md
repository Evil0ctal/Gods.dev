---
title: 'Password Hashing: Argon2, and Why Not MD5'
description: 'MD5 hashes a billion guesses a second on a gaming GPU. Argon2 is built to make each guess expensive on purpose. Here is the difference, and how salts and work factors actually work.'
pubDate: 2024-03-10
tags: ['security']
---

A consumer GPU can compute somewhere north of ten billion MD5 hashes
per second. That number alone should end the conversation, but it
doesn't, because "hash the password" sounds done the moment you write
`hashlib.md5(password.encode()).hexdigest()`, and the code runs, and it
looks right. It is not right. It was never right for passwords, even
back when MD5 wasn't already broken as a general-purpose hash.

The confusion is that MD5 and SHA-256 are *fast* by design — that's the
point, for checksums and file integrity. Fast is exactly the wrong
property for password storage, because "fast to compute" and "fast to
brute-force" are the same property viewed from two sides.

## What a stolen hash actually costs an attacker

Assume your database leaks — it happens to well-run companies, not
just careless ones. The attacker now has a list of hashes and, if you
did this part right, a per-user salt. Their entire remaining job is:
guess a password, hash it the same way you did, see if it matches.

With `sha256(salt + password)` and a GPU rig, they can try billions of
guesses per second per hash. A password from the "top 10,000 passwords"
list falls in microseconds. Even a decent 10-character password with
mixed case and digits — nominally billions of combinations — falls in
hours to a rented GPU cluster, because the attacker isn't limited by
your server, only by their own hardware.

```python
# what NOT to do
import hashlib

def hash_password(password: str, salt: bytes) -> str:
    return hashlib.sha256(salt + password.encode()).hexdigest()
```

This is a correctness bug wearing a security algorithm's clothes. The
hash function isn't broken. It's just the wrong tool — you want a
function that's *deliberately slow*, and slow in a way that resists
being sped up with custom hardware.

## Salts solve one problem, not the one you think

A salt — random bytes stored alongside the hash, unique per user — stops
one specific attack: rainbow tables, precomputed hash-to-password
lookups. Without a salt, two users with the same password get the same
hash, and an attacker who's precomputed `hash(x)` for every common
password `x` cracks both instantly by lookup. With a per-user salt,
every hash is unique even for identical passwords, so precomputation
doesn't transfer across accounts.

What a salt does *not* do is slow anyone down. `sha256(salt +
password)` is still a fast hash; the attacker just runs the same
billions-per-second attack against each salted hash individually
instead of against a shared table. Salting is necessary. It is not
sufficient. You still need the hash itself to be slow.

## Why Argon2 (and what "work factor" means)

Argon2 — specifically Argon2id, the hybrid variant — won the 2015
Password Hashing Competition and is the current recommendation from
OWASP. Its design goal is the opposite of MD5's: make each hash
computation expensive on purpose, and expensive in a way that resists
being cheapened by throwing custom silicon at it.

It does this with three tunable knobs:

- **time cost** — how many passes over memory the algorithm makes
- **memory cost** — how much RAM each hash computation requires
- **parallelism** — how many threads it uses

The memory cost is the interesting one. GPUs are fast because they have
thousands of cheap cores, but each core has little memory and little
memory bandwidth per core. A hash function that requires, say, 64MB of
RAM *per computation* means a GPU trying to run ten thousand parallel
guesses would need 640GB of fast memory — it doesn't have it. This is
called being "memory-hard," and it's the property that makes GPU and
ASIC cracking rigs far less effective against Argon2 than against a raw
SHA function.

```python
from argon2 import PasswordHasher

ph = PasswordHasher(
    time_cost=3,        # passes over memory
    memory_cost=65536,  # KiB — 64 MB per hash
    parallelism=4,
)

hashed = ph.hash("correct horse battery staple")
# stored: a self-describing string with algorithm, params, salt, and hash
# $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>

try:
    ph.verify(hashed, "correct horse battery staple")
except Exception:
    # VerifyMismatchError on wrong password
    pass
```

Notice the salt isn't a separate column you manage — Argon2's output
string embeds the salt and every parameter used, so verification
doesn't need you to remember what settings you hashed with. That also
means you can tune the cost upward over time (as hardware gets faster)
without breaking verification of hashes created under the old settings.

## Picking the numbers

There's no universal "correct" work factor — it's a trade-off between
login latency on your server and cost to an attacker. A reasonable
starting point most guides converge on: tune the parameters so a single
hash takes somewhere around 200–500ms on your actual production
hardware, then measure and adjust. If login feels slow, you're
protecting your users more than you need to. If it's instant, you
probably aren't protecting them enough. Re-benchmark whenever you
change hardware — a work factor tuned for 2020-era CPUs is doing less
work than you think on anything newer.

## What I learned

Password hashing is one of the few places in security where the
correct answer is "use the library, don't write the primitive" without
qualification. bcrypt and scrypt are acceptable if Argon2 isn't
available in your stack; MD5 and unsalted or single-round SHA are never
acceptable for this job, full stop, regardless of how the hash *looks*.
If you're staring at a schema with a `password_hash` column and you
can't tell from the stored value which algorithm produced it, that's
the first thing to fix — a hash you can't identify is a hash you can't
verify is still doing its job.
