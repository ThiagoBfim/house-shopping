import { expect, test, type Page } from '@playwright/test'

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test.use({ colorScheme: 'dark' })

test('tema: automático segue o sistema; claro e escuro ficam salvos', async ({ page }) => {
  await page.goto('./')
  const toggle = page.getByRole('button', { name: /^Tema:/ })
  await expect(toggle).toHaveText(/Automático/)
  const dark = await background(page)

  await toggle.click()
  await expect(toggle).toHaveText(/Claro/)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const light = await background(page)
  expect(light).not.toBe(dark)

  // continua claro depois de recarregar, mesmo com o sistema no escuro
  await page.reload()
  await expect(page.getByRole('button', { name: /^Tema:/ })).toHaveText(/Claro/)
  expect(await background(page)).toBe(light)

  await page.getByRole('button', { name: /^Tema:/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await background(page)).toBe(dark)

  await page.getByRole('button', { name: /^Tema:/ }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  expect(await background(page)).toBe(dark)
})
