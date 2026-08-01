---
title: 'A Caching Layer That Pays for Itself'
description: 'Most scraper re-runs re-fetch pages that have not changed since yesterday. A content-addressed cache turns that waste into a near-instant no-op — and gives you a free audit trail.'
pubDate: 2021-09-08
tags: ['scraping', 'performance']
---

Run the same scraper twice a day against a catalog that updates maybe
five percent of its pages, and you'll re-download the other ninety-five
percent for nothing. I noticed this because a rate-limit counter kept
tripping on the second run of the day, even though the second run should
have had almost nothing left to do. It didn't know that. It was fetching
everything, every time, from zero.

## Cache key on the request, not the response

The obvious cache is "save the response to disk, keyed by URL." That
works until you have query params, POST bodies, or auth headers that
change the response for the same URL. The fix is to hash the whole
request shape — method, URL, sorted params, and whatever body matters —
into one key.

```python
import hashlib
import json

def cache_key(method: str, url: str, params: dict | None, body: dict | None) -> str:
    payload = {
        "method": method.upper(),
        "url": url,
        "params": sorted((params or {}).items()),
        "body": body,
    }
    blob = json.dumps(payload, sort_keys=True, default=str).encode()
    return hashlib.sha256(blob).hexdigest()
```

Store the response bytes at a path built from that key — `cache/ab/cdef...`,
splitting on the first two hex chars so one directory doesn't end up with
a million files. Now a second run of an unchanged request is a filesystem
read, not a round trip.

```python
async def cached_fetch(client, method, url, params=None, body=None, ttl=3600):
    key = cache_key(method, url, params, body)
    path = CACHE_DIR / key[:2] / key
    if path.exists() and (time.time() - path.stat().st_mtime) < ttl:
        return json.loads(path.read_bytes())

    resp = await client.request(method, url, params=params, json=body)
    resp.raise_for_status()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(resp.content)
    return resp.json()
```

## Let the server tell you when it's stale

A time-based TTL is a guess. The server usually knows better, and HTTP
already has the vocabulary for this: `ETag` and `Last-Modified` on the
way out, `If-None-Match` and `If-Modified-Since` on the way back in. Store
the `ETag` alongside the cached body, send it next time, and a `304 Not
Modified` costs you a header round trip instead of a full payload.

```python
async def conditional_fetch(client, url, cached_etag=None):
    headers = {"If-None-Match": cached_etag} if cached_etag else {}
    resp = await client.get(url, headers=headers)
    if resp.status_code == 304:
        return None  # caller keeps using what it already has
    return resp.content, resp.headers.get("ETag")
```

Not every target sends `ETag`. Plenty of scraped sites don't bother. For
those, a content hash of the *previous* response, compared against the
new one after you fetch it, still saves you the downstream parse-and-diff
work even though it doesn't save the bandwidth — which is the next best
thing.

## The audit trail you get for free

The side effect nobody plans for: a content-addressed cache is also a
change log. If you keep the last N versions per key instead of
overwriting in place, "what did this page look like last Tuesday" becomes
a directory listing instead of a support ticket. I've used exactly this to
answer "did the price actually change or did our parser break" more times
than I want to admit — diff the two cached blobs before touching any
code.

## What I learned

The win isn't really speed, though it's a nice side effect that a
mostly-unchanged catalog re-scrapes in seconds instead of hours. The win
is that a cache turns "did this change" into a question you can answer by
comparing two files, instead of a question you can only answer by staring
at a live diff and hoping you remember what it looked like before.
