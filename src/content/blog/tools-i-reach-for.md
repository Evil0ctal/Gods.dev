---
title: 'The Tools I Reach For'
description: 'A working toolbox for reverse engineering, scraping, and ASR work — what earned a permanent spot and what got quietly dropped.'
pubDate: 2024-06-06
tags: ['essay', 'tooling']
---

My `~/.zshrc` has a block near the bottom labeled `# re/scraping tools`
that hasn't changed much in two years. That stability is the actual
signal — everything in it survived getting replaced by something newer,
which is the only test a tool really has to pass.

Here's what's in the block, and why it's still there.

## Reverse engineering

**Frida** is the one I open first, every time, for anything on a phone.
Not because static analysis is wrong, but because the fastest way to
learn what a function does is to watch it run:

```javascript
Java.perform(function () {
  const Signer = Java.use('com.example.security.Signer');
  Signer.sign.overload('java.lang.String').implementation = function (input) {
    const result = this.sign(input);
    console.log(`sign("${input}") -> ${result}`);
    return result;
  };
});
```

Twelve lines and you know the input/output shape of a function you've
never seen the source of. Static tools tell you what code *could* do;
Frida tells you what it *actually* does, on this device, right now, and
that gap matters more than it should.

**jadx** is the everyday Android decompiler — fast, good-enough Java
output, searchable across a whole APK. I reach for **Ghidra** only when
jadx's output goes to stubs, which means the real logic moved to a native
`.so`. Two tools, two jobs, and I stopped trying to make one do both.

For traffic, **mitmproxy** stays running in a terminal tab more often
than not. A transparent proxy plus a certificate pinned into a test
device is worth more than reading client code cold, because the wire is
where an app's opinions about what to hide actually show up.

## Scraping and backend

**httpx** replaced `requests` in every new project once I needed async
clients with a similar API. **Playwright** is the fallback when a site's
real content only exists after JavaScript runs — I resist it as long as
I can, because a rendered page costs an order of magnitude more than a
raw HTTP call, and most sites don't actually need it.

```bash
pip install "httpx[http2]" playwright
playwright install chromium
```

**Redis** is the one piece of infrastructure that shows up in nearly
every scraper I've built past a single script — frontier queue, dedup
set, rate-limit counters, all in one process that's boring in the best
way. Boring is a compliment for infrastructure.

## ASR and everything with a GPU

**faster-whisper** is the whole ASR stack now. It's CTranslate2 under the
hood, and the memory and throughput difference against stock Whisper was
big enough that I never looked back once I moved a transcription API
over.

```bash
pip install faster-whisper
nvidia-smi --query-gpu=memory.used,memory.total --format=csv
```

That `nvidia-smi` line runs more than any other command on the GPU boxes.
Half of production ML debugging is just watching a number change.

## What got dropped

I used to keep IDA around out of habit. Ghidra reads Dalvik and native
code well enough now that a paid license stopped earning its keep. I
dropped a homegrown proxy-pool script for the same reason people drop
homegrown ORMs — the maintenance cost snuck up on me and a library
already did it better.

The pattern behind every tool that survived: it answers a question fast,
with output I can act on immediately, and it doesn't ask me to trust it —
it shows me the thing. Tools that require faith over evidence get
replaced. Everything else earns its line in the `.zshrc`.
