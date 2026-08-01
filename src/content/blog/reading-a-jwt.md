---
title: 'How to Read a JWT (and What It Confesses)'
description: 'A JWT is base64, not encryption — anyone holding the token can read every claim inside it without a key. Here is what the three segments mean and what they quietly reveal.'
pubDate: 2020-06-25
tags: ['security', 'jwt']
---

Take any JWT out of a browser's dev tools — an `Authorization: Bearer`
header, a cookie, doesn't matter — and paste the middle segment into a
base64 decoder. No key, no tool beyond `base64 -d`, no special access.
You'll get back a JSON object, in full, readable by anyone who has the
token. This surprises people constantly, because "token" sounds
opaque, and a JWT is not opaque. It's signed, not encrypted, and that
distinction is the entire post.

## Three segments, three jobs

A JWT is three base64url-encoded chunks joined by dots: `header.payload.signature`.

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiI0MjIiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3NTQ0MTQ0MDB9.
4f8c1e0b7a9d3f2c5e6a1b8d9c0f3e2a1b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e
```

```python
import base64
import json

def decode_segment(segment: str) -> dict:
    # JWT base64 is unpadded; base64.urlsafe_b64decode wants padding
    padded = segment + "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(padded))

header, payload, signature = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", "eyJzdWIiOiI0MjIiLCJyb2xlIjoiYWRtaW4iLCJleHAiOjE3NTQ0MTQ0MDB9", "..."
print(decode_segment(header))   # {'alg': 'HS256', 'typ': 'JWT'}
print(decode_segment(payload))  # {'sub': '422', 'role': 'admin', 'exp': 1754414400}
```

The **header** names the signing algorithm and token type. The
**payload** is the claims — whatever the issuer chose to put in the
token: user id, role, expiry, scopes, sometimes far more than that.
The **signature** is a MAC or digital signature over the first two
segments, computed with a key only the issuer holds. Decoding needs no
key. *Verifying* needs the key. Those are different operations, and
mixing them up is the root of most JWT bugs.

## What the payload usually confesses

Pull apart JWTs from a handful of real services and a pattern shows up
fast: people put more in the payload than they mean to, because it's
convenient and nobody thinks about who else can read it.

- **Role and permission claims in plaintext** — `"role": "admin"`,
  `"is_staff": true`. Fine if the server always re-verifies the
  signature and never trusts a claim it hasn't checked against its own
  authorization logic. Not fine if any downstream service reads the
  claim without verifying, which happens more than you'd hope in
  microservice setups where "it's an internal request" quietly becomes
  "so we skip verification."
- **Internal identifiers** — database row ids, internal service names,
  sometimes a full internal email or an old username that was never
  meant to be user-facing.
- **Timing information** — `iat` (issued at) and `exp` (expiry) tell an
  attacker your token lifetime, which is useful for timing a replay or
  understanding your session model.
- **Scope details that map your API's shape** — a `scopes: [...]` array
  is a partial index of what the backend can do, handed to anyone
  holding a token.

None of this is a vulnerability in the JWT spec. It's a vulnerability
in treating the payload like a private note when it's closer to a
postcard — readable by the token holder and anyone they show it to.

## The bug that actually matters: `alg: none`

Reading claims is a privacy leak. The classic *exploit* lives in the
header, specifically the `alg` field, because some early JWT libraries
trusted whatever algorithm the token claimed to use instead of
enforcing what the server expected.

```python
# the header an attacker crafts by hand
{"alg": "none", "typ": "JWT"}
```

Set `alg` to `none`, drop the signature segment entirely, and a
library that honors the header's stated algorithm will accept the
token as validly "signed" — because "none" is, per spec, a legal
(if inadvisable) algorithm meaning no signature at all. Edit the
payload to `"role": "admin"`, and you've forged an admin token without
ever touching a key. This is a well-known, well-documented class of bug
against libraries that don't pin the expected algorithm; the fix is
never to trust the header's `alg` field — always specify the algorithm
you expect on the verifying side and reject anything else outright.

```python
import jwt  # PyJWT

# correct: the algorithm is an argument you supply, not a value you trust from the token
claims = jwt.decode(token, key=SECRET, algorithms=["HS256"])
```

A related variant targets asymmetric setups (`RS256`): if the verifier
naively uses whatever key material is available, an attacker who knows
the server's RSA *public* key can sign a token with `alg: HS256` and
use the public key as the HMAC secret — many libraries treat "a key"
as interchangeable regardless of which algorithm it was meant for. Same
fix: pin the algorithm, don't let the token pick.

## What I learned

The habit worth keeping: whenever a JWT shows up in a design or a
debugging session, decode it immediately — it takes ten seconds and it
tells you exactly what's actually flowing through your system versus
what the docs claim is flowing through it. And when reviewing anything
that *verifies* a JWT, the one question that matters is whether the
algorithm is pinned by the verifier or read from the token. If it's
read from the token, that's not a signed token anymore. It's a payload
with a signature attached that nobody's actually checking.
