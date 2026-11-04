import { compressToEncodedURIComponent } from 'lz-string'
import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { describeList, planList, type Choices } from '../src/engine/budget.ts'
import { expandHouse } from '../src/engine/house.ts'
import { MAX_MANUAL_ITEMS } from '../src/engine/manual.ts'
import {
  decodeState,
  encodeState,
  pack,
  STATE_VERSION,
  unpack,
  type ListState,
} from '../src/engine/share.ts'

const house = { cozinha: 1, quarto: 2, banheiro: 1 }
const expanded = expandHouse(rooms, products, house)

const choices: Choices = {
  locked: { 'cozinha:geladeira': 2, 'quarto-2:tv': 1 },
  excluded: { 'cozinha:fogao': 'owned', 'quarto-1:colchao': 'refused' },
  minNeed: 2,
  utensils: false,
  helpers: true,
  variants: { 'quarto-2:cama-box': 'queen' },
  needs: { 'cozinha:air-fryer': 1 },
  manual: [
    {
      id: 'm1',
      instanceId: 'quarto-2',
      name: 'Cadeira Tok&Stok',
      price: 399.9,
      qty: 4,
      url: 'https://www.amazon.com.br/dp/B0TESTE',
    },
    {
      id: 'm2',
      instanceId: 'cozinha',
      name: 'Fruteira',
      price: 59,
      qty: 1,
      url: 'https://x.com/a',
    },
  ],
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
        helpers: false,
        variants: {},
        needs: {},
        manual: [],
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
        helpers: false,
        variants: {},
        needs: {},
        manual: [],
      },
    })
  })

  it('lê os filtros e ignora necessidade inválida', () => {
    const decode = (extra: object) =>
      decodeState(wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: 5000, ...extra }), rooms)?.choices
    expect(decode({ n: 3, u: 0, f: 1 })).toMatchObject({
      minNeed: 3,
      utensils: false,
      helpers: true,
    })
    expect(decode({ n: 9, u: 1 })).toMatchObject({ minNeed: 1, utensils: true, helpers: false })
  })

  it('lê variantes e necessidades ajustadas, descartando itens fora da casa e valores inválidos', () => {
    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        h: { cozinha: 1 },
        b: 5000,
        t: { 'cozinha:fogao': 'cooktop-inducao', 'quarto-1:colchao': 'queen', 'cozinha:tv': 3 },
        e: { 'cozinha:air-fryer': 1, 'cozinha:forno': 9 },
      }),
      rooms,
    )
    expect(decoded?.choices.variants).toEqual({ 'cozinha:fogao': 'cooktop-inducao' })
    expect(decoded?.choices.needs).toEqual({ 'cozinha:air-fryer': 1 })
  })

  it('não grava filtros no padrão', () => {
    const plain = {
      ...state,
      choices: {
        ...choices,
        minNeed: 1 as const,
        utensils: true,
        helpers: false,
        variants: {},
        needs: {},
        manual: [],
      },
    }
    const wireOf = (s: ListState) => JSON.parse(unpack(encodeState(s))!) as Record<string, unknown>
    expect(wireOf(plain)).not.toHaveProperty('n')
    expect(wireOf(plain)).not.toHaveProperty('u')
    expect(wireOf(plain)).not.toHaveProperty('f')
    expect(wireOf(plain)).not.toHaveProperty('t')
    expect(wireOf(plain)).not.toHaveProperty('e')
    expect(wireOf(plain)).not.toHaveProperty('m')
    expect(wireOf(state)).toMatchObject({ n: 2, u: 0, f: 1, h: house })
    expect(wireOf(state)).not.toHaveProperty('r')
  })

  it('itens adicionados: quantidade 1 não vai no link', () => {
    const wireOf = (s: ListState) => JSON.parse(unpack(encodeState(s))!) as Record<string, unknown>
    expect(wireOf(state).m).toEqual([
      ['quarto-2', 'Cadeira Tok&Stok', 399.9, 'https://www.amazon.com.br/dp/B0TESTE', 4],
      ['cozinha', 'Fruteira', 59, 'https://x.com/a'],
    ])
  })

  it('itens adicionados: descarta inválidos e de cômodos fora da casa; ids pela posição', () => {
    const ok = 'https://loja.com/p'
    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        h: { cozinha: 1, quarto: 2 },
        b: 5000,
        m: [
          ['cozinha', ' Mesa ', 300, ok],
          ['banheiro', 'Toalha', 50, ok],
          ['quarto-3', 'Abajur', 80, ok],
          ['quarto-1', 'Abajur', 80, ok, 2],
          ['cozinha', '', 10, ok],
          ['cozinha', 'Grátis', 0, ok],
          ['cozinha', 'Caro', 2_000_000, ok],
          ['cozinha', 'Script', 10, 'javascript:alert(1)'],
          ['cozinha', 'Muitos', 10, ok, 100],
          ['cozinha', 'Meio', 10, ok, 1.5],
          ['cozinha', 10, 'Trocado', ok],
          'lixo',
        ],
      }),
      rooms,
    )
    expect(decoded?.choices.manual).toEqual([
      { id: 'm1', instanceId: 'cozinha', name: 'Mesa', price: 300, qty: 1, url: ok },
      { id: 'm2', instanceId: 'quarto-1', name: 'Abajur', price: 80, qty: 2, url: ok },
    ])
    const notArray = decodeState(
      wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: 5000, m: { x: 1 } }),
      rooms,
    )
    expect(notArray?.choices.manual).toEqual([])
  })

  it('link só com letras e números (o WhatsApp quebra em "-" e "+")', () => {
    expect(encodeState(state)).toMatch(/^0[0-9A-Za-z]+$/)
    expect(decodeState(encodeState(state), rooms)).toEqual(
      decodeState(wire(JSON.parse(unpack(encodeState(state))!)), rooms),
    )
  })

  it('links antigos (com "-" e "+") continuam abrindo', () => {
    const old = wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: 5000, p: {}, l: {}, x: {} })
    expect(old).toMatch(/^N/)
    expect(decodeState(old, rooms)?.budget).toBe(5000)
  })

  it('links de produto salvos com rastreamento vão limpos no link compartilhado', () => {
    const dirty = {
      ...state.choices.manual[1],
      url: 'https://www.mercadolivre.com.br/x/p/MLB1#tracking_id=abc',
    }
    const withDirty = { ...state, choices: { ...state.choices, manual: [dirty] } }
    expect(decodeState(encodeState(withDirty), rooms)?.choices.manual[0].url).toBe(
      'https://www.mercadolivre.com.br/x/p/MLB1',
    )
  })

  it('pack/unpack: ida e volta; lixo = undefined', () => {
    expect(unpack(pack('{"a":1}'))).toBe('{"a":1}')
    expect(unpack('0zz')).toBeUndefined()
    expect(unpack('0-x')).toBeUndefined()
    expect(unpack('0')).toBeUndefined()
    expect(unpack('lixo')).toBeUndefined()
  })

  it('trocas: ida e volta; item fora da casa, de outro cômodo ou repetido vira item comum', () => {
    const ok = 'https://loja.com/p'
    const swap = { ...state.choices.manual[1], replaces: 'cozinha:geladeira' }
    const withSwap = { ...state, choices: { ...state.choices, manual: [swap] } }
    expect(decodeState(encodeState(withSwap), rooms)?.choices.manual).toEqual([
      { ...swap, id: 'm1' },
    ])

    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        h: { cozinha: 1, quarto: 1 },
        b: 5000,
        m: [
          ['cozinha', 'Fogão bom', 900, ok, 1, 'cozinha:fogao'],
          ['cozinha', 'Outro fogão', 800, ok, 1, 'cozinha:fogao'],
          ['cozinha', 'Colchão', 900, ok, 1, 'quarto:colchao'],
          ['cozinha', 'Nada', 10, ok, 1, 'cozinha:nao-existe'],
          ['cozinha', 'Número', 10, ok, 1, 42],
        ],
      }),
      rooms,
    )
    expect(decoded?.choices.manual.map((m) => m.replaces)).toEqual([
      'cozinha:fogao',
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('itens adicionados: no máximo MAX_MANUAL_ITEMS', () => {
    const many = Array.from({ length: 40 }, (_, i) => ['cozinha', `Item ${i}`, 10, 'https://a.com'])
    const decoded = decodeState(
      wire({ v: STATE_VERSION, h: { cozinha: 1 }, b: 5000, m: many }),
      rooms,
    )
    expect(decoded?.choices.manual).toHaveLength(MAX_MANUAL_ITEMS)
  })

  it('respostas do assistente: ida e volta; formato inválido é descartado', () => {
    const answers = { limpeza: ['robo'], 'ja-tenho': ['geladeira', 'tv'] }
    expect(decodeState(encodeState({ ...state, answers }), rooms)?.answers).toEqual(answers)
    // sem respostas, o campo nem vai no link
    expect(decodeState(encodeState(state), rooms)).not.toHaveProperty('answers')

    const decoded = decodeState(
      wire({
        v: STATE_VERSION,
        h: { cozinha: 1 },
        b: 5000,
        a: { limpeza: ['robo', 7, 'NÃO VALE'], cafe: 'coado', 'x y': ['a'], vazio: [] },
      }),
      rooms,
    )
    expect(decoded?.answers).toEqual({ limpeza: ['robo'] })
  })
})

describe('medidas do produto trocado no link', () => {
  const sofa = { width: 210, depth: 92.5, height: 85 }
  const withSizes: ListState = {
    ...state,
    choices: {
      ...choices,
      manual: [
        {
          id: 'm1',
          instanceId: 'quarto-2',
          name: 'Cama nova',
          price: 1999,
          qty: 1,
          url: 'https://x.com/c',
          replaces: 'quarto-2:cama-box',
          dimensions: { width: 160, depth: 200, height: 45 },
        },
        {
          id: 'm2',
          instanceId: 'cozinha',
          name: 'Fruteira',
          price: 59,
          qty: 1,
          url: 'https://x.com/a',
          dimensions: sofa,
        },
        {
          id: 'm3',
          instanceId: 'cozinha',
          name: 'Sem medida',
          price: 10,
          qty: 2,
          url: 'https://x.com/b',
        },
      ],
    },
  }

  it('ida e volta preserva as medidas (troca e item só adicionado)', () => {
    const decoded = decodeState(encodeState(withSizes), rooms)!
    expect(decoded.choices.manual).toEqual(withSizes.choices.manual)
  })

  it('medida inválida no link é ignorada (o item fica, com a medida típica)', () => {
    const encoded = wire({
      v: STATE_VERSION,
      h: house,
      b: 40000,
      p: {},
      l: {},
      x: {},
      m: [['cozinha', 'Fruteira', 59, 'https://x.com/a', 1, '', [0, 'x', 80]]],
    })
    const decoded = decodeState(encoded, rooms)!
    expect(decoded.choices.manual).toHaveLength(1)
    expect(decoded.choices.manual[0]).not.toHaveProperty('dimensions')
  })
})
