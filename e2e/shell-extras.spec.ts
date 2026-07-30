import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('pipes feed one command into the next', async ({ page }) => {
  await run(page, 'echo hello | rev')
  await expect(page.locator('#term-output')).toContainText('olleh')
})

test('the CTF filesystem is greppable through a pipe', async ({ page }) => {
  await run(page, 'cat /opt/olympus/signer.js | grep vault')
  const out = page.locator('#term-output')
  await expect(out).toContainText('vault')
  // grep filtered, so the full file is not dumped (no function keyword line)
  await expect(out).not.toContainText('function xbogus')
})

test('figlet renders a block-letter banner', async ({ page }) => {
  await run(page, 'figlet gods')
  await expect(page.locator('#term-output')).toContainText('█')
})

test('cowsay speaks', async ({ page }) => {
  await run(page, 'cowsay moo')
  await expect(page.locator('#term-output')).toContainText('< moo >')
  await expect(page.locator('#term-output')).toContainText('^__^')
})

test('sl runs the train', async ({ page }) => {
  await run(page, 'sl')
  await expect(page.locator('#term-output')).toContainText('====')
})
