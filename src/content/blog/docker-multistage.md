---
title: 'Docker Multi-Stage Builds That Stay Small'
description: 'A single-stage Dockerfile ships your compiler, your package cache, and your test suite to production along with the app. Multi-stage builds are the fix, and the cache-friendly layer order is what makes them fast.'
pubDate: 2023-12-26
tags: ['docker', 'infrastructure']
---

```text
REPOSITORY   TAG       SIZE
myapi        v1        1.42GB
```

For a FastAPI service with maybe 40MB of actual application code and
dependencies. The other 1.38GB was `build-essential`, apt's package
cache, pip's wheel cache, and — because the `COPY . .` came before `pip
install`, in the wrong order — a full re-download of every dependency on
nearly every build, since editing any source file invalidated the layer
the install lived in. None of that belongs in the image that runs in
production; all of it was there because a single-stage Dockerfile doesn't
distinguish between "things I need to build the app" and "things I need
to run it."

## One stage, mixed concerns

The single-stage version looks reasonable until you actually read what
ends up in the final layer:

```dockerfile
FROM python:3.11
RUN apt-get update && apt-get install -y build-essential libpq-dev
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

`build-essential` compiles wheels for packages with C extensions. Once
those wheels are built, the compiler that built them is dead weight —
but `FROM python:3.11` at the top means every layer after it, including
the final `CMD`, is built on an image that still has the full compiler
toolchain sitting in it. There's no boundary in a single stage between
"tools I needed" and "artifacts I still need."

## Splitting build from runtime

Multi-stage builds give you that boundary directly: name a stage,
build everything in it, then start a fresh, smaller image and copy over
only the finished artifacts.

```dockerfile
# ---- build stage ----
FROM python:3.11 AS builder
RUN apt-get update && apt-get install -y build-essential libpq-dev
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ---- runtime stage ----
FROM python:3.11-slim
COPY --from=builder /install /usr/local
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0"]
```

`python:3.11-slim` never sees `build-essential` — it isn't installed
there, so it isn't in the layer history to prune later, it just never
exists in the final image. `COPY --from=builder` reaches into the first
stage and pulls out only `/install`, the compiled packages, leaving the
compiler and the apt cache behind in a stage that gets discarded once
the build finishes. That one change took the image from 1.42GB to
around 180MB, and the drop is entirely the compiler toolchain and
package caches that were never needed after the wheels were built.

## Layer order decides whether your cache is useful

Multi-stage builds solve image size. They don't automatically solve
build speed — that's a layer-ordering problem, and it bites just as hard
inside a build stage as outside one. Docker caches each layer and
reuses it if the inputs haven't changed, but that cache is only as good
as the order you hand it:

```dockerfile
# bad: any source change invalidates the pip install layer too
FROM python:3.11 AS builder
COPY . .
RUN pip install -r requirements.txt
```

```dockerfile
# good: requirements.txt rarely changes, so this layer usually just hits cache
FROM python:3.11 AS builder
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt
COPY . .
```

The second version copies only `requirements.txt` before running
`pip install`. Edit `app.py` and that layer's cache key — a hash of
`requirements.txt` — hasn't changed, so Docker skips reinstalling every
dependency and reuses the cached layer. On a service with a real
dependency tree, that's the difference between a ten-second rebuild and
a three-minute one, every single time you touch application code instead
of a dependency.

## What I learned

The size problem and the speed problem look like the same complaint —
"the Docker workflow is slow and heavy" — but they have different
causes and different fixes. Multi-stage builds fix what ships. Layer
ordering fixes how often you pay to rebuild it. Skip either one and the
other doesn't compensate: a small final image built with `COPY . .`
before `pip install` is still going to reinstall the world on every
source change, and a well-ordered single-stage build still ships a
compiler to production.
