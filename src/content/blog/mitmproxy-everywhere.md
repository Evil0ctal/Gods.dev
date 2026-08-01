---
title: 'mitmproxy Everywhere: Seeing What Apps Actually Send'
description: 'Before touching Frida or a disassembler, point every request the app makes through a transparent proxy — most of what you need to know about an API is sitting in plain traffic, if you bother to look first.'
pubDate: 2024-11-15
tags: ['reverse-engineering', 'tooling']
---

Half the time, the answer to "what does this app talk to" is sitting in
a request you could have read in five minutes, and people skip straight
to a decompiler anyway. Before hooking anything, before opening jadx,
the first move on any app should be pointing its traffic through
mitmproxy and just reading what goes over the wire. It's the cheapest
information you'll get all session, and it tells you whether you even
need the expensive tools.

## Setting up the transparent proxy

Run mitmproxy on your host, point the phone at it as an upstream proxy,
and every HTTP(S) request the device makes routes through a process you
control and can inspect live.

```bash
# on the host, listening on the default port
mitmproxy --listen-port 8080

# on the device: Settings > Wi-Fi > (network) > Modify >
# Proxy: Manual, host = your machine's LAN IP, port = 8080
```

For anything beyond a quick look, `mitmdump` with a save flag is more
useful than the interactive TUI — it writes every flow to a file you
can replay, diff, or grep later without babysitting a terminal:

```bash
mitmdump -w capture.flow
```

That single flag turns a proxy session into an artifact. Six months
later, when the app changes its API and you need to remember what the
old request shape looked like, that file is the answer.

## Getting the app to trust your CA

TLS means the traffic is encrypted between the app and mitmproxy unless
the device trusts mitmproxy's certificate — which it doesn't, by
default, for good reason. Installing the CA is the difference between
"connection refused" and a readable capture:

```bash
# visiting this from the device's browser (with the proxy active)
# downloads mitmproxy's CA cert
http://mitm.it
```

On modern Android, a CA installed as a *user* certificate is trusted by
the browser and most WebViews but not by apps targeting a recent API
level — since Android 7, apps opt out of trusting user-added CAs by
default unless their network security config explicitly says
otherwise. For those apps you need the certificate installed as a
*system* CA instead, which means root and pushing it into
`/system/etc/security/cacerts/` directly, or using Magisk's
`MagiskTrustUserCerts` module to promote the whole user CA store
automatically on every boot.

## Reading traffic that fights back

Get the CA trust right and most apps hand you readable JSON immediately
— endpoints, headers, auth tokens, the works. Some don't, because
they've layered application-level pinning on top of TLS: the app
checks the certificate's fingerprint itself and refuses to proceed even
though the OS-level chain of trust is fine. That shows up as the app
silently failing to load data with an empty mitmproxy capture, which is
a different problem from the CA-trust issue above and needs a Frida
hook against the specific pinning check to get past — a separate step,
not a mitmproxy setting.

Once traffic is flowing, the capture itself becomes a map for
everything else you do to the app. Endpoint paths tell you where the
interesting logic lives; a request parameter that looks like random
noise is your cue that there's a signing routine worth finding; a
response that's suspiciously terse compared to what the UI renders
tells you there's a second, undocumented endpoint filling in the rest.
None of that requires touching the app's code at all — it's available
from the traffic alone, before you've decided whether this needs
Frida, Ghidra, or nothing further.

## What I learned

Traffic capture is the cheapest reconnaissance in the whole reversing
toolkit, and it's tempting to skip it because it feels too simple to be
worth doing first. It isn't. An hour with mitmproxy tells you the shape
of the problem — how many endpoints, which ones are signed, which ones
are plain — before you've committed to a heavier tool. Read the wire
first. Decide what's actually worth hooking or disassembling only after
you know what you're looking at.
