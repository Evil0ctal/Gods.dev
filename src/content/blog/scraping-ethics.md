---
title: 'The Ethics of Scraping, From Someone Who Does It'
description: 'A working set of rules for where scraping crosses from "fine" to "not okay" — robots.txt, rate, authentication, and what I actually refuse to build.'
pubDate: 2024-08-02
tags: ['scraping', 'essay', 'ethics']
---

Someone opened an issue on one of my scraper repos asking me to add
support for pulling private messages from an account you're not logged
into. I closed it without much debate. Not because I'm squeamish about
scraping — I've built and maintained scrapers people use at real
scale — but because that request wasn't scraping. It was unauthorized
access wearing a scraping library as a costume. The line between those
two things is the whole subject of this post, and it's a line I think
about more than any technical problem I've solved this year.

## robots.txt is a request, not a lock, and I still honor it

`robots.txt` has no enforcement mechanism. Nothing stops a scraper from
ignoring it — there's no authentication, no cryptography, just a text
file a server hopes you'll read. That's exactly why I treat it as a
floor, not a formality: it's the clearest signal a site operator has for
"here's what I'd rather you not automate," and ignoring a clearly stated
preference because you technically *can* is the same move as walking
past a "staff only" door that happens to be unlocked. I disallow paths
their `robots.txt` disallows, full stop, even on projects where I
suspect nobody would notice either way.

Where it gets genuinely gray: `robots.txt` says nothing about *rate*, and
a crawler that respects every disallowed path but hammers the allowed
ones at a thousand requests a second is still being a bad citizen the
file just didn't have a mechanism to warn you about. Compliance with the
letter of the file isn't the same as not causing harm.

## Rate is where "legal" and "okay" split

A lot of the scraping-ethics conversation gets stuck on legality —
what's covered by a terms of service, what case law says about public
data — and I think that's the less interesting question for someone
actually writing the code. The question I ask myself isn't "can I get in
legal trouble for this," it's "is my traffic pattern indistinguishable
from an attack." A scraper doing one request every couple of seconds,
with realistic concurrency, during hours that don't spike alongside
someone's Black Friday traffic, is a good citizen almost regardless of
what it's collecting. The same scraper doing the same collection at
5,000 requests/second is a denial-of-service tool that happens to save
what it downloads. The data being public doesn't change which one of
those you are.

Concretely, that means: I rate-limit client-side even when the target
hasn't rate-limited me — a target's *absence* of a `429` isn't
permission, it might just mean nobody's built the throttle yet. I back
off harder than strictly necessary during what looks like a target's
peak traffic window. And when a target explicitly asks scrapers to slow
down (a `Retry-After` header, a note in their API docs, a support email
that says "please cap it at X/sec"), I treat that as binding even where
nothing technical enforces it.

## Consent and authentication are the actual bright line

Public data — a product listing, a public profile, a published article —
is fair game for a scraper built and run responsibly. The line I won't
cross is authentication: scraping something that required someone's
credentials to reach, on their behalf, without their explicit
involvement. That's not a scraping problem anymore, it's an access-
control problem, and the fact that a scraping library happens to be the
tool doesn't make it a scraping question. I've turned down "just scrape
their inbox once they're logged in" requests more than once, and I don't
think that's a hard call — the person asking usually already suspects
it's not, or they wouldn't be asking someone else to build it.

The genuinely gray zone is data that's *technically* public but clearly
not meant for bulk collection — a profile page anyone can view one at a
time in a browser, versus that same data pulled for every user on the
platform in an afternoon. My rule of thumb: if the aggregate I'm building
does something the individual page views couldn't (build a shadow
database, enable stalking, deanonymize something the platform tried to
keep pseudonymous) I don't build it, even if each individual request
would have been unremarkable on its own. Scale changes what a thing is,
not just how much of it there is.

## Where I actually draw the line

- **robots.txt**: honored, treated as a floor.
- **Rate**: throttled to look like a considerate visitor, not a stress
  test, independent of whether the target enforces a limit.
- **Auth**: never scrape behind someone else's login without them doing
  it themselves.
- **Aggregation**: if the bulk collection enables harm the individual
  page views couldn't, I don't build it regardless of the legal
  question.
- **Attribution and reuse**: if I republish scraped content, I say where
  it came from and I don't claim it as mine.

None of this makes scraping "safe" in some absolute sense — it's a
judgment call every time, and I've turned down requests I later decided
were probably fine, and said yes to a couple I now think I shouldn't
have. What I've learned is that the technical question (can I get the
data) and the ethical one (should this data be collected this way, at
this scale, for this purpose) are genuinely separate, and the second one
doesn't get easier just because you got good at the first.
