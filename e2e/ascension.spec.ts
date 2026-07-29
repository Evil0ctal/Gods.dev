import { test, expect, type Page } from '@playwright/test'
import { FRAG1, FRAG2_HEX, FRAG3 } from '../src/data/ascension'

// reassemble the passphrase exactly as a player would (hex -> ascii, then b64)
function hexToAscii(hex: string): string {
  let s = ''
  for (let i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return s
}
const PASSPHRASE = atob(FRAG1 + hexToAscii(FRAG2_HEX) + FRAG3)

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('breadcrumb 2 hides in the 404 kernel panic', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')
  await expect(page.locator('body')).toContainText('fragment 2')
  await expect(page.locator('body')).toContainText(FRAG2_HEX)
})

test.describe('terminal ARG', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('gods:booted', '1'))
    await page.goto('/')
  })

  test('breadcrumb 3 rides in /proc/1337/cmdline', async ({ page }) => {
    await run(page, 'cat /proc/1337/cmdline')
    await expect(page.locator('#term-output')).toContainText(FRAG3)
  })

  test('assembling the word and ascending dons the crown and the gold', async ({ page }) => {
    // wrong word is refused
    await run(page, 'ascend mortal')
    await expect(page.locator('#term-output')).toContainText('does not open')
    // the assembled word promotes: gold theme + ✦ crown on the prompt
    await run(page, `ascend ${PASSPHRASE}`)
    await expect(page.locator('#term-output')).toContainText('ascended')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'aureus')
    await expect(page.locator('#term-prompt')).toContainText('✦')
    // ascension survives a reload
    await page.reload()
    await expect(page.locator('#term-prompt')).toContainText('✦')
  })
})
