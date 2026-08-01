---
title: 'Generators vs Async Generators, Concretely'
description: 'yield pauses a function for the caller. async yield pauses it for the event loop too. The difference sounds academic until you try to page through an API and your generator blocks everything else on the way.'
pubDate: 2020-10-14
tags: ['python']
---

Here's a generator that pages through a scraper's results, one page at
a time, without loading everything into memory up front:

```python
def paginate(url: str):
    page = 1
    while True:
        resp = requests.get(url, params={"page": page})
        data = resp.json()
        if not data["items"]:
            return
        yield from data["items"]
        page += 1
```

That works, and it's memory-efficient — the caller gets items one at a
time, `for item in paginate(url)`, and only the current page is ever in
memory. But it's built on `requests.get`, which blocks the thread for
the entire round trip of every page. If this generator lives inside an
async service, that block stalls every other coroutine in the process
for as long as the network takes. The generator itself is fine; running
it inside async code is the bug.

## `yield` pauses for the caller. That's the whole contract.

A plain generator's contract is simple: calling `next()` on it runs
code until a `yield`, then hands control back to whoever called
`next()`. Nothing else in the program gets a say in when that happens —
it's purely a conversation between the generator and its caller.

```python
def counter():
    n = 0
    while True:
        n += 1
        yield n

g = counter()
next(g)  # 1 — caller decides exactly when this resumes
next(g)  # 2
```

That's fine for pure computation — Fibonacci, tree traversal,
transforming an in-memory list lazily. It says nothing about I/O,
because a plain generator has no way to `await` anything. Put a network
call inside one and it's a synchronous network call, full stop.

## `async def` + `yield` pauses for the event loop too

An async generator adds a second party to that conversation: the event
loop. `async for` doesn't just pull values — it lets other coroutines
run during the gaps, specifically at every `await` inside the
generator's body.

```python
async def paginate(url: str):
    page = 1
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(url, params={"page": page})
            data = resp.json()
            if not data["items"]:
                return
            for item in data["items"]:
                yield item
            page += 1

async def main():
    async for item in paginate("https://api.example.com/items"):
        await process(item)
```

Now the wait for each page happens at `await client.get(...)`, which is
a real suspension point — the event loop is free to run other tasks
while this page loads, exactly like any other `await`. Ten of these
generators running concurrently via `asyncio.gather` genuinely overlap
their network waits, instead of the synchronous version's one-page-at-
a-time serialization no matter how many "concurrent" callers you have.

## The rule for choosing: does the body ever wait on I/O?

If every step of producing the next value is CPU work — filtering,
transforming, computing — a plain generator is not just sufficient,
it's simpler and has less overhead. Wrapping pure computation in
`async def` buys nothing; there's nothing to yield to the event loop
for, so you're paying coroutine machinery for no benefit.

```python
# pure computation: plain generator is correct and simpler
def batched(items, size):
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
```

If the body does I/O — a request, a DB query, a file read via an async
driver — and it's running inside code that's already async, the
generator needs to be async too, or you'll block the whole event loop
exactly like the `requests.get` example at the top. Trying to mix them —
calling a synchronous generator's blocking I/O from inside an async
function — doesn't error. It just silently reintroduces the
serialization you thought you'd escaped by going async in the first
place.

## What I learned

`yield` and `async yield` look like the same keyword with a decorator
sprinkled on, but they answer a different question: who else gets to
run while this is paused. A plain generator pauses for nobody but its
caller. An async generator pauses for the whole event loop. Pick based
on whether the body actually waits on anything — and if you're not
sure, check for `await` inside the loop. If it's there, you need
`async def` and `async for` on both ends, or the pause you thought you
built doesn't exist.
