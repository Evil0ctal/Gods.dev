---
title: 'jadx vs Ghidra for Android: When to Reach for Which'
description: 'jadx gets you readable Java in seconds and gives up at the JNI boundary; Ghidra is slower and uglier but keeps going into the native library where the real logic lives.'
pubDate: 2023-01-07
tags: ['reverse-engineering', 'android', 'tools']
---

Drop an APK on jadx and thirty seconds later you have something that
reads like the original Java source — variable names guessed
reasonably, control flow reconstructed, `if`/`else` blocks where they
belong. Then you hit a method declared `native`, body-less, and jadx's
job is done. The actual logic is compiled into a `.so` file, and
Java-shaped tools stop there by design. That handoff point is the
entire decision between these two tools: jadx owns the Dalvik side,
Ghidra owns whatever's compiled to native machine code.

## jadx: fast, readable, occasionally wrong

jadx decompiles DEX bytecode straight to Java-like source, and for the
bulk of an app — activities, view logic, network calls, anything not
deliberately obfuscated — the output is close enough to original source
that you can read it like a normal codebase. It has a GUI with search,
cross-references, and a "find usages" that works across the whole APK,
which makes tracing where a string constant or a method gets called
from genuinely fast.

```bash
jadx -d out/ target.apk
grep -rn "checkLicense" out/
```

Where jadx struggles: heavy obfuscation confuses its control-flow
reconstruction, and it will occasionally emit Java that doesn't quite
compile, or collapses a switch into something misleading. It's a
decompiler making a best guess at source that produced the bytecode —
usually a very good guess, sometimes a wrong one. Treat its output as
strong evidence, not ground truth, especially around anything
obfuscated enough to be interesting in the first place.

## Ghidra: slower and uglier, but it doesn't stop at Java

The moment logic crosses into a `.so` — via `System.loadLibrary` and a
`native` method declaration — jadx has nothing left to show you. That's
where Ghidra picks up: point it at the extracted shared library and it
disassembles and decompiles the actual ARM or x86 machine code into
C-like pseudocode.

```text
undefined8 Java_com_example_app_Signer_nativeSign
              (JNIEnv *env, jobject thiz, jstring param)

{
  char *pcVar1;
  pcVar1 = (*env)->GetStringUTFChars(env, param, 0);
  return sign_impl(pcVar1);
}
```

Ghidra's decompiler output is rougher than jadx's — expect `undefined4`
types, raw pointer arithmetic, and function names that are addresses
until you rename them yourself. It's also solving a genuinely harder
problem: native code has none of Dalvik's structure to lean on, no
class metadata, often stripped symbols. What you get back in exchange
is completeness — it will show you *something* for every function in
the binary, where jadx simply refuses to render what it can't map back
to Java.

## Splitting the work between them

The efficient order is almost always: jadx first, to map the app's
shape and find the `native` declarations worth chasing, then Ghidra
only on the specific `.so` and only for the functions those
declarations point at. Loading an entire native library into Ghidra
and reading it top to bottom is a multi-day project; loading it to
answer "what does `nativeSign` actually do" is an afternoon.

The JNI function name itself hands you the entry point for free —
`Java_com_example_app_Signer_nativeSign` follows a fixed mangling
scheme (package, class, method name), so you can jump straight to it in
Ghidra's symbol tree instead of hunting through `JNI_OnLoad` for a
dynamic `RegisterNatives` call, which some apps use specifically to
avoid that predictable naming and make your life harder.

## What I learned

These aren't competing tools, they're sequential ones, and asking
"jadx or Ghidra" is usually the wrong question — the right one is
"which side of the JNI boundary is the logic I care about on." jadx is
where you spend ninety percent of the time on a typical app, because
ninety percent of a typical app is ordinary Java. Ghidra is where you
go when jadx shows you a `native` keyword and nothing else — and it's
worth having both installed before you need either, because that
handoff usually happens mid-investigation, not at the start.
