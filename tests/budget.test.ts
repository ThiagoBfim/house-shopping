import { describe, expect, it } from 'vitest'
import { products as realProducts, rooms as realRooms } from '../src/data/catalog-data.ts'
import type { Products, Room, RoomItem, Tier } from '../src/data/schema.ts'
import {
  budgetPresets,
  budgetRange,
  buildList,
  describeList,
  emptyChoices,
  neighborOption,
  optionForTier,
  planList,
  sortedOptions,
  tierTotal,
  type Choices,
} from '../src/engine/budget.ts'

const category = (label: string, prices: number[]) => ({
  label,
  utensil: false,
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
  { category: 'geladeira', need: 5, qty: 1 },
  { category: 'fogao', need: 4, qty: 1 },
  { category: 'micro', need: 3, qty: 1 },
  { category: 'freezer', need: 2, qty: 1 },
  { category: 'liquidificador', need: 1, qty: 1 },
]
const room: Room = { name: 'Cozinha', items }

/** Soma do tier 1 de todos os itens. */
const CHEAPEST_TOTAL = 2000 + 900 + 500 + 150 + 1900

const choices = (partial: Partial<Choices> = {}): Choices => ({ ...emptyChoices(), ...partial })
const tiersOf = (budget: number, c = choices()) => planList(room, products, budget, c)

describe('planList', () => {
  it('orçamento baixo: inclui só os necessários (≥ 4), mesmo passando do orçamento', () => {
    const view = buildList(room, products, 2500)
    expect(view.entries.map((e) => e.item.category)).toEqual(['geladeira', 'fogao'])
    expect(view.skipped.map((e) => e.item.category)).toEqual(['micro', 'freezer', 'liquidificador'])
    expect(view.total).toBe(2900)
    expect(view.remaining).toBe(-400)
  })

  it('inclui da maior para a menor necessidade e pula o que não cabe', () => {
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

  it('upgrade vai primeiro para o item de maior necessidade', () => {
    expect(tiersOf(CHEAPEST_TOTAL + 1500).geladeira).toBe(2)
  })

  it('pula upgrade que não cabe e tenta o próximo item', () => {
    // 700 não paga a geladeira (+1500), mas paga o fogão (+700)
    expect(tiersOf(CHEAPEST_TOTAL + 700)).toMatchObject({ geladeira: 1, fogao: 2 })
  })

  it('distribui upgrades em vez de concentrar tudo num item', () => {
    // geladeira (5/1) → fogão (4/1) → micro (3/1) antes da geladeira de novo (5/2 = 2,5)
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
      items: [{ category: 'micro', need: 5, qty: 4 }],
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
        { category: 'a', need: 3, qty: 1 },
        { category: 'b', need: 3, qty: 1 },
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
      required: 2900,
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

  it('soma a economia dos recusados e dos "já tenho" pelo preço mais barato × quantidade', () => {
    const view = buildList(
      room,
      products,
      30000,
      choices({ excluded: { fogao: 'refused', micro: 'owned', freezer: 'owned' } }),
    )
    expect(view.saved).toEqual({ refused: 900, owned: 500 + 1900 })
    expect(view.excluded.find((e) => e.item.category === 'micro')?.saved).toBe(500)

    const fourMicros: Room = { name: 'Copa', items: [{ category: 'micro', need: 5, qty: 4 }] }
    const owned = buildList(fourMicros, products, 30000, choices({ excluded: { micro: 'owned' } }))
    expect(owned.saved).toEqual({ refused: 0, owned: 2000 })
  })

  it('sem exclusões, economia zero', () => {
    expect(buildList(room, products, 30000).saved).toEqual({ refused: 0, owned: 0 })
  })
})

describe('filtros', () => {
  /** Mesmo catálogo, com o liquidificador marcado como utensílio. */
  const withUtensil: Products = {
    ...products,
    liquidificador: { ...products.liquidificador, utensil: true },
  }

  it('necessidade mínima esconde os itens abaixo dela e libera o dinheiro', () => {
    const view = buildList(room, products, CHEAPEST_TOTAL, choices({ minNeed: 3 }))
    expect(view.entries.map((e) => e.item.category)).toEqual(['geladeira', 'fogao', 'micro'])
    expect(view.filtered).toEqual([
      expect.objectContaining({ label: 'Freezer', reason: 'need' }),
      expect.objectContaining({ label: 'Liquidificador', reason: 'need' }),
    ])
    // o que seria do freezer e do liquidificador vira upgrade
    expect(view.entries.some((e) => e.option.tier > 1)).toBe(true)
  })

  it('sem utensílios esconde as categorias marcadas como utensílio', () => {
    const view = buildList(room, withUtensil, 1_000_000, choices({ utensils: false }))
    expect(view.entries.map((e) => e.item.category)).not.toContain('liquidificador')
    expect(view.filtered).toEqual([
      expect.objectContaining({ label: 'Liquidificador', reason: 'utensil' }),
    ])
  })

  it('facilitadores ficam fora até o usuário incluir', () => {
    const withHelper: Products = {
      ...products,
      liquidificador: { ...products.liquidificador, helper: true },
    }
    const off = buildList(room, withHelper, 1_000_000)
    expect(off.entries.map((e) => e.item.category)).not.toContain('liquidificador')
    expect(off.filtered).toEqual([
      expect.objectContaining({ label: 'Liquidificador', reason: 'helper' }),
    ])
    const on = buildList(room, withHelper, 1_000_000, choices({ helpers: true }))
    expect(on.entries.find((e) => e.item.category === 'liquidificador')?.helper).toBe(true)
    expect(on.entries.find((e) => e.item.category === 'fogao')?.helper).toBe(false)
  })

  it('marca os utensílios na lista', () => {
    const view = buildList(room, withUtensil, 1_000_000)
    const blender = view.entries.find((e) => e.item.category === 'liquidificador')
    expect(blender?.utensil).toBe(true)
    expect(view.entries.find((e) => e.item.category === 'fogao')?.utensil).toBe(false)
  })

  it('filtro vence a trava; recusado continua em "recusados"', () => {
    const view = buildList(
      room,
      products,
      30000,
      choices({ minNeed: 4, locked: { freezer: 4 }, excluded: { micro: 'owned' } }),
    )
    expect(view.entries.map((e) => e.item.category)).toEqual(['geladeira', 'fogao'])
    expect(view.excluded.map((e) => e.item.category)).toEqual(['micro'])
    expect(view.filtered.map((e) => e.item.category)).toEqual(['freezer', 'liquidificador'])
  })

  it('budgetRange considera só os itens que passam pelos filtros', () => {
    expect(budgetRange(room, withUtensil, { minNeed: 2, utensils: false, helpers: false })).toEqual(
      {
        required: 2900,
        allCheapest: 2000 + 900 + 500 + 1900,
        allTop: 15000 + 8000 + 3300 + 9000,
      },
    )
  })
})

describe('tierTotal / budgetPresets', () => {
  it('soma todos os itens no tier pedido (tier inexistente usa o mais próximo abaixo)', () => {
    expect(tierTotal(room, products, 1)).toBe(CHEAPEST_TOTAL)
    expect(tierTotal(room, products, 2)).toBe(3500 + 1600 + 900 + 3000 + 350)
    expect(tierTotal(room, products, 4)).toBe(15000 + 8000 + 3300 + 9000 + 350)
  })

  it('respeita os filtros', () => {
    expect(tierTotal(room, products, 1, { minNeed: 4, utensils: true, helpers: false })).toBe(2900)
  })

  it('três opções arredondadas para cima, em ordem crescente', () => {
    expect(budgetPresets(room, products)).toEqual([
      { id: 'economico', tier: 1, value: 6000 },
      { id: 'equilibrado', tier: 2, value: 10000 },
      { id: 'premium', tier: 3, value: 17000 },
    ])
  })

  it('com o orçamento premium, os itens mais necessários ficam no tier 3 ou acima', () => {
    const premium = budgetPresets(room, products)[2].value
    const view = buildList(room, products, premium)
    for (const category of ['geladeira', 'fogao']) {
      const entry = view.entries.find((e) => e.item.category === category)
      expect(entry?.option.tier).toBeGreaterThanOrEqual(3)
    }
  })
})
