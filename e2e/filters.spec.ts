import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const UTENSILS = [
  'Pratos (aparelho de jantar)',
  'Talheres (faqueiro)',
  'Panelas',
  'Copos',
  'Facas',
  'Jogo americano',
  'Toalha de mesa',
]

const cardNames = (page: Page) =>
  page
    .getByRole('article')
    .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label')!.split(':')[0]))

async function openKitchenForm(page: Page) {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByLabel('Orçamento em reais').fill('20000')
}

test('necessidade mínima 3+ e sem utensílios', async ({ page }) => {
  await openKitchenForm(page)
  const economic = page.locator('.preset', { hasText: 'Econômico' }).locator('.preset-value')
  const before = await economic.textContent()

  await page.getByRole('radio', { name: /3\+/ }).click()
  await page.getByRole('switch', { name: /Incluir utensílios/ }).uncheck()
  // sem pratos/talheres/panelas e sem os itens de necessidade 1–2, o econômico fica mais barato
  await expect(economic).not.toHaveText(before!)

  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const names = await cardNames(page)
  expect(names).toEqual(
    expect.arrayContaining(['Geladeira', 'Fogão ou cooktop', 'Forno', 'Micro-ondas']),
  )
  for (const hidden of [...UTENSILS, 'Freezer', 'Liquidificador'])
    expect(names).not.toContain(hidden)

  const hiddenSection = page.locator('.side-section', { hasText: 'Escondidos pelos filtros' })
  await expect(hiddenSection).toContainText('Pratos')
  await expect(hiddenSection).toContainText('Utensílio')
  await expect(hiddenSection).toContainText('Liquidificador')
  await expect(page.locator('.filters-panel summary')).toContainText(
    'necessidade 3+ · sem utensílios',
  )
})

test('card mostra necessidade e selo de utensílio', async ({ page }) => {
  await openKitchenForm(page)
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const plates = page.getByRole('article', { name: /^Pratos/ })
  await expect(plates.getByText('Utensílio')).toBeVisible()
  await expect(plates.getByText('Necessidade: necessário (4/5)')).toBeVisible()
  const fridge = page.getByRole('article', { name: /^Geladeira:/ })
  await expect(fridge.getByText('Necessidade: essencial (5/5)')).toBeVisible()
  await expect(fridge.getByText('Utensílio')).toHaveCount(0)
})

test('mudar filtro na lista recalcula e pode ser desfeito', async ({ page }) => {
  await openKitchenForm(page)
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const original = await cardNames(page)
  expect(original).toContain('Pratos (aparelho de jantar)')

  await page.locator('.filters-panel summary').click()
  await page.getByRole('switch', { name: /Incluir utensílios/ }).uncheck()
  await expect(page.getByText(/Filtros aplicados/)).toBeVisible()
  expect(await cardNames(page)).not.toContain('Pratos (aparelho de jantar)')

  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('article', { name: /^Pratos/ })).toBeVisible()
  expect(await cardNames(page)).toEqual(original)
})

test('link compartilhado mantém os filtros', async ({ page, browser }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await openKitchenForm(page)
  await page.getByRole('radio', { name: /4\+/ }).click()
  await page.getByRole('switch', { name: /Incluir utensílios/ }).uncheck()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const names = await cardNames(page)
  expect(names).toEqual(['Fogão ou cooktop', 'Geladeira'])

  await page.getByRole('button', { name: 'Copiar link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())

  const other = await browser.newContext()
  const friend = await other.newPage()
  await friend.goto(link)
  await expect(friend.getByRole('article').first()).toBeVisible()
  expect(await cardNames(friend)).toEqual(names)
  await expect(friend.locator('.filters-panel summary')).toContainText(
    'necessidade 4+ · sem utensílios',
  )
  await other.close()
})

test('facilitadores ficam fora até incluir', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByLabel('Orçamento em reais').fill('30000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  const helperCards = page.getByRole('article').filter({ hasText: 'Facilitador' })
  await expect(page.getByRole('heading', { name: /Facilitadores/ })).toBeVisible()
  await expect(helperCards).toHaveCount(0)

  await page.getByRole('button', { name: '+ Incluir facilitadores' }).click()
  await expect(page.getByText('com facilitadores')).toBeVisible()
  await expect(
    page.getByRole('article', { name: /^Potes de silicone para congelar:/ }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Incluir facilitadores' })).toHaveCount(0)
})
