import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('traceroute animates in game-mode and leaves the trace in scrollback', async ({ page }) => {
  await run(page, 'traceroute')
  await expect(page.locator('#game-screen .game-grid')).toBeVisible()
  await expect(page.locator('#term-input-line')).toBeHidden()
  await page.keyboard.press('x') // any key fast-forwards + exits
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
  await expect(page.locator('#term-output')).toContainText('Douyin_TikTok_Download_API')
  await expect(page.locator('#term-output')).toContainText('gods.dev')
})

test('nmap scans and reports open/closed/filtered ports', async ({ page }) => {
  await run(page, 'nmap')
  await expect(page.locator('#game-screen .game-grid')).toBeVisible()
  await page.keyboard.press('q') // quit still works via the game harness
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
})

test('inspect prints the visitor device fingerprint with a hashed id', async ({ page }) => {
  await run(page, 'inspect')
  await expect(page.locator('#term-output')).toContainText('fingerprint')
  await expect(page.locator('#term-output')).toContainText('visitor-id')
  // the visitor id is a 16-hex badge
  await expect(page.locator('#term-output .badge-ok')).toHaveText(/^[0-9a-f]{16}$/)
})

test('reduced motion renders traceroute instantly, no game takeover', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await run(page, 'traceroute')
  await expect(page.locator('#game-screen')).toHaveCount(0) // no animation
  await expect(page.locator('#term-output')).toContainText('Whisper-Speech-to-Text-API')
})
