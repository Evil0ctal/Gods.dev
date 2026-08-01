---
title: 'Type Hints That Earn Their Keep'
description: 'Half the type hints I have seen in real codebases are decoration: Any wearing a costume, or a type that repeats what the variable name already said. Here is the difference between a hint that catches a bug and one that just types more.'
pubDate: 2021-11-03
tags: ['python', 'typing']
---

I once fixed a bug in a scraper where a function annotated
`def parse(data: dict) -> dict` was handed a list, because "dict" meant
nothing more specific than "some JSON-shaped Python object" and mypy had
no way to know the caller's list wasn't a dict too, structurally
speaking, from ten call-sites away. The annotation wasn't wrong. It also
wasn't doing anything — it wrote down what a competent reader could
already guess from the function body, and it caught nothing at the one
call site that actually mattered.

```python
def parse(data: dict) -> dict:
    return {"id": data["id"], "title": data["title"].strip()}
```

`dict` here means "a Python dict of anything to anything." mypy will
happily accept `{"whatever": 123}` and blow up at runtime on
`data["title"]`. The hint decorates the function. It doesn't protect it.

## A hint earns its keep when it encodes a shape, not a container

The fix isn't "add more type hints." It's replace the vague container
type with something that actually describes the data — then the type
checker can catch the exact class of bug that just happened.

```python
from typing import TypedDict

class RawItem(TypedDict):
    id: int
    title: str

class ParsedItem(TypedDict):
    id: int
    title: str

def parse(data: RawItem) -> ParsedItem:
    return {"id": data["id"], "title": data["title"].strip()}
```

Now passing a list, or a dict missing `"title"`, or a dict where
`"title"` is an `int`, is a type error caught before the code runs —
not a `KeyError` or `AttributeError` discovered by a scraper failing at
2 a.m. on production data. The hint moved from documenting the function
to constraining what can reach it.

## `Any` is a type checker's silence, not its approval

The other quiet failure mode: reaching for `Any` to make an error go
away instead of to genuinely represent "this really could be anything."

```python
def process(payload: Any) -> Any:
    return payload["result"]["items"]
```

That type-checks. It also type-checks if `payload` is `None`, or a
string, or missing `"result"` entirely — `Any` is contagious and
disables checking on everything it touches, silently, for the rest of
its life in your code. It's not a type; it's an opt-out, and mypy will
never complain about it again no matter how the code around it changes.

The honest version says what you actually know, even if what you know
is partial:

```python
def process(payload: dict[str, Any]) -> list[dict[str, str]]:
    return payload["result"]["items"]
```

Now the checker at least confirms `payload` is dict-shaped, and confirms
the caller is prepared for a `list[dict[str, str]]` back — the `Any`
inside is honest about the one part genuinely unconstrained, instead of
smuggling that uncertainty into everything.

## The annotations worth writing: boundaries and public signatures

Not every line needs a hint, and chasing 100% annotation coverage on
internal helper functions is mostly wasted effort — a type checker can
usually infer local variable types just fine from context, and
annotating `x: int = 5` teaches nobody anything.

The annotations that pay for themselves are at the edges:

- **Function signatures**, especially on anything called from more than
  one place — this is where a type error actually saves you from a bad
  call site instead of just restating the obvious.
- **Return types**, because they document the contract without needing
  a docstring, and a checker enforces that every `return` statement in
  the function actually honors it.
- **Data crossing a boundary** — API responses, config files, anything
  parsed from JSON — is exactly where `TypedDict`, `dataclass`, or
  `pydantic` models turn "trust the shape" into "the shape is checked."

```python
def fetch_page(client: httpx.Client, url: str, timeout: float = 10.0) -> RawItem:
    resp = client.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.json()
```

That signature tells every caller what to pass and what comes back,
without opening the function body. Internal locals inside `fetch_page`
mostly don't need hints — mypy infers `resp: httpx.Response` on its own
from the assignment, and writing it out by hand adds noise, not safety.

## What I learned

A type hint is worth writing when it can be *wrong* in a way the
checker would catch — when it narrows what's allowed instead of
restating what's already obvious from the code around it. `dict` on a
JSON payload and `Any` used as a silencer are the two most common ways
type hints show up everywhere and protect nothing. `TypedDict`,
precise container types, and hints on the boundaries where untrusted
data enters your code are the ones that actually catch the bug before
it becomes a 2 a.m. page.
