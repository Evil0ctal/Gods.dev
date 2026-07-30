---
title: 'The Annotated Reverse: watch a video header decrypt in your browser'
description: 'A WeChat Channels cache file looks like noise. Drag a slider and XOR a recovered keystream across it, byte by byte, until the MP4 ftyp box surfaces — live, client-side, no server.'
pubDate: 2026-07-29
tags: ['reverse-engineering', 'wasm', 'wechat', 'interactive']
---

Here are the first 48 bytes of a WeChat Channels video, straight off disk.
They are noise — no `ftyp`, no structure, nothing a media player will touch.
The vendor calls this "encrypted."

Drag the slider. You are walking a recovered keystream across the ciphertext
one byte at a time, XOR-ing as you go. Watch the ASCII column on the right.

<div id="annotated-reverse">Reversing this live needs JavaScript. The short version: XOR the on-disk noise against the keystream the client itself generates, and an ordinary MP4 <code>ftyp</code> box falls out — the file was obfuscated, not encrypted.</div>

## What you just did

By byte 8 the ASCII gutter spells `ftyp` — the ISO Base Media File Format box
that starts almost every MP4. Nothing about that is a coincidence, and nothing
about it required a key you didn't already have:

- The **ciphertext** is the file as it sits in the cache.
- The **keystream** is what the client generates to play the video. It has to —
  the app decrypts locally to render frames.
- `plaintext = ciphertext XOR keystream`. That's the entire "decryption." You
  did it above with a range input.

That is the tell that separates obfuscation from cryptography. Real encryption
does not fold to a slider. This does, because the keystream is reproducible by
anyone who can run the client — the security lives in *hiding the generator*,
not in a secret you can't obtain.

## Where the keystream actually comes from

The generator in this demo is canned so it fits in a blog post. The real one
lives in a WebAssembly module and is **Isaac64**, seeded from a value that
travels with the media. Finding that — entropy first, then reading WASM until
the PRNG's skeleton gives it away — is the longer story, and I wrote it up
separately: [Reversing WeChat Channels](/blog/reversing-wechat-channels/).

The point of putting it in your browser instead of a screenshot: reverse
engineering is not a magic trick. It is a loop you can watch run. When a format
claims to be encrypted, the honest question is never *"is it encrypted?"* — it
is *"where does the client get the key?"* If the answer is "it makes the key
itself," you have a reading problem, not a cryptography one, and the slider
above is what solving it feels like.

*These bytes are a representative sample, not anyone's actual content. Analyze
only media and devices you're authorized to touch.*
