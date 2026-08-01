---
title: 'Monitoring a Scraper Fleet Before It Monitors You'
description: 'Green dashboards and a scraper that has been silently returning empty pages for six hours are not mutually exclusive. A handful of boring metrics catch it before your users do.'
pubDate: 2020-09-12
tags: ['scraping', 'observability']
---

I found out a scraper had been broken for six hours because a downstream
consumer emailed asking why their feed hadn't updated since lunch. The
process was alive. It had a healthy CPU graph. It logged nothing at
`ERROR` level, because it wasn't erroring — the target site had changed a
CSS selector, every parse returned an empty list, and "zero results" got
written to the database as a perfectly valid, perfectly wrong, empty
batch. Uptime monitoring said everything was fine. Everything was not
fine.

## Uptime is the wrong question

"Is the process running" tells you almost nothing about whether it's
doing useful work. A scraper can be up, responsive, and completely
useless at the same time — a selector drifts, an API adds a required
header you don't send, a login session expires and every request quietly
redirects to a login page you then "successfully" parse as empty. None of
that trips a process-alive check.

## The metrics that actually predict failure

Four numbers caught almost everything I ever cared about, without a
dashboard full of noise:

- **Success rate per source, not global.** A global 98% success rate can
  hide one source that's been at 0% since this morning, if it's a small
  fraction of total volume. Bucket by source and alert per-bucket.
- **Items per run, compared to a rolling median.** Not an absolute
  threshold — sites have natural variance — but a run that returns 4
  items when the last twenty averaged 400 is a signal, even with a
  perfect HTTP status code.
- **Time since last successful item, per source.** This is the one that
  would have caught my six-hour gap immediately. A source that hasn't
  produced a real item in three hours is broken, whether or not any
  individual request errored.
- **Response size distribution.** A login page and a real content page
  are almost always different sizes. A sudden clustering of responses
  around one small size, on a source that used to vary, is often a
  session expiring or a block page replacing real content.

```python
from dataclasses import dataclass, field
from collections import deque
import time

@dataclass
class SourceHealth:
    recent_counts: deque = field(default_factory=lambda: deque(maxlen=20))
    last_success: float = 0.0

    def record(self, item_count: int):
        self.recent_counts.append(item_count)
        if item_count > 0:
            self.last_success = time.time()

    def is_unhealthy(self) -> bool:
        stale = time.time() - self.last_success > 3 * 3600
        median = sorted(self.recent_counts)[len(self.recent_counts) // 2] if self.recent_counts else 0
        starved = self.recent_counts and self.recent_counts[-1] < median * 0.2
        return stale or starved
```

## Alert on the shape of the data, not just the transport

The trap with request-level monitoring — status codes, latency, error
rates — is that it only catches failures that HTTP is willing to admit
to. A 200 with an empty payload, a 200 with a login form, a 200 with the
same cached error page every site loves to serve: all invisible at the
transport layer. The fix is a lightweight sanity check on the *parsed*
result before you consider the run successful — did we get a plausible
item count, do the fields we expect exist, does the price field look like
a price and not `null` for the ninetieth request in a row.

```python
def sanity_check(items: list[dict]) -> list[str]:
    problems = []
    if len(items) == 0:
        problems.append("empty result set")
    null_price = sum(1 for i in items if i.get("price") is None)
    if items and null_price / len(items) > 0.5:
        problems.append(f"{null_price}/{len(items)} items missing price")
    return problems
```

Run that after every batch, and route the problems list somewhere that
pages you — not somewhere that just gets logged and scrolled past.

## What I learned

A scraper fleet doesn't fail like a normal service. It rarely crashes; it
degrades into producing confident, well-formed garbage while every
health check stays green. The metrics that catch that aren't about
whether requests succeed — they're about whether the *content* still
looks like the content you were getting yesterday. Watch the data, not
just the pipes it travels through.
