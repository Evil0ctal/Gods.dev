import { test, expect } from '@playwright/test'

test.describe('The Annotated Reverse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/the-annotated-reverse/')
  })

  test('the widget hydrates into a hex dump with a slider', async ({ page }) => {
    await expect(page.locator('.arev-dump .arev-b').first()).toBeVisible()
    await expect(page.locator('.arev-slider')).toBeVisible()
    // starts fully "encrypted": no byte revealed, callout hidden
    await expect(page.locator('.arev-b.revealed')).toHaveCount(0)
    await expect(page.locator('.arev-callout')).toBeHidden()
  })

  test('revealing the keystream surfaces the ftyp box', async ({ page }) => {
    await page.locator('.arev-all').click()
    await expect(page.locator('.arev-callout')).toBeVisible()
    await expect(page.locator('.arev-callout')).toContainText('ftyp')
    // the ascii gutter now reads the MP4 header
    const ascii = await page.locator('.arev-asc').allInnerTexts()
    expect(ascii.join('')).toContain('ftyp')
    // reset re-hides it
    await page.locator('.arev-reset').click()
    await expect(page.locator('.arev-callout')).toBeHidden()
  })

  test('is listed on the blog index and reachable', async ({ page }) => {
    await page.goto('/blog/')
    await expect(page.getByRole('link', { name: /Annotated Reverse/i })).toBeVisible()
  })
})
