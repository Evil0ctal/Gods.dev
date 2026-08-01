---
title: 'Reproducible Builds and Trusting What You Ship'
description: 'Why "it works on my machine" is a supply-chain risk, and the concrete pieces — pinned hashes, locked layers, a build receipt — that make a build verifiable instead of just repeatable.'
pubDate: 2025-04-20
tags: ['infrastructure', 'security']
---

I rebuilt a Docker image from the same Dockerfile, on the same commit,
two days apart, and got two different `pip freeze` outputs. Nothing in
the Dockerfile had changed. A transitive dependency had shipped a patch
release in between, `requirements.txt` pinned the top-level package but
not its dependencies, and the build silently pulled in different code
both times. That gap — same instructions, different artifact — is the
entire problem reproducible builds exist to close.

## "Reproducible" means bit-identical, not "works the same"

It's tempting to call a build reproducible if it behaves the same way
each time. That's not the bar. The actual definition is stricter: given
the same source and the same build inputs, the output artifact is
byte-for-byte identical, every time, on any machine. That strictness is
the point — it's what lets you verify a binary matches its claimed
source instead of trusting the party that built it.

The gap between "usually works" and "provably identical" is exactly
where supply-chain attacks live. A compromised build server can inject
anything into an artifact that nobody re-derives independently, and
nobody notices, because the artifact still "works."

## The three places non-determinism sneaks in

**Unpinned dependencies.** `requirements.txt` with bare package names
resolves against whatever's newest on the day you build, not the day you
wrote it:

```text
# reproducible: exact version AND hash, so pip refuses a substituted package
httpx==0.27.0 \
    --hash=sha256:71d5465162c13681bff01ad59b2cc68dd838ea1f10e51574bac27103f00c159
```

`pip install -r requirements.txt` with hashes present will hard-fail
rather than silently install a different artifact under the same
version number — that's the property you actually want, not just a
pinned version string.

**Build timestamps embedded in the artifact.** Compilers and packagers
love to stamp "built at" into binaries and archives, which makes two
otherwise-identical builds differ by exactly one field. Reproducible
build tooling neutralizes this with a fixed epoch:

```bash
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
docker build --build-arg SOURCE_DATE_EPOCH .
```

Tar and zip archivers, in particular, embed per-file mtimes by default —
`tar --mtime="@$SOURCE_DATE_EPOCH"` strips that variability out entirely.

**Non-deterministic ordering.** Filesystem directory listings and hash-map
iteration order aren't guaranteed stable across runs or platforms. A
packaging script that does `os.listdir()` and writes files into an
archive in whatever order the OS handed them back will produce a
different archive on every machine, even with identical file contents:

```python
# non-deterministic: relies on OS-provided directory order
for name in os.listdir(src_dir):
    archive.add(name)

# deterministic: order is a function of the data, not the filesystem
for name in sorted(os.listdir(src_dir)):
    archive.add(name)
```

## The build receipt

Determinism is only useful if someone can check it. The output I want
sitting next to every release artifact is a small receipt, not a promise:

```text
artifact:  gods-api-v2.4.1.tar.gz
sha256:    9f2a...c831
source:    git@commit 7dba6dc
built by:  ci-runner-3, SOURCE_DATE_EPOCH=1745020800
verify:    docker build . | sha256sum   # should match the line above
```

That last line is the whole point — it turns "trust me" into "run this
and check." Anyone with the source and the pinned toolchain can rebuild
the artifact independently and diff the hash. If it matches, the CI
pipeline that produced the shipped binary wasn't lying about what it
built from.

## What I learned

Most of the work isn't cryptography, it's removing sources of
accidental entropy — a timestamp here, an unsorted loop there, an
unpinned transitive dependency three levels down. None of it is exotic.
What changes is the posture: instead of asking people to trust that the
artifact matches the source, you hand them a command that lets them
check it themselves. That's a small technical change with an
outsized effect on how much you have to take on faith.
