import { describe, expect, it } from 'vitest'
import { products as realProducts, rooms as realRooms } from '../src/data/catalog-data.ts'
import { validateCatalog } from '../src/data/validate.ts'

const option = (tier: number, price: number, overrides: Record<string, unknown> = {}) => ({
  id: `geladeira-t${tier}`,
  tier,
  name: `Geladeira tier ${tier}`,
  price,
  priceUpdatedAt: '2026-10-22',
  store: 'amazon',
  url: `https://example.com/geladeira/${tier}`,
  bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
  ...overrides,
})

const fourTiers = () => [option(1, 2000), option(2, 3500), option(3, 7000), option(4, 15000)]

const products = (options: unknown[] = fourTiers()) => ({
  geladeira: { label: 'Geladeira', utensil: false, options },
})

const rooms = (category = 'geladeira') => ({
  cozinha: { name: 'Cozinha', items: [{ category, need: 5 }] },
})

function errorsOf(rawRooms: unknown, rawProducts: unknown): string[] {
  const result = validateCatalog(rawRooms, rawProducts)
  return result.ok ? [] : result.errors
}

describe('validateCatalog', () => {
  it('aceita o catálogo real em data/', () => {
    expect(errorsOf(realRooms, realProducts)).toEqual([])
  })

  it('aceita um catálogo mínimo válido e aplica qty = 1 por padrão', () => {
    const result = validateCatalog(rooms(), products())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.rooms.cozinha.items[0].qty).toBe(1)
  })

  it('aceita produto barato com menos de 4 tiers', () => {
    const cheap = [option(1, 149), option(2, 349)]
    expect(errorsOf(rooms(), products(cheap))).toEqual([])
  })

  it('exige os 4 tiers em produto caro', () => {
    const errors = errorsOf(rooms(), products([option(1, 2000), option(2, 3500)]))
    expect(errors).toEqual([
      'products/geladeira.json: produto caro (até R$ 3500) precisa dos 4 tiers — faltando tier 3, 4',
    ])
  })

  it('exige preços crescentes por tier', () => {
    const options = fourTiers()
    options[2].price = 3000
    expect(errorsOf(rooms(), products(options))).toContainEqual(
      'products/geladeira.json: preço do tier 3 (R$ 3000) deve ser maior que o do tier 2 (R$ 3500)',
    )
  })

  it('rejeita tier repetido', () => {
    const options = [...fourTiers(), option(4, 20000, { id: 'outra' })]
    expect(errorsOf(rooms(), products(options))).toContainEqual(
      'products/geladeira.json: tier 4 repetido',
    )
  })

  it('rejeita id repetido entre categorias', () => {
    const data = {
      ...products(),
      freezer: { label: 'Freezer', utensil: false, options: [option(1, 500)] },
    }
    expect(errorsOf(rooms(), data)).toContainEqual(
      'products/freezer.json: id "geladeira-t1" repetido (também em geladeira)',
    )
  })

  it.each([
    ['http (sem https)', 'http://example.com/x'],
    ['texto que não é URL', 'link-afiliado'],
  ])('rejeita URL inválida: %s', (_, url) => {
    const options = fourTiers()
    options[0] = option(1, 2000, { url })
    expect(errorsOf(rooms(), products(options))).toContainEqual(
      'products/geladeira.json › options.0.url: deve ser uma URL https válida',
    )
  })

  it.each([
    [['Um', 'Dois'].map((b) => `${b} bullet`), 'mínimo de 3 bullets'],
    [['1', '2', '3', '4', '5', '6'].map((b) => `Bullet ${b}`), 'máximo de 5 bullets'],
  ])('limita a quantidade de bullets (%#)', (bullets, message) => {
    const options = fourTiers()
    options[1] = option(2, 3500, { bullets })
    expect(errorsOf(rooms(), products(options))).toContainEqual(
      `products/geladeira.json › options.1.bullets: ${message}`,
    )
  })

  it('rejeita campos desconhecidos (pega erros de digitação)', () => {
    const options = fourTiers()
    options[0] = option(1, 2000, { prcie: 10 })
    expect(errorsOf(rooms(), products(options)).join('\n')).toMatch(
      /products\/geladeira\.json › options\.0.*prcie/,
    )
  })

  it('reporta erro de formato e de regra de negócio juntos', () => {
    const data = {
      geladeira: {
        label: 'Geladeira',
        utensil: false,
        options: [option(1, 2000), option(2, 3500)],
      },
      fogao: {
        label: 'Fogão',
        utensil: false,
        options: [option(1, 900, { id: 'fogao-t1', url: 'http://x' })],
      },
    }
    expect(errorsOf(rooms(), data)).toEqual([
      'products/fogao.json › options.0.url: deve ser uma URL https válida',
      'products/geladeira.json: produto caro (até R$ 3500) precisa dos 4 tiers — faltando tier 3, 4',
    ])
  })

  it('rejeita cômodo com categoria inexistente', () => {
    expect(errorsOf(rooms('lava-loucas'), products())).toEqual([
      'rooms.json › cozinha › lava-loucas: categoria não existe (falta products/lava-loucas.json)',
    ])
  })

  it.each([0, 6, 2.5, '5'])('rejeita necessidade fora de 1–5: %s', (need) => {
    const data = rooms()
    ;(data.cozinha.items[0] as { need: unknown }).need = need
    expect(errorsOf(data, products()).join('\n')).toMatch(/rooms\.json › cozinha\.items\.0\.need/)
  })

  it('exige o campo utensil na categoria', () => {
    const data = { geladeira: { label: 'Geladeira', options: fourTiers() } }
    expect(errorsOf(rooms(), data)).toContainEqual(
      'products/geladeira.json › utensil: informe true ou false',
    )
  })
})
