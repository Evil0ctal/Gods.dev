---
title: 'Rotating Proxies Without Rotating Your Sanity'
description: 'A proxy pool with no health checks just rotates which broken proxy fails your next request — the fix is treating "healthy" as a decaying score, not a boolean.'
pubDate: 2024-04-08
tags: ['scraping', 'infrastructure']
---

I bought a residential proxy pool, wired up round-robin rotation, and my
error rate went *up*. Turned out about 15% of the pool was dead on
arrival — proxies that had been recycled by the provider, IPs already
flagged by the target, endpoints that just timed out. Round-robin doesn't
care. It hands you the next proxy in line whether it works or not, so a
sixth of my requests were doomed before they left the machine.

## Rotation alone isn't a strategy, it's a shuffle

The naive version treats the pool as an undifferentiated list:

```python
proxies = ["http://p1:8080", "http://p2:8080", "http://p3:8080", ...]

def get_proxy():
    return random.choice(proxies)
```

This assumes every proxy in the list is equally good, right now. They
aren't. Datacenter proxies get IP-banned by aggressive targets in hours.
Residential proxies drop offline when the device they're routed through
goes to sleep. A provider's pool churns underneath you constantly. A
list with no feedback loop just means you keep drawing dead cards.

## Health as a score, not a switch

The fix that actually held up: stop treating proxies as up/down and
track a rolling success rate instead, so a proxy that fails once isn't
thrown away, but one that fails *consistently* drops out of rotation on
its own.

```python
from collections import deque
import time

class ProxyHealth:
    def __init__(self, window=20):
        self.window = window
        self.results = deque(maxlen=window)  # True/False per attempt
        self.cooldown_until = 0.0

    def record(self, ok: bool):
        self.results.append(ok)
        if not ok and self.success_rate() < 0.5:
            self.cooldown_until = time.monotonic() + 60  # sit out a minute

    def success_rate(self) -> float:
        if not self.results:
            return 1.0  # optimistic default for an untested proxy
        return sum(self.results) / len(self.results)

    def available(self) -> bool:
        return time.monotonic() >= self.cooldown_until
```

Weighted selection then favors proxies with a good recent track record
without permanently blacklisting one that had a bad minute — a proxy
that was down for a network blip recovers on its own once its window
fills back up with successes:

```python
def pick_proxy(pool: dict[str, ProxyHealth]) -> str:
    candidates = [p for p, h in pool.items() if h.available()]
    if not candidates:
        # everyone's in cooldown — pick the least-bad option rather than fail outright
        candidates = list(pool)
    weights = [pool[p].success_rate() + 0.05 for p in candidates]  # floor so dead isn't zero
    return random.choices(candidates, weights=weights, k=1)[0]
```

## Sticky sessions, deliberately

Some targets key rate limits or session state to the client IP — a login
flow, a shopping cart, anything with server-side state tied to your
apparent address. Rotating the proxy mid-session there doesn't help you,
it breaks you: the target sees a session that suddenly jumped IP and
either drops it or flags it as suspicious.

The fix is sticky-by-key: hash whatever identifies the logical session
(account id, cart id, crawl job id) to a proxy, and hold that mapping for
the session's lifetime instead of re-rotating on every request.

```python
def sticky_proxy(session_key: str, pool: list[str]) -> str:
    idx = hash(session_key) % len(pool)
    return pool[idx]
```

Combine the two: sticky assignment for anything stateful, weighted
rotation by health for anything stateless like a plain page fetch. Using
one strategy everywhere is the mistake — pure rotation breaks sessions,
pure stickiness means one bad proxy tanks every request tied to it.

## What I learned

A proxy pool needs the same failure handling as any other dependency you
don't control: track health per-endpoint, decay bad scores instead of
hard-banning on one failure, and give state-carrying flows a sticky
assignment instead of rotating them into a broken session. The 15% dead
pool didn't get better because I complained to the provider — it got
better because the client stopped sending traffic to the dead 15% on its
own, and that's the only fix that scales past however many proxies you
can manually babysit.
