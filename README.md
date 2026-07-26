# gods.dev

> the terminal is the interface.

Personal site of [Evil0ctal](https://github.com/Evil0ctal) — a static
[Astro](https://astro.build) site that boots like a kernel, takes commands
like a shell, and hides more than it shows.

**Live:** https://gods.dev

## What's inside

- 🖥️ Interactive terminal homepage — type `help`, or click your way around
- ✝️ The whole New Testament in your terminal — `bible john 3:16`, `bible random`,
  plus a verse of the day on the homepage (World English Bible, public domain)
- 📝 Markdown blog with an `ls -la` aesthetic
- 🎨 Four switchable themes (`theme crt` for the 1978 experience)
- 🥚 Easter eggs. Everywhere. `view-source` is a feature, not a bug
- ⚑ A full CTF — run `ctf` in the terminal: 7 progressive web / crypto /
  reversing / stego / forensics challenges, flags `gods{...}`, local scoreboard
  and ranks (script kiddie → god). Also browsable at `/ctf`

## Development

```bash
npm install
npm run dev        # localhost:4321
npm run test:unit  # vitest (terminal core)
npm run test:e2e   # playwright (needs: npx playwright install chromium)
npm run build      # static output in dist/
```

Blog posts live in `src/content/blog/*.md` — add a file, push, done.
`draft: true` keeps a post local.

## Docker

Run the production build locally in a container (multi-stage: Node build → nginx):

```bash
docker build -t gods-dev .
docker run --rm -d -p 8811:80 --name gods-dev gods-dev
# http://localhost:8811 — nginx serves dist/ with GitHub-Pages-style 404 handling
docker stop gods-dev
```

## Deploying

Pushes to `main` run tests, build, and deploy to GitHub Pages via Actions.

One-time repo setup:
1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Pages → Custom domain: `gods.dev` (wait for the HTTPS check)
3. DNS at your registrar (apex A/AAAA → GitHub Pages):
   - `A` records: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - `AAAA` records: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153

`.dev` is on the HSTS preload list, so HTTPS is mandatory — GitHub Pages
provisions the certificate automatically once DNS propagates.

## License

MIT — see [LICENSE](LICENSE). The flags are yours if you can find them.
