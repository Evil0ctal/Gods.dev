---
title: 'When You Have to Render: Playwright for JS-Heavy Sites'
description: 'A headless browser is 10-50x heavier than an HTTP request and worth it exactly when the data you need does not exist until JavaScript runs — here is how to tell, and how to keep the cost down when it does.'
pubDate: 2021-01-20
tags: ['scraping', 'playwright']
---

I spent an evening trying to scrape a product listing page with `httpx`
before I checked the obvious thing: view-source. The HTML the server
sent had a `<div id="root"></div>` and nothing else. Every product, every
price, every image — assembled client-side by React after a fetch to an
internal API. No amount of clever header spoofing fixes that. The data
just isn't in the response.

## The test that tells you which world you're in

Before reaching for a browser, view-source (not the rendered DevTools
Elements panel, the actual raw HTML) and look for the data you need in
it. If the numbers, names, and links are there as text, you don't need a
browser — you need better HTML parsing, or you need to find the API call
that's populating that DOM (open the Network tab, filter to XHR/fetch,
reload). If view-source shows an empty shell and a pile of `<script>`
tags, JavaScript is doing the work and you have two options: reverse the
API calls, or render the page and read the result. Reversing the API is
almost always faster once it's built, but rendering is the fallback when
the API is heavily obfuscated or the app assembles data from six calls
you'd rather not reimplement.

## The actual cost of rendering

A `httpx.get()` call is a few milliseconds of network time and a few KB
of memory. A Playwright page load spins up (or reuses) a real browser
process, allocates a full rendering pipeline, executes every script on
the page, fires every XHR the page fires, and only then hands you a DOM.
On my machine that's the difference between roughly 5,000 requests/sec
against a fast target with `httpx` and maybe 5-15 pages/sec/worker with
a browser, depending on the page. That's not a rounding difference,
that's two orders of magnitude, and it's why "just use Playwright for
everything" is a bad default even though it's the most reliable one.

```python
from playwright.async_api import async_playwright

async def render(url: str) -> str:
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, wait_until="networkidle")
        html = await page.content()
        await browser.close()
        return html
```

That snippet works and is also close to the worst way to run it at
volume — launching and closing a full browser per URL. Every improvement
from here is about not paying startup cost per page.

## Keeping it lean

**Reuse the browser, not the page.** Launch once, open a fresh page (or
a fresh browser *context*, which is cheaper than a fresh browser and
gives you cookie/storage isolation between "sessions") per unit of work:

```python
browser = await pw.chromium.launch(headless=True)
context = await browser.new_context()
# ... many pages against this one context, closed and reopened as needed
await browser.close()  # once, at the end
```

**Block what you don't need.** If you're scraping text or structured
data, you almost never need images, fonts, or stylesheets to load — they
cost bandwidth and rendering time for zero benefit:

```python
async def block_heavy_assets(route):
    if route.request.resource_type in {"image", "font", "media", "stylesheet"}:
        await route.abort()
    else:
        await route.continue_()

await page.route("**/*", block_heavy_assets)
```

This alone routinely cuts page load time by half on image-heavy sites.

**Wait for the right thing, not a fixed sleep.** `page.wait_for_timeout(3000)`
is a guess dressed up as code — too short and you scrape a half-rendered
page, too long and you're burning seconds you didn't need. Wait for the
actual signal instead: a specific selector appearing, a network-idle
state, or a response matching the API call you know populates the data.

```python
await page.goto(url)
await page.wait_for_selector(".product-card", timeout=10_000)
```

**Run a pool, not a spawn-per-request.** One browser process with
several contexts, drawn from a bounded worker pool, beats spinning up a
new Chromium instance for every job — the launch itself is the most
expensive part of the whole operation.

## What I learned

Rendering is correct exactly as often as the data genuinely doesn't
exist until JavaScript builds it, and wrong the rest of the time — check
view-source first, every time, because reaching for a browser out of
habit means paying browser prices for HTML that was sitting there in
plain text the whole time. When you do need it, the win isn't avoiding
Playwright, it's not re-paying its startup cost on every single page.
