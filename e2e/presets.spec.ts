import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const presetValue = async (page: Page, name: string) =>
  Number(
    (await page
      .locator('.preset', { hasText: name })
      .locator('.preset-value')
      .textContent())!.replace(/\D/g, ''),
  )

test('três orçamentos sugeridos, com o equilibrado já escolhido', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1, Quarto: 2, Banheiro: 1 })

  const economic = await presetValue(page, 'Econômico')
  const balanced = await presetValue(page, 'Equilibrado')
  const premium = await presetValue(page, 'Premium')
  expect(economic).toBeGreaterThan(0)
  expect(balanced).toBeGreaterThan(economic)
  expect(premium).toBeGreaterThan(balanced)

  await expect(page.getByRole('radio', { name: /Equilibrado/ })).toBeChecked()
  await expect(page.getByLabel('Orçamento em reais')).toHaveValue(balanced.toLocaleString('pt-BR'))
})

test('escolher Premium monta a lista com esse orçamento', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  const premium = await presetValue(page, 'Premium')
  await page.getByRole('radio', { name: /Premium/ }).check()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await expect(page.locator('.summary')).toContainText(`de R$ ${premium.toLocaleString('pt-BR')}`)
  await expect(page.getByText('Faltam')).toHaveCount(0)
})

test('digitar outro valor desmarca as opções', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Sala: 1 })
  await page.getByLabel('Orçamento em reais').fill('12345')
  for (const name of ['Econômico', 'Equilibrado', 'Premium']) {
    await expect(page.getByRole('radio', { name: new RegExp(name) })).not.toBeChecked()
  }
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await expect(page.locator('.summary')).toContainText('de R$ 12.345')
})
