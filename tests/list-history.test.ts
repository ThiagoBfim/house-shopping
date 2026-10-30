import { describe, expect, it } from 'vitest'
import type { ListEntry, ListView } from '../src/engine/budget.ts'
import { listChange, priceOn } from '../src/engine/list-history.ts'
import type { PricePoint, ProductOption } from '../src/data/schema.ts'

const option = (id: string, history?: PricePoint[]): ProductOption => {
  const price = history ? history[history.length - 1].price : 100
  const url = `https://www.mercadolivre.com.br/p/MLB${id.length}`
  return {
    id,
    tier: 1,
    name: `Produto ${id}`,
    price,
    priceUpdatedAt: '2026-10-30',
    store: 'mercadolivre',
    url,
    bullets: ['Bullet um', 'Bullet dois', 'Bullet três'],
    ...(history && {
      offers: [
        { store: 'mercadolivre', url, price, updatedAt: '2026-10-30', available: true, history },
      ],
    }),
  }
}

const entry = (key: string, opt: ProductOption, qty = 1): ListEntry =>
  ({
    item: { category: key, need: 3, qty },
    label: key,
    option: opt,
    options: [opt],
    subtotal: opt.price * qty,
    locked: false,
    utensil: false,
    helper: false,
  }) as ListEntry

const view = (entries: ListEntry[], manual = 0): ListView => ({
  entries,
  manual: [],
  skipped: [],
  excluded: [],
  filtered: [],
  budget: 10_000,
  total: entries.reduce((sum, e) => sum + e.subtotal, manual),
  remaining: 0,
  saved: { refused: 0, owned: 0 },
})

const fridge = option('geladeira', [
  { date: '2026-10-01', price: 4000 },
  { date: '2026-10-23', price: 3800 },
  { date: '2026-10-30', price: 3500 },
])
const towel = option('toalha', [
  { date: '2026-10-22', price: 50 },
  { date: '2026-10-29', price: 60 },
])
const generic = option('tapete')

describe('priceOn', () => {
  const history = fridge.offers![0].history!
  it('preço em vigor na data', () => {
    expect(priceOn(history, '2026-10-22')).toBe(4000)
    expect(priceOn(history, '2026-10-23')).toBe(3800)
    expect(priceOn(history, '2026-10-31')).toBe(3500)
  })
  it('antes do primeiro ponto, vale o primeiro', () => {
    expect(priceOn(history, '2026-01-01')).toBe(4000)
  })
})

describe('listChange', () => {
  const list = view(
    [entry('geladeira', fridge), entry('toalha', towel, 4), entry('tapete', generic)],
    80,
  )

  it('de ontem para hoje: só a geladeira mudou', () => {
    const change = listChange(list, '2026-10-30', 1)
    expect(change).toMatchObject({ since: '2026-10-29', from: 4220, to: 3920, delta: -300 })
    expect(change.items).toEqual([
      {
        key: 'geladeira',
        label: 'geladeira',
        name: 'Produto geladeira',
        qty: 1,
        from: 3800,
        to: 3500,
        delta: -300,
      },
    ])
  })

  it('de uma semana para outra: soma as mudanças e conta a quantidade', () => {
    const change = listChange(list, '2026-10-30', 7)
    // em 23/10: geladeira 3800 + 4 toalhas a 50 + tapete 100 + manual 80
    expect(change).toMatchObject({ since: '2026-10-23', from: 4180, to: 3920, delta: -260 })
    expect(change.items.map((i) => [i.key, i.delta])).toEqual([
      ['geladeira', -300],
      ['toalha', 40],
    ])
  })

  it('pontos do gráfico: o total na data de comparação e nos dias em que mudou', () => {
    expect(listChange(list, '2026-10-30', 7).points).toEqual([
      { date: '2026-10-23', price: 4180, carried: true },
      { date: '2026-10-29', price: 4220 },
      { date: '2026-10-30', price: 3920 },
    ])
  })

  it('sem histórico no período: variação zero', () => {
    const change = listChange(view([entry('tapete', generic)]), '2026-10-30', 30)
    expect(change).toMatchObject({ delta: 0, items: [] })
    expect(change.points).toHaveLength(1)
  })
})
