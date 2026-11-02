import { readFileSync } from 'node:fs'
import { expect, test, type Page, type Route } from '@playwright/test'

const API = 'http://api.test'
// Resposta real da skill /floor-plan (apartamento de 2 quartos), a mesma dos testes unitários.
const apto = JSON.parse(readFileSync('tests/fixtures/floor-plan-apto.json', 'utf8')) as unknown

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Mock {
  health?: { floorPlan: boolean; cheaperPrices: boolean }
  /** Respostas de GET /api/jobs/:id, em ordem (a última se repete). */
  jobs?: Record<string, object[]>
  /** POST → id do job (ou erro). */
  start?: Record<string, { id: string } | { status: number; error: string }>
}

/** Backend local simulado (VITE_LOCAL_API no playwright.config). */
async function mockApi(page: Page, mock: Mock) {
  const calls: {
    method: string
    path: string
    query: URLSearchParams
    size: number
    body: string
  }[] = []
  const seen: Record<string, number> = {}
  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    calls.push({
      method: request.method(),
      path: url.pathname,
      query: url.searchParams,
      size: request.postDataBuffer()?.length ?? 0,
      body: request.postDataBuffer()?.toString('utf8') ?? '',
    })
    const json = (status: number, body: object) =>
      route.fulfill({ status, json: body, headers: CORS })
    if (url.pathname === '/api/health') {
      return json(200, mock.health ?? { floorPlan: true, cheaperPrices: true })
    }
    if (request.method() === 'POST') {
      const start = mock.start?.[url.pathname]
      if (!start) return json(404, { error: 'sem mock' })
      return 'id' in start ? json(202, start) : json(start.status, { error: start.error })
    }
    const id = url.pathname.split('/').pop()!
    const answers = mock.jobs?.[id] ?? []
    const n = (seen[id] = (seen[id] ?? 0) + 1)
    return answers.length ? json(200, answers[Math.min(n, answers.length) - 1]) : json(404, {})
  })
  return calls
}

const labs = (page: Page) => page.locator('.labs-panel')

async function turnOn(page: Page, name: string) {
  await labs(page).locator('summary').click()
  await labs(page)
    .getByRole('switch', { name: new RegExp(name) })
    .check()
}

test('sem o backend local, os recursos em teste não aparecem', async ({ page }) => {
  await page.route(`${API}/**`, (route) => route.abort())
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Quais cômodos você vai montar?' })).toBeVisible()
  await expect(labs(page)).toHaveCount(0)
  await expect(page.getByText('Enviar a planta')).toHaveCount(0)
})

test('chaves desligadas por padrão; preços indisponíveis sem a skill', async ({ page }) => {
  await mockApi(page, { health: { floorPlan: true, cheaperPrices: false } })
  await page.goto('./')
  await expect(labs(page)).toContainText('backend local conectado')
  await labs(page).locator('summary').click()
  await expect(labs(page).getByRole('switch', { name: /Planta da casa/ })).not.toBeChecked()
  await expect(labs(page).getByRole('switch', { name: /Preços mais baratos/ })).toBeDisabled()
  await expect(labs(page)).toContainText('precisa da skill /search-better-prices')
  await expect(page.getByText('Enviar a planta')).toHaveCount(0)
})

test('planta → cômodos, cama pelo tamanho do quarto e desenho do imóvel', async ({ page }) => {
  const calls = await mockApi(page, {
    start: { '/api/floor-plan': { id: 'p1' } },
    jobs: {
      p1: [
        { id: 'p1', status: 'running' },
        { id: 'p1', status: 'done', result: apto, costUsd: 0.27 },
      ],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')

  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  const summary = page.getByRole('status').filter({ hasText: 'Planta lida' })
  await expect(summary).toContainText('2 Quartos')
  await expect(summary).toContainText('3 Banheiros')
  await expect(summary).toContainText('Suíte (14 m²) → queen')
  await expect(summary).toContainText('Dorm. 2 (9 m²) → casal')
  await expect(summary).toContainText('Fora da lista: Circulação, Closet')
  await expect(summary).toContainText('US$ 0.27')
  expect(calls.find((c) => c.method === 'POST')).toMatchObject({
    path: '/api/floor-plan',
    size: 3,
  })
  expect(calls.find((c) => c.method === 'POST')!.query.get('name')).toBe('apto.png')

  // a escolha de cômodos já vem marcada: 2 quartos, 3 banheiros, sala, cozinha…
  await page.getByRole('button', { name: /^Continuar com 10 cômodos/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  const bed = page.locator('#room-quarto-1').getByRole('article', { name: /^Cama \/ base box/ })
  await expect(bed.getByRole('radio', { name: 'Queen' })).toHaveAttribute('aria-checked', 'true')
  const bed2 = page.locator('#room-quarto-2').getByRole('article', { name: /^Cama \/ base box/ })
  await expect(bed2.getByRole('radio', { name: 'Casal' })).toHaveAttribute('aria-checked', 'true')

  const drawing = page.getByRole('group', { name: 'Desenho do imóvel com os móveis da lista' })
  await expect(drawing).toBeVisible()
  await expect(drawing.getByRole('button', { name: /^Quarto 1, 14 m²: \d+ itens/ })).toBeVisible()
  await expect(drawing.getByRole('img', { name: 'Closet (fora da lista)' })).toBeVisible()
  await drawing.getByRole('button', { name: /^Cozinha, 9 m²/ }).click()
  await expect(page.locator('#room-cozinha')).toBeInViewport()

  // o desenho continua depois de recarregar; com a chave desligada, some
  await page.reload()
  await expect(drawing).toBeVisible()
  await labs(page).locator('summary').click()
  await labs(page)
    .getByRole('switch', { name: /Planta da casa/ })
    .uncheck()
  await expect(drawing).toHaveCount(0)
})

test('planta: erro do backend aparece e dá para tentar de novo', async ({ page }) => {
  await mockApi(page, {
    start: {
      '/api/floor-plan': { status: 400, error: 'Envie a planta em PNG, JPG, WEBP, GIF ou PDF.' },
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from('x') })
  await expect(page.getByRole('alert')).toHaveText('Envie a planta em PNG, JPG, WEBP, GIF ou PDF.')
  await expect(page.getByLabel('Planta da casa (imagem ou PDF)')).toBeEnabled()
})

/** "R$ 12.345,67" → 12345.67 */
async function listTotal(page: Page): Promise<number> {
  const text = (await page.locator('.summary-total').textContent()) ?? ''
  return Number(text.replace(/[^\d,]/g, '').replace(',', '.'))
}

test('preços mais baratos: troca link e preço e volta ao que era antes', async ({ page }) => {
  const calls = await mockApi(page, {
    start: { '/api/cheaper-prices': { id: 'c1' } },
    jobs: {
      c1: [
        { id: 'c1', status: 'running', progress: { done: 1, total: 5 } },
        {
          id: 'c1',
          status: 'done',
          progress: { done: 5, total: 5 },
          // linha 2 = 1º item da lista; linha 3 sem preço melhor
          result: [
            {
              row: 2,
              status: 'melhor',
              preco: 1,
              loja: 'Magalu',
              link: 'https://magalu.com/p?utm_source=x',
            },
            { row: 3, status: 'sem preço melhor' },
          ],
        },
      ],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Preços mais baratos')
  await page
    .getByRole('button', { name: /^Cozinha/ })
    .first()
    .click()
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  const first = page.locator('.product-list article').first()
  const label = (await first.getAttribute('aria-label'))!
  const [category, product] = label.split(': ')
  const before = await listTotal(page)

  const panel = page.getByRole('region', { name: '🔎 Preços mais baratos' })
  await panel.getByRole('button', { name: 'Buscar preços mais baratos' }).click()
  await expect(panel.getByText('1 de 5 itens pesquisados')).toBeVisible()
  await expect(panel.getByText(/1 de 2 itens ficaram mais baratos/)).toBeVisible()
  const post = calls.find((c) => c.method === 'POST')!
  expect(post.path).toBe('/api/cheaper-prices')
  // os 5 itens mais caros, no formato do itens.json da skill (linha, produto, preço…)
  const { items } = JSON.parse(post.body) as { items: { row: number; produto: string }[] }
  expect(items).toHaveLength(5)
  expect(items.map((i) => i.row)).toContain(2)
  expect(items.find((i) => i.row === 2)?.produto).toBe(product)

  // o item virou uma troca com a loja nova, no mesmo lugar
  const swap = page.getByRole('article', { name: `Trocado por você (${category}): ${product}` })
  await expect(swap).toContainText('Mais barato em Magalu')
  await expect(swap.getByRole('link', { name: /Ver anúncio/ })).toHaveAttribute(
    'href',
    'https://magalu.com/p',
  )
  expect(await listTotal(page)).toBeLessThan(before)

  // voltar ao que era antes (continua disponível depois de recarregar)
  await page.reload()
  await panel.getByRole('button', { name: /Voltar ao que era antes \(1 item\)/ }).click()
  await expect(swap).toHaveCount(0)
  await expect(page.getByRole('article', { name: label })).toBeVisible()
  expect(await listTotal(page)).toBeCloseTo(before, 2)
  await expect(panel.getByRole('button', { name: /Voltar ao que era antes/ })).toHaveCount(0)
})
