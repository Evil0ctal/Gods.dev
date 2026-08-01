---
title: 'Testing Async Code Without Flakes'
description: 'A test suite that passed nine times out of ten was worse than one that always failed — here is how real time, real sleeps, and shared fixtures turned deterministic async code into a coin flip.'
pubDate: 2024-01-22
tags: ['python', 'testing']
---

CI failed on a test that had passed locally fifty times in a row. Then
it passed on rerun. Then it failed again three days later, unrelated
commit. The test was checking that a rate limiter's token bucket refilled
after a cooldown, and it worked by calling `await asyncio.sleep(0.5)` and
hoping the background refill task had run by then. It usually had.
"Usually" is not a test.

Async tests fail differently than sync ones. A sync test either does the
right thing or it doesn't — the failure is repeatable. An async test can
depend on scheduling order, wall-clock timing, and which coroutine the
event loop happened to run first, which means the same code can pass or
fail depending on machine load. Fixing that is less about `asyncio`
trivia and more about refusing to let real time or real ordering into
the test.

## Stop sleeping, start controlling the clock

Real `asyncio.sleep()` calls in a test are a bet that your machine will
be fast enough, consistently enough, forever. Replace the bet with
control. `pytest-asyncio` runs the coroutine on a real event loop, but
you can inject a fake clock so "time passing" is something the test
decides, not something it waits for.

```python
import asyncio
import pytest

class FakeClock:
    def __init__(self):
        self.now = 0.0

    def time(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.mark.asyncio
async def test_token_bucket_refills_after_cooldown():
    clock = FakeClock()
    bucket = TokenBucket(capacity=5, refill_seconds=10, clock=clock.time)

    for _ in range(5):
        assert bucket.try_consume()
    assert not bucket.try_consume()   # exhausted

    clock.advance(10)                 # instant, no real sleep
    assert bucket.try_consume()       # refilled
```

Zero wall-clock time spent in the test, zero chance the CI runner being
slow that day changes the outcome. The bucket's implementation takes a
`clock` callable instead of calling `time.monotonic()` directly — that
one seam is what makes the whole thing testable.

## Race conditions: force the interleaving instead of hoping for it

The flakiest tests I've written were ones checking that two coroutines
handled a shared resource correctly — a cache, a connection pool. The
naive test starts both coroutines with `asyncio.gather` and hopes they
interleave in the order that exercises the bug. Sometimes they do.
Mostly they don't, and the test is "passing" while testing nothing.

```python
@pytest.mark.asyncio
async def test_double_checked_lock_prevents_duplicate_fetch():
    fetch_count = 0
    started = asyncio.Event()
    proceed = asyncio.Event()

    async def slow_fetch(key: str):
        nonlocal fetch_count
        fetch_count += 1
        started.set()
        await proceed.wait()   # held open on purpose
        return f"value-for-{key}"

    cache = LockingCache(fetch=slow_fetch)

    task1 = asyncio.create_task(cache.get("k"))
    await started.wait()               # force task1 into the fetch
    task2 = asyncio.create_task(cache.get("k"))
    await asyncio.sleep(0)             # yield once, let task2 hit the lock

    proceed.set()                      # release both
    r1, r2 = await asyncio.gather(task1, task2)

    assert fetch_count == 1            # only one real fetch happened
    assert r1 == r2 == "value-for-k"
```

The `asyncio.Event` pair is the trick: it pins `task1` inside the fetch
until the test is ready, so `task2`'s attempt to acquire the lock is
guaranteed to happen while the fetch is in flight — not "probably," 
guaranteed, every run.

## Mocking async dependencies without breaking `await`

`unittest.mock.Mock` doesn't return an awaitable by default, so
`await client.get(url)` on a plain mock raises `TypeError: object Mock
can't be used in 'await' expression`. `AsyncMock` exists for exactly
this and is easy to forget:

```python
from unittest.mock import AsyncMock

async def test_fetch_retries_on_timeout():
    client = AsyncMock()
    client.get.side_effect = [asyncio.TimeoutError(), {"status": "ok"}]

    result = await fetch_with_retry(client, "https://example.com")

    assert result == {"status": "ok"}
    assert client.get.call_count == 2
```

## What I learned

Every flaky async test I've debugged traced back to one of two things:
real time standing in for controlled time, or hoped-for interleaving
standing in for forced interleaving. Inject the clock. Force the race
with events instead of asking `asyncio.sleep(0.1)` to get lucky. A test
that's allowed to depend on scheduling luck isn't testing your code —
it's testing your CI runner's mood that day.
