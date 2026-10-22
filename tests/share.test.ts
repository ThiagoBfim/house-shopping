import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import realProducts from '../data/products.json'
import realRooms from '../data/rooms.json'
import type { Products, Rooms } from '../src/data/schema.ts'
import { describeList, planList, type Choices } from '../src/engine/budget.ts'
import { decodeState, encodeState, STATE_VERSION, type ListState } from '../src/engine/share.ts'

const rooms = realRooms as Rooms
const products = realProducts as Products
const room = rooms.cozinha

const choices: Choices = {
  locked: { geladeira: 2, freezer: 1 },
  excluded: { fogao: 'owned', liquidificador: 'refused' },
}
const state: ListState = {
  roomId: 'cozinha',
  budget: 20000,
  plan: planList(room, products, 20000, choices),
  choices,
}

const wire = (data: unknown) => compressToEncodedURIComponent(JSON.stringify(data))

describe('encodeState / decodeState', () => {
  it('ida e volta preserva o estado', () => {
    expect(decodeState(encodeState(state), rooms)).toEqual(state)
  })

  it('link compartilhado reproduz exatamente a mesma lista', () => {
    const decoded = decodeState(encodeState(state), rooms)!
    const original = describeList(room, products, state.budget, state.plan, state.choices)
    const shared = describeList(room, products, decoded.budget, decoded.plan, decoded.choices)
    expect(shared).toEqual(original)
  })

  it('gera texto seguro para URL e curto', () => {
    const encoded = encodeState(state)
    expect(encoded).toMatch(/^[A-Za-z0-9+\-$]+$/)
    expect(encoded.length).toBeLessThan(300)
  })

  it.each([
    ['texto aleatório', 'isso-nao-e-um-estado'],
    ['vazio', ''],
    ['JSON que não é objeto', wire([1, 2])],
    ['versão diferente', wire({ v: STATE_VERSION + 1, r: 'cozinha', b: 1000 })],
    ['cômodo inexistente', wire({ v: STATE_VERSION, r: 'garagem', b: 1000 })],
    ['cômodo herdado de Object', wire({ v: STATE_VERSION, r: 'toString', b: 1000 })],
    ['orçamento inválido', wire({ v: STATE_VERSION, r: 'cozinha', b: -5 })],
    ['orçamento não numérico', wire({ v: STATE_VERSION, r: 'cozinha', b: '1000' })],
  ])('rejeita entrada inválida: %s', (_, encoded) => {
    expect(decodeState(encoded, rooms)).toBeUndefined()
  })

  it('descarta categorias e valores desconhecidos (catálogo mudou)', () => {
    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        r: 'cozinha',
        b: 5000,
        p: { geladeira: 2, adega: 3, fogao: 9 },
        l: { freezer: 1, 'micro-ondas': 'x' },
        x: { fogao: 'r', adega: 'o', liquidificador: 'z', freezer: 1 },
      }),
      rooms,
    )
    expect(decoded).toEqual({
      roomId: 'cozinha',
      budget: 5000,
      plan: { geladeira: 2 },
      choices: { locked: { freezer: 1 }, excluded: { fogao: 'refused' } },
    })
  })

  it('aceita campos ausentes', () => {
    expect(decodeState(wire({ v: STATE_VERSION, r: 'cozinha', b: 5000 }), rooms)).toEqual({
      roomId: 'cozinha',
      budget: 5000,
      plan: {},
      choices: { locked: {}, excluded: {} },
    })
  })
})
