---
title: 'The GIL in Practice, Not Theory'
description: 'Four threads decoding video frames ran no faster than one. The same four threads doing HTTP requests ran nearly 4x faster. Same GIL, opposite outcome — here is why.'
pubDate: 2024-08-17
tags: ['python', 'performance']
---

I once "parallelized" a batch of frame-decode calls across four threads
expecting a 4x speedup and got nothing — same wall-clock time as one
thread, sometimes slightly worse from the thread-switching overhead. Two
weeks later I put four HTTP downloads on four threads and got almost
exactly 4x. Same interpreter, same GIL, same `threading` module.
Opposite result. The GIL is one lock, but whether it hurts you depends
entirely on what the thread is doing while it holds it.

## What the GIL actually locks

The Global Interpreter Lock ensures only one thread executes Python
bytecode at a time. It exists because CPython's memory management
(reference counting, mainly) isn't thread-safe without it. That's the
whole mechanism — not "Python can't do parallelism," just "only one
thread runs Python bytecode at once."

The part that matters in practice: the GIL is released around blocking
I/O calls. When a thread calls `socket.recv()` or waits on a file read,
CPython drops the GIL so another thread can run Python bytecode while
the first thread waits on the kernel. That's why the HTTP download case
scaled — three threads sit inside `recv()`, GIL released, while a fourth
runs Python. Decoding video frames is almost pure CPU inside Python and
C extensions that don't release the lock — every thread wants the GIL
at the same time, and they take turns, achieving nothing threading
wouldn't achieve serially plus overhead.

```python
import threading
import time

def cpu_bound(n: int) -> int:
    total = 0
    for i in range(n):
        total += i * i
    return total

def io_bound(url: str) -> int:
    import urllib.request
    return len(urllib.request.urlopen(url).read())
```

Run `cpu_bound` on four threads and time it against one thread running
it four times sequentially — the numbers land close enough to call it a
wash. Run `io_bound` on four threads against four downloads run one
after another, and the concurrent version wins by roughly the number of
threads, because the GIL is free during the part that actually takes
time: waiting on the network.

## The decision rule that actually holds up

- **I/O-bound (network, disk, subprocess, DB calls)** → `threading` or
  `asyncio` both work; threads are the simpler upgrade from existing
  sync code, `asyncio` scales further with less per-task overhead.
- **CPU-bound (parsing, hashing, image/audio processing, numeric loops)**
  → `multiprocessing` or a process pool. Each process gets its own GIL,
  so you get real parallelism, at the cost of pickling data across the
  process boundary.

```python
from concurrent.futures import ProcessPoolExecutor

def decode_frame(raw: bytes) -> bytes:
    # actual CPU work: this benefits from real parallelism
    ...

with ProcessPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(decode_frame, frames))
```

Same code, wrapped in `ProcessPoolExecutor` instead of
`ThreadPoolExecutor`, and the frame-decode workload from the opening
actually did scale — because each worker process has its own
interpreter and its own GIL, not because the code got smarter.

## The trap: mixed workloads that look I/O-bound

The one that actually catches people: a "network" function that does a
little too much CPU work per response. Downloading is I/O-bound.
Downloading *and then parsing a large JSON payload and computing a hash
of it* on the same thread is a mixed workload, and the CPU portion still
serializes behind the GIL even though the function spends most of its
wall-clock time in a socket call.

```python
async def fetch_and_hash(url: str) -> str:
    resp = await client.get(url)          # GIL released here
    data = resp.json()                     # GIL held here
    return hashlib.sha256(data).hexdigest()  # and here
```

With enough concurrent requests, the JSON parsing and hashing — both
pure CPU, both holding the GIL — start contending with each other even
though every individual `await client.get` looks fine in isolation. The
fix is the same one from the CPU-bound case: push the parse-and-hash
step to a process pool or a `run_in_executor` call, and let the async
side handle only the actual waiting.

## What I learned

Don't ask "is the GIL a problem for my code" as one question — ask it per
function. If a function spends its time waiting on something outside the
interpreter, threads or `asyncio` are close to free parallelism. If it
spends its time computing, no amount of `threading` fixes that; you need
separate processes or you need to accept it's serial. The GIL isn't a
tax on Python — it's a tax on treating CPU work like I/O work.
