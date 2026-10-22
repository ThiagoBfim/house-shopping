import { describe, expect, it } from 'vitest'
import realProducts from '../data/products.json'
import realRooms from '../data/rooms.json'
import type { Products, Room, RoomItem, Tier } from '../src/data/schema.ts'
import {
  budgetRange,
  buildList,
  describeList,
  emptyChoices,
  neighborOption,
  optionForTier,
  planList,
  sortedOptions,
  type Choices,
} from '../src/engine/budget.ts'

const category = (label: string, prices: number[]) => ({
  label,
  options: prices.map((price, i) => ({
    id: `${label.toLowerCase()}-${i + 1}`,
    tier: (i + 1) as Tier,
    name: `${label} ${i + 1}`,
    price,
    priceUpdatedAt: '2026-10-22',
    store: 'other' as const,
    url: 'https://example.com',
    bullets: ['a', 'b', 'c'],
  })),
})

const products: Products = {
  geladeira: category('Geladeira', [2000, 3500, 7000, 15000]),
  fogao: category('Fogao', [900, 1600, 3300, 8000]),
  micro: category('Micro', [500, 900, 1500, 3300]),
  liquidificador: category('Liquidificador', [150, 350]),
  freezer: category('Freezer', [1900, 3000, 4500, 9000]),
}

const items: RoomItem[] = [
  { category: 'geladeira', priority: 'essential', weight: 10, qty: 1 },
  { category: 'fogao', priority: 'essential', weight: 9, qty: 1 },
  { category: 'micro', priority: 'important', weight: 6, qty: 1 },
  { category: 'liquidificador', priority: 'important', weight: 3, qty: 1 },
  { category: 'freezer', priority: 'optional', weight: 4, qty: 1 },
]
const room: Room = { name: 'Cozinha', items }

/** Soma do tier 1 de todos os itens. */
const CHEAPEST_TOTAL = 2000 + 900 + 500 + 150 + 1900

const choices = (partial: Partial<Choices> = {}): Choices => ({ ...emptyChoices(), ...partial })
const tiersOf = (budget: number, c = choices()) => planList(room, products, budget, c)

describe('planList', () => {
  it('orçamento baixo: inclui só os essenciais, mesmo passando do orçamento', () => {
    const view = buildList(room, products, 2500)
    expect(view.entries.map((e) => e.item.category)).toEqual(['geladeira', 'fogao'])
    expect(view.skipped.map((e) => e.item.category)).toEqual(['micro', 'liquidificador', 'freezer'])
    expect(view.total).toBe(2900)
    expect(view.remaining).toBe(-400)
  })

  it('inclui importantes antes dos desejáveis e pula o que não cabe', () => {
    expect(tiersOf(3550)).toEqual({ geladeira: 1, fogao: 1, micro: 1, liquidificador: 1 })
  })

  it('orçamento exato: tudo no tier mais barato e saldo zero', () => {
    const view = buildList(room, products, CHEAPEST_TOTAL)
    expect(view.entries.every((e) => e.option.tier === 1)).toBe(true)
    expect(view.remaining).toBe(0)
  })

  it('orçamento alto: tudo no tier mais caro', () => {
    expect(tiersOf(1_000_000)).toEqual({
      geladeira: 4,
      fogao: 4,
      micro: 4,
      liquidificador: 2,
      freezer: 4,
    })
  })

  it('upgrade vai primeiro para o item de maior peso', () => {
    expect(tiersOf(CHEAPEST_TOTAL + 1500).geladeira).toBe(2)
  })

  it('pula upgrade que não cabe e tenta o próximo item', () => {
    // 700 não paga a geladeira (+1500), mas paga o fogão (+700)
    expect(tiersOf(CHEAPEST_TOTAL + 700)).toMatchObject({ geladeira: 1, fogao: 2 })
  })

  it('distribui upgrades em vez de concentrar tudo num item', () => {
    // geladeira (10/1) → fogão (9/1) → micro (6/1) antes da geladeira de novo (10/2 = 5)
    const plan = tiersOf(CHEAPEST_TOTAL + 1500 + 700 + 400)
    expect(plan).toMatchObject({ geladeira: 2, fogao: 2, micro: 2, freezer: 1 })
  })

  it('respeita item travado, mesmo acima do orçamento', () => {
    const view = buildList(room, products, 10000, choices({ locked: { geladeira: 4 } }))
    expect(view.entries.map((e) => [e.item.category, e.option.tier, e.locked])).toEqual([
      ['geladeira', 4, true],
      ['fogao', 1, false],
    ])
    expect(view.remaining).toBe(10000 - 15000 - 900)
  })

  it('não faz upgrade de item travado', () => {
    expect(tiersOf(1_000_000, choices({ locked: { geladeira: 1 } })).geladeira).toBe(1)
  })

  it('tudo travado: o plano é exatamente o travado', () => {
    const locked: Record<string, Tier> = {
      geladeira: 2,
      fogao: 3,
      micro: 1,
      liquidificador: 2,
      freezer: 1,
    }
    expect(tiersOf(1_000_000, choices({ locked }))).toEqual(locked)
  })

  it('item recusado sai e o dinheiro liberado vira upgrade', () => {
    const budget = CHEAPEST_TOTAL
    const before = buildList(room, products, budget)
    const after = buildList(room, products, budget, choices({ excluded: { geladeira: 'refused' } }))
    expect(after.entries.find((e) => e.item.category === 'geladeira')).toBeUndefined()
    expect(after.excluded).toEqual([
      expect.objectContaining({ label: 'Geladeira', reason: 'refused' }),
    ])
    expect(after.entries.some((e) => e.option.tier > 1)).toBe(true)
    expect(after.total).toBeGreaterThan(before.total - 2000)
  })

  it('tudo recusado: lista vazia', () => {
    const excluded = Object.fromEntries(items.map((i) => [i.category, 'owned' as const]))
    const view = buildList(room, products, 30000, choices({ excluded }))
    expect(view.entries).toEqual([])
    expect(view.skipped).toEqual([])
    expect(view.excluded).toHaveLength(items.length)
    expect(view.total).toBe(0)
    expect(view.remaining).toBe(30000)
  })

  it('multiplica pela quantidade', () => {
    const chairs: Room = {
      name: 'Sala',
      items: [{ category: 'micro', priority: 'essential', weight: 5, qty: 4 }],
    }
    expect(buildList(chairs, products, 2000).total).toBe(2000)
    expect(planList(chairs, products, 3599, emptyChoices())).toEqual({ micro: 1 })
    expect(planList(chairs, products, 3600, emptyChoices())).toEqual({ micro: 2 })
  })

  it('soma centavos sem erro de ponto flutuante', () => {
    const cheap: Products = { a: category('A', [0.1]), b: category('B', [0.2]) }
    const tiny: Room = {
      name: 'X',
      items: [
        { category: 'a', priority: 'important', weight: 1, qty: 1 },
        { category: 'b', priority: 'important', weight: 1, qty: 1 },
      ],
    }
    const view = buildList(tiny, cheap, 0.3)
    expect(view.entries).toHaveLength(2)
    expect(view.total).toBe(0.3)
    expect(view.remaining).toBe(0)
  })

  it('é determinístico, independente da ordem dos itens no JSON', () => {
    const shuffled: Room = { ...room, items: [...items].reverse() }
    for (const budget of [2500, 8000, 20000, 33333]) {
      const expected = tiersOf(budget)
      expect(planList(room, products, budget, emptyChoices())).toEqual(expected)
      expect(planList(shuffled, products, budget, emptyChoices())).toEqual(expected)
      expect(buildList(shuffled, products, budget)).toEqual(buildList(room, products, budget))
    }
  })

  it('nunca passa do orçamento quando os essenciais cabem', () => {
    for (let budget = CHEAPEST_TOTAL; budget <= 45000; budget += 777) {
      expect(buildList(room, products, budget).remaining).toBeGreaterThanOrEqual(0)
    }
  })

  it('funciona com o catálogo real (Cozinha, R$ 30.000)', () => {
    const view = buildList(realRooms.cozinha as Room, realProducts as Products, 30000)
    expect(view.entries.length).toBeGreaterThan(0)
    expect(view.remaining).toBeGreaterThanOrEqual(0)
  })
})

describe('describeList', () => {
  it('escolhas atuais têm precedência sobre o plano (sem reload)', () => {
    const plan = tiersOf(CHEAPEST_TOTAL)
    const view = describeList(
      room,
      products,
      CHEAPEST_TOTAL,
      plan,
      choices({ locked: { fogao: 3 }, excluded: { freezer: 'refused' } }),
    )
    expect(view.entries.find((e) => e.item.category === 'fogao')?.option.tier).toBe(3)
    expect(view.entries.find((e) => e.item.category === 'freezer')).toBeUndefined()
    // o dinheiro do freezer não é redistribuído até o reload
    expect(view.entries.filter((e) => e.option.tier > 1).map((e) => e.item.category)).toEqual([
      'fogao',
    ])
  })

  it('lista em ordem de importância e mostra a opção mais barata dos que não couberam', () => {
    const view = buildList(room, products, 2900)
    expect(view.skipped[0]).toMatchObject({ label: 'Micro', cheapest: { price: 500 } })
  })
})

describe('helpers de opções', () => {
  const options = sortedOptions(products, 'liquidificador')

  it('optionForTier usa o tier mais próximo quando o pedido não existe', () => {
    expect(optionForTier(options, 2).tier).toBe(2)
    expect(optionForTier(options, 4).tier).toBe(2)
    const onlyUpper = options.filter((o) => o.tier === 2)
    expect(optionForTier(onlyUpper, 1).tier).toBe(2)
  })

  it('neighborOption retorna undefined nos extremos', () => {
    expect(neighborOption(options, 1, -1)).toBeUndefined()
    expect(neighborOption(options, 1, 1)?.tier).toBe(2)
    expect(neighborOption(options, 2, 1)).toBeUndefined()
    expect(neighborOption(options, 2, -1)?.tier).toBe(1)
  })
})

describe('budgetRange', () => {
  it('calcula mínimo dos essenciais, tudo barato e tudo no topo', () => {
    expect(budgetRange(room, products)).toEqual({
      essentials: 2900,
      allCheapest: CHEAPEST_TOTAL,
      allTop: 15000 + 8000 + 3300 + 350 + 9000,
    })
  })
})

describe('excluded', () => {
  it('informa a opção mais barata do item excluído (para reativar)', () => {
    const view = buildList(room, products, 30000, choices({ excluded: { fogao: 'refused' } }))
    expect(view.excluded[0]).toMatchObject({ label: 'Fogao', cheapest: { tier: 1, price: 900 } })
  })
})
