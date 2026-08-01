---
title: 'Structured Logging You''ll Actually Read at 3AM'
description: 'Grepping a log line for the fourth field that might be a user id is not a strategy. Correlation ids, consistent keys, and JSON turn logs into something you can query under pressure.'
pubDate: 2023-02-27
tags: ['observability', 'backend']
---

Here's a log line I used to write, in production, without embarrassment:

```text
[2023-02-14 03:12:07] ERROR: failed to process request for user, retrying
```

Failed how. Which user. Retrying what, with what backoff, for how long.
None of that survives grep at 3 a.m. when a scraper worker is throwing
errors and you're trying to figure out if it's one bad URL or the whole
fleet falling over. That log line answers zero of your questions and
you already knew all its words before you read it.

## Log lines are data, not prose

The fix isn't "write better sentences." It's stop writing sentences.
A log entry is a record with fields — treat it like one, and emit
structured data instead of a string you'll `.split()` in a moment of
desperation.

```python
import logging
import sys
from pythonjsonlogger import jsonlogger

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(jsonlogger.JsonFormatter(
    "%(asctime)s %(levelname)s %(name)s %(message)s"
))
logger = logging.getLogger("scraper")
logger.addHandler(handler)
logger.setLevel(logging.INFO)

logger.error(
    "fetch failed",
    extra={
        "url": url,
        "status_code": resp.status_code if resp else None,
        "attempt": attempt,
        "worker_id": worker_id,
        "correlation_id": job_id,
    },
)
```

That emits one JSON object per line. It's uglier to eyeball in a raw
terminal and dramatically better to actually use — pipe it through `jq`,
ship it to any log aggregator, or just `grep` for `"worker_id":"w-7"` and
get exactly the lines from that worker, nothing else, no false positives
from a URL that happens to contain the digit 7.

```bash
tail -f app.log | jq 'select(.level=="ERROR" and .worker_id=="w-7")'
```

Try doing that reliably against a free-text log. You can't — you end up
writing a regex that's really a small, bad JSON parser.

## Correlation ids are how you reconstruct a story

The other thing free-text logging can't give you: a single request
touches your API handler, a queue, a worker, maybe a retry, maybe a
downstream call. Each of those emits its own log lines, interleaved
with every other request being processed at the same time. Without a
shared id, you cannot tell which lines belong to the same story.

A correlation id fixes that. Generate one at the edge, thread it through
every log call for the life of the request — including into background
tasks and retries — and every line becomes greppable back into one
sequence.

```python
import contextvars

request_id_var = contextvars.ContextVar("request_id", default=None)

def get_logger_context():
    return {"request_id": request_id_var.get()}

# in the FastAPI middleware, set it once per request
@app.middleware("http")
async def add_request_id(request, call_next):
    request_id_var.set(str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id_var.get()
    return response
```

Every log statement downstream — in the handler, in the retry logic, in
the worker that eventually picks the job up — pulls from the same
context var. Now `request_id:"a1b2c3"` in your aggregator is the whole
story of that one request, start to finish, regardless of how many
threads, coroutines, or workers touched it.

## Levels are a contract, not a vibe

The other habit that quietly rots logs: using `ERROR` for anything that
felt bad in the moment, and `INFO` for anything that felt fine. Six
months later nobody can distinguish signal from noise because the levels
carry no consistent meaning.

Set a rule and hold to it:

- `DEBUG` — only useful with the code open next to it, off in production.
- `INFO` — expected events: a job started, a request completed, a cache
  was cold. Safe to leave on always.
- `WARNING` — the system recovered on its own, but you want to know it
  had to. A retry that eventually succeeded.
- `ERROR` — the system did not recover. Someone got a failure because of
  this. Every `ERROR` should be actionable, or it's not an `ERROR`.

If every `ERROR` in your logs is actionable, alerting on `level:ERROR`
becomes trustworthy instead of something you mute after the third false
alarm.

## What I learned

Free-text logs are optimized for a human reading top-to-bottom in real
time, which is exactly the opposite of how you actually read logs — at
3 a.m., filtering hard, under pressure, needing one specific thread out
of ten thousand interleaved lines. Structure the data, carry a
correlation id through the whole request, and keep levels honest. The
log line above should have been:

```json
{"level":"ERROR","msg":"fetch failed","url":"...","status_code":429,"attempt":3,"correlation_id":"a1b2c3"}
```

Same failure. Actually queryable.
