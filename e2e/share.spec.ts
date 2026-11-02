import { readFileSync } from 'node:fs'
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
  expect(link).toMatch(/#l=0[0-9A-Za-z]+&s=1$/)

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
  expect(text).toMatch(/#l=0[0-9A-Za-z]+&s=1$/)
})

/** Simula o encurtador (VITE_SHORTENER no playwright.config) devolvendo `shorturl`. */
async function mockShortener(page: Page, shorturl: string) {
  const requested: string[] = []
  await page.route('https://encurtador.test/**', (route) => {
    requested.push(decodeURIComponent(new URL(route.request().url()).searchParams.get('url')!))
    return route.fulfill({
      json: { shorturl },
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  return requested
}

test('copiar e WhatsApp usam o link curto, que leva à lista completa', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const requested = await mockShortener(page, 'https://is.gd/lista1')
  await buildCustomList(page)

  await page.getByRole('button', { name: 'Copiar link' }).click()
  await expect(page.getByText('Link curto copiado!')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://is.gd/lista1')
  expect(requested).toHaveLength(1)
  expect(requested[0]).toMatch(/\/house-shopping\/#l=0[0-9A-Za-z]+&s=1$/)

  // o link curto já está pronto: o WhatsApp abre com ele, sem pedir de novo
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'WhatsApp' }).click(),
  ])
  await expect.poll(() => decodeURIComponent(popup.url())).toContain('https://is.gd/lista1')
  expect(requested).toHaveLength(1)
})

test('WhatsApp encurta no clique; com o encurtador fora do ar vai o link completo', async ({
  page,
}) => {
  await page.route('https://encurtador.test/**', (route) => route.abort())
  await buildCustomList(page)
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('link', { name: 'WhatsApp' }).click(),
  ])
  await expect.poll(() => popup.url()).toMatch(/^https:\/\/(api\.)?wa\.me\/|whatsapp/)
  const text = decodeURIComponent(new URL(popup.url()).searchParams.get('text') ?? '')
  expect(text).toMatch(/#l=0[0-9A-Za-z]+&s=1$/)
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

test('baixar a lista em Excel', async ({ page }, testInfo) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^lista-house-shopping-\d{4}-\d{2}-\d{2}\.xlsx$/)
  await expect(page.getByText('Planilha baixada.')).toBeVisible()

  const path = testInfo.outputPath('lista.xlsx')
  await download.saveAs(path)
  if (process.env.XLSX_COPY) await download.saveAs(process.env.XLSX_COPY)
  // zip sem compressão: o XML da planilha aparece em texto puro
  const bytes = readFileSync(path)
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  const text = bytes.toString('utf8')
  const fridge = await page
    .getByRole('article', { name: /^Geladeira:/ })
    .getByRole('heading')
    .textContent()
  expect(text).toContain(fridge!)
  expect(text).toContain('Link do anúncio')
  expect(text).toContain('TargetMode="External"')
})
