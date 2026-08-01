---
title: 'async with: Context Managers That Clean Up After You'
description: 'An httpx client that never closes and a Postgres connection that never returns to the pool look identical at first: fine, until the process runs long enough for the leak to matter.'
pubDate: 2022-05-10
tags: ['python', 'async']
---

I had a scraper worker that ran for days at a time, and every few hours
its file descriptor count would tick up by exactly one. Never down.
Eventually it hit the OS limit and every subsequent request failed with
`OSError: too many open files`. The cause was one `httpx.AsyncClient()`
created per request and never explicitly closed — each one held a
connection pool alive in the background, and nothing ever told it to
let go.

```python
# leaks a client (and its connection pool) on every call
async def fetch(url: str) -> dict:
    client = httpx.AsyncClient()
    r = await client.get(url)
    return r.json()
```

`async with` exists to make that impossible to forget.

## The pattern: guaranteed cleanup, even when things go wrong

`__aenter__` and `__aexit__` are the async equivalent of `__enter__`
and `__exit__`, and the guarantee is the same one context managers have
always made: whatever happens inside the `with` block — a clean return,
an exception, a cancellation — `__aexit__` runs.

```python
async def fetch(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        return r.json()
    # client.aclose() has already run here, no matter how we got here
```

That "no matter how" is the entire value proposition. Write your own
async context manager and the obligation is to honor it exactly the
same way — `__aexit__` has to run cleanup even when the block raised.

```python
class AcquiredConnection:
    def __init__(self, pool):
        self.pool = pool
        self.conn = None

    async def __aenter__(self):
        self.conn = await self.pool.acquire()
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        await self.pool.release(self.conn)
        return False  # don't suppress the exception, just clean up first
```

Returning `False` (or nothing) from `__aexit__` is the part people get
wrong under pressure — it's tempting to swallow the exception since
you're already handling it, but that silently hides real failures from
the caller. Clean up, then let the exception continue on its way unless
you have a specific reason to suppress it.

## `@asynccontextmanager` for the common case

Writing a full class with `__aenter__`/`__aexit__` is overkill for
anything that's really just "setup, yield, teardown." The
`contextlib.asynccontextmanager` decorator turns a single async
generator into the same guarantee, with a fraction of the boilerplate.

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def acquired_connection(pool):
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        await pool.release(conn)

async def query(pool, sql: str):
    async with acquired_connection(pool) as conn:
        return await conn.fetch(sql)
```

The `finally` block is doing exactly what `__aexit__` did above — it
runs whether the `yield` line raises or returns cleanly. This is also
the shape FastAPI's `lifespan` handler wants: acquire your resources
before `yield`, tear them down after, and the framework guarantees the
teardown half runs on shutdown.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await asyncpg.create_pool(dsn=DATABASE_URL)
    app.state.http_client = httpx.AsyncClient()
    yield
    await app.state.http_client.aclose()
    await app.state.pool.close()
```

## The mistake that undoes all of it: sharing across concurrent tasks

Async context managers guard against forgetting to clean up. They do
nothing to guard against reusing a resource across two coroutines that
are running concurrently and both mutating it, which is a different bug
that happens to look similar.

```python
# one client instance, reused across concurrent requests — fine, it's
# designed for this, connection pooling is the whole point
async with httpx.AsyncClient() as client:
    await asyncio.gather(*(client.get(u) for u in urls))

# one DB transaction, reused across concurrent tasks — NOT fine, most
# drivers assume single-writer usage per connection/transaction
async with pool.acquire() as conn:
    async with conn.transaction():
        await asyncio.gather(
            conn.execute("update a set x = 1"),
            conn.execute("update b set y = 2"),
        )  # interleaves writes on one connection — undefined behavior
```

`httpx.AsyncClient` is explicitly built to be shared and reused across
concurrent calls — that's why creating a new one per request was the
bug in the first place. A single database connection or transaction
usually isn't; check what the specific library promises rather than
assuming "it's an async context manager" implies "safe to share."

## What I learned

`async with` doesn't prevent leaks by magic — it prevents them by
making cleanup unconditional and impossible to skip by forgetting a
line at the bottom of a function. Reach for `asynccontextmanager` for
anything with a setup/teardown shape, use it for every resource that
opens a socket or a connection, and always check whether the resource
underneath is meant to be shared across concurrent tasks or acquired
fresh each time. The context manager only guarantees the close; it
doesn't guarantee the concurrency model.
