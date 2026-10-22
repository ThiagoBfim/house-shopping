import { describe, expect, it } from 'vitest'
import {
  assistant as realAssistant,
  products as realProducts,
  rooms as realRooms,
} from '../src/data/catalog-data.ts'
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
  it('aceita o catálogo real em data/ (com as perguntas do assistente)', () => {
    expect(validateCatalog(realRooms, realProducts, realAssistant)).toMatchObject({ ok: true })
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

  describe('variantes', () => {
    const withVariants = (options: unknown[], variants = ['piso', 'cooktop']) => ({
      geladeira: {
        label: 'Fogão ou cooktop',
        utensil: false,
        variants: variants.map((id) => ({ id, label: `Tipo ${id}` })),
        options,
      },
    })
    const piso = (tier: number, price: number) =>
      option(tier, price, { id: `piso-${tier}`, variants: ['piso'] })
    const cooktop = (tier: number, price: number) =>
      option(tier, price, { id: `cooktop-${tier}`, variants: ['cooktop'] })

    it('cada variante tem a sua escada de tiers (o mesmo tier pode repetir entre variantes)', () => {
      const options = [piso(1, 300), piso(2, 600), cooktop(1, 400), cooktop(2, 800)]
      expect(errorsOf(rooms(), withVariants(options))).toEqual([])
    })

    it('uma opção pode entrar em várias variantes', () => {
      const options = [
        piso(1, 300),
        option(2, 600, { id: 'serve-nos-dois', variants: ['piso', 'cooktop'] }),
        cooktop(1, 400),
      ]
      expect(errorsOf(rooms(), withVariants(options))).toEqual([])
    })

    it('aplica as regras de tier dentro de cada variante', () => {
      const options = [
        piso(1, 300),
        option(1, 350, { id: 'piso-outro', variants: ['piso'] }),
        cooktop(1, 2000),
        cooktop(2, 1500),
      ]
      expect(errorsOf(rooms(), withVariants(options))).toEqual([
        'products/geladeira.json (variante piso): tier 1 repetido',
        'products/geladeira.json (variante cooktop): produto caro (até R$ 2000) precisa dos 4 tiers — faltando tier 3, 4',
        'products/geladeira.json (variante cooktop): preço do tier 2 (R$ 1500) deve ser maior que o do tier 1 (R$ 2000)',
      ])
    })

    it('rejeita opção sem variante, variante inexistente e variante vazia', () => {
      const options = [
        option(1, 300, { id: 'sem-variante' }),
        option(2, 600, { id: 'variante-errada', variants: ['inducao'] }),
        piso(3, 900),
      ]
      expect(errorsOf(rooms(), withVariants(options))).toEqual([
        'products/geladeira.json: "sem-variante" precisa dizer em quais variantes entra',
        'products/geladeira.json: "variante-errada" usa a variante "inducao", que não existe',
        'products/geladeira.json: variante "cooktop" sem nenhuma opção',
      ])
    })

    it('rejeita variants na opção quando a categoria não tem variantes', () => {
      const options = [option(1, 149, { variants: ['piso'] })]
      expect(errorsOf(rooms(), products(options))).toEqual([
        'products/geladeira.json: "geladeira-t1" tem variants, mas a categoria não declara variantes',
      ])
    })
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
