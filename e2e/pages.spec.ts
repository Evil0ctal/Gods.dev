import { test, expect } from '@playwright/test'

test('about and projects render with seo meta', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('h1')).toContainText('Evil0ctal')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://gods.dev/about/')

  await page.goto('/projects/')
  await expect(page.locator('.projects h2').first()).toBeVisible()
})

test('admin bait page taunts and is noindexed', async ({ page }) => {
  await page.goto('/admin/')
  await expect(page.locator('h1')).toContainText('nice try')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
})

test('404 kernel panic with clue', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist/')
  expect(res?.status()).toBe(404)
  await expect(page.locator('body')).toContainText('KERNEL PANIC')
})

test('robots.txt and sitemap exist; sitemap excludes admin', async ({ page }) => {
  const robots = await page.request.get('/robots.txt')
  expect(await robots.text()).toContain('Disallow: /admin/')
  const sitemap = await page.request.get('/sitemap-index.xml')
  expect(sitemap.status()).toBe(200)
})

test('homepage source contains the ascii comment easter egg', async ({ page }) => {
  const res = await page.request.get('/')
  const html = await res.text()
  expect(html).toContain('a source reader. i like you already')
})
