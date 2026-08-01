---
title: 'alg:none — The JWT Bug That Won''t Die'
description: 'The header of a JWT says which algorithm signed it — and if your code trusts that field, an attacker can just set it to "none" and delete the signature. Still shows up in 2026.'
pubDate: 2022-06-21
tags: ['security', 'jwt']
---

Take any valid JWT, base64-decode the header, change `"alg": "HS256"` to
`"alg": "none"`, strip the signature off the end entirely, and re-encode
it. On a library configured the naive way, that forged token is accepted
as valid. No key, no cracking, no brute force — you just asked the
server to trust a field the token itself supplied about how to check
itself.

This bug is old — it's been a known JWT footgun for over a decade — and
it still turns up, because the mistake is subtle and the JWT spec itself
half-invites it.

## Why the token gets to claim its own algorithm

A JWT is three base64url segments: header, payload, signature.

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzQyIn0.dG90YWxseS1yZWFsLXNpZ25hdHVyZQ
```

Decode the header and it's just JSON:

```json
{"alg": "HS256", "typ": "JWT"}
```

The `alg` field tells the verifier which algorithm to use — HMAC with a
shared secret, RSA with a public key, or, per the spec, `none` for an
unsigned token (a real, intended use case for cases where integrity
doesn't matter). The insecure pattern is a verifier that reads `alg` from
the untrusted token and dispatches on it:

```python
# WRONG: the token tells you how to verify itself
import json, base64

def verify(token: str, secret: str) -> dict:
    header_b64, payload_b64, sig_b64 = token.split(".")
    header = json.loads(base64.urlsafe_b64decode(header_b64 + "=="))

    if header["alg"] == "none":
        return json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
    elif header["alg"] == "HS256":
        # ... check HMAC signature against secret ...
        ...
```

An attacker doesn't need your secret. They just build a token with
`alg: none`, no signature, and whatever payload they want —
`{"sub": "user_42", "role": "admin"}` — and this code hands the payload
straight back as verified.

The related variant is worse in practice: an attacker changes
`HS256` to a case an implementation still recognizes but handles wrong,
or — the classic 2015-era bug — swaps `RS256` for `HS256` and, knowing
your RSA *public* key (which is, by definition, public), signs a token
with HMAC using the public key string as the HMAC secret. A verifier
that dispatches its algorithm off the token's own header will happily
"verify" that HMAC signature against the same public key string,
because from its point of view a signature checked out.

## The fix: the caller decides the algorithm, not the token

```python
# RIGHT: you specify exactly what you accept, the library does not guess
import jwt  # PyJWT

def verify(token: str, secret: str) -> dict:
    return jwt.decode(token, secret, algorithms=["HS256"])
```

`algorithms=["HS256"]` is not decoration — it's the actual fix. PyJWT
checks the token's `alg` header against that allowlist and rejects
anything else, including `none`, before it ever tries to check a
signature. The vulnerability isn't really about signature verification
code being buggy; it's about letting an attacker choose which security
check runs.

```python
# also wrong, in the opposite direction: accepting everything
jwt.decode(token, secret, algorithms=["HS256", "RS256", "none"])
```

`"none"` in that list means exactly what it says — the library will
accept unsigned tokens as valid. It has legitimate uses (an internal
system that only cares about the payload's authenticity via other
means), but it should never sit in the same allowlist as an algorithm
you use for real authentication.

## A quick self-check

```python
import jwt

try:
    payload = jwt.decode(
        forged_token,
        key,
        algorithms=["HS256"],   # never leave this open-ended
    )
except jwt.exceptions.InvalidAlgorithmError:
    print("rejected: alg not in allowlist")
```

If your codebase has `jwt.decode` calls without an explicit
`algorithms=` list, or with a list that includes more algorithms than
you actually issue, that's worth an audit today, not on the next
security pass.

## What I learned

The lesson generalizes past JWT: never let untrusted input specify how
it should be validated. A JWT header, a `Content-Type` claimed by an
uploaded file, a `format` query parameter that picks a deserializer —
same shape of bug every time. The check that decides "is this trusted"
has to come from configuration your code controls, never from a field
the thing being checked gets to fill in itself.
