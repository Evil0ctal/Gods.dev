---
title: 'Pagination, Cursors, and the Lies APIs Tell'
description: 'A scraper that never throws an error can still lose thousands of rows to offset pagination. Here is how silent truncation happens and how cursor tokens fix it — mostly.'
pubDate: 2022-02-03
tags: ['scraping', 'python']
---

I once left a scraper running overnight against a marketplace API, walking
`?offset=&limit=100` from zero to whatever `total` the first response
claimed. It finished clean. No 4xx, no 5xx, no exceptions in the log. When
I diffed the row count against the site's own public count endpoint the
next morning, I was short by a bit over eight thousand listings. Nothing
had crashed. The data had just quietly stopped being there.

## Offset pagination lies by omission

Offset pagination assumes the underlying list holds still while you walk
it. It almost never does. Someone deletes a row while you're on page 40,
every row after it shifts left by one, and page 41 now starts where page
40's last row would have been — you skip one row per deletion, forever,
with no signal that it happened.

```python
# looks correct, silently drops rows under concurrent writes
async def paginate(client, limit=100):
    offset = 0
    while True:
        resp = await client.get("/items", params={"offset": offset, "limit": limit})
        batch = resp.json()["items"]
        if not batch:
            return
        for item in batch:
            yield item
        offset += limit
```

The failure mode is worse than an error, because an error tells you to
retry. A gap tells you nothing. The only way to catch it after the fact is
to compare a count you trust — a `total` field from a separate endpoint,
a known-good scrape from last week — against what you actually collected.
By the time you notice, the deleted rows might be gone from the live API
too, and you can't go back and get them.

## Cursors fix the shifting-list problem, not every problem

A cursor is a pointer into a stable ordering, usually an opaque token
built from the last row's sort key — `created_at` plus `id` as a
tiebreaker is the common shape. Because it says "give me everything after
*this specific row*" instead of "give me the rows currently sitting at
this offset," insertions and deletions elsewhere in the list don't shift
your position.

```python
async def paginate_cursor(client, limit=100):
    cursor = None
    seen_last = None
    while True:
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        resp = (await client.get("/items", params=params)).json()
        batch = resp["items"]
        if not batch:
            return
        # a cursor that repeats the last row you already saw means
        # the server is confused, not that you're done
        if batch[0]["id"] == seen_last:
            raise RuntimeError("cursor did not advance, aborting")
        for item in batch:
            yield item
        seen_last = batch[-1]["id"]
        cursor = resp.get("next_cursor")
        if cursor is None:
            return
```

That guard against a non-advancing cursor matters more than it looks. I've
hit APIs where the cursor token is a base64 blob of an offset in
disguise — same shifting-list bug, wearing a cursor-shaped costume. The
tell is that it breaks the same way offset does: rows go missing under
concurrent writes, just with an opaque token instead of a visible integer
hiding the mechanism.

## Detecting truncation instead of trusting it away

You can't always force an API to give you a real cursor. What you can
always do is stop trusting silence as a success signal.

```python
expected_total = (await client.get("/items/count")).json()["total"]
collected = [item async for item in paginate_cursor(client)]

drift = expected_total - len(collected)
if abs(drift) > expected_total * 0.01:  # more than 1% off
    log.warning("pagination drift: expected %d got %d", expected_total, len(collected))
```

A 1% threshold is arbitrary — pick one that matches how much churn your
target genuinely has between the count call and the walk finishing. The
point isn't the exact number, it's having *any* independent check instead
of assuming a 200-status walk with no errors means a complete walk.

## What I learned

Pagination bugs don't look like bugs. They look like a scraper that ran
fine and returned less data than it should have, and the only way to
catch that is to measure completeness against something outside the
pagination loop itself — a count endpoint, a previous run, a checksum.
Cursor pagination removes one entire class of these failures for free.
It does not remove the need to check your work.
