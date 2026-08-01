---
title: 'Finding a Memory Leak in a Long-Running Service'
description: 'RSS climbing 40MB an hour on a service that "does nothing but parse JSON" — a walk through tracemalloc snapshots and the boring discipline of finding what keeps growing.'
pubDate: 2024-09-15
tags: ['python', 'debugging']
---

A worker process serving a scraping API was restarting itself every six
hours. Not crashing — the container orchestrator's memory limit was
killing it because RSS had climbed from 180MB at boot to 2GB. Nothing in
the logs. No exceptions. Just a slow, steady climb, like the process was
holding its breath.

That's the shape of most Python memory leaks: nothing dramatic, no stack
trace pointing at a culprit, just a number that goes up and never comes
back down. Finding the cause is not clever, it's methodical — you take
snapshots and compare them.

## Confirm it's actually growing, not just fragmented

Before hunting, rule out the boring explanation: Python's allocator
doesn't always return freed memory to the OS, so RSS can look like a
leak when it's really fragmentation. `tracemalloc` sidesteps that
question entirely because it tracks *Python-level* allocations, not what
the OS reports — if `tracemalloc`'s total keeps growing across
snapshots, something is holding references, full stop.

```python
import tracemalloc

tracemalloc.start()
# ... let the service run for a while ...
snapshot1 = tracemalloc.take_snapshot()
```

Take a second snapshot after another stretch of normal traffic, then
diff them:

```python
snapshot2 = tracemalloc.take_snapshot()
top_diffs = snapshot2.compare_to(snapshot1, "lineno")

for stat in top_diffs[:10]:
    print(stat)
```

```text
parser.py:44: size=812 KiB (+780 KiB), count=9821 (+9800)
cache.py:19: size=210 KiB (+4 KiB), count=3102 (+11)
requests/models.py:899: size=98 KiB (+1 KiB), count=210 (+2)
```

One line is doing almost all the growing. `parser.py:44`, +780 KiB and
+9800 objects between two snapshots taken twenty minutes apart, while
request volume in that window was roughly constant. That's the signal —
not the biggest allocator overall, the biggest *delta*.

## The line, and why it leaked

```python
# parser.py:44
_seen_ids: dict[str, dict] = {}

def parse_item(raw: dict) -> dict:
    item = normalize(raw)
    _seen_ids[item["id"]] = item   # never evicted
    return item
```

A dedup cache with no eviction policy, module-level, living for the
life of the process. Every unique item id it ever saw stayed in memory
forever. On a service processing a constant stream of scraped items with
mostly-unique ids, that dict just grows in a straight line — the exact
shape of the RSS graph that paged someone at 3am.

The fix is bounding it, not removing it — the cache was doing real work
(deduping retries within a batch), it just needed a lifetime:

```python
from collections import OrderedDict

class BoundedCache(OrderedDict):
    def __init__(self, maxsize: int = 10_000):
        super().__init__()
        self.maxsize = maxsize

    def __setitem__(self, key, value):
        if key in self:
            self.move_to_end(key)
        super().__setitem__(key, value)
        if len(self) > self.maxsize:
            self.popitem(last=False)  # evict oldest

_seen_ids = BoundedCache(maxsize=10_000)
```

## Objects that won't die: gc as a second opinion

`tracemalloc` finds *allocation sites*. Sometimes you need to know what's
still alive right now and why. `gc.get_objects()` plus a type count is
the blunt but effective follow-up:

```python
import gc
from collections import Counter

gc.collect()
counts = Counter(type(o).__name__ for o in gc.get_objects())
for name, n in counts.most_common(10):
    print(n, name)
```

If `dict` or a specific class count is climbing across two calls to this
with no corresponding drop, something is holding a reference chain to
those objects that a normal garbage collection can't break — commonly a
closure over `self` registered as a callback and never deregistered, or
an event listener that outlives the object it was attached to.

## What I learned

A leak almost never announces itself. It shows up as an infra symptom —
a restart schedule, an OOM kill, a memory graph with a slope instead of
a plateau — days before anyone connects it to a code change. The
discipline that actually finds it is boring on purpose: snapshot,
change nothing, snapshot again, diff, and trust the delta over your
guess about which line "seems suspicious." The line that grows is rarely
the line you'd have bet on.
