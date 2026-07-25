---
title: 'Building gods.dev: a terminal that pretends to be a homepage'
description: 'Why my personal site boots like a kernel, takes commands like a shell, and hides flags like a CTF — built with Astro, deployed on GitHub Pages.'
pubDate: 2026-07-25
tags: ['astro', 'meta', 'easter-eggs']
---

Every developer eventually builds a personal site. Most of them are cards:
a photo, three links, a wall of buzzwords. I wanted mine to feel like the
place I actually live — a terminal.

## The idea

The homepage of gods.dev is a shell. You type `help`, it answers. You
`ls -a` around, you find things I did not put in the navigation. Some of
them are articles. Some of them are... not.

```bash
guest@gods.dev:~$ ls -a
.secrets/  blog/  README.txt
```

## The stack

- **Astro 5** — every page is static HTML; the terminal is the only island.
- **Vanilla TypeScript** — no framework runtime. View source. It's readable.
- **GitHub Pages** — push to main, Actions builds, done.

## The rules I set for myself

1. The site must work with JavaScript disabled — content first, toys second.
2. The terminal core must be unit-tested like real software (it is).
3. Every corner must hide at least one thing worth finding.

If you found this post through the terminal: good. If you found the other
thing in `~/.secrets`: better. If you have no idea what I am talking about —
open the homepage and type `help`.
