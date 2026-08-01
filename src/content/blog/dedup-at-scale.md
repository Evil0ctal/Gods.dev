---
title: 'Deduplication at Scale: Bloom Filters and Beyond'
description: 'An exact dedup set stops fitting in memory around a hundred million items — a Bloom filter trades a small, tunable false-positive rate for a fixed, predictable memory budget.'
pubDate: 2020-11-28
tags: ['scraping', 'algorithms']
---

A `set()` of seen URLs is exact and free to reach for, right up until it
isn't. A Python `set` of ~80-byte URL strings costs roughly 100+ bytes
per entry once you account for object overhead and hash table slack. At
50 million URLs that's north of 5GB just for the dedup structure, before
the rest of the crawler gets any memory at all. The set didn't get
slower — sets stay O(1) — it just stopped fitting on the machine.

## The trade a Bloom filter makes

A Bloom filter answers "have I seen this?" with a guarantee in one
direction only: "definitely no" is always correct, "probably yes" might
be wrong. It never produces a false negative (it will never tell you
you haven't seen something you have), but it can produce a false
positive (it might tell you you've seen something you actually haven't).
For a dedup set, a false positive means you skip a URL you should have
crawled — an acceptable, tunable cost. A false negative would mean
re-crawling something already done, which is wasteful but not wrong; a
Bloom filter can't do that at all, by construction.

The structure is a bit array and `k` independent hash functions. Adding
an item sets `k` bit positions; checking membership reads those same `k`
positions and returns "maybe" only if every one of them is set:

```python
import mmh3  # murmurhash3, fast and well-distributed for this

class BloomFilter:
    def __init__(self, size_bits: int, num_hashes: int):
        self.size = size_bits
        self.k = num_hashes
        self.bits = bytearray(size_bits // 8 + 1)

    def _positions(self, item: str):
        for i in range(self.k):
            yield mmh3.hash(item, seed=i) % self.size

    def add(self, item: str):
        for pos in self._positions(item):
            self.bits[pos // 8] |= (1 << (pos % 8))

    def __contains__(self, item: str) -> bool:
        return all(self.bits[pos // 8] & (1 << (pos % 8)) for pos in self._positions(item))
```

The interesting part isn't the code, it's the sizing. Given an expected
item count `n` and a target false-positive rate `p`, the optimal bit
array size and hash count fall out of two formulas:

```text
m = -(n * ln(p)) / (ln(2)^2)     # bits needed
k = (m / n) * ln(2)              # optimal number of hash functions
```

For 50 million URLs at a 1% false-positive rate, that's roughly 480
million bits — about 60MB. Compare that to the multiple gigabytes a
Python set costs for the same data: two orders of magnitude smaller, for
a 1-in-100 chance of skipping a URL you should have crawled. For a
crawler chasing coverage over a huge site, that trade is almost always
worth it.

## What "beyond" looks like when even that's too coarse

A plain Bloom filter has two limits worth knowing before you commit to
one. First, you can't remove an item — clearing bits could un-set a
position another item also depends on. If your dedup set needs deletion
(a URL expires and should become eligible again), a **Counting Bloom
Filter** swaps each bit for a small counter, incremented on add and
decremented on remove, at the cost of several times the memory of the
plain version.

Second, a plain Bloom filter's false-positive rate creeps upward as it
fills — insert more items than it was sized for and it saturates,
degrading toward "yes" for everything. A **Scalable Bloom Filter**
handles growth you can't predict upfront by chaining filters: start
small, and when one fills past its target rate, add a new one sized
larger with a tighter rate, checking membership across the whole chain.

For anything I'd call "production," I don't hand-roll the bit-twiddling
above — I reach for `pybloom-live` for an in-process filter, or Redis's
`RedisBloom` module (`BF.ADD` / `BF.EXISTS`) when the filter needs to be
shared across worker processes or machines, which is the common case for
a distributed crawler.

## When exact still wins

Don't reach for probabilistic dedup by default. If the item count is
small enough that a hash set fits comfortably in memory — low tens of
millions of short keys, easily — a `set()` is simpler, exact, and you
never have to explain a false positive to anyone. Bloom filters earn
their complexity specifically at the point where "exact and in memory"
stops being possible simultaneously, and not a step before that.

## What I learned

Exact dedup and probabilistic dedup aren't competing techniques, they're
tools for two different regimes: use a set until memory says no, then
size a Bloom filter deliberately with the `n`/`p` math instead of
guessing a bit-array length, and reach for the counting or scalable
variants only when deletion or unbounded growth actually shows up as a
requirement — not preemptively. The memory graph is what tells you which
regime you're in; it's not a judgment call.
