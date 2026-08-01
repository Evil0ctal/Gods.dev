---
title: 'The Headers That Fingerprint You'
description: 'Two requests can carry the same User-Agent and still be told apart in milliseconds — the giveaway is almost never the header you were worried about.'
pubDate: 2023-08-22
tags: ['web', 'privacy', 'reverse-engineering']
---

Send this from `curl` and from a real Chrome tab, both spoofing the exact
same User-Agent string:

```bash
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36" https://example.com/api
```

One of them gets served. One gets a 403 or a suspiciously generic error
page. Same User-Agent, same IP if you're on the same machine, same TLS
version even. The thing that gave you away almost never shows up in the
header you carefully spoofed — it's in the ten headers you didn't think
about.

## The header everyone spoofs, and the ones nobody does

User-Agent is the header people fix first because it's the one they know
about. That's exactly why it's the weakest signal on its own — anti-bot
systems assume it's fake and look at whether everything *around* it is
consistent with the claim.

A real Chrome 115 request on Windows carries a specific, boring, very
consistent set of companions:

```text
sec-ch-ua: "Not/A)Brand";v="99", "Chromium";v="115"
sec-ch-ua-mobile: ?0
sec-ch-ua-platform: "Windows"
sec-fetch-site: same-origin
sec-fetch-mode: cors
sec-fetch-dest: empty
accept-language: en-US,en;q=0.9
accept-encoding: gzip, deflate, br
```

Send a User-Agent that claims Chrome 115 on Windows, then send none of the
`sec-ch-ua-*` client hints and no `sec-fetch-*` headers at all, and you've
told the server more than you told it with the honest version. Real
browsers don't get to opt out of client hints. A request claiming to be
one that lacks them is claiming to be a browser from before those headers
existed while also claiming a version number that postdates them. That
contradiction is free to detect — it's a string comparison, not a model.

## Order and casing are a fingerprint too

This is the one that trips people up because it's invisible in most
tooling. HTTP header *order* is not meaningless — Chrome sends headers in
a fixed sequence baked into its network stack, and that sequence differs
from Firefox's, which differs from curl's, which differs from whatever
your HTTP client library decided was a sensible default.

`requests` in Python lowercases and alphabetizes; `httpx` preserves
insertion order but that order is whatever you typed in your dict; `curl`
has its own fixed order. None of them match a real browser's byte-for-
byte header sequence, and one layer down the same trick works against
your TLS ClientHello — JA3 fingerprints your cipher suite list and
extension order the same way header order fingerprints your HTTP client.

```python
import httpx

# insertion order becomes wire order in httpx — most people get this
# backwards and paste headers in alphabetical order out of habit
headers = {
    "Host": "example.com",
    "Connection": "keep-alive",
    "sec-ch-ua": '"Not/A)Brand";v="99", "Chromium";v="115"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 ...",
    "Accept": "text/html,application/xhtml+xml,...",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Dest": "document",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
}
r = httpx.get("https://example.com", headers=headers)
```

Matching this order for one browser version, on one OS, is doable. Keeping
it correct as Chrome ships a new version every few weeks is the part
people give up on, which is exactly why header-order fingerprinting stays
effective for so long — it doesn't need to be clever, it just needs
maintenance costs to be asymmetric in the defender's favor.

## What Accept-Language and Accept-Encoding leak

These two get treated as boilerplate and they're some of the richest
signal in the whole request.

`Accept-Language` with real q-value weighting (`en-US,en;q=0.9,fr;q=0.8`)
tells you the exact language preference list a specific OS locale
produces. A scraper that sends `en-US,en;q=0.9` for every single request
across a pool of "residential" IPs registered in a dozen different
countries is broadcasting that either the IPs are fake or the language
header is — both can't be true of the same real user.

`Accept-Encoding` is the quieter one. Browsers advertise `br` (Brotli)
because they can decode it. Plenty of scraping stacks still send only
`gzip, deflate`, because Brotli support in the HTTP client was added
later, or never wired in at all. That's a one-token tell that costs the
defender nothing to check and costs you an afternoon to notice.

## The actual lesson

None of these headers matter individually. What's being fingerprinted is
*coherence* — whether the twenty small claims your request makes about
itself are mutually consistent with a real browser having sent it. Spoof
one field and leave the other nineteen at their library defaults, and
you've built a more detectable request than sending no forged headers at
all, because now the inconsistency itself is the signal.

If you're doing this for legitimate scraping or research, treat headers
as a set, not a checklist: pick a real, current browser fingerprint,
mirror every header it sends including order and casing, and update the
whole set together when you rev the User-Agent. A half-updated identity
is worse than an honest one.
