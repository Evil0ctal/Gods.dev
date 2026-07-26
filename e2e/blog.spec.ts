import { test, expect } from '@playwright/test'

test('blog index lists published posts, newest first', async ({ page }) => {
  await page.goto('/blog/')
  await expect(page.locator('.post-list a').first()).toContainText('terminal that pretends')
})

test('draft posts are excluded from the production build', async ({ page }) => {
  await page.goto('/blog/')
  await expect(page.locator('body')).not.toContainText('DRAFT: this post must never appear')
  const res = await page.request.get('/blog/drafts-are-invisible/')
  expect(res.status()).toBe(404)
})

test('post page has terminal chrome, code copy button and jsonld', async ({ page }) => {
  await page.goto('/blog/building-gods-dev/')
  await expect(page.locator('.term-titlebar .title')).toContainText('~/blog/building-gods-dev.md')
  await expect(page.locator('.copy-btn').first()).toBeVisible()
  const ld = await page.locator('script[type="application/ld+json"]').textContent()
  expect(ld).toContain('"BlogPosting"')
})

test('rss feed serves published posts only', async ({ page }) => {
  const res = await page.request.get('/rss.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  expect(xml).toContain('building-gods-dev')
  expect(xml).not.toContain('drafts-are-invisible')
})
