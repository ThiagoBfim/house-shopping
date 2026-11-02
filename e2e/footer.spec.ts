import { expect, test } from '@playwright/test'

test('rodapé com copyright e versão da aplicação', async ({ page }) => {
  await page.goto('./')
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText(`© ${new Date().getFullYear()} Thiago Bomfim`)
  // local: tag mais próxima do git ("v1.2.0-1-gabc1234"), commit ou "dev"
  await expect(footer).toContainText(/Versão (v\d+\.\d+\.\d+\S*|[0-9a-f]{7,}|dev)/)
})
