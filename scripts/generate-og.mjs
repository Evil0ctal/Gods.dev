// Generates public/og-default.png (1200x630) with Playwright's bundled chromium.
// Run once: node scripts/generate-og.mjs
import { chromium } from '@playwright/test'

const html = `<!doctype html>
<html><head><style>
  body { margin: 0; width: 1200px; height: 630px; display: flex; align-items: center;
         justify-content: center; background: #16161e; font-family: 'SF Mono', Menlo, monospace; }
  .card { width: 1080px; border: 2px solid #3b4261; border-radius: 16px; background: #1a1b26;
          box-shadow: 0 24px 80px rgba(0,0,0,.6); overflow: hidden; }
  .bar { background: #13131a; padding: 18px 28px; display: flex; gap: 12px; align-items: center;
         border-bottom: 1px solid #3b4261; }
  .dot { width: 20px; height: 20px; border-radius: 50%; }
  .body { padding: 44px 56px 56px; }
  .prompt { color: #9ece6a; font-size: 34px; }
  .cmd { color: #c0caf5; font-size: 34px; }
  h1 { color: #7aa2f7; font-size: 88px; margin: 18px 0 8px; letter-spacing: -2px; }
  p { color: #565f89; font-size: 34px; margin: 0; }
  .cursor { display: inline-block; width: 22px; height: 40px; background: #7aa2f7; vertical-align: middle; }
</style></head><body>
  <div class="card">
    <div class="bar">
      <span class="dot" style="background:#ff5f56"></span>
      <span class="dot" style="background:#ffbd2e"></span>
      <span class="dot" style="background:#27c93f"></span>
    </div>
    <div class="body">
      <div><span class="prompt">guest@gods.dev:~$</span> <span class="cmd">whoami</span></div>
      <h1>gods.dev</h1>
      <p>Evil0ctal — security research, open-source tools, and a terminal that talks back.<span class="cursor"></span></p>
    </div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
await page.screenshot({ path: 'public/og-default.png' })
await browser.close()
console.log('wrote public/og-default.png')
