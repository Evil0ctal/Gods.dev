import { test, expect } from '@playwright/test'

test('about and projects render with seo meta', async ({ page }) => {
  await page.goto('/about/')
  await expect(page.locator('h1')).toContainText('Evil0ctal')
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://gods.dev/about/')

  await page.goto('/projects/')
  await expect(page.locator('.projects h2').first()).toBeVisible()
  // projects link to real GitHub repos (baked from the API, or the fallback list)
  await expect(page.locator('.projects a[href*="github.com/Evil0ctal/"]').first()).toBeVisible()
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

test('ctf hub page lists challenges and hides a flag in its source', async ({ page }) => {
  await page.goto('/ctf/')
  await expect(page.locator('h1')).toContainText('~/ctf')
  await expect(page.locator('.ctf-name').first()).toBeVisible()
  // the "Source of Truth" challenge: a base64 flag in a head deploy comment
  const res = await page.request.get('/ctf/')
  const html = await res.text()
  expect(html).toContain('deploy: olympus-prod')
  expect(html).toContain('sha0:')
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
