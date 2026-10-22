import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList } from '../src/engine/budget.ts'
import { exportFileName, listRows, listSheet } from '../src/engine/export.ts'
import { expandHouse } from '../src/engine/house.ts'
import { applyPreferences } from '../src/engine/preferences.ts'
import { emptyChoices } from '../src/engine/budget.ts'

const house = expandHouse(rooms, products, { cozinha: 1, quarto: 2, utilidades: 1 })
const custom = applyPreferences(house.room, house.products, emptyChoices())
const view = buildList(custom.room, custom.products, 60_000)

describe('exportar a lista', () => {
  const rows = listRows(view, house.instances)

  it('uma linha por item da lista, agrupada por cômodo na ordem da casa', () => {
    expect(rows).toHaveLength(view.entries.length)
    const rooms = rows.map((r) => r.room)
    expect([...new Set(rooms)]).toEqual(['Cozinha', 'Quarto 1', 'Quarto 2', 'Utilidades'])
    // cada cômodo aparece num bloco só
    expect(rooms).toEqual([...rooms].sort((a, b) => rooms.indexOf(a) - rooms.indexOf(b)))
  })

  it('nome, preço, quantidade, total e link do anúncio', () => {
    const regua = rows.find((r) => r.item === 'Régua de tomada')!
    expect(regua).toMatchObject({ room: 'Utilidades', qty: 3, store: 'Mercado Livre' })
    expect(regua.total).toBeCloseTo(regua.price * 3, 2)
    expect(regua.url).toMatch(/^https:\/\//)
    const entry = view.entries.find((e) => e.item.category === 'utilidades:filtro-de-linha')!
    expect(regua.product).toBe(entry.option.name)
  })

  it('planilha: cabeçalho, itens, total com fórmula, orçamento e saldo', () => {
    const sheet = listSheet(view, house.instances)
    expect(sheet.rows[0].map((c) => c && 'text' in c && c.text)).toEqual([
      'Cômodo',
      'Item',
      'Produto',
      'Qtd',
      'Preço unitário',
      'Total',
      'Loja',
      'Link do anúncio',
    ])
    const last = rows.length + 1
    const summary = sheet.rows.slice(-3)
    expect(summary[0][4]).toEqual({ text: 'Total da lista', bold: true })
    expect(summary[0][5]).toMatchObject({ formula: `SUM(F2:F${last})`, value: view.total })
    expect(summary[1][5]).toMatchObject({ number: 60_000 })
    expect(summary[2][4]).toMatchObject({ text: 'Saldo' })
    expect(sheet.rows[1][7]).toEqual({ link: rows[0].url })
  })

  it('lista acima do orçamento mostra "Faltam"; lista vazia soma zero', () => {
    const over = buildList(custom.room, custom.products, 100)
    expect(listSheet(over, house.instances).rows.at(-1)![4]).toMatchObject({ text: 'Faltam' })
    const empty = { ...view, entries: [], total: 0 }
    expect(listSheet(empty, house.instances).rows.at(-3)![5]).toMatchObject({ formula: '0' })
  })

  it('nome do arquivo com a data', () => {
    expect(exportFileName('2026-10-22')).toBe('lista-house-shopping-2026-10-22.xlsx')
  })
})
