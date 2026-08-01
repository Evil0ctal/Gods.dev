---
title: 'Debugging CUDA Out-of-Memory Like a Detective'
description: 'A CUDA OOM traceback tells you where the allocation failed, not why the memory was gone. Here is how to read the allocator instead of just raising batch size down.'
pubDate: 2024-04-21
tags: ['ml', 'debugging', 'cuda']
---

```text
torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate 512.00 MiB
(GPU 0; 23.65 GiB total capacity; 21.02 GiB already allocated;
340.12 MiB free; 22.10 GiB reserved in total by PyTorch)
```

The instinct is to read "21 GiB allocated on a 24 GiB card" and conclude
the model is just too big. Sometimes that's true. But look at the last
line again: 22.10 GiB *reserved*, only 21.02 GiB *allocated*. There's over
a gigabyte the process is holding but not using for this request, and the
allocator still couldn't find 512 MiB contiguous to hand out. That gap
between reserved and allocated is where the actual bug usually lives:
fragmentation, not raw size.

## Reserved vs allocated vs free

PyTorch's caching allocator asks the CUDA driver for memory in large
chunks and then hands out pieces of those chunks to tensors as you create
them. When a tensor is freed, its memory goes back to the *allocator's*
pool, not back to the driver — that's the "reserved" number. It stays
reserved so the next allocation is fast, no round-trip to the driver.

That's usually a win. It becomes a problem when reserved memory is
scattered into pieces too small for a new allocation to fit, even though
the *sum* of free space would be plenty. `torch.cuda.memory_summary()` is
the tool that shows you this, not just a nvidia-smi number:

```python
import torch

print(torch.cuda.memory_summary(device=0, abbreviated=True))
```

```text
|      Metric      | Cur Usage | Peak Usage |
|-------------------|-----------|------------|
| Allocated memory  |  21.02 GB |   22.80 GB |
| Reserved memory   |  22.10 GB |   22.10 GB |
|   from large pool |  20.88 GB |   20.88 GB |
|   from small pool |   1.22 GB |    1.22 GB |
```

If reserved is climbing while allocated stays flat across requests, you
have a fragmentation problem, not a "the model needs a bigger GPU"
problem. Those get fixed differently.

## The batch size trap

Dropping batch size "fixes" almost every OOM, which is exactly why it's a
trap — it treats the symptom and hides the cause. If your fragmentation is
coming from variable-length sequences (padding a batch of mixed-length
audio or text to the longest item, over and over, with different lengths
each time), a smaller batch buys headroom without addressing why the
allocator keeps carving out differently-sized chunks in the first place.

Two changes that actually address fragmentation instead of dodging it:

- **Bucket by length.** Sort or bucket inputs so batches have similar
  sequence lengths, so the allocator sees repeatable shapes instead of a
  new size every call.
- **Set the allocator's split threshold.** `PYTORCH_CUDA_ALLOC_CONF` lets
  you cap how large a memory block can be split, which reduces the
  allocator carving big reserved chunks into slivers it can't reassemble:

```bash
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:128
```

## Finding the actual leak, not just the OOM

A true leak — memory that grows request over request and never comes
back — is a different animal from fragmentation, and conflating the two
wastes a debugging session. The tell is `torch.cuda.memory_allocated()`
trending upward across requests that should have identical footprints:

```python
import torch

for i, batch in enumerate(loader):
    output = model(batch)
    loss = criterion(output, batch.target)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

    if i % 50 == 0:
        print(f"step {i}: {torch.cuda.memory_allocated() / 1e9:.2f} GB allocated")
```

If that number climbs and never plateaus, look for tensors held past
their useful life — a loss history list that keeps `.append(loss)`
instead of `.append(loss.item())` (keeping the whole autograd graph
alive per entry), or a cache dict keyed on request id that never evicts.
`gc.collect()` plus `torch.cuda.empty_cache()` will confirm it: if memory
drops back down after both, it was fragmentation or lingering references
Python's own garbage collector could clear; if it doesn't drop, something
is still holding a reference to those tensors, most likely a Python-side
cache or a closure.

## What I learned

The traceback tells you where the allocation failed. It does not tell
you why the memory wasn't there. Treat every OOM as a question with
three possible answers — genuinely too big, fragmented, or leaking — and
`memory_summary()` before you touch batch size. Two of those three have
nothing to do with model size, and shrinking the batch only ever fixes
the first one.
