---
title: 'Hooking JNI: When the Logic Lives in native.so'
description: 'When a method is declared native and nothing else, the Java layer is just a doorway — the actual work, and the actual hook target, is a compiled function in a shared library.'
pubDate: 2022-10-11
tags: ['reverse-engineering', 'android', 'jni']
---

```java
public native String sign(String url, long timestamp);
```

That's the entire method. No body, because there is no body in the DEX
— `native` means "implemented elsewhere," and elsewhere is
`libapp.so`. jadx can show you the declaration and every call site that
uses it. It cannot show you what `sign()` actually does, because that
logic was never compiled to Dalvik bytecode in the first place. This is
where a lot of request-signing and anti-tamper logic ends up, precisely
because it's a harder wall for tools like jadx to see through.

## Why the logic ends up here

JNI — the Java Native Interface — is the bridge Android apps use to
call into C or C++ code compiled for the device's actual CPU. Anything
performance-sensitive gets a legitimate reason to live there: crypto,
codec work, hot loops. But it's also just a good place to hide logic
from casual reversing, since it forces anyone reading the app to switch
tools entirely — from a Java-aware decompiler to a native disassembler
— and that switch alone stops a lot of surface-level analysis.

## Hooking the boundary with Frida instead of crossing it

You don't need to fully reverse the native function to observe what
crosses the JNI boundary. `Interceptor.attach` on the exported symbol
gives you the arguments and return value at the call site, which is
often everything you actually need — the algorithm can stay a black
box as long as you can see its inputs and outputs.

```javascript
const libapp = Process.findModuleByName('libapp.so');
const signAddr = libapp.findExportByName('Java_com_example_app_Signer_sign');

Interceptor.attach(signAddr, {
    onEnter(args) {
        // args[0] = JNIEnv*, args[1] = jobject (this)
        // args[2..] are the actual Java parameters, as jobjects
        this.env = args[0];
        console.log('[jni] sign() called');
    },
    onLeave(retval) {
        // retval is a jstring — read it back through JNI to get text
        const jstr = ptr(retval);
        const cStr = this.env.readCString
            ? this.env.readCString(jstr)
            : Java.vm.getEnv().getStringUtfChars(jstr, null);
        console.log('[jni] sign() returned:', cStr);
    }
});
```

`Java_com_example_app_Signer_sign` isn't a guess — it's the mangled
name JNI requires for a method Java resolves automatically at load
time: `Java_` plus the fully qualified class and method name, with `_`
substituted for `.`. If the symbol table has that name intact, you can
jump straight to it in both Frida and Ghidra without hunting.

## When the name isn't there to find

Some libraries register their native methods dynamically through
`RegisterNatives` inside `JNI_OnLoad`, specifically to avoid the
predictable `Java_...` symbol and make static discovery harder. The
function still has to exist and still has to run, so the fallback is
hooking `RegisterNatives` itself and logging every method it binds —
which hands you the real function pointer regardless of what the
library's authors tried to keep off the symbol table.

```javascript
const RegisterNatives = Module.findExportByName('libart.so', 'RegisterNatives');
Interceptor.attach(RegisterNatives, {
    onEnter(args) {
        const methodCount = args[3].toInt32();
        console.log('[jni] RegisterNatives called, methods:', methodCount);
        // args[2] is a JNINativeMethod*, walk it to log name + fnPtr
        // per entry if you need the exact function addresses
    }
});
```

Hooking the registration call instead of a named export is slower to
set up but strictly more general — it works whether the app used the
predictable naming convention or deliberately avoided it.

## What I learned

`native` in a method signature isn't a dead end, it's a sign the
interesting part of the app moved to a different file format. The
Java/Kotlin layer usually still tells you *when* the native function
gets called and *with what* — Frida's `Interceptor` lets you watch that
boundary without fully reverse engineering what happens on the other
side of it. Full static analysis in Ghidra is still worth doing when
you need to reimplement the logic yourself, but for a first pass,
watching the JNI boundary is almost always faster than reading the
`.so` from scratch.
