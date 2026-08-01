---
title: 'FastAPI Patterns I Keep Coming Back To'
description: 'Three FastAPI habits that outlive the tutorial phase: dependencies as the injection seam, lifespan for anything that needs to open and close, and response models as a contract, not decoration.'
pubDate: 2021-05-21
tags: ['backend', 'fastapi', 'python']
---

Every FastAPI project I've shipped past the prototype stage ends up
leaning on the same three patterns, regardless of what the API actually
does. Not because they're clever — because the alternative to each of
them is a specific, predictable kind of pain I've already paid for once.

## Dependencies as the only injection seam

The tempting shortcut is a module-level global for anything shared — a
database session, an HTTP client, a model. It works until you need to
test the handler without a real database, or swap the client for a mock
in one test but not another:

```python
# module-level global: works, until you need to swap it
db = Database(DATABASE_URL)

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    return await db.fetch_one(user_id)
```

`Depends` turns that hardcoded reference into a parameter FastAPI resolves
at call time, which means tests can override it without touching the
handler at all:

```python
async def get_db() -> Database:
    return app.state.db

@app.get("/users/{user_id}")
async def get_user(user_id: int, db: Database = Depends(get_db)):
    return await db.fetch_one(user_id)

# in tests, no monkeypatching required:
app.dependency_overrides[get_db] = lambda: FakeDatabase()
```

The pattern generalizes past databases — auth (`Depends(get_current_user)`),
rate limiting, feature flags, anything a handler needs but shouldn't be
responsible for constructing. If a handler is importing something from a
module to use it directly, that's usually a dependency that hasn't been
extracted yet.

## Lifespan for anything with an open and a close

Before `lifespan`, connection pools got created in an `@app.on_event("startup")`
handler and it mostly worked, right up until an exception during startup
left a pool half-initialized with no corresponding shutdown ever firing.
`lifespan` makes the pairing structural instead of a matter of remembering
both decorators:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await Database.connect(DATABASE_URL)
    app.state.http = httpx.AsyncClient()
    yield
    await app.state.http.aclose()
    await app.state.db.disconnect()

app = FastAPI(lifespan=lifespan)
```

Everything before `yield` is startup, everything after is shutdown, and
they live in one function you can actually read top to bottom. The rule
I follow: if something needs an explicit `.close()` or `.disconnect()`
anywhere in the codebase, it belongs in `lifespan`, not constructed
lazily inside a handler on first use.

## Response models as a contract, not decoration

It's easy to treat `response_model` as documentation sugar for the
OpenAPI schema and return whatever dict a handler happens to build. The
part that's easy to miss: FastAPI actively *filters* the response through
that model, which means it's also your last line of defense against
leaking a field you didn't mean to expose:

```python
class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    # password_hash intentionally not listed

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: int, db: Database = Depends(get_db)):
    user = await db.fetch_one(user_id)   # ORM object has password_hash too
    return user   # FastAPI serializes through UserOut and drops the rest
```

Without `response_model`, whatever the ORM object serializes to is what
ships — including any field someone adds to the table next quarter.
`response_model` makes "what this endpoint returns" a change you have to
make on purpose, in one place, instead of an accident of what the
database schema happens to contain today.

## What ties them together

All three are the same move applied to a different part of the app:
stop letting a handler reach out and grab what it needs, or leak what it
happens to have. Dependencies make inputs explicit and swappable. Lifespan
makes resource ownership explicit and paired. Response models make output
explicit and filtered. None of it is FastAPI-specific wisdom, exactly —
it's just that FastAPI hands you the tools to do it cleanly enough that
skipping them starts to feel like the extra work.
