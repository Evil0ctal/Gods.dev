---
title: 'An Async Mental Model That Sticks'
description: 'asyncio is not multithreading with extra steps. It is one thread taking turns, and every bug I have chased in async code traces back to forgetting that single fact.'
pubDate: 2025-08-02
tags: ['python', 'async']
---

The bug report was: two coroutines that increment the same counter
somehow never race. New Python users expect a lock there, because
they've been taught threads first and asyncio looks like threads with
`async` sprinkled on. It isn't. It's one thread, and understanding why
that counter never races is the whole mental model in one example.

```python
counter = 0

async def increment():
    global counter
    counter += 1

async def main():
    await asyncio.gather(*(increment() for _ in range(1000)))
    print(counter)  # always 1000, no lock needed
```

That never races because `counter += 1` never yields control mid-
operation — there's no `await` inside it, so once it starts it runs to
completion before anything else gets a turn. The moment you add an
`await` inside that function, the guarantee is gone.

## The event loop is a single-threaded scheduler, not a thread pool

Threads give you *preemptive* concurrency — the OS can interrupt a
thread at almost any instruction and hand the CPU to another one, which
is exactly why threaded code needs locks around shared state.

`asyncio` gives you *cooperative* concurrency. Only one coroutine runs
at a time, on one thread, and it keeps running until it hits an `await`
that actually suspends — at that point, and only at that point, the
event loop is free to run something else.

```text
task A: runs -----await-----> [suspended] ...... resumes -----returns
task B:                          runs -----await-----> [suspended] ......
                                                                      resumes
```

No two of those "runs" segments overlap in time. Ever. That's the whole
trick behind why plain Python data structures — dicts, lists, a plain
integer — are safe to share across coroutines without a lock, as long as
you never `await` in the middle of a read-modify-write.

## `await` is the only place anything else can happen

Once that clicks, most "impossible" async bugs stop being mysterious.
Every one of them reduces to: something ran between two lines you
assumed were atomic, and the reason is there's an `await` between them
you didn't notice was a handoff point.

```python
async def transfer(from_acct, to_acct, amount):
    balance = await get_balance(from_acct)   # <- yields here
    if balance >= amount:
        # another transfer() could have run entirely in between
        await debit(from_acct, amount)
        await credit(to_acct, amount)
```

Between the `await get_balance` and the `await debit`, the event loop is
free to run any other ready task — including another `transfer()` call
against the same account, reading the same now-stale balance. This is a
real race, and it's real *because* of the `await`, not despite it.
Synchronous code never has this class of bug because nothing else ever
gets a turn mid-function. Async code has exactly this class of bug, at
exactly the points marked `await`, and nowhere else.

## Blocking calls are the model's real enemy

If cooperative scheduling only works because coroutines yield at
`await`, then a coroutine that never yields — because it's doing
something synchronous and slow — freezes the entire program, not just
itself.

```python
async def bad_handler():
    time.sleep(2)          # blocks the ONE thread; every task waits
    return "done"

async def good_handler():
    await asyncio.sleep(2)  # yields; everything else keeps running
    return "done"
```

`time.sleep` doesn't know it's running inside an event loop. It just
blocks the OS thread, and since asyncio only has the one thread doing
all the work, every other task — every other request your server is
handling — stalls for those two seconds too. This is the single most
common way people accidentally serialize a server they built to be
concurrent, and it's silent: no error, no warning, just a service that
mysteriously gets slower under load in a way that doesn't match request
volume.

## What sticks

Three sentences, and they cover almost everything:

- One thread. Only one coroutine's code is ever actually executing at a
  given instant.
- Control only changes hands at `await` (or equivalent suspension
  points) — never mid-statement, never for free.
- Anything that blocks without yielding — a `time.sleep`, a synchronous
  DB driver, a CPU-heavy loop — blocks the entire program, not just its
  caller.

Every asyncio bug I've debugged is one of those three facts being
forgotten in a specific place. Keep them loaded and most async code
stops looking mysterious and starts looking like ordinary sequential
logic with clearly marked handoff points.
