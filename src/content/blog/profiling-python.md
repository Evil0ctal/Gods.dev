---
title: 'Profiling Python Before You Guess'
description: 'A batch endpoint that "felt slow" turned out to be spending 40% of its time in a regex compile nobody cached. Here is the two-tool loop I run before touching any code.'
pubDate: 2020-08-30
tags: ['python', 'performance']
---

Someone filed an issue against a scraper API I maintain: "batch endpoint
is slow for large lists." No numbers, no repro size, just a vibe. My
first instinct was to rewrite the parsing loop with a comprehension
instead of appends, because that felt like the obvious win. I didn't
touch it. I profiled first, and the comprehension would have saved
nothing — the actual cost was a compiled regex being recompiled on every
single call.

That's the whole argument for profiling before guessing: your intuition
about what's slow in Python is wrong more often than it's right, because
the interpreter's costs don't line up with what "looks expensive" to a
human reading the code.

## cProfile: the blunt instrument, first

`cProfile` instruments every function call and gives you a full picture
in one run. It's the right first step precisely because it's dumb — it
doesn't require you to already know where to look.

```bash
python -m cProfile -o out.prof -m myapp.batch_endpoint sample_input.json
python -c "
import pstats
p = pstats.Stats('out.prof')
p.sort_stats('cumulative').print_stats(15)
"
```

The output for that "slow" batch endpoint looked like this, trimmed:

```text
   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
    10000    1.812    0.000    1.812    0.000 re.py:251(compile)
    10000    0.041    0.000    1.853    0.000 parser.py:88(extract_id)
        1    0.003    0.003    1.856    1.856 batch_endpoint.py:12(run)
```

Ten thousand items, ten thousand calls to `re.compile`, 1.8 seconds spent
compiling the *same pattern* every time. The comprehension rewrite I
almost did instead would have touched `tottime` of 0.041s — noise next
to the actual problem.

## The fix, obvious once you see it

```python
import re

# WRONG: recompiled on every call
def extract_id(text: str) -> str | None:
    m = re.search(r"video/(\d+)", text)
    return m.group(1) if m else None

# RIGHT: compiled once at import time
_VIDEO_ID_RE = re.compile(r"video/(\d+)")

def extract_id(text: str) -> str | None:
    m = _VIDEO_ID_RE.search(text)
    return m.group(1) if m else None
```

`re` does cache compiled patterns internally, but that cache has a small
default size and gets evicted under enough distinct patterns — relying
on it instead of compiling once yourself is exactly the kind of "should
be fine" assumption profiling exists to check.

## py-spy for the case cProfile can't touch: production

`cProfile` adds real overhead — 20-30% isn't unusual — and it needs you
to run the code under it, which you often can't do against a live
process handling real traffic. `py-spy` attaches to a *running* PID from
outside the process and samples the call stack, so you can point it at
production without restarting anything or shipping instrumented code.

```bash
sudo py-spy top --pid 41213
```

```text
Total Samples 1400
GIL: 0.00%, Active: 94.00%, Threads: 5

  %Own   %Total  OwnTime  TotalTime  Function (filename)
 61.00%  61.00%   8.54s     8.54s   json.loads (json/decoder.py)
 18.00%  18.00%   2.52s     2.52s   decompress (gzip.py)
  9.00%   9.00%   1.26s     1.26s   extract_id (parser.py)
```

That's a live worker, sampled while it was actually serving traffic, no
restart, no code change. It told me a different service was
CPU-bound on JSON decoding of a response we didn't need most fields
from — a `py-spy dump` for a full stack trace on a stuck worker has also
saved me from restarting a hung service blind more than once.

## What I learned

Profile before you change anything, even when you're confident. The
confident guess is usually confidently wrong, because Python's cost
model is unintuitive: object allocation, attribute lookup, and
regex compilation are expensive in ways that don't match how "heavy" the
code looks on the page. `cProfile` for a controlled run, `py-spy` for a
process you can't stop — that two-tool loop has replaced every "this
looks slow" instinct I used to trust.
