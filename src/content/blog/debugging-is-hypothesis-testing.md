---
title: 'Debugging Is Hypothesis Testing'
description: 'Adding a print statement is not debugging until it is attached to a specific guess that the result can prove wrong — otherwise you are just watching numbers scroll by.'
pubDate: 2020-12-27
tags: ['essay', 'debugging']
---

"It fails sometimes" is not a bug report, it's a starting point, and the
worst way to work from it is opening the file and staring until something
looks suspicious. I've done that. It burns an hour and teaches you
nothing you couldn't have gotten from thirty seconds of thinking, because
staring isn't a method — it's waiting for luck.

## Start with a guess you can be wrong about

The only move that reliably works is picking a specific, falsifiable
hypothesis before touching anything. Not "something's wrong with the
retry logic" — that's not falsifiable, there's no test that could prove
it false. Something narrower: "the retry counter resets on every call
because it's a local variable instead of being passed through." That
claim has a specific, checkable consequence: if it's true, the counter
should read 0 on every entry to the function, even on the fifth attempt.

```python
import logging

def fetch_with_retry(url, attempt=0, counter=[0]):  # suspect: local state
    counter[0] += 1
    logging.info(f"attempt={attempt} counter_state={counter[0]}")
    ...
```

Run it once. Either the log shows `counter_state` climbing across calls,
which kills the hypothesis, or it shows something that confirms a
different bug entirely — a mutable default argument shared across every
call, which is its own classic trap and not what I was even looking for.
Either outcome is progress. A hunch that isn't stated as a testable claim
can't be killed, and a hypothesis you can't kill just sits there
unresolved while you add more logging around it out of anxiety instead of
curiosity.

## Make the test cheap, not clever

The instinct once you have a hypothesis is to write an elaborate
reproduction — spin up the full service, replay real traffic, watch it
in production-like conditions. That's usually backwards. The cheapest
test that could falsify the hypothesis is the right one, even if it's
ugly, even if it's a five-line script that isolates exactly the suspect
code path and nothing else.

```python
# cheapest possible falsification, not the most realistic one
def test_retry_counter_persists():
    calls = []
    for i in range(3):
        calls.append(fetch_with_retry.__wrapped__(url="x"))
    # if the hypothesis is right, this assertion fails
    assert calls == [1, 2, 3]
```

If that five-line test can kill the hypothesis, it's better than a full
integration run, because it isolates the one variable in question and
removes twenty others that could confound the result. A test that's
"more realistic" but touches more surface area than it needs to is
usually just a slower way to get a noisier answer.

## Binary search is the same idea at a different scale

When the bug is "somewhere in these eight commits" instead of "somewhere
in this function," the hypothesis just gets coarser and the falsification
tool changes, not the method.

```bash
git bisect start
git bisect bad HEAD
git bisect good v1.4.0
# git checks out the midpoint; you run the repro and answer good/bad
git bisect run pytest tests/test_retry.py -k test_counter
```

Each step is still: state a hypothesis ("the break is in the first half
of this range"), run the cheapest thing that can prove it wrong (the
existing test suite, pointed at one commit), and narrow based on the
result. `git bisect` is just hypothesis testing with the search space
made explicit and the falsification automated.

## What actually separates good debugging from bad

Not tool sophistication — I've watched people debug real problems with
nothing but `print` and win, and watched people misuse a full debugger
for an hour without learning anything, because they never stated what
they expected to see before they looked. The stare-at-it approach and the
attach-a-debugger-and-poke-around approach fail for the same reason: no
hypothesis means no way to know when you've learned something versus
when you've just watched more numbers go by.

State the guess. Design the cheapest experiment that could prove it
wrong. Run it. If it survives, you've narrowed the search space for free;
if it dies, you've eliminated a whole branch of possibility in exchange
for five minutes. Either way beats staring, every time.
