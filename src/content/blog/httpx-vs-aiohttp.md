---
title: 'httpx vs aiohttp: Picking an Async HTTP Client'
description: 'Both do async HTTP fine. The real differences show up in HTTP/2 support, connection pool tuning, and how much of the requests-shaped API you get to keep.'
pubDate: 2021-08-17
tags: ['scraping', 'python', 'async']
---

I switched a scraper from `aiohttp` to `httpx` and the diff was almost
nothing — swap the import, swap `ClientSession` for `AsyncClient`, done.
That's the trap. The libraries look interchangeable in a tutorial and
diverge in exactly the places that matter once you're doing this for
real: connection pooling under load, HTTP/2, and what happens when a
target starts throttling you.

## The API-shape difference, briefly

`aiohttp` predates `httpx` by years and it shows — it has its own idioms
(`ClientSession`, `async with session.get(url) as resp`) that don't
resemble `requests` at all. `httpx` was written explicitly to mirror
`requests`'s API, sync and async both:

```python
# httpx — same shape as requests, just await it
async with httpx.AsyncClient() as client:
    resp = await client.get(url, params={"q": "test"})
    data = resp.json()

# aiohttp — its own conventions, response is a context manager
async with aiohttp.ClientSession() as session:
    async with session.get(url, params={"q": "test"}) as resp:
        data = await resp.json()
```

Small thing, but it matters for a team: anyone who's used `requests`
reads `httpx` code on sight. `aiohttp` needs its own onboarding.

## HTTP/2 is the feature that actually changes throughput

This is the one that made me switch on a real scraper, not a toy. Modern
sites — CDNs, most SPAs, a lot of API gateways — serve over HTTP/2 by
default. `aiohttp` doesn't do HTTP/2 client support at all. `httpx` does,
via an opt-in flag:

```python
client = httpx.AsyncClient(http2=True)
```

HTTP/2 multiplexes many requests over one TCP connection instead of
opening a new connection (or reusing from a pool) per request. Against a
target that terminates HTTP/2, this cuts connection-setup overhead
dramatically when you're hammering the same host — no repeated TLS
handshakes, no waiting for a pool slot to free up. It also changes your
fingerprint: a client speaking HTTP/1.1 to a server that expects HTTP/2
traffic stands out in ways that matter if you care about blending in.

The catch: `http2=True` requires the `h2` package, and if the target
doesn't advertise HTTP/2 via ALPN, `httpx` falls back to HTTP/1.1
silently. Worth checking with `resp.http_version` the first time, not
assuming it stuck.

## Connection pool tuning, and where it bites

Both libraries pool connections per host, but the failure mode when the
pool is too small looks different. Under-provision `aiohttp`'s
`TCPConnector` and requests queue invisibly — no error, just latency
creeping up as concurrency rises, and it's easy to misattribute that to
the target being slow.

```python
# aiohttp: pool size lives on the connector, not the session
connector = aiohttp.TCPConnector(limit=100, limit_per_host=20)
session = aiohttp.ClientSession(connector=connector)

# httpx: pool limits live on Limits, passed to the client
limits = httpx.Limits(max_connections=100, max_keepalive_connections=20)
client = httpx.AsyncClient(limits=limits)
```

Same idea, different object graph. The default `limit_per_host` in
`aiohttp` is unlimited (bounded only by the global `limit`), whereas
`httpx`'s default `max_keepalive_connections` is a conservative 20 — I've
seen an `httpx` scraper look throttled by the target when it was actually
throttled by its own default pool, invisible until you print
`client._transport` and go digging.

## Which one, honestly

- Reaching for something that feels like `requests` and mostly staying
  HTTP/1.1: `httpx`, for the API familiarity alone.
- Talking to a target that serves HTTP/2 and you're doing enough volume
  that connection reuse matters: `httpx` with `http2=True`, no contest.
- Already deep in an `aiohttp`-based stack (a lot of async web frameworks
  use it under the hood for WebSocket support too): stay, don't rewrite
  for its own sake.
- Need raw throughput on a huge number of small requests against
  HTTP/1.1-only targets: benchmark both on your actual workload.
  `aiohttp`'s C-accelerated parser has historically had a slight edge
  here, and "historically" is doing a lot of work in that sentence —
  measure it yourself before trusting anyone's number, including mine.

The takeaway that's held up over several projects: don't pick based on
the API tutorial. Pick based on whether the target speaks HTTP/2 and
whether your pool limits match your actual concurrency, because that's
where the two libraries stop looking like each other.
