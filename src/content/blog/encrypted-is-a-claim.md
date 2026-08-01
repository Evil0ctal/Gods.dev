---
title: '''Encrypted'' Is a Claim, Not a Fact'
description: 'A marketing page saying "military-grade encryption" tells you nothing about security — the one question that matters is where the client gets the key, and most products would rather you not ask.'
pubDate: 2020-08-01
tags: ['essay', 'security']
---

A product page I looked at once described its file protection as
"military-grade AES-256 encryption." True, as far as it went. The app did
call AES-256. What the page didn't say, because pages like that never do,
is that the key was derived from the device's serial number with no salt
and no secret input — a value that ships on a sticker on the back of the
device. The cipher was real. The security was theater. That gap is the
entire subject of this post.

## The claim on the label

"Encrypted" is a word vendors use to end a conversation, not start one.
It shows up on box copy, in API docs, in compliance checklists, and it's
treated as a boolean — either a product has it or it doesn't. But
encryption without key management is just a longer way of storing
plaintext. The algorithm has never been the weak point in a system I've
looked at. The key always is.

So the question that actually matters isn't "is this encrypted." It's
narrower and much less flattering to marketing copy: **where does the
client get the key, and who else can get it the same way?**

## Three ways a key hides in plain sight

Every "encrypted" client system I've taken apart falls into one of a
small number of buckets, and none of them require breaking the cipher.

**The key ships with the client.** Hardcoded in a binary, embedded as a
string constant, sitting in a config file next to the app. `strings` on
the binary or a quick decompile finds it. This is the most common pattern
by a wide margin, because key management is hard and shipping a static
key is free.

**The key is derived from something public.** A device ID, a timestamp, a
username, a value baked into the file being protected — anything an
attacker can also observe. This one is sneakier because it *feels* more
secure than a hardcoded key. It isn't. If you can compute every input the
derivation function uses, you can compute the key, and "derived" doesn't
mean "secret" unless one of the inputs actually is.

**The key comes from the server, at request time, in a way you can
intercept.** This is the closest to real key management, and it's the
one case where "encrypted" starts meaning something — *if* the channel
delivering the key is itself protected and the server actually withholds
the key from anyone it hasn't authenticated. Plenty of systems get this
half right: they fetch the key over TLS, which is good, then hand it to
any authenticated client indiscriminately, which quietly erases the
benefit.

## The test that actually matters

Forget the cipher name. Ask one question, and answer it honestly: if you
handed a competent attacker the client binary, the client's network
traffic, and nothing else, could they reconstruct the key? Not "would it
be hard" — could they, given time.

```text
key is hardcoded in the client        -> yes, trivially
key is derived from client-visible data -> yes, with some effort
key requires the server, per-request,
  gated on real auth                    -> maybe not
```

That's the whole test. It's not about cryptanalysis. It's about whether
the secret the system depends on is actually kept anywhere secret, or
whether "encrypted" is doing the work that "obfuscated" should be doing
instead, because obfuscated doesn't sound as good on a compliance form.

## Why this keeps happening

Not because engineers don't understand cryptography — AES is a solved
problem and everyone knows how to call a library function. It happens
because key *management* is a product decision with real cost: it means
a server round-trip, an auth check, a place for the flow to fail and
support tickets to land. Shipping a static key has none of that cost.
It also has none of the security, but that trade doesn't show up until
someone bothers to check, and most people asking "is it encrypted" never
get past the label.

I've stopped treating "encrypted" as an answer. It's a claim, and every
claim implies a place to go verify it. The verification is always the
same one question — trace the key back to its source, and see whether
that source is actually a secret or just a place nobody thought to look.
