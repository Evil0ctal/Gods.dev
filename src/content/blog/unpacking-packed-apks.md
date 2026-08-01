---
title: 'Unpacking a Packed APK: Dumping DEX from Memory'
description: 'A packed APK ships a classes.dex that is mostly a decoy — the code that actually runs gets assembled in memory at launch, which means the honest copy only ever exists at runtime.'
pubDate: 2022-01-14
tags: ['reverse-engineering', 'android']
---

`classes.dex` is 40 kilobytes. The app has a login screen, a feed, push
notifications, in-app purchases — there is no version of that feature
list that fits in 40 kilobytes of bytecode. Open it in jadx anyway and
the picture confirms it: a handful of classes, one of them with a name
like `StubApplication`, and a `loadLibrary` call pointing at a native
library that clearly does the rest of the work. This is a packed APK.
The DEX on disk is a loader. The real app assembles itself in memory
after launch, specifically so tools like jadx have nothing useful to
read.

## Why packers exist

Commercial app-protection products exist because static analysis is
cheap and automatic — a decompiler with no human attached can process
thousands of APKs a day, extract strings, flag reused code, and clone
an app's business logic wholesale. A packer's whole job is to deny that
first, free pass: encrypt or otherwise obscure the real DEX, ship a
tiny stub loader as the "real" `classes.dex`, and have that stub decrypt
and load the actual application classes only once the process is
already running, inside memory a static tool never touches.

It's the same idea as a packed Windows executable — UPX and friends do
this to native binaries for the same reason — just applied to Dalvik
bytecode instead of machine code. The stub's `attachBaseContext` or
`onCreate` typically does the heavy lifting: decrypt a blob bundled in
the assets folder or the native library, hand it to a custom
`ClassLoader`, and from that point on the "real" app is running code
that was never on disk in a form jadx could parse.

## The window you're actually exploiting

The trick works against static analysis specifically because static
analysis never runs the code. Dynamic analysis doesn't have that
weakness — the real classes have to exist, fully decrypted, in the
process's memory at some point, because the ART runtime can't execute
DEX bytecode it can't read. That's the gap: somewhere between "app
launched" and "app is usable," the honest classes exist in memory in
the clear, however briefly the packer's authors hoped that window would
be.

Frida gets you into that window. `Java.enumerateClassLoaders()` lists
every `ClassLoader` currently alive in the process, including whatever
custom loader the packer's stub just constructed to load the real
classes — and once you're holding a reference to it, you can walk its
loaded classes directly instead of waiting for a full memory dump.

```javascript
Java.perform(function () {
    Java.enumerateClassLoaders({
        onMatch: function (loader) {
            try {
                // if this loader knows about a class the stub
                // clearly doesn't ship, the real app is loaded here
                loader.findClass('com.example.app.LoginActivity');
                console.log('[unpack] real classloader found:', loader);
            } catch (e) {
                // this loader doesn't have it — keep looking
            }
        },
        onComplete: function () {}
    });
});
```

## Dumping the DEX once you've found it

Finding the right loader gets you a reference; getting bytes out to
disk still means reading the loader's in-memory DEX buffer directly,
since `ClassLoader` doesn't hand back raw bytes through its public API.
The reliable approach is walking the loader's internal `dexFile` /
`pathList` fields with Frida's Java reflection helpers, or — simpler,
if the app is cooperative — just letting the process run to completion
and scanning its memory maps for the DEX magic bytes:

```bash
# DEX files start with "dex\n0"+version — scan a live process's
# memory for that signature and carve out whatever follows it
python3 dex_carve.py --pid $(pidof com.example.app) --signature "6465780a30333900"
```

Once you've got a candidate blob starting at that signature, `dexdump`
or jadx itself will tell you immediately whether you carved a real,
loadable DEX or just a coincidental byte run — a valid file opens
clean, everything else throws.

## What I learned

A packer changes where the honest code lives, not whether it exists.
Bytecode the CPU can execute is bytecode you can eventually read — the
only real question is whether you catch it on disk or in memory. Every
hour a packer's authors spend making the on-disk artifact useless is an
hour that just moves the interesting part of your job later in the
process's lifecycle, not off the table entirely.
