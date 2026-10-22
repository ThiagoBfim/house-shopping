import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { describeList, planList, type Choices } from '../src/engine/budget.ts'
import { expandHouse } from '../src/engine/house.ts'
import { decodeState, encodeState, STATE_VERSION, type ListState } from '../src/engine/share.ts'

const house = { cozinha: 1, quarto: 2, banheiro: 1 }
const expanded = expandHouse(rooms, products, house)

const choices: Choices = {
  locked: { 'cozinha:geladeira': 2, 'quarto-2:tv': 1 },
  excluded: { 'cozinha:fogao': 'owned', 'quarto-1:colchao': 'refused' },
  minNeed: 2,
  utensils: false,
}
const state: ListState = {
  house,
  budget: 40000,
  plan: planList(expanded.room, expanded.products, 40000, choices),
  choices,
}

const wire = (data: unknown) => compressToEncodedURIComponent(JSON.stringify(data))

describe('encodeState / decodeState', () => {
  it('ida e volta preserva o estado', () => {
    expect(decodeState(encodeState(state), rooms)).toEqual(state)
  })

  it('link compartilhado reproduz exatamente a mesma lista', () => {
    const decoded = decodeState(encodeState(state), rooms)!
    const again = expandHouse(rooms, products, decoded.house)
    const original = describeList(
      expanded.room,
      expanded.products,
      state.budget,
      state.plan,
      state.choices,
    )
    const shared = describeList(
      again.room,
      again.products,
      decoded.budget,
      decoded.plan,
      decoded.choices,
    )
    expect(shared).toEqual(original)
  })

  it('gera texto seguro para URL', () => {
    expect(encodeState(state)).toMatch(/^[A-Za-z0-9+\-$]+$/)
  })

  it.each([
    ['texto aleatório', 'isso-nao-e-um-estado'],
    ['vazio', ''],
    ['JSON que não é objeto', wire([1, 2])],
    ['versão diferente', wire({ v: STATE_VERSION + 1, h: { cozinha: 1 }, b: 1000 })],
    ['cômodo inexistente', wire({ v: STATE_VERSION, r: 'garagem', b: 1000 })],
    ['cômodo herdado de Object', wire({ v: STATE_VERSION, r: 'toString', b: 1000 })],
    ['casa sem nenhum cômodo válido', wire({ v: STATE_VERSION, h: { garagem: 2 }, b: 1000 })],
    ['sem casa nem cômodo', wire({ v: STATE_VERSION, b: 1000 })],
    ['orçamento inválido', wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: -5 })],
    ['orçamento não numérico', wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: '1000' })],
  ])('rejeita entrada inválida: %s', (_, encoded) => {
    expect(decodeState(encoded, rooms)).toBeUndefined()
  })

  it('descarta itens e valores desconhecidos (catálogo mudou)', () => {
    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        h: { cozinha: 1, quarto: 2 },
        b: 5000,
        p: {
          'cozinha:geladeira': 2,
          'cozinha:adega': 3,
          'quarto-3:colchao': 1,
          'cozinha:fogao': 9,
        },
        l: { 'quarto-1:colchao': 1, 'quarto-2:tv': 'x' },
        x: { 'cozinha:fogao': 'r', 'quarto-1:adega': 'o', 'quarto-2:cama-box': 'z' },
      }),
      rooms,
    )
    expect(decoded).toEqual({
      house: { cozinha: 1, quarto: 2 },
      budget: 5000,
      plan: { 'cozinha:geladeira': 2 },
      choices: {
        locked: { 'quarto-1:colchao': 1 },
        excluded: { 'cozinha:fogao': 'refused' },
        minNeed: 1,
        utensils: true,
      },
    })
  })

  it('converte link do formato antigo (um cômodo, chaves sem instância)', () => {
    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        r: 'cozinha',
        b: 5000,
        p: { geladeira: 2, adega: 3 },
        l: { freezer: 1 },
        x: { fogao: 'r' },
        n: 3,
        u: 0,
      }),
      rooms,
    )
    expect(decoded).toEqual({
      house: { cozinha: 1 },
      budget: 5000,
      plan: { 'cozinha:geladeira': 2 },
      choices: {
        locked: { 'cozinha:freezer': 1 },
        excluded: { 'cozinha:fogao': 'refused' },
        minNeed: 3,
        utensils: false,
      },
    })
  })

  it('lê os filtros e ignora necessidade inválida', () => {
    const decode = (extra: object) =>
      decodeState(wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: 5000, ...extra }), rooms)?.choices
    expect(decode({ n: 3, u: 0 })).toMatchObject({ minNeed: 3, utensils: false })
    expect(decode({ n: 9, u: 1 })).toMatchObject({ minNeed: 1, utensils: true })
  })

  it('não grava filtros no padrão', () => {
    const plain = { ...state, choices: { ...choices, minNeed: 1 as const, utensils: true } }
    const wireOf = (s: ListState) =>
      JSON.parse(decompressFromEncodedURIComponent(encodeState(s))) as Record<string, unknown>
    expect(wireOf(plain)).not.toHaveProperty('n')
    expect(wireOf(plain)).not.toHaveProperty('u')
    expect(wireOf(state)).toMatchObject({ n: 2, u: 0, h: house })
    expect(wireOf(state)).not.toHaveProperty('r')
  })
})
