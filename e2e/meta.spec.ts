import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('build prints the baked provenance receipt', async ({ page }) => {
  await run(page, 'build')
  await expect(page.locator('#term-output')).toContainText('build receipt')
  await expect(page.locator('#term-output')).toContainText('commit')
})

test('whatsnew lists baked commits from git history', async ({ page }) => {
  await run(page, 'whatsnew')
  await expect(page.locator('#term-output')).toContainText('changelog')
})

test('uses lists the toolchain', async ({ page }) => {
  await run(page, 'uses')
  await expect(page.locator('#term-output')).toContainText('Frida')
  await expect(page.locator('#term-output')).toContainText('reverse engineering')
})

test('footer shows a build receipt with a commit link', async ({ page }) => {
  const receipt = page.locator('.site-footer').getByText(/built/i)
  await expect(receipt).toBeVisible()
})

test('stats shows GitHub numbers baked at build (or a graceful fallback)', async ({ page }) => {
  await run(page, 'stats')
  await expect(page.locator('#term-output')).toContainText('github · Evil0ctal')
  // either real numbers with a languages bar, or the unavailable fallback — both mention the profile
  await expect(page.locator('#term-output')).toContainText('github.com/Evil0ctal')
})
