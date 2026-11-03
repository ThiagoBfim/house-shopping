import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList, emptyChoices } from '../src/engine/budget.ts'
import {
  bedSizeForArea,
  contentsByInstance,
  parseFloorPlan,
  planToHouse,
  setRoomType,
  withoutBedVariants,
} from '../src/engine/floor-plan.ts'
import { expandHouse } from '../src/engine/house.ts'
import { replaceWith } from '../src/engine/manual.ts'
import { applyPreferences } from '../src/engine/preferences.ts'
// Resposta real da skill /floor-plan para um apartamento de 2 quartos (Drop 31).
import apto from './fixtures/floor-plan-apto.json'

const room = (partial: object) => ({
  type: 'quarto',
  label: 'Quarto',
  areaM2: 10,
  openings: [],
  x: 0,
  y: 0,
  width: 0.5,
  height: 0.5,
  ...partial,
})

describe('parseFloorPlan', () => {
  it('aceita a resposta real da skill', () => {
    const plan = parseFloorPlan(apto)!
    expect(plan.aspect).toBe(1.5)
    expect(plan.rooms).toHaveLength(11)
    expect(plan.notes).toContain('Circulação')
  })

  it('descarta cômodos inválidos e corrige o que dá', () => {
    const plan = parseFloorPlan({
      aspect: 9,
      notes: 4,
      rooms: [
        room({ label: '  Suíte  ', areaM2: -3, width: 0.9, x: 0.5 }),
        room({ x: 1.5 }),
        room({ type: 3 }),
        room({ label: '' }),
        'lixo',
        null,
        room({ instanceId: 'quarto-2' }),
      ],
    })!
    expect(plan.aspect).toBe(1)
    expect(plan.notes).toBe('')
    expect(plan.rooms).toEqual([
      {
        type: 'quarto',
        label: 'Suíte',
        areaM2: null,
        openings: [],
        x: 0.5,
        y: 0,
        width: 0.5,
        height: 0.5,
      },
      {
        type: 'quarto',
        label: 'quarto',
        areaM2: 10,
        openings: [],
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
      },
      {
        type: 'quarto',
        label: 'Quarto',
        areaM2: 10,
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        openings: [],
        instanceId: 'quarto-2',
      },
    ])
    expect(parseFloorPlan({ rooms: 'x' })).toBeUndefined()
    expect(parseFloorPlan(null)).toBeUndefined()
    expect(
      parseFloorPlan({ rooms: Array.from({ length: 40 }, () => room({})) })!.rooms,
    ).toHaveLength(30)
  })
})

describe('portas e janelas', () => {
  it('ficam as válidas; o resto é descartado', () => {
    const plan = parseFloorPlan({
      aspect: 1,
      notes: '',
      rooms: [
        room({
          openings: [
            { kind: 'door', wall: 'bottom', position: 0.2, widthCm: 80 },
            { kind: 'window', wall: 'top', position: 0.5, widthCm: 150 },
            { kind: 'porta', wall: 'top', position: 0.5, widthCm: 80 },
            { kind: 'door', wall: 'teto', position: 0.5, widthCm: 80 },
            { kind: 'door', wall: 'left', position: 1.4, widthCm: 80 },
            { kind: 'door', wall: 'left', position: 0.5, widthCm: 10 },
            'lixo',
          ],
        }),
        room({ openings: 'x' }),
      ],
    })!
    expect(plan.rooms[0].openings).toEqual([
      { kind: 'door', wall: 'bottom', position: 0.2, widthCm: 80 },
      { kind: 'window', wall: 'top', position: 0.5, widthCm: 150 },
    ])
    expect(plan.rooms[1].openings).toEqual([])
  })
})

describe('bedSizeForArea', () => {
  it.each([
    [7, 'solteiro'],
    [9, 'casal'],
    [11.9, 'casal'],
    [12, 'queen'],
    [15.9, 'queen'],
    [16, 'king'],
  ])('%s m² → %s', (area, size) => expect(bedSizeForArea(area)).toBe(size))
})

describe('planToHouse', () => {
  const read = planToHouse(parseFloorPlan(apto)!, rooms)

  it('conta os cômodos de cada tipo; utilidades entra sempre', () => {
    expect(read.house).toEqual({
      quarto: 2,
      banheiro: 3,
      sala: 1,
      cozinha: 1,
      lavanderia: 1,
      'area-externa': 1,
      utilidades: 1,
    })
    expect(read.ignored).toEqual(['Circulação', 'Closet'])
    expect(read.aspect).toBe(1.5)
  })

  it('o maior quarto vira o Quarto 1; cada cômodo ligado a um cômodo da casa', () => {
    const label = (instanceId: string) => read.rooms.find((r) => r.instanceId === instanceId)?.label
    expect(label('quarto-1')).toBe('Suíte')
    expect(label('quarto-2')).toBe('Dorm. 2')
    expect(label('banheiro-1')).toBe('Banho')
    expect(label('banheiro-3')).toBe('Lavabo')
    expect(read.rooms.find((r) => r.label === 'Closet')).not.toHaveProperty('instanceId')
    // as ligações existem na casa montada
    const instances = expandHouse(rooms, products, read.house).instances.map((i) => i.id)
    for (const r of read.rooms) if (r.instanceId) expect(instances).toContain(r.instanceId)
  })

  it('cama pelo tamanho: suíte de 14 m² queen, quarto de 9 m² casal (cama, colchão e roupa de cama)', () => {
    expect(read.variants['quarto-1:cama-box']).toBe('queen')
    expect(read.variants['quarto-1:colchao']).toBe('queen')
    expect(read.variants['quarto-2:cama-box']).toBe('casal')
    expect(read.variants['quarto-2:jogo-de-cama']).toBe('casal')
    // as variantes valem no motor
    const house = expandHouse(rooms, products, read.house)
    const choices = { ...emptyChoices(), variants: read.variants }
    const custom = applyPreferences(house.room, house.products, choices)
    const view = buildList(custom.room, custom.products, 1_000_000, choices)
    expect(view.entries.find((e) => e.item.category === 'quarto-1:cama-box')?.variant).toBe('queen')
  })

  it('excedentes acima de 5 e área desconhecida (sem cama escolhida)', () => {
    const many = planToHouse(
      parseFloorPlan({
        aspect: 1,
        notes: '',
        rooms: [
          ...Array.from({ length: 6 }, (_, i) => room({ label: `Q${i}`, areaM2: 10 + i })),
          room({ type: 'quarto', label: 'Sem área', areaM2: null }),
          room({ type: 'utilidades', label: 'Utilidades?' }),
          room({ type: 'garagem', label: 'Garagem' }),
        ],
      })!,
      rooms,
    )
    expect(many.house.quarto).toBe(5)
    expect(many.ignored).toEqual(['Utilidades?', 'Garagem', 'Q0', 'Sem área'])
    expect(planToHouse({ aspect: 1, notes: '', rooms: [] }, rooms).house).toEqual({})
  })

  it('ler de novo troca as ligações antigas', () => {
    const again = planToHouse(
      {
        aspect: 1,
        notes: '',
        rooms: [{ ...room({ type: 'outro' }), openings: [], instanceId: 'quarto-1' }],
      },
      rooms,
    )
    expect(again.rooms[0]).not.toHaveProperty('instanceId')
  })
})

describe('contentsByInstance', () => {
  it('categorias da lista e itens do usuário (trocas com a categoria trocada)', () => {
    const house = expandHouse(rooms, products, { cozinha: 1, quarto: 2 })
    const choices = replaceWith(
      {
        ...emptyChoices(),
        manual: [
          {
            id: 'a',
            instanceId: 'quarto-2',
            name: 'Abajur',
            price: 80,
            qty: 1,
            url: 'https://a.com',
          },
        ],
      },
      {
        id: 'b',
        instanceId: 'cozinha',
        name: 'Geladeira X',
        price: 3000,
        qty: 1,
        url: 'https://b.com',
        replaces: 'cozinha:geladeira',
      },
    )
    const view = buildList(house.room, house.products, 1_000_000, choices)
    const contents = contentsByInstance(view)
    expect(contents.cozinha.categories).not.toContain('geladeira')
    expect(contents.cozinha.categories).toContain('fogao')
    expect(contents.cozinha.manual).toEqual([{ name: 'Geladeira X', category: 'geladeira' }])
    expect(contents['quarto-2'].manual).toEqual([{ name: 'Abajur' }])
    expect(contents['quarto-1'].categories.length).toBeGreaterThan(0)
  })
})

describe('mudar o tipo de um cômodo', () => {
  const plan = parseFloorPlan(apto)!
  const dorm2 = plan.rooms.findIndex((r) => r.label === 'Dorm. 2')

  it('quarto vira quarto do bebê: um quarto a menos, sem cama de casal nele', () => {
    const read = planToHouse(setRoomType(plan, dorm2, 'quarto-bebe'), rooms)
    expect(read.house).toMatchObject({ quarto: 1, 'quarto-bebe': 1 })
    expect(read.rooms[dorm2].instanceId).toBe('quarto-bebe')
    // a suíte agora é o único quarto ("quarto", sem número) e continua queen
    expect(read.rooms.find((r) => r.label === 'Suíte')?.instanceId).toBe('quarto')
    expect(read.variants).toMatchObject({ 'quarto:cama-box': 'queen' })
    expect(Object.keys(read.variants).some((k) => k.startsWith('quarto-2'))).toBe(false)
    // a planta original não muda
    expect(plan.rooms[dorm2].type).toBe('quarto')
  })

  it('quarto vira escritório; hall vira escritório; cômodo sai da lista', () => {
    expect(planToHouse(setRoomType(plan, dorm2, 'escritorio'), rooms).house).toMatchObject({
      quarto: 1,
      escritorio: 1,
    })
    const hall = plan.rooms.findIndex((r) => r.label === 'Circulação')
    expect(planToHouse(setRoomType(plan, hall, 'escritorio'), rooms).house.escritorio).toBe(1)
    const out = planToHouse(setRoomType(plan, dorm2, 'outro'), rooms)
    expect(out.house.quarto).toBe(1)
    expect(out.ignored).toContain('Dorm. 2')
  })

  it('withoutBedVariants: tira só as camas dos quartos', () => {
    expect(
      withoutBedVariants({
        'quarto-1:cama-box': 'queen',
        'quarto:colchao': 'casal',
        'quarto-2:jogo-de-cama': 'casal',
        'quarto-1:tv': 'grande',
        'quarto-bebe:berco': 'x',
        'cozinha:fogao': 'cooktop-inducao',
      }),
    ).toEqual({
      'quarto-1:tv': 'grande',
      'quarto-bebe:berco': 'x',
      'cozinha:fogao': 'cooktop-inducao',
    })
  })
})
