import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const card = (page: Page, label: string) =>
  page.getByRole('article', { name: new RegExp(`^${label}:`) })

/** Itens exibidos (nome + tier), saldo e itens fora da lista: o que precisa ser idêntico. */
async function snapshot(page: Page) {
  await expect(page.getByRole('article').first()).toBeVisible()
  return {
    items: await page
      .getByRole('article')
      .evaluateAll((cards) =>
        cards.map(
          (c) => `${c.getAttribute('aria-label')} | ${c.querySelector('.tier-badge')?.textContent}`,
        ),
      ),
    remaining: await page.getByTestId('remaining').textContent(),
    sides: await page.locator('.side-section li').allTextContents(),
  }
}

/** Monta uma lista com recusa, troca de tier e reload. */
async function buildCustomList(page: Page) {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByLabel('Orçamento em reais').fill('20000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await card(page, 'Fogão ou cooktop').getByRole('button', { name: 'Recusar' }).click()
  await card(page, 'Geladeira')
    .getByRole('button', { name: /Mais barato/ })
    .click()
  await page.getByRole('button', { name: /Recalcular lista/ }).click()
  await card(page, 'Freezer').getByRole('button', { name: 'Já tenho' }).click()
}

test('link compartilhado abre a mesma lista em outro aparelho', async ({ page, browser }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await buildCustomList(page)
  const original = await snapshot(page)

  await page.getByRole('button', { name: 'Copiar link' }).click()
  await expect(page.getByText('Link copiado!')).toBeVisible()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/#l=.+&s=1$/)

  // outro "celular": contexto novo, sem localStorage
  const other = await browser.newContext()
  const friend = await other.newPage()
  await friend.goto(link)
  await expect(friend.getByText('Lista compartilhada.')).toBeVisible()
  expect(await snapshot(friend)).toEqual(original)
  // a marca de "compartilhado" sai da URL depois de aberta
  await expect(friend).not.toHaveURL(/&s=1/)
  await other.close()
})

test('a lista sobrevive ao recarregar a página e a abrir o site sem link', async ({ page }) => {
  await buildCustomList(page)
  const original = await snapshot(page)
  expect(page.url()).toMatch(/#l=/)

  await page.reload()
  expect(await snapshot(page)).toEqual(original)

  // sem hash na URL: restaura do localStorage
  await page.goto('./')
  expect(await snapshot(page)).toEqual(original)
  await expect(page.getByText('Lista compartilhada.')).toHaveCount(0)
})

test('botão do WhatsApp leva o link da lista', async ({ page }) => {
  await buildCustomList(page)
  const href = await page.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')
  expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/)
  const text = decodeURIComponent(href!.split('text=')[1])
  expect(text).toContain('Minha lista (Cozinha)')
  expect(text).toMatch(/#l=.+&s=1$/)
})

test('link inválido abre a tela inicial sem quebrar', async ({ page }) => {
  await page.goto('./#l=link-quebrado&s=1')
  await expect(page.getByRole('heading', { name: 'Quais cômodos você vai montar?' })).toBeVisible()
})

test('voltar aos cômodos mantém a seleção e a lista salva', async ({ page }) => {
  await buildCustomList(page)
  await page.getByRole('button', { name: '← Cômodos' }).click()
  await expect(page.getByRole('heading', { name: 'Quais cômodos você vai montar?' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Cozinha \d+ itens$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page).toHaveURL(/#l=/)
})
