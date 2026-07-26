import { test, expect, type Page } from '@playwright/test'

// skip the boot animation for deterministic tests
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gods:booted', '1'))
  await page.goto('/')
})

async function run(page: Page, cmd: string): Promise<void> {
  await page.locator('#term-input').fill(cmd)
  await page.locator('#term-input').press('Enter')
}

test('static motd and crawlable footer nav are present for no-js visitors', async ({ page }) => {
  await expect(page.locator('#motd h1')).toContainText('Evil0ctal')
  // nav links stay in the DOM for crawlers/screen readers but are sr-only:
  // clipped to a 1px box, so humans see only the copyright line
  await expect(page.locator('footer nav a[href="/blog/"]')).toBeAttached()
  const navBox = await page.locator('footer nav').boundingBox()
  expect(navBox?.width ?? 0).toBeLessThanOrEqual(1)
  await expect(page.locator('footer')).toContainText('© 2026 Evil0ctal')
})

test('help lists commands and hides easter eggs', async ({ page }) => {
  await run(page, 'help')
  const output = page.locator('#term-output')
  await expect(output).toContainText('theme')
  await expect(output).toContainText('neofetch')
  await expect(output.getByRole('button', { name: 'sudo' })).toHaveCount(0)
})

test('clicking a command link executes it and returns focus to the input', async ({ page }) => {
  await run(page, 'help')
  await page.locator('#term-output .cmd-link[data-cmd="neofetch"]').first().click()
  await expect(page.locator('#term-output')).toContainText('gods.dev 1.0 (Olympus)')
  await expect(page.locator('#term-input')).toBeFocused()
})

test('tab completes a unique prefix', async ({ page }) => {
  const input = page.locator('#term-input')
  await input.fill('neo')
  await input.press('Tab')
  await expect(input).toHaveValue('neofetch')
})

test('arrow-up recalls history', async ({ page }) => {
  await run(page, 'whoami')
  await page.locator('#term-input').press('ArrowUp')
  await expect(page.locator('#term-input')).toHaveValue('whoami')
})

test('theme switch persists across reloads', async ({ page }) => {
  await run(page, 'theme crt')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'crt')
})

test('filesystem: ls reveals .secrets and cat reads the prophecy', async ({ page }) => {
  await run(page, 'ls')
  await expect(page.locator('#term-output')).toContainText('.secrets/')
  await run(page, 'cat .secrets/prophecy.txt')
  await expect(page.locator('#term-output')).toContainText('M29xp3fjoTEsMmOxp19hZ3qsqUVkL2gmsD==')
})

test('sudo gets roasted', async ({ page }) => {
  await run(page, 'sudo rm -rf /')
  await expect(page.locator('#term-output')).toContainText('not in the sudoers file')
})

test('vim traps until :q!', async ({ page }) => {
  await run(page, 'vim')
  await expect(page.locator('#term-prompt')).toHaveText('--INSERT--')
  await run(page, ':q!')
  await expect(page.locator('#term-output')).toContainText('escaped vim')
})

test('wrong flag is rejected', async ({ page }) => {
  await run(page, 'flag submit gods{definitely_wrong}')
  await expect(page.locator('#term-output')).toContainText('not fooled')
})

test('terminal scrolls internally while the page height stays fixed', async ({ page }) => {
  for (let i = 0; i < 5; i++) await run(page, 'help')
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  expect(pageOverflow).toBeLessThanOrEqual(1)
  const body = page.locator('#terminal .term-body')
  const inner = await body.evaluate((el) => ({
    canScroll: el.scrollHeight > el.clientHeight,
    atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 4,
  }))
  expect(inner.canScroll).toBe(true)
  expect(inner.atBottom).toBe(true)
})

test('bible command reads scripture from the terminal', async ({ page }) => {
  await run(page, 'bible john 3:16')
  await expect(page.locator('#term-output')).toContainText('John 3:16 · WEB')
  await expect(page.locator('#term-output')).toContainText('For God so loved the world')
})

test('bible books lists the canon', async ({ page }) => {
  await run(page, 'bible books')
  await expect(page.locator('#term-output')).toContainText('Revelation')
  await expect(page.locator('#term-output .cmd-link[data-cmd="bible matthew 1"]')).toBeVisible()
})

test('verse of the day is prerendered and executes on click', async ({ page }) => {
  await expect(page.locator('#votd')).toBeVisible()
  await page.locator('#votd .cmd-link').click()
  await expect(page.locator('#term-output')).toContainText('· WEB')
})

test('unknown command suggests help', async ({ page }) => {
  await run(page, 'frobnicate')
  await expect(page.locator('#term-output')).toContainText('command not found')
})

test('blog command lists posts and navigates', async ({ page }) => {
  await run(page, 'blog read building-gods-dev')
  await page.waitForURL('**/blog/building-gods-dev/')
  await expect(page.locator('article.post h1')).toContainText('terminal that pretends')
})
