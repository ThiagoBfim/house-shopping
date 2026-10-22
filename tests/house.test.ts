import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList, emptyChoices } from '../src/engine/budget.ts'
import {
  describeSpec,
  expandHouse,
  itemKey,
  MAX_PER_ROOM,
  normalizeSpec,
  roomCount,
  splitItemKey,
} from '../src/engine/house.ts'

describe('chaves de item', () => {
  it('ida e volta, mesmo com categoria que tem hífen', () => {
    expect(itemKey('quarto-2', 'ar-condicionado')).toBe('quarto-2:ar-condicionado')
    expect(splitItemKey('quarto-2:ar-condicionado')).toEqual({
      instanceId: 'quarto-2',
      category: 'ar-condicionado',
    })
  })
})

describe('normalizeSpec / roomCount / describeSpec', () => {
  it('descarta cômodo inexistente, zero e não inteiro; limita o máximo; segue a ordem do catálogo', () => {
    const spec = normalizeSpec(
      { garagem: 1, quarto: 2, cozinha: 1, sala: 0, banheiro: 1.5, 'area-externa': 99 },
      rooms,
    )
    expect(spec).toEqual({ cozinha: 1, quarto: 2, 'area-externa': MAX_PER_ROOM })
    expect(Object.keys(spec)).toEqual(['cozinha', 'quarto', 'area-externa'])
    expect(roomCount(spec)).toBe(3 + MAX_PER_ROOM)
  })

  it('descreve a casa em pt-BR', () => {
    expect(describeSpec({ cozinha: 1 }, rooms)).toBe('Cozinha')
    expect(describeSpec({ cozinha: 1, quarto: 2, 'quarto-bebe': 2, banheiro: 1 }, rooms)).toBe(
      'Cozinha, 2 Quartos, 2 Quartos do bebê e Banheiro',
    )
    expect(describeSpec({ 'area-externa': 2 }, rooms)).toBe('2 Áreas externas')
  })
})

describe('expandHouse', () => {
  const spec = { cozinha: 1, quarto: 2, 'quarto-bebe': 1, banheiro: 1 }
  const house = expandHouse(rooms, products, spec)

  it('cria uma instância por cômodo, numerando os repetidos', () => {
    expect(house.instances.map((i) => [i.id, i.title])).toEqual([
      ['cozinha', 'Cozinha'],
      ['quarto-1', 'Quarto 1'],
      ['quarto-2', 'Quarto 2'],
      ['quarto-bebe', 'Quarto do bebê'],
      ['banheiro', 'Banheiro'],
    ])
  })

  it('junta todos os itens com chave por instância e apelida o catálogo', () => {
    const expected =
      rooms.cozinha.items.length +
      2 * rooms.quarto.items.length +
      rooms['quarto-bebe'].items.length +
      rooms.banheiro.items.length
    expect(house.room.items).toHaveLength(expected)
    expect(house.room.items.map((i) => i.category)).toContain('quarto-2:colchao')
    expect(house.products['quarto-2:colchao']).toBe(products.colchao)
    expect(Object.keys(house.products)).toHaveLength(expected)
  })

  it('um orçamento só para a casa: necessários de todos os cômodos entram primeiro', () => {
    const { room, products: aliased } = house
    const view = buildList(room, aliased, 60000, emptyChoices())
    expect(view.remaining).toBeGreaterThanOrEqual(0)
    const included = new Set(view.entries.map((e) => e.item.category))
    for (const key of [
      'cozinha:geladeira',
      'quarto-1:colchao',
      'quarto-2:colchao',
      'quarto-bebe:berco',
      'banheiro:chuveiro',
    ]) {
      expect(included).toContain(key)
    }
  })

  it('recusar o colchão do Quarto 1 não mexe no do Quarto 2', () => {
    const choices = { ...emptyChoices(), excluded: { 'quarto-1:colchao': 'refused' as const } }
    const view = buildList(house.room, house.products, 60000, choices)
    const keys = view.entries.map((e) => e.item.category)
    expect(keys).not.toContain('quarto-1:colchao')
    expect(keys).toContain('quarto-2:colchao')
  })

  it('casa vazia', () => {
    expect(expandHouse(rooms, products, {}).room.items).toEqual([])
  })
})
