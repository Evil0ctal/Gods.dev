import { test, expect } from '@playwright/test'

// This spec deliberately does NOT set the `gods:booted` skip flag that
// terminal.spec uses, so the boot animation actually plays.

test('boot sequence plays on load and can be skipped', async ({ page }) => {
  await page.goto('/')
  // Act 1 (operator console) appears, and the prompt is hidden while booting
  await expect(page.locator('#term-output')).toContainText('operator console', { timeout: 5000 })
  await expect(page.locator('#term-input-line')).toBeHidden()
  // any key skips straight to the terminal
  await page.keyboard.press('Enter')
  await expect(page.locator('#term-input')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.boot-line')).toHaveCount(0)
  await expect(page.locator('#motd')).toBeVisible()
})

test('reduced motion skips the boot entirely', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#term-input')).toBeVisible()
  await expect(page.locator('#term-output')).not.toContainText('operator console')
})
