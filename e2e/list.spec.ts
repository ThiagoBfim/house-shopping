import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

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
  await pickRooms(page, { Cozinha: 1 })
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
  await expect(
    page.getByRole('button', { name: /Recalcular lista para usar os R\$\s[\d.]+ restantes/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Recalcular lista/ }).click()

  // o dinheiro liberado vira upgrade em outros itens
  await expect(page.getByText('↑ Melhorou').first()).toBeVisible()
  await expect(
    page.getByText(
      /Lista recalculada: \d+ ite(m melhorou|ns melhoraram).*usou R\$\s[\d.]+ do saldo/,
    ),
  ).toBeVisible()
  expect(await remaining(page)).toBeLessThan(before + freed)

  // "Desfazer" volta a lista de antes do recálculo, com o saldo de volta
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect.poll(() => remaining(page)).toBeCloseTo(before + freed, 2)
  expect(await tiersByLabel(page)).toEqual(tiersBefore)
  await page.getByRole('button', { name: /Recalcular lista para usar os/ }).click()

  // a geladeira continua fora e pode ser reativada
  const excluded = page.locator('.side-section', { hasText: 'Recusados' })
  await expect(excluded).toContainText('Geladeira')
  await excluded.getByRole('button', { name: 'Reativar' }).click()
  await expect(card(page, 'Geladeira')).toBeVisible()
})

test('mudar filtro depois de recusar guarda o saldo; só o recalcular usa', async ({ page }) => {
  await openKitchen(page, '30000')
  await card(page, 'Geladeira').getByRole('button', { name: 'Recusar' }).click()
  const freed = await remaining(page)
  expect(freed).toBeGreaterThan(1000)

  // tirar os utensílios libera mais dinheiro, mas o motor não gasta de volta o que foi recusado
  await page.locator('.filters-panel summary').click()
  await page.getByRole('switch', { name: /Incluir utensílios/ }).uncheck()
  await expect(page.getByText(/Saldo de R\$\s[\d.]+ guardado/)).toBeVisible()
  expect(await remaining(page)).toBeGreaterThanOrEqual(freed)

  // e incluir de volta encaixa os utensílios sem usar o saldo
  await page.getByRole('switch', { name: /Incluir utensílios/ }).check()
  expect(await remaining(page)).toBeGreaterThanOrEqual(freed - 1)

  const button = page.getByRole('button', { name: /Recalcular lista para usar os/ })
  await button.click()
  await expect(page.getByText(/Lista recalculada/)).toBeVisible()
  expect(await remaining(page)).toBeLessThan(freed)
  await expect(button).toHaveCount(0)
})

test('desfazer uma recusa traz o item de volta', async ({ page }) => {
  await openKitchen(page, '30000')
  await card(page, 'Fogão ou cooktop').getByRole('button', { name: 'Já tenho' }).click()
  await expect(card(page, 'Fogão ou cooktop')).toHaveCount(0)

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(card(page, 'Fogão ou cooktop')).toBeVisible()
})

/** Preço da opção mais barata de uma categoria do catálogo real (na variante padrão). */
function cheapestPrice(category: string): number {
  const { options, variants } = JSON.parse(
    readFileSync(`data/products/${category}.json`, 'utf8'),
  ) as { options: { price: number; variants?: string[] }[]; variants?: { id: string }[] }
  const ladder = variants ? options.filter((o) => o.variants?.includes(variants[0].id)) : options
  return Math.min(...ladder.map((o) => o.price))
}

/** "R$ 1.234,50" → 1234.5 */
const reais = (text: string | null) => Number(text!.replace(/[^\d,]/g, '').replace(',', '.'))

test('mostra quanto economiza com "já tenho" e recusados', async ({ page }) => {
  await openKitchen(page, '30000')
  await expect(page.getByTestId('saved')).toHaveCount(0)

  await card(page, 'Geladeira').getByRole('button', { name: 'Já tenho' }).click()
  await card(page, 'Fogão ou cooktop').getByRole('button', { name: 'Recusar' }).click()

  const expected = cheapestPrice('geladeira') + cheapestPrice('fogao')
  await expect(page.getByTestId('saved')).toContainText('Você economiza')
  expect(reais(await page.getByTestId('saved').locator('strong').textContent())).toBe(expected)

  const section = page.locator('.side-section', { hasText: 'Recusados' })
  await expect(section).toContainText('Economia de')
  const row = (label: string) => section.getByRole('listitem').filter({ hasText: label })
  expect(reais(await row('Geladeira').locator('.saved-value').textContent())).toBe(
    cheapestPrice('geladeira'),
  )

  // reativar tira da economia
  await row('Fogão').getByRole('button', { name: 'Reativar' }).click()
  expect(reais(await page.getByTestId('saved').locator('strong').textContent())).toBe(
    cheapestPrice('geladeira'),
  )
})

test('mais barato trava o item e o recalcular respeita a trava', async ({ page }) => {
  await openKitchen(page, '30000')
  const stove = card(page, 'Fogão ou cooktop')
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

for (const room of [
  'Cozinha',
  'Quarto',
  'Sala',
  'Quarto do bebê',
  'Banheiro',
  'Área externa',
  'Lavanderia',
  'Utilidades',
  'Escritório',
]) {
  test(`${room}: monta a lista com R$ 15.000`, async ({ page }) => {
    await page.goto('./')
    await pickRooms(page, { [room]: 1 })
    await page.getByLabel('Orçamento em reais').fill('15000')
    await page.getByRole('button', { name: 'Montar minha lista' }).click()
    expect(await page.getByRole('article').count()).toBeGreaterThan(3)
    expect(await remaining(page)).toBeGreaterThanOrEqual(0)
  })
}

test('produto com link real mostra a foto e o botão da loja', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Sala: 1 })
  await page.getByLabel('Orçamento em reais').fill('5000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const tv = card(page, 'Smart TV')
  await expect(tv.locator('img')).toHaveAttribute('src', /^https:\/\/http2\.mlstatic\.com\//)
  await expect(tv.getByRole('link', { name: 'Comprar no Mercado Livre ↗' })).toHaveAttribute(
    'href',
    /^https:\/\/meli\.la\//,
  )
  await expect(tv.getByText('Apoia o criador do site, sem custo extra')).toBeVisible()
})

test('variação de preço abre o gráfico com os dias em que o preço mudou', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Utilidades: 1 })
  await page.getByLabel('Orçamento em reais').fill('600')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  // extensão e régua de tomada têm histórico com mudança de preço
  const trend = page.locator('.price-trend-button').first()
  await expect(trend).toHaveAttribute('aria-expanded', 'false')
  await trend.click()
  await expect(trend).toHaveAttribute('aria-expanded', 'true')
  const chart = page.locator('.price-chart')
  await expect(chart).toContainText('Preço nos últimos 6 meses')
  expect(await chart.getByRole('listitem').count()).toBeGreaterThanOrEqual(2)
  await expect(chart.getByRole('listitem').first()).toHaveText(/^Em \d\d\/\d\d.*: R\$/)
  await expect(chart).toContainText(/Menor: R\$\s[\d.,]+ · Maior: R\$\s[\d.,]+/)

  await trend.click()
  await expect(chart).toHaveCount(0)
})

test('mostra quanto a mesma lista mudou de preço desde ontem, 7 e 30 dias', async ({ page }) => {
  // data fixa: o histórico do catálogo tem mudanças entre 23/10 e 30/10
  await page.clock.setFixedTime(new Date('2026-10-31T12:00:00'))
  await openKitchen(page, '30000')

  const toggle = page.getByRole('button', { name: /^Lista .* mais (barata|cara) que / })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()

  const periods = page.getByRole('radiogroup', { name: 'Comparar com' })
  await periods.getByRole('radio', { name: /7 dias/ }).click()
  await expect(periods.getByRole('radio', { name: /7 dias/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(
    page.getByText(/^Em 24\/10, esta mesma lista custava R\$\s[\d.,]+\. Hoje custa/),
  ).toBeVisible()
  await expect(page.locator('#list-change-chart')).toContainText('Total da lista')
  await expect(page.getByText(/ite(m mudou|ns mudaram) de preço/)).toBeVisible()
  expect(await page.locator('.list-change-items li').count()).toBeGreaterThan(0)

  await toggle.click()
  await expect(periods).toHaveCount(0)
})
