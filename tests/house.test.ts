import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList, emptyChoices } from '../src/engine/budget.ts'
import {
  addRoomInstance,
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

describe('pôr mais um cômodo na lista (a planta tem mais do que a lista)', () => {
  const choices = {
    ...emptyChoices(),
    locked: { 'banheiro:chuveiro': 2 as const, 'sala:sofa': 1 as const },
    excluded: { 'banheiro:toalhas': 'owned' as const },
    variants: { 'banheiro:box-banheiro': 'x' },
    needs: { 'banheiro:lixeira-banheiro': 1 as const },
    manual: [
      {
        id: 'm1',
        instanceId: 'banheiro',
        name: 'Espelho',
        price: 100,
        qty: 1,
        url: 'https://x.com/e',
        replaces: 'banheiro:gabinete-banheiro',
      },
      { id: 'm2', instanceId: 'sala', name: 'Vaso', price: 50, qty: 1, url: 'https://x.com/v' },
    ],
  }

  it('de 1 para 2: o banheiro que existia vira "banheiro-1" e as escolhas dele vão junto', () => {
    const {
      house,
      choices: next,
      renamed,
    } = addRoomInstance({ banheiro: 1, sala: 1 }, 'banheiro', choices)
    expect(house).toEqual({ banheiro: 2, sala: 1 })
    expect(renamed).toEqual({ from: 'banheiro', to: 'banheiro-1' })
    expect(next.locked).toEqual({ 'banheiro-1:chuveiro': 2, 'sala:sofa': 1 })
    expect(next.excluded).toEqual({ 'banheiro-1:toalhas': 'owned' })
    expect(next.variants).toEqual({ 'banheiro-1:box-banheiro': 'x' })
    expect(next.needs).toEqual({ 'banheiro-1:lixeira-banheiro': 1 })
    expect(next.manual.map((m) => [m.instanceId, m.replaces])).toEqual([
      ['banheiro-1', 'banheiro-1:gabinete-banheiro'],
      ['sala', undefined],
    ])
    // os ids batem com a casa nova
    expect(expandHouse(rooms, {}, house).instances.map((i) => i.id)).toContain('banheiro-1')
  })

  it('de 0 para 1 ou de 2 para 3: nada muda de nome; acima do máximo, nada muda', () => {
    expect(addRoomInstance({ sala: 1 }, 'area-externa', choices)).toEqual({
      house: { sala: 1, 'area-externa': 1 },
      choices,
    })
    expect(addRoomInstance({ banheiro: 2 }, 'banheiro', choices).house).toEqual({ banheiro: 3 })
    expect(addRoomInstance({ banheiro: 5 }, 'banheiro', choices).house).toEqual({ banheiro: 5 })
  })
})
