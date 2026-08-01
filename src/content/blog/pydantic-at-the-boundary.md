---
title: 'Validate at the Boundary: pydantic Where It Counts'
description: 'Every field you don''t validate at the edge becomes a bug report from three call sites deep. A working pattern for putting pydantic exactly where the trust changes.'
pubDate: 2023-11-08
tags: ['python', 'pydantic']
---

A scraper I ran choked for two days on a `KeyError: 'duration'` buried
four functions deep in a video parser. The actual problem was upstream:
one platform started returning `"duration": null` for a subset of videos,
and nothing between the HTTP response and that fourth function noticed.
By the time the code cared about `duration`, it had been passed around,
reshaped, and half-trusted by three other functions that all assumed the
key existed.

That is the failure mode `pydantic` fixes, and it's worth being precise
about *where* it fixes it, because sprinkling `BaseModel` everywhere is
its own kind of mess.

## The boundary is the point, not the model

A "boundary" is anywhere data changes trust level: an HTTP response
entering your code, a request body entering your handler, a config file
entering your app, a message coming off a queue. Inside those boundaries,
your own code is producing and consuming its own values — you already
control the shape, so re-validating it everywhere is just noise.

```python
from pydantic import BaseModel, Field, field_validator

class VideoPayload(BaseModel):
    video_id: str
    duration: int = Field(ge=0)
    author_id: str
    play_count: int = Field(default=0, ge=0)

    @field_validator("duration", mode="before")
    @classmethod
    def coerce_null_duration(cls, v):
        # upstream sometimes sends null instead of omitting the field
        return 0 if v is None else v
```

Parse the raw response once, at the edge:

```python
resp = await client.get(url)
payload = VideoPayload.model_validate(resp.json())
# everything after this line gets a real int, never a None
```

Everything downstream of `VideoPayload.model_validate` gets a `VideoPayload`
with a guaranteed-non-null `int` duration. The `KeyError` two days in
becomes a `ValidationError` at the one call site that does the parsing —
same day, same stack trace, obvious cause.

## What actually belongs in the model

The temptation is to make the model do everything: business rules,
derived fields, side effects. Resist it. A boundary model should answer
one question — "is this shaped like what I expect?" — not "is this a
good idea?"

```python
class CreateJobRequest(BaseModel):
    url: str
    priority: int = Field(default=0, ge=0, le=10)
    callback_url: str | None = None

    @field_validator("url")
    @classmethod
    def must_be_http(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("url must be http(s)")
        return v
```

That's shape and basic invariants — not "is this URL reachable" (that's
a network call, do it later, async, with its own error handling) and not
"does this user have quota left" (that's authorization, a different
layer with a different failure mode). Cramming those into the validator
means a `ValidationError` starts meaning three unrelated things, and your
error handling has to guess which one it got.

## The cost you're trading for

`pydantic` validation is not free. Parsing a large nested payload on
every request adds measurable overhead, and `model_validate` on a hot
path — say, a per-item validator inside a loop processing ten thousand
scraped rows — will show up in a profile. The fix is not to skip
validation; it's to validate the *batch* shape once instead of every
row:

```python
class ScrapedBatch(BaseModel):
    items: list[VideoPayload]

batch = ScrapedBatch.model_validate({"items": raw_rows})
# one validation pass, not ten thousand individual calls
```

And for genuinely hot inner loops where the data already came from a
`VideoPayload` you validated on the way in — don't re-validate it on the
way out. Trust your own boundary. Re-validating internal data you
produced yourself is the same mistake as not validating external data at
all, just pointed the wrong direction: wasted cycles instead of missed
bugs.

## What I learned

The rule that stuck: validate once, at the point where trust changes,
and pass a typed object everywhere after that. Not because it's elegant
— because it turns "some function three calls deep got a `None` it
didn't expect" into "this one line raised a clear error with the exact
field name." Every hour you spend deciding what belongs in the boundary
model is an hour you don't spend grepping through five files for where a
`null` snuck in.
