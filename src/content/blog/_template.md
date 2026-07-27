---
# ── Required ────────────────────────────────────────────────
title: 'Post title — shown in the blog list, the <h1>, and the browser tab'
description: 'One or two sentences that stand on their own. Reused for the SEO meta description and the social share card, so write it for a stranger.'
pubDate: 2026-07-27            # YYYY-MM-DD. Drives sort order (newest first).

# ── Optional (delete any you do not use) ────────────────────
# updatedDate: 2026-07-28      # add when you revise an already-published post
tags: ['tag-one', 'tag-two']   # free-form; lowercase-kebab reads best
draft: true                    # true  = hidden in production, visible in `npm run dev`
                               # false = published. Flip this (or delete the line) to ship.
# ogImage: '/images/my-post-card.png'   # custom social image; omit to use the site default
---

Open with the concrete thing — an example, a number, a command, a screenshot,
a scene. Explain *after* it, not before. Short, direct sentences beat padded ones,
and every section should earn its place.

## A section heading

Regular Markdown works: **bold**, *italic*, `inline code`, and
[links](https://github.com/Evil0ctal). Lists too:

- first point
- second point

Fenced code blocks are highlighted by Shiki and recolour with the site theme —
always tag the language:

```python
async def scrape(url: str) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(url)
        return r.json()
```

```bash
guest@gods.dev:~$ curl -sS https://gods.dev/ | head
```

> Blockquotes render as well — handy for a pulled-out line or a caveat.

Images live in `public/` and are referenced by absolute path (e.g. put the file
at `public/images/example.png`):

![describe the image for screen readers](/images/example.png)

## Wrap up

Close with something concrete — a takeaway, a result, a next step — not a soft
summary. Then, when it's ready, set `draft: false` above and commit.
