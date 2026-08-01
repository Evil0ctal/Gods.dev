---
title: 'Captchas, Consent, and Where I Draw the Line'
description: 'A working set of rules for what I will automate against a website and what I refuse, and why the line is drawn where it is.'
pubDate: 2022-07-19
tags: ['scraping', 'ethics', 'essay']
---

A captcha showed up on a login flow I was scraping, once, and I closed the
laptop and didn't come back to that project. Not because I couldn't have
solved it — there are services that will solve one for a few cents — but
because a captcha in front of a login is a site telling you, explicitly,
"this is not for machines." Paying someone to defeat that message felt
different from everything else I do, and it took me a while to figure out
why.

Here's the line I've landed on, and the reasoning under it.

## What a captcha actually means

Rate limits, `robots.txt`, and honest 403s are a site setting terms. A
captcha in front of *content* — a product page, a search result — is
usually just a blunt anti-bot measure, and I treat it like any other
technical obstacle: annoying, sometimes worth working around, ethically
neutral.

A captcha in front of *authentication* is different. It's not gatekeeping
data, it's gatekeeping an account action — login, signup, checkout. That's
where a human is supposed to be proving they're a human doing something
on their own behalf. Automating past that isn't scraping anymore, it's
impersonation, even if the account is your own. I don't do it, and I
don't build tools that do it for other people.

```text
captcha on GET /products/123        -> anti-bot friction, fair game
captcha on POST /login               -> identity gate, hard no
captcha on POST /checkout            -> identity + money, hard no
```

That table is crude but it's the whole decision tree.

## Rate is a form of consent

Robots.txt is a polite request, not a lock, and I don't pretend otherwise.
But a site that says "60 requests per minute" in its docs or its 429
responses is telling me the terms it's willing to serve data under. I stay
under that, even when I could technically push past it with a bigger
proxy pool.

```python
# a rate limiter that respects the number they gave you,
# not the number you could get away with
import asyncio

class RateLimiter:
    def __init__(self, requests_per_minute: int):
        self._interval = 60.0 / requests_per_minute
        self._last = 0.0

    async def wait(self) -> None:
        now = asyncio.get_event_loop().time()
        delay = self._last + self._interval - now
        if delay > 0:
            await asyncio.sleep(delay)
        self._last = asyncio.get_event_loop().time()
```

That's not a technical necessity — I could run five of these in parallel
across five proxies and blow past the stated limit. I don't, because the
stated limit is the consent I was given, and pushing past it is the same
move as ignoring a "no soliciting" sign because it isn't locked.

## Public data isn't a blank check either

"It's public, so it's fair game" is true and also incomplete. A public
profile page and a public API are both public, but scraping one at a
sustained clip that meaningfully degrades the service for other users
crosses a different line — not a legal one, a courtesy one. I size
scrapers to be invisible in the site's traffic graph, not to be maximally
fast. A crawler that shows up as a spike in someone's dashboard is a
crawler that's about to get every IP in your pool banned, and it deserved
to.

The other public-data trap is scope creep: I'll go looking for one field
and notice the response has a user's email, phone number, or precise
location sitting right there because nobody bothered to strip it from an
internal API. Grabbing it because it's *technically* in the response I
already have isn't the same as it being data I set out to collect, and I
don't keep it.

## The actual rule

None of this reduces to a clean algorithm, but the underlying question I
ask before any scraper ships is: would the terms I'm operating under
survive being described honestly to the person running the site? "I
fetch this at a rate their own docs allow, I don't touch anything behind
a login, and I discard fields I didn't come for" survives that. "I paid a
captcha farm to log into accounts I don't own" does not. The captcha
itself was never the real test — it's just the moment the question gets
asked out loud.
