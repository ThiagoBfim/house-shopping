import { describe, expect, it } from 'vitest'
import type { Products, Room } from '../src/data/schema.ts'
import { buildList, emptyChoices, type Choices } from '../src/engine/budget.ts'
import { applyPreferences, chosenVariant } from '../src/engine/preferences.ts'

const opt = (id: string, tier: 1 | 2 | 3 | 4, price: number, variants?: string[]) => ({
  id,
  tier,
  name: id,
  price,
  priceUpdatedAt: '2026-10-22',
  store: 'mercadolivre' as const,
  url: `https://example.com/${id}`,
  bullets: ['a b c', 'd e f', 'g h i'],
  available: true,
  ...(variants && { variants }),
})

const products: Products = {
  fogao: {
    label: 'Fogão ou cooktop',
    utensil: false,
    variants: [
      { id: 'piso', label: 'Fogão de piso' },
      { id: 'inducao', label: 'Cooktop de indução' },
    ],
    options: [
      opt('piso-1', 1, 900, ['piso']),
      opt('piso-2', 2, 1800, ['piso']),
      opt('inducao-1', 1, 1500, ['inducao']),
      opt('inducao-2', 2, 2500, ['inducao']),
    ],
  },
  airfryer: { label: 'Air fryer', utensil: false, options: [opt('af', 1, 400)] },
}
const room: Room = {
  name: 'Cozinha',
  items: [
    { category: 'fogao', need: 5, qty: 1 },
    { category: 'airfryer', need: 3, qty: 1 },
  ],
}
const choices = (partial: Partial<Choices> = {}): Choices => ({ ...emptyChoices(), ...partial })

describe('preferências (variantes e necessidade ajustada)', () => {
  it('sem escolha, usa a primeira variante', () => {
    const custom = applyPreferences(room, products, choices())
    expect(custom.products.fogao.options.map((o) => o.id)).toEqual(['piso-1', 'piso-2'])
  })

  it('com escolha, só a escada da variante entra no motor', () => {
    const custom = applyPreferences(room, products, choices({ variants: { fogao: 'inducao' } }))
    expect(custom.products.fogao.options.map((o) => o.id)).toEqual(['inducao-1', 'inducao-2'])
    const view = buildList(
      custom.room,
      custom.products,
      1700,
      choices({ variants: { fogao: 'inducao' } }),
    )
    expect(view.entries[0]).toMatchObject({ variant: 'inducao', option: { id: 'inducao-1' } })
    expect(view.entries[0].variants?.map((v) => v.id)).toEqual(['piso', 'inducao'])
  })

  it('variante desconhecida (link antigo) cai na padrão', () => {
    expect(chosenVariant(products.fogao.variants!, 'gas')).toBe('piso')
    const custom = applyPreferences(room, products, choices({ variants: { fogao: 'gas' } }))
    expect(custom.products.fogao.options.map((o) => o.id)).toEqual(['piso-1', 'piso-2'])
  })

  it('necessidade ajustada muda a prioridade do item', () => {
    const custom = applyPreferences(room, products, choices({ needs: { airfryer: 1 } }))
    expect(custom.room.items.find((i) => i.category === 'airfryer')?.need).toBe(1)
    const view = buildList(custom.room, custom.products, 5000, choices({ minNeed: 2 }))
    expect(view.filtered.map((f) => f.item.category)).toEqual(['airfryer'])
  })

  it('itens sem variantes não aparecem com variants na lista', () => {
    const custom = applyPreferences(room, products, choices())
    const view = buildList(custom.room, custom.products, 5000)
    expect(view.entries.find((e) => e.item.category === 'airfryer')).not.toHaveProperty('variants')
  })
})

describe('motor sem applyPreferences', () => {
  it('categoria com variantes usa a escada padrão (sem travar no loop de upgrades)', () => {
    const view = buildList(room, products, 100_000)
    expect(view.entries.find((e) => e.item.category === 'fogao')?.option.id).toBe('piso-2')
  })
})
