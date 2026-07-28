import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('games launcher lists the arcade', async ({ page }) => {
  await run(page, 'games')
  await expect(page.locator('#term-output')).toContainText('arcade')
  await expect(page.locator('#term-output .cmd-link[data-cmd="snake"]')).toBeVisible()
})

test('snake enters game mode and quits back to the terminal', async ({ page }) => {
  await run(page, 'snake')
  await expect(page.locator('#game-screen .game-grid')).toBeVisible()
  await expect(page.locator('#term-input-line')).toBeHidden()
  await page.keyboard.press('q')
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
})

test('dino enters game mode and quits', async ({ page }) => {
  await run(page, 'dino')
  await expect(page.locator('#game-screen .game-grid')).toBeVisible()
  await expect(page.locator('#game-screen')).toContainText('distance')
  await page.keyboard.press('q')
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
})

test('flappy enters game mode and quits', async ({ page }) => {
  await run(page, 'flappy')
  await expect(page.locator('#game-screen .game-grid')).toBeVisible()
  await expect(page.locator('#game-screen')).toContainText('score')
  await page.keyboard.press('q')
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
})

test('2048 renders a tile grid and quits', async ({ page }) => {
  await run(page, '2048')
  await expect(page.locator('#game-screen .game-2048 .tile').first()).toBeVisible()
  await page.keyboard.press('q')
  await expect(page.locator('#game-screen')).toHaveCount(0)
  await expect(page.locator('#term-input')).toBeVisible()
})

test('adventure is a captured repl that can be won', async ({ page }) => {
  await run(page, 'adventure')
  await expect(page.locator('#term-output')).toContainText('ASCENT')
  await expect(page.locator('#term-prompt')).toHaveText('ascent>')
  for (const cmd of ['n', 'down', 'take key', 'up', 's', 'east']) await run(page, cmd)
  await expect(page.locator('#term-output')).toContainText('YOU WIN')
  // repl ended → normal prompt restored
  await expect(page.locator('#term-prompt')).toContainText('guest@gods.dev')
})

test('sound command toggles', async ({ page }) => {
  await run(page, 'sound on')
  await expect(page.locator('#term-output')).toContainText('sound')
  await expect(page.locator('#term-output .badge-ok')).toContainText('on')
})

test('birthday command greets and lights fireworks', async ({ page }) => {
  await run(page, 'birthday')
  await expect(page.locator('#term-output')).toContainText('HAPPY BIRTHDAY')
  await expect(page.locator('#fireworks')).toBeAttached()
})

test('seasonal theme applies and persists', async ({ page }) => {
  await run(page, 'theme christmas')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'christmas')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'christmas')
})
