---
title: 'Bypassing SSL Pinning on Android, Three Ways'
description: 'objection, a Frida script, and a patched APK all defeat certificate pinning — they just trade off setup time, durability, and how much of the app you have to touch.'
pubDate: 2021-03-19
tags: ['reverse-engineering', 'android', 'tls']
---

mitmproxy sits between the phone and the internet, the CA is installed
and trusted on the device, and the capture pane is still empty. The app
made a request — the connection indicator blinked — and mitmproxy never
saw a byte of it. That's the tell. The app isn't failing to connect,
it's refusing to trust *your* certificate specifically. That's
certificate pinning, and there isn't one fix for it, there are three,
and they don't cost the same.

## Way one: objection

[objection](https://github.com/sensepost/objection) wraps Frida with a
library of prebuilt hooks, and "disable SSL pinning" is one command:

```bash
objection -g com.example.app explore
# inside the objection shell
android sslpinning disable
```

This is the fastest path from zero to a working capture, and for a
first pass at an unfamiliar app it's the right first move. The tradeoff
is that it's a shotgun. objection patches every pinning implementation
it knows how to recognize — `TrustManager`, OkHttp's `CertificatePinner`,
a few others — whether or not the app is actually using that one. It
works often enough to be the default choice, and when it doesn't work
you've lost five minutes, not an afternoon.

## Way two: a Frida script targeted at the real implementation

When objection doesn't land, it's because the app pins in a way its
hook list doesn't cover — a custom `TrustManager`, or pinning done
inside a WebView, or logic buried in an obfuscated helper class. The
fix is the same idea as objection's, aimed by hand. Find the class
doing the check, override the method that decides trust:

```javascript
Java.perform(function () {
    const OkHttpPinner = Java.use('okhttp3.CertificatePinner');
    OkHttpPinner.check.overload(
        'java.lang.String', 'java.util.List'
    ).implementation = function (hostname, certs) {
        console.log('[pin] skipped check for', hostname);
        // return without throwing — the real implementation throws
        // SSLPeerUnverifiedException when the pin doesn't match
    };
});
```

This costs more time than objection because you have to find the class
first — usually by grepping the decompiled source for `TrustManager`,
`CertificatePinner`, or `checkServerTrusted`, then confirming with a
breakpoint or a log line that it's actually on the call path. What you
get back is precision: a hook that does exactly one thing, doesn't
touch code paths you don't care about, and is easy to explain later.

## Way three: patch the APK

Both of the above require Frida running against a live process, which
means a rooted device or a gadget-injected build, every single session.
Sometimes you want the unpinned behavior to just be *true of the APK*
— for a build you hand to someone else, or a CI pipeline that needs to
capture traffic without a Frida rig attached. That means editing the
smali directly.

```bash
apktool d target.apk -o target-src
# find checkServerTrusted or CertificatePinner.check in the smali,
# replace the throw with a return-void, or short-circuit the
# comparison that decides trust
apktool b target-src -o target-patched.apk
apksigner sign --ks debug.keystore target-patched.apk
```

This is the slowest and most fragile of the three — you're editing
bytecode by hand, and if you patch the wrong branch the app crashes
instead of connecting insecurely. It's also the only one that survives
without Frida attached, which matters for automation, and it's the one
most likely to trip an integrity check if the app verifies its own
signature or checksums its own DEX.

## Which one to reach for

Start with objection, always — it's nearly free. Drop to a targeted
Frida script the moment objection's generic hooks miss, because you'll
spend that saved time finding the real class anyway. Reach for the APK
patch only when you need the unpinned behavior to persist without a
Frida session attached, and budget real time for it — you're doing
brain surgery on bytecode you didn't write, and it will occasionally
fight back with a crash you have to diagnose from a stack trace with no
line numbers.

None of these three break TLS. They all do the same thing: convince the
app that the certificate it already has permission to distrust is fine
to trust. The interesting engineering is deciding which layer is cheapest
to lie to.
