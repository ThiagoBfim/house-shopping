import { expect, test, type Page } from '@playwright/test'
import { pickRooms } from './helpers.ts'

const manualCard = (page: Page, name: string) =>
  page.getByRole('article', { name: `Adicionado por você: ${name}` })

/** "R$ 12.345,67" → 12345.67 */
async function listTotal(page: Page): Promise<number> {
  const text = (await page.locator('.summary-total').textContent()) ?? ''
  return Number(text.replace(/[^\d,]/g, '').replace(',', '.'))
}

test('adicionar item manual com quantidade, editar, recarregar, compartilhar e remover', async ({
  page,
  browser,
}) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1 })
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  const before = await listTotal(page)

  await page.getByRole('button', { name: 'Adicionar item em Cozinha' }).click()
  // Esc fecha sem salvar
  await page.getByLabel('Nome do produto').press('Escape')
  await expect(page.getByLabel('Nome do produto')).toBeHidden()

  await page.getByRole('button', { name: 'Adicionar item em Cozinha' }).click()
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Informe o nome do produto.')).toBeVisible()
  await expect(page.getByText('Cole o link do produto.')).toBeVisible()

  await page.getByLabel('Nome do produto').fill('Cadeira Tok&Stok')
  await page.getByLabel('Preço unitário').fill('399,90')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  }
  await expect(page.getByRole('textbox', { name: 'Quantidade' })).toHaveValue('4')
  await page.getByLabel('Link do produto').fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Link inválido: comece com https://')).toBeVisible()
  await page.getByLabel('Link do produto').fill('https://www.amazon.com.br/dp/B0TESTE')
  await page.getByLabel('Link do produto').press('Enter')

  const card = manualCard(page, 'Cadeira Tok&Stok')
  await expect(card).toBeVisible()
  await expect(card).toContainText(/4 × R\$\s399,90/)
  await expect(card).toContainText(/R\$\s1\.599,60/)
  const link = card.getByRole('link', { name: /Ver anúncio na Amazon/ })
  await expect(link).toHaveAttribute('href', 'https://www.amazon.com.br/dp/B0TESTE')
  await expect(link).toHaveAttribute('rel', /nofollow/)
  expect(await listTotal(page)).toBeCloseTo(before + 1599.6, 2)

  // a busca também acha o item adicionado
  await page.getByPlaceholder('Buscar produto na lista…').fill('tok&stok')
  await expect(card).toBeVisible()
  await expect(page.getByText(/1 item encontrado/)).toBeVisible()
  await page.getByPlaceholder('Buscar produto na lista…').fill('')

  // editar a quantidade
  await card.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('textbox', { name: 'Quantidade' }).fill('2')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(card).toContainText(/2 × R\$\s399,90/)
  expect(await listTotal(page)).toBeCloseTo(before + 799.8, 2)

  // recalcular mantém o item
  await page.getByRole('button', { name: /Recalcular lista/ }).click()
  await expect(card).toBeVisible()
  const recalculated = await listTotal(page)

  // sobrevive ao recarregar
  await page.reload()
  await expect(card).toContainText(/2 × R\$\s399,90/)

  // vai no link compartilhado
  await page.getByRole('button', { name: 'Copiar link' }).click()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  const other = await browser.newContext()
  const friend = await other.newPage()
  await friend.goto(shared)
  await expect(manualCard(friend, 'Cadeira Tok&Stok')).toContainText(/R\$\s799,80/)
  expect(await listTotal(friend)).toBeCloseTo(recalculated, 2)
  await other.close()

  // remover (com desfazer)
  await card.getByRole('button', { name: 'Remover' }).click()
  await expect(card).toBeHidden()
  expect(await listTotal(page)).toBeCloseTo(recalculated - 799.8, 2)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(card).toBeVisible()
})

test('com vários cômodos, o item entra no cômodo escolhido e sai junto com ele', async ({
  page,
}) => {
  await page.goto('./')
  await pickRooms(page, { Cozinha: 1, Quarto: 2 })
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  await page.getByRole('button', { name: 'Adicionar item em Quarto 2' }).click()
  await page.getByLabel('Nome do produto').fill('Abajur')
  await page.getByLabel('Preço unitário').fill('80')
  await page.getByLabel('Link do produto').fill('https://www.tokstok.com.br/abajur')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  const room = page.locator('#room-quarto-2')
  await expect(room.getByRole('article', { name: 'Adicionado por você: Abajur' })).toBeVisible()
  await expect(room.getByRole('link', { name: 'Ver anúncio ↗' })).toBeVisible()

  // tirar o segundo quarto leva o item junto
  await page.getByRole('button', { name: '← Cômodos' }).click()
  await page.getByRole('button', { name: 'Remover um Quarto', exact: true }).click()
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await expect(page.getByText('1 item adicionado por você saiu junto com o cômodo.')).toBeVisible()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await expect(page.getByRole('article', { name: /^Adicionado por você/ })).toHaveCount(0)
})
