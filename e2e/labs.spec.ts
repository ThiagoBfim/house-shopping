import { readFileSync } from 'node:fs'
import { expect, test, type Page, type Route } from '@playwright/test'

const API = 'http://api.test'
// Resposta real da skill /floor-plan (apartamento de 2 quartos), a mesma dos testes unitários.
const apto = JSON.parse(readFileSync('tests/fixtures/floor-plan-apto.json', 'utf8')) as unknown
// Resposta real da skill /house-3d para a mesma planta (só 3 portas desenhadas).
const casa3d = JSON.parse(readFileSync('tests/fixtures/house-3d-apto.json', 'utf8')) as unknown

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface Mock {
  health?: { floorPlan: boolean; cheaperPrices: boolean; house3d?: boolean; chat?: boolean }
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

/** Passo do fluxo da planta (só existe com a planta ligada e lida). */
async function toStep(page: Page, name: 'Móveis' | 'Posições em 3D' | 'Projeto em 3D') {
  await page
    .getByRole('navigation', { name: 'Passos do projeto' })
    .getByRole('button', { name: new RegExp(name) })
    .click()
}

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

  // fluxo: passo 2 (móveis) é a lista; o desenho e as posições ficam no passo 3
  const steps = page.getByRole('navigation', { name: 'Passos do projeto' })
  await expect(steps.getByRole('button', { name: /Móveis/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  const drawing = page.getByRole('group', { name: 'Desenho do imóvel com os móveis da lista' })
  await expect(drawing).toHaveCount(0)
  await page
    .getByRole('button', { name: /Ver os móveis nos cômodos \(3D\)/ })
    .first()
    .click()
  await expect(steps.getByRole('button', { name: /Posições em 3D/ })).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect(page.locator('#room-cozinha')).toHaveCount(0)
  await expect(drawing).toBeVisible()
  await expect(drawing.getByRole('button', { name: /^Quarto 1, 14 m²: \d+ itens/ })).toBeVisible()
  await expect(drawing.getByRole('img', { name: 'Closet (fora da lista)' })).toBeVisible()

  // posição dos móveis: vista em escala por cômodo; tocar num móvel mostra medida e preço
  const furniture = page.getByRole('region', { name: '🛋️ Posição dos móveis' })
  await furniture.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(furniture).toContainText(/Quarto 1: [\d,]+ × [\d,]+ m/)
  await furniture.getByRole('button', { name: /^Cama \/ base box:/ }).click()
  await expect(furniture.getByRole('status')).toContainText(/📐 ~?[\d,]+ × [\d,]+ × [\d,]+ cm/)
  await expect(furniture.getByRole('status')).toContainText('R$')
  await expect(furniture.getByRole('button', { name: /^Criado-mudo:/ })).toHaveCount(2)

  // 3D: no passo das posições a cena já abre; toca na cama (gancho de teste) e vê o cartão
  const scene = furniture.locator('.room-3d')
  const canvas = scene.locator('canvas')
  await expect(canvas).toBeVisible()
  const bedOnScreen = await page.evaluate(() => {
    const room = (window as unknown as { __room3d?: { screenPosition: (id: string) => unknown } })
      .__room3d
    return room?.screenPosition('quarto-1:cama-box#0') as { x: number; y: number } | undefined
  })
  expect(bedOnScreen).toBeTruthy()
  await canvas.click({ position: bedOnScreen! })
  await expect(scene.getByRole('status')).toContainText('Cama / base box')
  await expect(scene.getByRole('status')).toContainText(/📐 ~?[\d,]+ × [\d,]+ × [\d,]+ cm/)
  // a lista de móveis da cena também escolhe
  await scene.getByText(/^Móveis na cena/).click()
  await scene.getByRole('button', { name: 'Guarda-roupa' }).click()
  await expect(scene.getByRole('status')).toContainText('Guarda-roupa')
  await scene.getByRole('button', { name: 'Fechar' }).click()
  await expect(canvas).toHaveCount(0)

  await expect(furniture.getByRole('button', { name: '🧊 Ver em 3D' })).toBeVisible()

  // o passo fica salvo ao recarregar; voltar aos móveis mostra a lista de novo
  await page.reload()
  await expect(drawing).toBeVisible()
  await page.getByRole('button', { name: /Voltar aos móveis/ }).click()
  await expect(page.locator('#room-cozinha')).toBeVisible()
  await expect(drawing).toHaveCount(0)
  await toStep(page, 'Posições em 3D')
  await expect(drawing).toBeVisible()

  // o desenho continua depois de recarregar; com a chave desligada, some
  await page.reload()
  await expect(drawing).toBeVisible()
  await labs(page).locator('summary').click()
  await labs(page)
    .getByRole('switch', { name: /Planta da casa/ })
    .uncheck()
  await expect(drawing).toHaveCount(0)
  // sem a planta não há fluxo: a lista de sempre
  await expect(steps).toHaveCount(0)
  await expect(page.locator('#room-cozinha')).toBeVisible()
})

test('planta: um quarto vira quarto do bebê ou escritório', async ({ page }) => {
  await mockApi(page, {
    start: { '/api/floor-plan': { id: 'p1' } },
    jobs: { p1: [{ id: 'p1', status: 'done', result: apto, costUsd: 0.27 }] },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  const summary = page.getByRole('status').filter({ hasText: 'Planta lida' })
  await expect(summary).toContainText('2 Quartos')

  const types = page.getByRole('group', { name: 'Tipo de cada cômodo' })
  const dorm2 = types.getByRole('combobox', { name: /^Dorm\. 2/ })
  await expect(dorm2).toHaveValue('quarto')

  // escritório: um quarto a menos, um escritório a mais
  await dorm2.selectOption({ label: 'Escritório' })
  await expect(summary).toContainText('Quarto, ')
  await expect(summary).toContainText('Escritório')
  await expect(summary).not.toContainText('Dorm. 2 (9 m²) → casal')

  // quarto do bebê
  await dorm2.selectOption({ label: 'Quarto do bebê' })
  await expect(summary).toContainText('Quarto do bebê')
  await expect(summary).not.toContainText('Escritório')
  await expect(summary).toContainText('Suíte (14 m²) → queen')

  // um cômodo que estava fora (closet) entra como escritório
  await types.getByRole('combobox', { name: /^Closet/ }).selectOption({ label: 'Escritório' })
  await expect(summary).toContainText('Escritório')

  await page.getByRole('button', { name: /^Continuar com 11 cômodos/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await expect(page.locator('#room-quarto-bebe')).toBeVisible()
  await expect(page.locator('#room-escritorio')).toBeVisible()
  await expect(page.locator('#room-quarto-2')).toHaveCount(0)
  const bed = page.locator('#room-quarto').getByRole('article', { name: /^Cama \/ base box/ })
  await expect(bed.getByRole('radio', { name: 'Queen' })).toHaveAttribute('aria-checked', 'true')
  await toStep(page, 'Posições em 3D')
  const drawing = page.getByRole('group', { name: 'Desenho do imóvel com os móveis da lista' })
  await expect(drawing.getByRole('button', { name: /^Quarto do bebê, 9 m²/ })).toBeVisible()
  await expect(drawing.getByRole('button', { name: /^Escritório/ })).toBeVisible()
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
        // a lista aparece no clique; depois os resultados chegam item a item
        { id: 'c1', status: 'running', progress: { done: 0, total: 5 }, partial: [] },
        {
          id: 'c1',
          status: 'running',
          progress: { done: 1, total: 5 },
          partial: [
            {
              row: 2,
              status: 'melhor',
              preco: 1,
              loja: 'Magalu',
              link: 'https://magalu.com/p?utm_source=x',
            },
          ],
        },
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
  const oldUrl = (await first.locator('.buy-button').getAttribute('href'))!
  const before = await listTotal(page)

  const panel = page.getByRole('region', { name: '🔎 Preços mais baratos' })
  await panel.getByRole('button', { name: 'Buscar preços mais baratos' }).click()
  // no clique: os 5 itens mais caros, o primeiro procurando e os outros na fila
  const rows = panel.getByRole('listitem')
  await expect(rows).toHaveCount(5)
  await expect(rows.first()).toContainText('Procurando…')
  await expect(rows.filter({ hasText: 'Na fila' })).toHaveCount(4)
  // item a item: o achado aparece antes de a busca terminar
  await expect(panel.getByText('1 de 5 itens pesquisados')).toBeVisible()
  const row = rows.filter({ hasText: product })
  await expect(row).toContainText('Mais barato')
  await expect(rows.filter({ hasText: 'Procurando…' })).toHaveCount(1)

  // no fim: resumo, os dois anúncios do item mais barato e o resto
  await expect(panel.getByText('Mais barato em 1 de 5 itens')).toBeVisible()
  await expect(row).toContainText('Agora: R$ 1,00 em Magalu')
  await expect(row.getByRole('link', { name: 'anúncio anterior ↗' })).toHaveAttribute(
    'href',
    oldUrl,
  )
  await expect(row.getByRole('link', { name: 'nova oferta ↗' })).toHaveAttribute(
    'href',
    'https://magalu.com/p',
  )
  await expect(rows.filter({ hasText: 'Sem preço melhor' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'Não pesquisado' })).toHaveCount(3)
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

  // o resultado e o "voltar" continuam depois de recarregar
  await page.reload()
  await expect(panel.getByText('Mais barato em 1 de 5 itens')).toBeVisible()
  await panel.getByRole('button', { name: 'Voltar ao que era antes' }).click()
  await expect(swap).toHaveCount(0)
  await expect(page.getByRole('article', { name: label })).toBeVisible()
  expect(await listTotal(page)).toBeCloseTo(before, 2)
  await expect(panel.getByRole('button', { name: /Voltar ao que era antes/ })).toHaveCount(0)
})

type SceneState = { mode: string; x: number; z: number; room: number; tour: number }
const sceneState = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __house3d: { state: () => SceneState } }).__house3d.state(),
  )

test('casa em 3D: gerar com planta e fotos, andar em primeira pessoa, tour e vídeo', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const calls = await mockApi(page, {
    health: { floorPlan: true, cheaperPrices: false, house3d: true },
    start: { '/api/floor-plan': { id: 'p1' }, '/api/house-3d': { id: 'h1' } },
    jobs: {
      p1: [{ id: 'p1', status: 'done', result: apto }],
      h1: [
        { id: 'h1', status: 'running' },
        { id: 'h1', status: 'done', result: casa3d, costUsd: 0.41 },
      ],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Projeto em 3D')

  const gen = page.locator('.house-3d-generate')
  const button = gen.getByRole('button', { name: '✨ Gerar casa em 3D' })
  await expect(button).toBeDisabled()
  await gen
    .getByLabel('Planta')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  // 1×1 px: o navegador reduz/converte para JPEG antes de enviar
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await gen.getByLabel(/Fotos dos cômodos/).setInputFiles([
    { name: 'sala.png', mimeType: 'image/png', buffer: pixel },
    { name: 'quarto.png', mimeType: 'image/png', buffer: pixel },
  ])
  await button.click()
  await expect(page.getByRole('dialog', { name: 'Casa em 3D' })).toBeVisible({ timeout: 15000 })

  // multipart com planta, 2 fotos e os móveis da lista por cômodo, com medida
  const post = calls.find((c) => c.path === '/api/house-3d')!
  expect(post.body).toContain('name="planta"; filename="apto.png"')
  expect(post.body.match(/name="fotos"; filename="(sala|quarto)\.jpg"/g)).toHaveLength(2)
  const moveis = JSON.parse(
    post.body.split('name="moveis"')[1].split('\r\n\r\n')[1].split('\r\n')[0],
  )
  expect(moveis.find((r: { instanceId: string }) => r.instanceId === 'quarto-1').items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'quarto-1:cama-box', placement: 'floor' }),
    ]),
  )

  // abre em tela cheia, de cima
  const dialog = page.getByRole('dialog', { name: 'Casa em 3D' })
  await expect(dialog).toBeVisible()
  await page.waitForFunction(
    () => 'state' in ((window as unknown as { __house3d?: object }).__house3d ?? {}),
  )
  await expect(dialog.getByRole('button', { name: '🛰️ De cima' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // andar: começa na entrada (varanda), W anda para dentro sem atravessar parede
  await dialog.getByRole('button', { name: '🚶 Andar' }).click()
  await expect(dialog.getByRole('button', { name: '🚶 Andar' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(dialog.locator('.house-3d-room')).toHaveText(/Varanda/)
  const before = await sceneState(page)
  await page.keyboard.down('w')
  await page.waitForTimeout(1500)
  await page.keyboard.up('w')
  const after = await sceneState(page)
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2)
  expect(after.x).toBeGreaterThan(6)
  expect(after.x).toBeLessThan(10) // dentro da varanda (6–10 m), não atravessou a parede

  // tour gravado: passa por outro cômodo, parar entrega o vídeo
  await dialog.getByRole('button', { name: '⏺️ Gravar tour em vídeo' }).click()
  await expect(dialog.locator('.house-3d-rec')).toBeVisible()
  await expect
    .poll(async () => (await sceneState(page)).tour, { timeout: 15000 })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => dialog.locator('.house-3d-room').textContent(), { timeout: 20000 })
    .not.toMatch(/Varanda/)
  await dialog.getByRole('button', { name: /Parar e salvar vídeo/ }).click()
  const download = dialog.getByRole('link', { name: 'Baixar vídeo' })
  await expect(download).toBeVisible()
  await expect(download).toHaveAttribute('download', /^tour-da-casa\.(webm|mp4)$/)
  expect((await sceneState(page)).mode).toBe('walk')

  // fechar e reabrir sem gerar de novo (fica salva no navegador)
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(gen.getByRole('status')).toContainText('Casa gerada: 11 cômodos')
  await expect(gen.getByRole('status')).toContainText('US$ 0.41')
  await page.reload()
  await page
    .locator('.house-3d-generate')
    .getByRole('button', { name: '🔄 Atualizar o 3D' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Casa em 3D' })).toBeVisible()
  expect(calls.filter((c) => c.path === '/api/house-3d')).toHaveLength(1)
})

test('casa em 3D realista: armários das fotos, texturas e render em alta qualidade', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const casaArmarios = JSON.parse(
    readFileSync('tests/fixtures/house-3d-armarios.json', 'utf8'),
  ) as unknown
  const calls = await mockApi(page, {
    health: { floorPlan: true, cheaperPrices: false, house3d: true },
    start: { '/api/floor-plan': { id: 'p1' }, '/api/house-3d': { id: 'h1' } },
    jobs: {
      p1: [{ id: 'p1', status: 'done', result: apto }],
      h1: [{ id: 'h1', status: 'done', result: casaArmarios, costUsd: 1.2 }],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Projeto em 3D')

  const gen = page.locator('.house-3d-generate')
  await gen
    .getByLabel('Planta')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await gen.getByRole('button', { name: '🌟 Gerar casa em 3D realista' }).click()

  const dialog = page.getByRole('dialog', { name: 'Casa em 3D' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  const post = calls.find((c) => c.path === '/api/house-3d')!
  expect(post.query.get('quality')).toBe('realista')
  // abre já no realista (texturas e céu carregados de public/textures)
  await expect(dialog.getByRole('button', { name: '✨ Realista' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.waitForFunction(
    () => 'state' in ((window as unknown as { __house3d?: object }).__house3d ?? {}),
    null,
    { timeout: 60_000 },
  )

  await dialog.getByRole('button', { name: '📸 Render realista' }).click()
  const render = page.getByRole('dialog', { name: 'Render realista' })
  await expect(render).toBeVisible({ timeout: 180_000 })
  await expect(render.getByRole('link', { name: 'Baixar imagem' })).toHaveAttribute(
    'href',
    /^data:image\/png;base64,/,
  )
  await render.getByRole('button', { name: 'Voltar ao 3D' }).click()
  await expect(render).toHaveCount(0)

  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await expect(gen.getByRole('status')).toContainText('Casa gerada (realista)')
  await expect(gen.getByRole('status')).toContainText('3 armário(s) das fotos')
})

test('posição dos móveis = casa em 3D: mover, girar, lista atual', async ({ page }) => {
  test.setTimeout(120_000)
  const casaArmarios = JSON.parse(
    readFileSync('tests/fixtures/house-3d-armarios.json', 'utf8'),
  ) as unknown
  await mockApi(page, {
    health: { floorPlan: true, cheaperPrices: false, house3d: true },
    start: { '/api/floor-plan': { id: 'p1' }, '/api/house-3d': { id: 'h1' } },
    jobs: {
      p1: [{ id: 'p1', status: 'done', result: apto }],
      h1: [{ id: 'h1', status: 'done', result: casaArmarios }],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Posições em 3D')

  const layout = page.locator('.furniture-layout')
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(layout).not.toContainText('da casa em 3D')
  await expect(layout.locator('.layout-fixed')).toHaveCount(0)

  // gerar a casa em 3D: a vista de cima passa a ser o cômodo do 3D (medidas e armário da foto)
  await toStep(page, 'Projeto em 3D')
  const gen = page.locator('.house-3d-generate')
  await gen
    .getByLabel('Planta')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await gen.getByRole('button', { name: '✨ Gerar casa em 3D' }).click()
  const dialog = page.getByRole('dialog', { name: 'Casa em 3D' })
  await expect(dialog).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole('button', { name: 'Fechar' }).click()
  await toStep(page, 'Posições em 3D')
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(layout).toContainText('Quarto 1: 3,5 × 4 m (da casa em 3D)')
  await expect(layout.getByLabel('Armário embutido (das fotos)')).toHaveCount(1)

  // mover a cama com as setas: anda 10 cm por vez até bater (aí avisa e não sai do lugar)
  const bed = layout.getByRole('button', { name: /^Cama \/ base box/ })
  const at = async () => [await bed.getAttribute('data-x'), await bed.getAttribute('data-y')]
  const start = await at()
  await bed.focus()
  let moved = false
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp']) {
    await page.keyboard.press(key)
    if ((await at()).join() !== start.join()) {
      moved = true
      break
    }
  }
  expect(moved).toBe(true)
  const after = await at()
  const reset = layout.getByRole('button', { name: /Voltar às posições sugeridas/ })
  await expect(reset).toBeVisible()
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('ArrowUp')
    if (await layout.getByRole('alert').isVisible()) break
  }
  await expect(layout.getByRole('alert')).toContainText('Não dá para mover o móvel aí')
  const blocked = await at()

  // girar: muda a direção (ou avisa que não cabe)
  const facing = await bed.getAttribute('data-facing')
  await layout.getByRole('button', { name: '↻ Girar' }).click()
  await expect
    .poll(
      async () =>
        (await bed.getAttribute('data-facing')) !== facing ||
        (await layout.getByRole('alert').textContent())?.includes('girar'),
    )
    .toBe(true)

  // as posições ficam salvas no navegador
  const saved = await at()
  await page.reload()
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  expect(await at()).toEqual(saved)
  expect(saved).not.toEqual(start)
  expect(after).not.toEqual(start)
  expect(blocked).not.toEqual(start)

  // voltar às sugeridas
  await reset.click()
  expect(await at()).toEqual(start)
  await expect(reset).toHaveCount(0)

  // arrastar com o mouse/dedo: em cima da cômoda fica vermelho e não deixa
  const dresser = layout.getByRole('button', { name: /^Cômoda/ })
  await layout.locator('svg').scrollIntoViewIfNeeded()
  const from = (await bed.locator('rect').boundingBox())!
  const to = (await dresser.locator('rect').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 })
  await expect(bed).toHaveClass(/is-moving/)
  await expect(bed).toHaveClass(/is-invalid/)
  await page.mouse.up()
  await expect(layout.getByRole('alert')).toContainText('Não dá para pôr o móvel aí')
  expect(await at()).toEqual(start)
  // um pouco para a direita (lugar livre): vai
  const box = (await bed.locator('rect').boundingBox())!
  const svgBox = (await layout.locator('svg').boundingBox())!
  const pxPerCm = svgBox.width / (350 + 80)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 20 * pxPerCm, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(layout.getByRole('alert')).toHaveCount(0)
  expect(Number(await bed.getAttribute('data-x'))).toBe(Number(start[0]) + 20)
  await reset.click()

  // tirar a cama da lista (passo dos móveis): some da vista de cima e do 3D
  await toStep(page, 'Móveis')
  await page
    .locator('#room-quarto-1')
    .getByRole('article', { name: /^Cama \/ base box/ })
    .getByRole('button', { name: 'Recusar' })
    .click()
  await toStep(page, 'Posições em 3D')
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(layout.getByRole('button', { name: /^Criado-mudo/ }).first()).toBeVisible()
  await expect(bed).toHaveCount(0)
  await toStep(page, 'Projeto em 3D')
  await gen.getByRole('button', { name: '🔄 Atualizar o 3D' }).click()
  await page.waitForFunction(
    () => 'state' in ((window as unknown as { __house3d?: object }).__house3d ?? {}),
  )
  const inScene = await page.evaluate(() =>
    (
      window as unknown as { __house3d: { screenPosition: (id: string) => unknown } }
    ).__house3d.screenPosition('quarto-1:cama-box#0'),
  )
  expect(inScene).toBeUndefined()
})

test('posição dos móveis lista tudo do cômodo: no desenho ou "também neste cômodo"', async ({
  page,
}) => {
  await mockApi(page, {
    start: { '/api/floor-plan': { id: 'p1' } },
    jobs: { p1: [{ id: 'p1', status: 'done', result: apto }] },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByLabel('Orçamento em reais').fill('200000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Posições em 3D')

  const layout = page.locator('.furniture-layout')
  await layout.getByRole('tab', { name: 'Cozinha' }).click()
  // no desenho: lixeira, coifa (em cima do fogão), purificador
  for (const name of [/^Lixeira de cozinha/, /^Coifa/, /^Purificador/, /^Fogão/]) {
    await expect(layout.getByRole('button', { name })).toHaveCount(1)
  }
  // o resto da cozinha na lista do cômodo (bancada e guardados)
  const others = layout.locator('.layout-others')
  await others.locator('summary').click()
  await expect(others).toContainText('Micro-ondas')
  await expect(others).toContainText('Panelas')
  // recusar o micro-ondas (passo dos móveis) tira ele da lista do cômodo
  await toStep(page, 'Móveis')
  await page
    .locator('#room-cozinha')
    .getByRole('article', { name: /^Micro-ondas/ })
    .getByRole('button', { name: 'Recusar' })
    .click()
  await toStep(page, 'Posições em 3D')
  await layout.getByRole('tab', { name: 'Cozinha' }).click()
  await others.locator('summary').click()
  await expect(others).toContainText('Panelas')
  await expect(others).not.toContainText('Micro-ondas')

  await layout.getByRole('tab', { name: 'Banheiro 1' }).click()
  await expect(layout.getByRole('button', { name: /^Box de banheiro/ })).toHaveCount(1)
  await layout.getByRole('tab', { name: 'Lavanderia' }).click()
  await expect(layout.getByRole('button', { name: /^Varal/ })).toHaveCount(1)
})

test('planta sem área de serviço: a lavanderia entra na lista e fica na cozinha', async ({
  page,
}) => {
  const semLavanderia = JSON.parse(JSON.stringify(apto)) as {
    rooms: { type: string; label: string }[]
  }
  for (const r of semLavanderia.rooms) if (r.type === 'lavanderia') r.type = 'outro'
  await mockApi(page, {
    start: { '/api/floor-plan': { id: 'p1' } },
    jobs: { p1: [{ id: 'p1', status: 'done', result: semLavanderia }] },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  const summary = page.getByRole('status').filter({ hasText: 'Planta lida' })
  await expect(summary).toContainText('Lavanderia')
  await expect(summary).toContainText(
    'Lavanderia na cozinha: a planta não tem um espaço só para ela.',
  )
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByLabel('Orçamento em reais').fill('200000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  // a lista tem a lavanderia (máquina de lavar não some)
  await expect(
    page.locator('#room-lavanderia').getByRole('article', { name: /^Máquina de lavar/ }),
  ).toHaveCount(1)
  // no desenho do imóvel (passo das posições): "Cozinha + Lavanderia"
  await toStep(page, 'Posições em 3D')
  await expect(page.getByRole('button', { name: /^Cozinha \+ Lavanderia/ })).toHaveCount(1)
  // na posição dos móveis: sem aba própria; a máquina e o varal ficam na cozinha
  const layout = page.locator('.furniture-layout')
  await expect(layout.getByRole('tab', { name: 'Lavanderia' })).toHaveCount(0)
  await layout.getByRole('tab', { name: 'Cozinha' }).click()
  await expect(layout).toContainText('🧺 Lavanderia fica aqui')
  await expect(layout.getByRole('button', { name: /^Máquina de lavar/ })).toHaveCount(1)
  await expect(layout.getByRole('button', { name: /^Fogão/ })).toHaveCount(1)
})

test('trocar o sofá com as medidas: a posição dos móveis usa o tamanho do sofá novo', async ({
  page,
}) => {
  await mockApi(page, {
    start: { '/api/floor-plan': { id: 'p1' } },
    jobs: { p1: [{ id: 'p1', status: 'done', result: apto }] },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByLabel('Orçamento em reais').fill('200000')
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Posições em 3D')

  const layout = page.locator('.furniture-layout')
  await layout.getByRole('tab', { name: 'Sala' }).click()
  const sofa = layout.getByRole('button', { name: /^Sofá/ })
  const footprint = async () => {
    const rect = sofa.locator('rect')
    return [Number(await rect.getAttribute('width')), Number(await rect.getAttribute('height'))]
      .sort((a, b) => b - a)
      .join('×')
  }
  const before = await footprint()

  // trocar pelo sofá que eu achei, com as medidas dele (passo dos móveis)
  await toStep(page, 'Móveis')
  await page
    .locator('#room-sala')
    .getByRole('article', { name: /^Sofá:/ })
    .getByRole('button', { name: 'Trocar' })
    .click()
  await page.getByLabel('Preço unitário').fill('3.499,00')
  await page.getByLabel('Link do produto').fill('https://www.magazineluiza.com.br/sofa-retratil')
  await page.getByLabel('Largura em cm').fill('250')
  await page.getByRole('button', { name: 'Trocar', exact: true }).click()
  await expect(page.locator('.manual-error')).toContainText('Preencha as três medidas')
  await page.getByLabel('Profundidade em cm').fill('105')
  await page.getByLabel('Altura em cm').fill('95')
  await page.getByRole('button', { name: 'Trocar', exact: true }).click()

  const swap = page.getByRole('article', { name: /^Trocado por você \(Sofá\)/ })
  await expect(swap).toContainText('📐 250 × 105 × 95 cm')
  await toStep(page, 'Posições em 3D')
  await layout.getByRole('tab', { name: 'Sala' }).click()
  await expect.poll(footprint).toBe('250×105')
  expect(before).not.toBe('250×105')

  // fica no link/navegador: recarregar mantém a medida; editar mostra os valores
  await page.reload()
  await layout.getByRole('tab', { name: 'Sala' }).click()
  await expect.poll(footprint).toBe('250×105')
})

test('chat do projeto: a IA vê o projeto, sugere e só muda ao aplicar', async ({ page }) => {
  const calls = await mockApi(page, {
    health: { floorPlan: true, cheaperPrices: false, house3d: true, chat: true },
    start: { '/api/floor-plan': { id: 'p1' }, '/api/chat': { id: 'c1' } },
    jobs: { p1: [{ id: 'p1', status: 'done', result: apto }] },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Posições em 3D')

  const layout = page.locator('.furniture-layout')
  await layout.getByRole('tab', { name: 'Sala' }).click()
  const sofa = layout.getByRole('button', { name: /^Sofá/ })
  const rect = sofa.locator('rect')
  const [x, y, w, d] = await Promise.all(
    ['x', 'y', 'width', 'height'].map(async (a) => Number(await rect.getAttribute(a))),
  )
  const facing = await sofa.getAttribute('data-facing')
  // resposta da IA montada com a posição de agora: mesma posição (cabe), fora do cômodo (não
  // cabe) e tirar a poltrona da lista
  await page.route(`${API}/api/jobs/c1`, (route) =>
    route.fulfill({
      headers: CORS,
      json: {
        id: 'c1',
        status: 'done',
        costUsd: 0.12,
        result: {
          reply: 'O sofá fica bem na parede da janela. A poltrona aperta a passagem.',
          actions: [
            {
              type: 'move',
              room: 'sala',
              key: 'sala:sofa',
              unit: 0,
              xCm: x + w / 2,
              yCm: y + d / 2,
              rotation: facing,
            },
            {
              type: 'move',
              room: 'sala',
              key: 'sala:sofa',
              unit: 0,
              xCm: 5000,
              yCm: 10,
              rotation: 'down',
            },
            { type: 'remove', key: 'sala:poltrona' },
          ],
        },
      },
    }),
  )

  const chat = page.getByRole('region', { name: '💬 Converse sobre o projeto' })
  await chat.getByLabel('Mensagem').fill('A tomada da TV fica na parede da janela. O que acha?')
  await chat.getByRole('button', { name: 'Enviar' }).click()
  await expect(chat.getByRole('log')).toContainText('O sofá fica bem na parede da janela')
  await expect(chat).toContainText('US$ 0.12')

  // o pedido levou o projeto: cômodos com medidas e móveis no lugar, a lista e a conversa
  const request = JSON.parse(calls.find((c) => c.path === '/api/chat')!.body)
  expect(request.messages.at(-1)).toEqual({
    role: 'user',
    text: 'A tomada da TV fica na parede da janela. O que acha?',
  })
  const sala = request.rooms.find((r: { id: string }) => r.id === 'sala')
  expect(sala.furniture.map((f: { key: string }) => f.key)).toContain('sala:sofa')
  expect(sala.widthCm).toBeGreaterThan(0)
  expect(request.list.items.length).toBeGreaterThan(5)

  // nada mudou ainda; aplicar uma por uma
  const actions = chat.locator('.chat-actions li')
  await expect(actions).toHaveCount(3)
  await expect(page.getByRole('button', { name: /Voltar às posições sugeridas/ })).toHaveCount(0)
  await actions.nth(0).getByRole('button', { name: 'Aplicar' }).click()
  await expect(actions.nth(0)).toContainText('✓ aplicado')
  await expect(page.getByRole('button', { name: /Voltar às posições sugeridas/ })).toBeVisible()
  await actions.nth(1).getByRole('button', { name: 'Aplicar' }).click()
  await expect(actions.nth(1)).toContainText('✗ não coube')
  await expect(actions.nth(2)).toContainText('Tirar Poltrona da lista')
  await actions.nth(2).getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Poltrona recusado.')).toBeVisible()
  await expect(layout.getByRole('button', { name: /^Poltrona/ })).toHaveCount(0)

  // a conversa fica salva no navegador
  await page.reload()
  await expect(chat.getByRole('log')).toContainText('O sofá fica bem na parede da janela')
  await expect(chat.locator('.chat-actions li').nth(0)).toContainText('✓ aplicado')
})

test('planta + fotos no começo: leitura caprichada vira a planta do projeto', async ({ page }) => {
  const casaArmarios = JSON.parse(
    readFileSync('tests/fixtures/house-3d-armarios.json', 'utf8'),
  ) as unknown
  const calls = await mockApi(page, {
    health: { floorPlan: true, cheaperPrices: false, house3d: true },
    start: { '/api/house-3d': { id: 'h1' }, '/api/floor-plan': { id: 'p1' } },
    jobs: {
      h1: [{ id: 'h1', status: 'done', result: casaArmarios, costUsd: 0.45 }],
      p1: [{ id: 'p1', status: 'done', result: apto }],
    },
  })
  await page.goto('./')
  await turnOn(page, 'Planta da casa')
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.getByLabel(/Fotos dos cômodos/).setInputFiles([
    { name: 'cozinha.png', mimeType: 'image/png', buffer: pixel },
    { name: 'suite.png', mimeType: 'image/png', buffer: pixel },
  ])
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'apto.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') })

  // com fotos, a leitura vai para a skill /house-3d (planta, fotos e sem móveis ainda)
  const summary = page.getByRole('status').filter({ hasText: 'Planta lida' })
  await expect(summary).toContainText('2 Quartos')
  await expect(page.getByText(/^Lida com 2 foto\(s\):/)).toContainText('3 armário(s) embutido(s)')
  const post = calls.find((c) => c.path === '/api/house-3d')!
  expect(post.body).toContain('name="planta"; filename="apto.pdf"')
  expect(post.body.match(/name="fotos"/g)).toHaveLength(2)
  expect(calls.some((c) => c.path === '/api/floor-plan')).toBe(false)

  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()

  // sem gerar nada: a posição dos móveis já é a casa lida (medidas e armário da foto)
  await toStep(page, 'Posições em 3D')
  const layout = page.locator('.furniture-layout')
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(layout).toContainText('(da casa em 3D)')
  await expect(layout.getByLabel('Armário embutido (das fotos)')).toHaveCount(1)
  // e o projeto em 3D já abre essa casa
  await toStep(page, 'Projeto em 3D')
  await expect(page.locator('.house-3d-generate').getByRole('status')).toContainText(
    '3 armário(s) das fotos',
  )

  // ler outra planta sem fotos: leitura rápida, e a casa da leitura anterior sai
  await toStep(page, 'Móveis')
  await page.getByRole('button', { name: '← Cômodos' }).click()
  await page.getByLabel(/Fotos dos cômodos/).setInputFiles([])
  await page
    .getByLabel('Planta da casa (imagem ou PDF)')
    .setInputFiles({ name: 'outra.png', mimeType: 'image/png', buffer: Buffer.from('png') })
  await expect(page.getByRole('status').filter({ hasText: 'Planta lida' })).toBeVisible()
  expect(calls.filter((c) => c.path === '/api/floor-plan')).toHaveLength(1)
  await expect(page.getByText(/^Lida com \d foto/)).toHaveCount(0)
  await page.getByRole('button', { name: /^Continuar com/ }).click()
  await page.getByRole('button', { name: 'Montar minha lista' }).click()
  await toStep(page, 'Posições em 3D')
  await layout.getByRole('tab', { name: 'Quarto 1' }).click()
  await expect(layout).not.toContainText('(da casa em 3D)')
})
