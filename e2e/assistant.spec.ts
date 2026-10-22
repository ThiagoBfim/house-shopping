import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const card = (page: Page, label: string) =>
  page.getByRole('article', { name: new RegExp(`^${label}:`) })
const variant = (page: Page, label: string, name: string) =>
  card(page, label).getByRole('radio', { name })
const groupTitles = (page: Page) => page.locator('.room-group-header h3').allTextContents()
const tap = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()
const skip = (page: Page) => tap(page, 'Pular esta pergunta')

/** Responde o assistente como no "pronto quando" do Drop 18. */
async function answerAll(page: Page, fromList = false) {
  if (fromList) {
    await page.getByRole('button', { name: '✨ Refazer com perguntas' }).click()
  } else {
    await page.goto('./')
    await page.getByRole('button', { name: 'Começar →' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Quem vai morar na casa?' })).toBeFocused()
  await tap(page, 'Casal com filhos')
  await tap(page, 'Não')
  await tap(page, 'PlayStation')
  await tap(page, 'Não tem')
  await tap(page, 'Equilibrado')
  await tap(page, 'Cooktop de indução')
  await skip(page) // cozinhar
  await skip(page) // café
  await skip(page) // calor
  await tap(page, 'Queen')
  await tap(page, 'Geladeira')
  await tap(page, 'Continuar')
  await skip(page) // utensílios
  await skip(page) // facilitadores
}

test('monte pra mim: as respostas viram a lista', async ({ page }) => {
  await answerAll(page)

  await expect(page.getByRole('heading', { name: /Pronto!/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fogão: Cooktop de indução/ })).toBeVisible()
  await tap(page, 'Ver minha lista →')

  expect(await groupTitles(page)).toEqual([
    'Cozinha',
    'Quarto 1',
    'Quarto 2',
    'Sala',
    'Banheiro',
    'Lavanderia',
    'Utilidades',
    'Escritório gamer',
  ])
  await expect(variant(page, 'Fogão ou cooktop', 'Cooktop de indução')).toBeChecked()
  await expect(variant(page, 'Forno', 'Forno de embutir')).toBeChecked()
  await expect(variant(page, 'Panelas', 'Para indução')).toBeChecked()
  await expect(variant(page, 'Videogame', 'PlayStation')).toBeChecked()
  await expect(variant(page, 'Colchão', 'Queen').first()).toBeChecked()
  await expect(card(page, 'Geladeira')).toHaveCount(0)
  await expect(page.locator('.side-section', { hasText: 'Recusados' })).toContainText('Geladeira')

  // o link (URL) reproduz a mesma lista
  await page.reload()
  await expect(variant(page, 'Fogão ou cooktop', 'Cooktop de indução')).toBeChecked()
})

test('pular tudo na primeira pergunta deixa o fluxo atual intacto', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Começar →' }).click()
  await tap(page, 'Pular tudo')
  await expect(page.getByRole('heading', { name: 'Quais cômodos você vai montar?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escolha pelo menos um cômodo' })).toBeDisabled()
})

test('voltar e mudar uma resposta pelo resumo', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Começar →' }).click()
  await tap(page, 'Só eu')
  await page.getByRole('button', { name: 'Pergunta anterior' }).click()
  await expect(page.getByRole('button', { name: 'Só eu' })).toHaveAttribute('aria-pressed', 'true')
  await tap(page, 'Casal')
  for (let i = 0; i < 12; i++) await skip(page)

  await page.getByRole('button', { name: /^Casa: Casal/ }).click()
  await tap(page, 'Com bebê (ou chegando)')
  for (let i = 0; i < 12; i++) await skip(page)
  await expect(page.getByRole('button', { name: /^Casa: Com bebê/ })).toBeVisible()

  await tap(page, 'Ajustar orçamento antes')
  await expect(page.getByRole('heading', { name: /Quarto do bebê/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Equilibrado/ })).toBeChecked()
})

test('trocar a variante no card e refazer com as respostas marcadas', async ({ page }) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  const stove = card(page, 'Fogão ou cooktop')
  await expect(variant(page, 'Fogão ou cooktop', 'Fogão de piso')).toBeChecked()
  await variant(page, 'Fogão ou cooktop', 'Cooktop a gás').click()
  await expect(stove.getByRole('heading')).toHaveText(/Cooktop a Gás/)
  await expect(page.getByText('Fogão ou cooktop: cooktop a gás.')).toBeVisible()

  await answerAll(page, true)
  await tap(page, 'Ver minha lista →')
  await expect(page.getByText('Lista montada com as suas respostas.')).toBeVisible()
  await page.getByRole('button', { name: '✨ Refazer com perguntas' }).click()
  await expect(page.getByRole('button', { name: 'Casal com filhos' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
