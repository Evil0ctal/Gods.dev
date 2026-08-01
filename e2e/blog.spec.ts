import { test, expect } from '@playwright/test'

test('blog index lists published posts, newest first', async ({ page }) => {
  await page.goto('/blog/')
  const times = await page
    .locator('.post-list time')
    .evaluateAll((els) => els.map((e) => e.getAttribute('datetime') ?? ''))
  expect(times.length).toBeGreaterThan(1)
  // dates are listed in descending (newest-first) order (across the per-year groups)
  expect(times).toEqual([...times].sort().reverse())
  await expect(page.locator('a[href="/blog/building-gods-dev/"]')).toBeVisible()
})

test('draft posts are excluded from the production build', async ({ page }) => {
  await page.goto('/blog/')
  await expect(page.locator('body')).not.toContainText('DRAFT: this post must never appear')
  const res = await page.request.get('/blog/drafts-are-invisible/')
  expect(res.status()).toBe(404)
})

test('inner pages offer a visible way back to the terminal', async ({ page }) => {
  await page.goto('/blog/building-gods-dev/')
  // footer nav is visible on inner pages and links home
  const homeNav = page.locator('footer nav a[href="/"]')
  await expect(homeNav).toBeVisible()
  const box = await page.locator('footer nav').boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(1)
  // and the in-article "cd ~" shortcut points to the terminal
  await expect(page.locator('.post-nav a[href="/"]')).toBeVisible()
})

test('post page has terminal chrome, code copy button and jsonld', async ({ page }) => {
  await page.goto('/blog/building-gods-dev/')
  await expect(page.locator('.term-titlebar .title')).toContainText('~/blog/building-gods-dev.md')
  await expect(page.locator('.copy-btn').first()).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').textContent()
  expect(ld).toContain('"BlogPosting"')
})

test('rss feed serves published posts and studies, no drafts', async ({ page }) => {
  const res = await page.request.get('/rss.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  expect(xml).toContain('building-gods-dev')
  expect(xml).toContain('/study/the-prodigal-son/')
  expect(xml).not.toContain('drafts-are-invisible')
})

test('study index lists articles with passages', async ({ page }) => {
  await page.goto('/study/')
  await expect(page.locator('h1')).toContainText('~/study')
  await expect(page.locator('.study-list a[href="/study/sermon-on-the-mount/"]')).toBeVisible()
  await expect(page.locator('.study-list')).toContainText('Luke 15:11-32')
})
