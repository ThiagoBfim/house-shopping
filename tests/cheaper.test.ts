import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import {
  buildList,
  describeList,
  emptyChoices,
  planList,
  type Choices,
} from '../src/engine/budget.ts'
import { applyPriceFinds, priceItems } from '../src/engine/cheaper.ts'
import { listRowRefs, listRows } from '../src/engine/export.ts'
import { expandHouse } from '../src/engine/house.ts'
import { MAX_MANUAL_ITEMS, type ManualItem } from '../src/engine/manual.ts'
import { applyPreferences } from '../src/engine/preferences.ts'

const house = expandHouse(rooms, products, { cozinha: 1, quarto: 1 })
const abajur: ManualItem = {
  id: 'a1',
  instanceId: 'quarto',
  name: 'Abajur',
  price: 100,
  qty: 2,
  url: 'https://loja.com/abajur',
}
const base: Choices = { ...emptyChoices(), manual: [abajur] }
const listOf = (choices: Choices) => {
  const custom = applyPreferences(house.room, house.products, choices)
  return buildList(custom.room, custom.products, 60_000, choices)
}
const view = listOf(base)
const refs = listRowRefs(view, house.instances)
const rows = listRows(view, house.instances)
/** Linha da planilha (1ª linha de itens = 2) do item. */
const rowOf = (match: (ref: (typeof refs)[number]) => boolean) => refs.findIndex(match) + 2

describe('listRowRefs', () => {
  it('uma referência por linha da planilha, na mesma ordem', () => {
    expect(refs).toHaveLength(rows.length)
    const geladeira = rowOf((r) => r.kind === 'catalog' && r.key === 'cozinha:geladeira')
    expect(rows[geladeira - 2].item).toBe('Geladeira')
    const manual = rowOf((r) => r.kind === 'manual' && r.id === 'a1')
    expect(rows[manual - 2].product).toBe('Abajur')
  })
})

describe('priceItems', () => {
  it('os mais caros primeiro, com a linha da planilha de cada um', () => {
    const items = priceItems(view, house.instances, 3)
    expect(items).toHaveLength(3)
    const totals = items.map((i) => i.preco * i.qtd)
    expect(totals).toEqual([...totals].sort((a, b) => b - a))
    for (const item of items) {
      const row = rows[item.row - 2]
      expect(item).toEqual({
        row: item.row,
        produto: row.product,
        qtd: row.qty,
        preco: row.price,
        loja: row.store,
        link: row.url,
      })
    }
    expect(priceItems(view, house.instances, 999)).toHaveLength(rows.length)
  })
})

describe('applyPriceFinds', () => {
  const geladeira = view.entries.find((e) => e.item.category === 'cozinha:geladeira')!
  const rowGeladeira = rowOf((r) => r.kind === 'catalog' && r.key === 'cozinha:geladeira')
  const rowAbajur = rowOf((r) => r.kind === 'manual' && r.id === 'a1')

  it('item do catálogo vira troca; item do usuário tem preço e link novos', () => {
    const result = applyPriceFinds(base, view, refs, [
      {
        row: rowGeladeira,
        status: 'melhor',
        preco: geladeira.option.price - 300.004,
        loja: ' Magalu ',
        link: 'https://www.magazineluiza.com.br/geladeira/p/123/?utm_source=google',
      },
      {
        row: rowAbajur,
        status: 'melhor',
        preco: 80,
        loja: 'Tok&Stok',
        link: 'https://tokstok.com.br/a',
      },
    ])
    const swap = result.choices.manual.find((m) => m.replaces === 'cozinha:geladeira')!
    expect(swap).toMatchObject({
      instanceId: 'cozinha',
      name: geladeira.option.name,
      price: Math.round((geladeira.option.price - 300.004) * 100) / 100,
      qty: 1,
      url: 'https://www.magazineluiza.com.br/geladeira/p/123/',
      found: { store: 'Magalu', was: geladeira.option.price },
    })
    expect(result.choices.manual.find((m) => m.id === 'a1')).toMatchObject({
      price: 80,
      url: 'https://tokstok.com.br/a',
      found: { store: 'Tok&Stok', was: 100 },
    })
    // maior economia primeiro; a do abajur conta a quantidade (2 × R$ 20)
    expect(result.applied.map((a) => a.saving)).toEqual([300, 40])
    expect(result.skipped).toBe(0)
    // sem recalcular (o que a pessoa vê), o total cai exatamente pela economia
    const custom = applyPreferences(house.room, house.products, base)
    const plan = planList(custom.room, custom.products, 60_000, base)
    const after = describeList(custom.room, custom.products, 60_000, plan, result.choices)
    expect(after.total).toBeCloseTo(view.total - 340, 2)
    // a lista original não muda
    expect(base.manual).toHaveLength(1)
  })

  it('ignora o que não é preço melhor, preço maior, sem link e linhas fora da planilha', () => {
    const result = applyPriceFinds(base, view, refs, [
      { row: rowGeladeira, status: 'sem preço melhor' },
      {
        row: rowGeladeira,
        status: 'melhor',
        preco: geladeira.option.price + 1,
        link: 'https://a.com',
      },
      { row: rowGeladeira, status: 'melhor', preco: 10 },
      { row: rowGeladeira, status: 'melhor', preco: 10, link: 'javascript:alert(1)' },
      { row: rowAbajur, status: 'melhor', preco: 100, link: 'https://a.com' },
      { row: 9999, status: 'melhor', preco: 1, link: 'https://a.com' },
    ])
    expect(result.choices).toBe(base)
    expect(result.applied).toEqual([])
  })

  it('busca de novo num item já trocado: atualiza a troca e guarda o preço original', () => {
    const first = applyPriceFinds(base, view, refs, [
      { row: rowGeladeira, status: 'melhor', preco: 1000, loja: 'A', link: 'https://a.com/g' },
    ]).choices
    const view2 = listOf(first)
    const refs2 = listRowRefs(view2, house.instances)
    const swap = first.manual.find((m) => m.replaces)!
    const row = refs2.findIndex((r) => r.kind === 'manual' && r.id === swap.id) + 2
    const second = applyPriceFinds(first, view2, refs2, [
      { row, status: 'melhor', preco: 900, link: 'https://b.com/g' },
    ])
    expect(second.choices.manual.find((m) => m.id === swap.id)).toMatchObject({
      price: 900,
      found: { store: 'outra loja', was: geladeira.option.price },
    })
  })

  it('item que saiu da lista durante a busca é ignorado', () => {
    const changed = listOf({ ...base, excluded: { 'cozinha:geladeira': 'owned' } })
    const result = applyPriceFinds(base, changed, refs, [
      { row: rowGeladeira, status: 'melhor', preco: 10, link: 'https://a.com' },
    ])
    expect(result.applied).toEqual([])
  })

  it('respeita o limite de itens adicionados', () => {
    const full: Choices = {
      ...base,
      manual: Array.from({ length: MAX_MANUAL_ITEMS }, (_, i) => ({ ...abajur, id: `m${i}` })),
    }
    const result = applyPriceFinds(full, view, refs, [
      { row: rowGeladeira, status: 'melhor', preco: 10, link: 'https://a.com' },
    ])
    expect(result.skipped).toBe(1)
    expect(result.applied).toEqual([])
  })
})
