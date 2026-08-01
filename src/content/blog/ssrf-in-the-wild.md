---
title: 'SSRF in the Wild: The Request Your Server Shouldn''t Make'
description: 'A "fetch this image URL" feature is a server-side HTTP client with your infrastructure''s network access and none of a browser''s guardrails. Here is how that gets abused, and how allowlists actually stop it.'
pubDate: 2026-04-11
tags: ['security', 'web']
---

A feature request that shows up in one form or another on almost every
backend: "let users submit a URL and we'll fetch it" — an avatar from a
link, a webhook target, a PDF to render, an OG-image preview for a
pasted link. It's a small feature. It's also a server-side HTTP client
that an anonymous user gets to point wherever they want, and that's the
whole vulnerability in one sentence.

```python
import requests
from fastapi import FastAPI

app = FastAPI()

@app.post("/preview")
def fetch_preview(url: str):
    resp = requests.get(url, timeout=5)
    return {"content_type": resp.headers.get("content-type"), "body": resp.text[:2000]}
```

That endpoint works exactly as intended when someone submits a public
image URL. It also works exactly as intended when someone submits
`http://169.254.169.254/latest/meta-data/iam/security-credentials/`,
because `requests.get` doesn't know the difference between "a URL the
product owner had in mind" and "a URL that reaches your cloud
provider's instance metadata service." It just makes the request, from
inside your network, with whatever access your server has.

## Where the request actually lands

This is Server-Side Request Forgery: you control the URL, the server's
own network position does the requesting. The interesting targets
aren't random internet hosts — they're things reachable *only* from
inside your infrastructure, which is exactly what makes SSRF valuable
to an attacker even when the response body gets truncated or filtered
before it's shown back.

- **Cloud metadata endpoints.** `169.254.169.254` on AWS, GCP, and
  Azure serves instance credentials, IAM role tokens, and startup
  scripts to anything that asks — no auth, because it's assumed only
  the instance itself can reach it. SSRF breaks that assumption.
- **Internal services with no auth of their own.** Admin panels,
  internal APIs, Redis or Elasticsearch consoles bound to a private
  subnet — they skip auth because "nothing outside the VPC can reach
  this." Your SSRF-vulnerable server is inside the VPC.
- **Localhost on the server itself.** `http://127.0.0.1:PORT` reaches
  whatever's listening on the box — a debug endpoint, a management
  port, sometimes the app's own internal API with a different (weaker)
  auth model than the public one.
- **The filesystem, if the scheme isn't restricted.** `file:///etc/passwd`
  works if your HTTP client happens to support the `file://` scheme and
  nobody thought to disable it.

## Why blocklists lose

The obvious first fix is checking the hostname against known-bad
targets. It's also the fix that keeps failing in practice, because the
attacker doesn't need a *new* trick — just a different way of writing
down the same target than the one the blocklist checks for.

```python
BLOCKED = {"169.254.169.254", "localhost", "127.0.0.1"}

def is_blocked(url: str) -> bool:
    from urllib.parse import urlparse
    host = urlparse(url).hostname
    return host in BLOCKED
```

Every one of these gets past that check while landing on the same
target:

```text
http://0177.0.0.1/                 # octal
http://2130706433/                 # decimal IP for 127.0.0.1
http://127.1/                      # short form
http://0x7f.0.0.1/                 # hex
http://[::ffff:127.0.0.1]/         # IPv4-mapped IPv6
http://metadata.google.internal/   # DNS name, not an IP at all
http://attacker.com/ -> 302 -> http://169.254.169.254/   # redirect
```

That last one is the sharpest: even a request library that resolves and
checks the hostname correctly can still be led to the blocked target by
a 302 response, if you validate the URL you were *given* but not every
URL the request *follows*. Blocklisting is trying to enumerate infinite
ways to spell the same address. You will not win that game.

## What actually works: allowlist and resolve-then-check

The reliable fix inverts the check: instead of asking "is this
address bad," ask "is this address on the short list of things we
intended to allow" — and check the address the request will *actually*
hit, after DNS resolution, not the string the user typed.

```python
import ipaddress
import socket
from urllib.parse import urlparse

ALLOWED_SCHEMES = {"http", "https"}

def is_safe_target(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        return False
    if not parsed.hostname:
        return False

    try:
        # resolve DNS ourselves, then check the *resolved* address —
        # a hostname's string form tells you nothing about where it points
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        return False

    for family, _, _, _, sockaddr in infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return False
    return True
```

Pair that with a client configured to **not follow redirects** (or to
re-run this same check on every hop), a short timeout, and a response
size cap, and you've closed the practical paths: no private-range IP,
no metadata service, no redirect laundering. If your product only ever
needs to fetch from a known set of partner domains — webhook receivers,
a specific CDN — an actual allowlist of hostnames is stronger still and
removes the DNS-resolution edge cases entirely.

## What I learned

SSRF is a bug about *trust boundaries*, not about URL parsing — the
parsing mistakes are just where it usually gets caught. Any code path
where user input becomes the target of a request your server makes is
worth a specific question during review: what does this server's
network position grant that a random internet client's doesn't? If the
answer is "access to metadata, internal services, or localhost," that
endpoint needs the allowlist-and-resolve treatment before it ships, not
after the first `169.254.169.254` shows up in an access log.
