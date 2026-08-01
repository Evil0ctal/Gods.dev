---
title: 'Your First Frida Hook: Reading What an Android App Hides'
description: 'Attaching Frida and overriding one Java method is the fastest way to see what an app actually does at runtime, not what jadx guesses it does statically.'
pubDate: 2025-01-29
tags: ['reverse-engineering', 'android', 'frida']
---

jadx tells me `checkLicense()` returns a `boolean`. It does not tell me
what that boolean actually is when I tap the button, or what gets fed
into the method that decides it. Static reading gets you the shape of
the code. It does not get you the values flowing through it while the
app runs. For that you need to be inside the process while it's alive,
and the fastest way in is Frida.

This is the walkthrough I wish I'd had the first time: get `frida-server`
talking to a device, attach to a running app, and override one method's
return value. Nothing clever. Just the minimum path from "I have an APK"
to "I am watching it lie to itself."

## Getting frida-server onto the device

Frida is two halves: a server binary that runs on the device, and a
Python/CLI client that talks to it over USB or TCP. Match the server
version to your client version exactly, or the handshake fails silently
in ways that waste an hour.

```bash
# on the host: check the client version first
pip show frida | grep Version

# grab the matching frida-server release for your device's ABI
# (arm64-v8a on basically every phone from the last several years)
adb push frida-server-16.x.x-android-arm64 /data/local/tmp/frida-server
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "su -c /data/local/tmp/frida-server &"
```

That last line needs root — `frida-server` runs as a privileged process
so it can attach to arbitrary apps. If the device isn't rooted, you're
into `frida-gadget` territory instead, which means injecting a shared
library into the APK before you install it. More setup, same end result.
Start with a rooted emulator or a rooted test device if you have one;
save gadget injection for when you don't.

Confirm the client can see it:

```bash
frida-ps -U
```

If that lists running processes on the device, you're attached. If it
times out, it's almost always the version mismatch above, not something
exotic.

## Your first hook

Pick a target method. `Java.perform` is the wrapper Frida needs so your
code runs on a thread the ART runtime has already initialized — call
`Java.use` outside of it and you get a null class loader and a confusing
error.

```javascript
// hook.js
Java.perform(function () {
    const LicenseChecker = Java.use('com.example.app.LicenseChecker');

    LicenseChecker.checkLicense.implementation = function () {
        const original = this.checkLicense();
        console.log('[hook] checkLicense() really returned:', original);
        return true; // force it, see what changes
    };
});
```

Run it against the live app:

```bash
frida -U -f com.example.app -l hook.js --no-pause
```

`-f` spawns the app fresh instead of attaching to one already running,
which matters if the check fires at startup before you'd otherwise get
a chance to attach. `--no-pause` lets it run immediately instead of
waiting at the entrypoint.

The moment that log line prints, you've learned two things at once:
what the app's real answer was, and what happens when you feed it a
different one. Half the time the second part is more interesting than
the first — a `true` you forced in might unlock a screen, or it might
do nothing because the actual gate is somewhere else entirely, and now
you know where to look next.

## Where this goes from a toy to a tool

One overridden boolean is a demo. The real use is the same trick applied
in a loop: hook every method on a suspicious class, log arguments and
return values, and read the transcript instead of the decompiled source.

```javascript
Java.perform(function () {
    const Target = Java.use('com.example.app.Signer');
    Target.sign.overloads.forEach(function (overload) {
        overload.implementation = function () {
            console.log('[sign] args:', JSON.stringify(arguments));
            const result = overload.apply(this, arguments);
            console.log('[sign] result:', result);
            return result;
        };
    });
});
```

That pattern — enumerate overloads, wrap each implementation, log in and
out — is most of what you need before you ever touch a disassembler.

## What I actually learned

Static analysis answers "what could this code do." Frida answers "what
did this code just do, with these exact inputs, on this exact device."
Those are different questions, and the second one is almost always the
one you actually need answered. Get comfortable with `Java.perform` and
method overrides before you reach for anything heavier — most reversing
sessions end with a five-line hook, not a week in a debugger.
