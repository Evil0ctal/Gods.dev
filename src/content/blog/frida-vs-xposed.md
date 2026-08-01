---
title: 'Frida vs Xposed: Two Ways to Bend an App'
description: 'Frida and Xposed both let you rewrite app behavior at runtime, but they sit at opposite points on the setup-cost versus persistence tradeoff — here is how to pick.'
pubDate: 2022-07-26
tags: ['reverse-engineering', 'android', 'frida']
---

I get asked, often enough that it's worth writing down, "should I use
Frida or Xposed for this?" The honest answer is that they solve
overlapping problems from opposite directions, and the right pick usually
falls out of one question: does this hook need to survive a reboot?

## What each one actually is

**Frida** injects a JavaScript runtime into a *running* process from the
outside — over USB, over TCP, from a Python script on your laptop. There
is no persistent installation on the device beyond the `frida-server`
binary. You attach, you hook, you detach, and the target app goes back to
being unmodified the moment you're done.

```python
import frida, sys

session = frida.get_usb_device().attach("com.example.app")
script = session.create_script("""
Java.perform(function () {
    var Api = Java.use("com.example.net.Api");
    Api.request.implementation = function (url) {
        console.log("[frida] request -> " + url);
        return this.request(url);
    };
});
""")
script.load()
sys.stdin.read()
```

**Xposed** (and its modern successor, LSPosed) is the opposite shape: a
module installed *into the system*, loaded by a modified Zygote for every
app that starts, forever, until you uninstall the module. You write a
module once, and every future launch of the target app — and any other
app you've hooked — picks it up automatically, no laptop required.

```java
public class ExampleHook implements IXposedHookLoadPackage {
    public void handleLoadPackage(XC_LoadPackage.LoadPackageParam lpp) {
        if (!lpp.packageName.equals("com.example.app")) return;
        XposedHelpers.findAndHookMethod(
            "com.example.net.Api", lpp.classLoader, "request", String.class,
            new XC_MethodHook() {
                protected void afterHookedMethod(MethodHookParam param) {
                    Log.d("xposed", "request -> " + param.args[0]);
                }
            });
    }
}
```

## Setup cost, in practice

Frida needs a `frida-server` binary running on the device (rootless setups
exist too, repackaging the target APK) and a controlling process on your
side. That's it — five minutes from a fresh emulator to your first hook,
and the hook logic lives in a script file you can iterate on without
touching the device again.

Xposed/LSPosed needs a rooted device with a custom recovery-installed
framework, and each module change means rebuilding, reinstalling, and
usually rebooting or at least soft-rebooting the Zygote. It's a heavier
setup with a slower edit-test loop, full stop.

## Where each one wins

Frida wins for exploration — the interactive, "what does this function
actually return" phase of reversing an app you don't understand yet. The
attach/detach model means zero footprint left on the device, which
matters if the app has any integrity checking (root detection, package
signature verification, tamper detection) that would notice a modified
system framework.

Xposed wins when you need the modification to be *ambient* — always on,
surviving reboots, active before you've even opened a terminal. A module
that, say, permanently strips ads from a launcher, or globally intercepts
notifications across every app on the device, is a genuinely different
requirement than "let me see what this one function does right now,"
and Frida's session-based model isn't really built for it.

## The one that surprises people

Root detection routines are frequently tuned against Xposed-style
persistent modification — checking for the framework's known files,
processes, and hooked-method signatures — simply because it's the older,
more established target. Frida attaching over USB from an external
process is a different fingerprint, and plenty of app hardening that
successfully blocks Xposed doesn't even look for Frida's approach at all.
That's not a permanent advantage — Frida detection exists and keeps
improving — but it's often the deciding factor day-to-day: try Frida
first, because it's cheaper to set up and less likely to trip whatever
the app's hardening was actually built to catch.
