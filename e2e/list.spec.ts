import { expect, test, type Page } from '@playwright/test'

const card = (page: Page, label: string) =>
  page.getByRole('article', { name: new RegExp(`^${label}:`) })

/** Saldo exibido no resumo, em reais. */
async function remaining(page: Page): Promise<number> {
  const text = await page.getByTestId('remaining').textContent()
  return Number(text!.replace(/[^\d,]/g, '').replace(',', '.'))
}

/** Tier exibido de cada item da lista, por nome da categoria. */
const tiersByLabel = (page: Page) =>
  page
    .getByRole('article')
    .evaluateAll((cards) =>
      Object.fromEntries(
        cards.map((c) => [
          c.getAttribute('aria-label')!.split(':')[0],
          c.querySelector('.tier-badge')!.textContent,
        ]),
      ),
    )

async function openKitchen(page: Page, budget: string) {
  await page.goto('./')
  await page.getByRole('button', { name: /Cozinha/ }).click()
  await page.getByLabel('Orçamento em reais').fill(budget)
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
}

test('recusar a geladeira e recalcular usa o dinheiro liberado em outros itens', async ({
  page,
}) => {
  await openKitchen(page, '30000')
  const before = await remaining(page)
  const fridgePrice = await card(page, 'Geladeira').locator('.product-price strong').textContent()
  const freed = Number(fridgePrice!.replace(/[^\d,]/g, '').replace(',', '.'))
  const tiersBefore = await tiersByLabel(page)
  delete tiersBefore.Geladeira

  await card(page, 'Geladeira').getByRole('button', { name: 'Recusar' }).click()

  // sem reload, a lista não muda sozinha: só libera o saldo da geladeira
  await expect(card(page, 'Geladeira')).toHaveCount(0)
  expect(await remaining(page)).toBeCloseTo(before + freed, 2)
  expect(await tiersByLabel(page)).toEqual(tiersBefore)
  await expect(page.getByRole('button', { name: /Recalcular lista com o saldo/ })).toBeVisible()

  await page.getByRole('button', { name: /Recalcular lista/ }).click()

  // o dinheiro liberado vira upgrade em outros itens
  await expect(page.getByText('↑ Melhorou').first()).toBeVisible()
  await expect(page.getByText(/Lista recalculada: \d+ ite(m mudou|ns mudaram)/)).toBeVisible()
  expect(await remaining(page)).toBeLessThan(before + freed)

  // a geladeira continua fora e pode ser reativada
  const excluded = page.locator('.side-section', { hasText: 'Recusados' })
  await expect(excluded).toContainText('Geladeira')
  await excluded.getByRole('button', { name: 'Reativar' }).click()
  await expect(card(page, 'Geladeira')).toBeVisible()
})

test('desfazer uma recusa traz o item de volta', async ({ page }) => {
  await openKitchen(page, '30000')
  await card(page, 'Fogão').getByRole('button', { name: 'Já tenho' }).click()
  await expect(card(page, 'Fogão')).toHaveCount(0)

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(card(page, 'Fogão')).toBeVisible()
})

test('mais barato trava o item e o recalcular respeita a trava', async ({ page }) => {
  await openKitchen(page, '30000')
  const stove = card(page, 'Fogão')
  await expect(stove.getByRole('button', { name: /Mais caro/ })).toBeDisabled()

  await stove.getByRole('button', { name: /Mais barato/ }).click()
  await expect(stove.locator('.tier-badge')).toHaveText('Caro')
  await expect(stove.getByText('🔒 Travado')).toBeVisible()

  await page.getByRole('button', { name: /Recalcular lista/ }).click()
  await expect(stove.locator('.tier-badge')).toHaveText('Caro')
})

test('item que não coube pode ser adicionado', async ({ page }) => {
  await openKitchen(page, '3000')
  const skipped = page.locator('.side-section', { hasText: 'Não coube' })
  await expect(skipped).toContainText('Freezer')

  await skipped
    .locator('li', { hasText: 'Freezer' })
    .getByRole('button', { name: 'Adicionar' })
    .click()
  await expect(card(page, 'Freezer')).toBeVisible()
  await expect(page.getByText('Faltam')).toBeVisible()
})

for (const room of ['Cozinha', 'Quarto', 'Sala', 'Quarto do bebê', 'Área externa']) {
  test(`${room}: monta a lista com R$ 15.000`, async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: new RegExp(`^${room} \\d+ itens$`) }).click()
    await page.getByLabel('Orçamento em reais').fill('15000')
    await page.getByRole('button', { name: 'Montar minha lista' }).click()
    expect(await page.getByRole('article').count()).toBeGreaterThan(3)
    expect(await remaining(page)).toBeGreaterThanOrEqual(0)
  })
}
