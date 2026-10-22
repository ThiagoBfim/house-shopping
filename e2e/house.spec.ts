import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const HOUSE = { Cozinha: 1, Quarto: 2, 'Quarto do bebê': 1, Banheiro: 1 }
const GROUPS = ['Cozinha', 'Quarto 1', 'Quarto 2', 'Quarto do bebê', 'Banheiro']

const groupTitles = (page: Page) => page.locator('.room-group-header h3').allTextContents()
const group = (page: Page, title: string) =>
  page.locator('.room-group', { has: page.getByRole('heading', { name: title, exact: true }) })

async function buildHouse(page: Page) {
  await page.goto('./')
  await pickRooms(page, HOUSE)
  await expect(
    page.getByRole('heading', { name: /Cozinha, 2 Quartos, Quarto do bebê e Banheiro/ }),
  ).toBeVisible()
  await page.getByLabel('Orçamento em reais').fill('60000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
}

test('a planta mostra os cômodos escolhidos', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('img', { name: 'Sua planta ainda está vazia' })).toBeVisible()
  await page.getByRole('button', { name: /^Quarto \d+ itens$/ }).click()
  await page.getByRole('button', { name: 'Adicionar um Quarto', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Sua planta: Quarto 1, Quarto 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar com 2 cômodos' })).toBeEnabled()

  await page.getByRole('button', { name: 'Casa completa' }).click()
  await expect(
    page.getByRole('img', { name: /Sua planta: Cozinha, Quarto, Sala, Banheiro/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Limpar' }).click()
  await expect(page.getByRole('button', { name: 'Escolha pelo menos um cômodo' })).toBeDisabled()
})

test('casa inteira: um orçamento só e lista agrupada por cômodo', async ({ page }) => {
  await buildHouse(page)
  expect(await groupTitles(page)).toEqual(GROUPS)
  for (const title of GROUPS) {
    await expect(group(page, title).getByRole('article').first()).toBeVisible()
  }
  const remaining = await page.getByTestId('remaining').textContent()
  expect(remaining).toMatch(/^R\$/)
  await expect(page.getByText('Faltam')).toHaveCount(0)
  // os dois quartos têm colchão, cada um no seu grupo
  await expect(group(page, 'Quarto 1').getByRole('article', { name: /^Colchão:/ })).toBeVisible()
  await expect(group(page, 'Quarto 2').getByRole('article', { name: /^Colchão:/ })).toBeVisible()
})

test('recusar o colchão do Quarto 1 não mexe no Quarto 2', async ({ page }) => {
  await buildHouse(page)
  await group(page, 'Quarto 1')
    .getByRole('article', { name: /^Colchão:/ })
    .getByRole('button', { name: 'Recusar' })
    .click()
  await expect(page.getByText('Colchão (Quarto 1) recusado.')).toBeVisible()
  await expect(group(page, 'Quarto 1').getByRole('article', { name: /^Colchão:/ })).toHaveCount(0)
  await expect(group(page, 'Quarto 2').getByRole('article', { name: /^Colchão:/ })).toBeVisible()
  await expect(page.locator('.side-section', { hasText: 'Recusados' })).toContainText(
    'Colchão (Quarto 1)',
  )
})

test('link compartilhado da casa abre a mesma lista em outro aparelho', async ({
  page,
  browser,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await buildHouse(page)
  const snapshot = (p: Page) =>
    p
      .getByRole('article')
      .evaluateAll((cards) =>
        cards.map((c) => `${c.closest('.room-group')?.id} ${c.getAttribute('aria-label')}`),
      )
  const original = await snapshot(page)

  await page.getByRole('button', { name: 'Copiar link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  const other = await browser.newContext()
  const friend = await other.newPage()
  await friend.goto(link)
  await expect(friend.getByText('Lista compartilhada.')).toBeVisible()
  expect(await groupTitles(friend)).toEqual(GROUPS)
  expect(await snapshot(friend)).toEqual(original)
  await other.close()
})
