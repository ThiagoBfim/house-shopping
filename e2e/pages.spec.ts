import { expect, test } from '@playwright/test'

test('página 404 volta para o início mantendo o link compartilhado (#)', async ({ page }) => {
  // Espera a navegação do redirecionamento: depois, o app limpa o link inválido do endereço
  // (por isso conferir a URL no fim falhava às vezes, com a suíte em paralelo).
  const redirected = page.waitForURL(/\/house-shopping\/#l=link-quebrado&s=1$/)
  await page.goto('./404.html#l=link-quebrado&s=1')
  await redirected
  await expect(page.getByRole('heading', { name: 'Quais cômodos você vai montar?' })).toBeVisible()
})

test('prévia do link (Open Graph) com título e imagem em endereço absoluto', async ({ page }) => {
  await page.goto('./')
  const meta = (property: string) =>
    page.locator(`meta[property="${property}"]`).getAttribute('content')
  expect(await meta('og:title')).toContain('House Shopping')
  expect(await meta('og:image')).toBe('https://thiagobfim.github.io/house-shopping/icon-512.png')
})
