---
title: 'A Tour of JavaScript Obfuscation (and De-obfuscation)'
description: 'The three obfuscation tricks that show up in almost every protected web bundle — string arrays, control-flow flattening, dead code — and how to peel each one back.'
pubDate: 2023-06-10
tags: ['reverse-engineering', 'javascript']
---

Open the network-signing function in a heavily protected site's bundle
and you'll see something like this:

```javascript
function _0x4a1f(_0x2b3c, _0x1e9a) {
  const _0x5f8d = _0x2b91();
  return (_0x4a1f = function (_0x4a1fx1, _0x4a1fx2) {
    _0x4a1fx1 = _0x4a1fx1 - 0x1a3;
    return _0x5f8d[_0x4a1fx1];
  })(_0x2b3c, _0x1e9a);
}
```

Nobody wrote that by hand. It's the output of a commercial obfuscator
run against ordinary code, and the good news is that these tools apply
from a small, well-known bag of tricks. Learn the tricks once and every
new bundle stops looking like noise.

## String arrays: the most common trick, and the easiest to break

The pattern above is a **string array**. Every literal string in the
source gets moved into one big array, and every reference to a string
gets replaced by a call to a lookup function with an index (often offset
by some constant to make static searching harder). The obfuscator does
this because grepping a bundle for `"https://api.example.com"` is how
reversers usually start, and a string array removes every literal from
plain sight.

The break is mechanical: find the array, find the lookup function, and
just... call it, using the exact JS runtime the code expects. You don't
need to understand the array's construction, you need to *execute* it:

```javascript
// paste the string-array setup + lookup function into a throwaway
// Node REPL or a headless browser console, then just call it
console.log(_0x4a1f(0x1a5)); // -> "Content-Type"
console.log(_0x4a1f(0x1a9)); // -> "application/json"
```

Do this for every index the code calls, and you can mechanically replace
every `_0x4a1f(0x1a5)` in the source with its literal string. Suddenly the
function body reads like normal JavaScript again.

## Control-flow flattening: the maze with one correct path

Flattening rewrites a normal sequence of statements into a `while` loop
around a `switch`, where a single state variable decides which case runs
next:

```javascript
let _s = 0x3;
while (true) {
  switch (_s) {
    case 0x3: total = a + b; _s = 0x7; continue;
    case 0x7: if (total > 0x64) { _s = 0x2; continue; } _s = 0x9; continue;
    case 0x2: total = 0x64; _s = 0x9; continue;
    case 0x9: return total;
  }
}
```

The control flow graph is deliberately scrambled — cases aren't laid out
in execution order, so reading top-to-bottom tells you nothing. The fix
is to trace the state variable instead of the code: start at the initial
value, follow which case sets `_s` to what next, and note down the order
you actually visit. Once you have the real sequence — `3 -> 7 -> 2 -> 9` in
that example — rewrite it as plain control flow and delete the switch
entirely. It's tedious, not hard, and mostly a job for a script once you
understand the pattern, since the transform is completely mechanical.

## Dead code and opaque predicates: noise with no function

The last common trick is padding — branches that can never execute, or
conditions that always evaluate the same way but are dressed up to look
data-dependent:

```javascript
if ((0x2 * 0x3) % 0x5 === 0x1) {
  // this always runs; the condition is a constant in disguise
  doRealWork();
} else {
  // dead code, included only to waste your time
  fetch('/telemetry', { method: 'POST' });
}
```

There's no algorithm to recover here — just patience. Evaluate the
condition by hand (or let the debugger do it), confirm it's constant, and
delete the branch that never runs. The only trap is assuming a strange
branch is *always* dead; some obfuscators mix in real environment checks
(devtools detection, timing checks) among the fake ones, so verify each
one rather than pattern-matching on "looks like junk."

## Putting it together

None of these three tricks is individually hard to reverse — they're
mechanical transforms, and mechanical transforms have mechanical
inverses. What makes a real bundle painful is all three stacked at once,
so a flattened switch statement is calling a string-array lookup inside a
branch guarded by a fake predicate. The way through is the same as any
layered problem: strip one layer fully before touching the next, and
resist the urge to read the tangled version and guess. Execute the string
array, trace the state variable, evaluate the predicates — in that order,
the "obfuscated" bundle becomes a normal function with a slightly ugly
variable-naming scheme.
