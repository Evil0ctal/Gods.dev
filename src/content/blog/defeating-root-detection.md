---
title: 'Root Detection Is a Suggestion'
description: 'Root and emulator checks look for a handful of predictable signals — here is what they actually test, and how to neutralize them with Frida instead of un-rooting your only test device.'
pubDate: 2020-05-09
tags: ['reverse-engineering', 'android', 'frida']
---

The app installs fine, opens fine, shows a splash screen, and closes.
No crash log, no error toast, nothing in logcat above `I/`. That
silence is usually root detection doing its job: the app noticed
something about the device and decided to leave quietly rather than
tell you why. Before reaching for a debugger, it's worth knowing that
almost every root check on Android is built from the same small set of
signals, and every one of them is a lie you can tell instead.

## What the checks actually look for

Root detection isn't magic — it's a handful of filesystem and package
checks that a rooted device fails and a stock device passes.

- **`su` binary presence.** The check runs `Runtime.exec("which su")`
  or stats known paths directly: `/system/bin/su`, `/system/xbin/su`,
  `/sbin/su`. Rooting tools install a `su` binary; stock ROMs don't
  ship one.
- **Build tags.** `Build.TAGS` reads `"test-keys"` on a device signed
  with AOSP test keys instead of a manufacturer's release keys — a
  strong hint the ROM isn't stock.
- **Package presence.** A `PackageManager` query for
  `com.topjohnwu.magisk` or older `eu.chainfire.supersu` finds the
  root manager app itself, if it's installed under its default name.
- **Writable system partitions.** Checking whether `/system` mounts
  read-write instead of read-only — root often remounts it for
  installing Magisk modules or Xposed.
- **RootBeer and friends.** Most apps don't write these checks from
  scratch; they pull in a library like RootBeer that bundles all of
  the above behind one `isRooted()` call, which is convenient for the
  app author and equally convenient for you — one class to hook
  instead of five scattered checks.

## Neutralizing checks without gutting your rooted setup

The naive fix is to un-root the device, which defeats the point of
having a rooted test phone in the first place. The better fix is to
leave the device rooted and lie to the app about what it's finding.
Same approach as any other Frida hook: intercept the method that
returns the verdict, and return the answer the app wants to hear.

```javascript
Java.perform(function () {
    // most root-check libraries funnel down to one boolean method
    const RootBeer = Java.use('com.scottyab.rootbeer.RootBeer');
    RootBeer.isRooted.implementation = function () {
        console.log('[roothook] isRooted() suppressed');
        return false;
    };

    // hand-rolled checks usually shell out — catch it at the source
    const Runtime = Java.use('java.lang.Runtime');
    Runtime.exec.overload('java.lang.String').implementation = function (cmd) {
        if (cmd.indexOf('su') !== -1) {
            console.log('[roothook] blocked exec:', cmd);
            throw Java.use('java.io.IOException').$new('not found');
        }
        return this.exec(cmd);
    };
});
```

If the app checks `Build.TAGS` directly, you can't override a static
field the same way you override a method — instead hook the getter or
patch the value at class-load time with `Java.use('android.os.Build')`
and reassign the field before anything reads it. The general move is
always the same: find the specific signal, and intercept it at the
narrowest point instead of trying to make the phone actually look
un-rooted at the OS level, which is a much bigger and less reliable
project.

Magisk's own hide/deny-list feature does some of this for you at the
system level — it can make root invisible to a specific app without
any Frida involvement — but it doesn't catch custom checks the app
wrote itself, which is exactly the gap the hooks above fill.

## Emulator detection is the same game with different tells

Apps that don't care about root often still care whether they're on an
emulator, and the signals are the same shape: `Build.FINGERPRINT`
containing `"generic"`, `Build.MODEL` reading `"sdk_gphone"` or
`"Android SDK built for x86"`, `/dev/qemu_pipe` existing, or the
`ro.kernel.qemu` system property being set. Same fix applies — hook the
getters, hook the property reads, return what a real device would
return. If you're doing serious analysis work, a real rooted device
beats an emulator for exactly this reason: half the checks in a
production app exist specifically to catch you using one.

## What I learned

Root and emulator detection are usually built to catch casual users
poking around, not a determined analyst with Frida attached. The
checks are static, enumerable, and gated behind a small number of
methods — which means the fix is also static and enumerable. Spend ten
minutes finding which specific check fired before writing any hook;
guessing and hooking everything RootBeer-shaped works often enough to
feel productive, but a targeted hook is the one you can explain, reuse,
and trust when the app updates and half the class names change.
