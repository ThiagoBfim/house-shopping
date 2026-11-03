import { describe, expect, it } from 'vitest'
import { products, rooms } from '../src/data/catalog-data.ts'
import { buildList, emptyChoices } from '../src/engine/budget.ts'
import { expandHouse } from '../src/engine/house.ts'
import {
  builtInPlaced,
  furnishHouse,
  furnitureForSkill,
  linkRooms,
  parseHouseModel,
  type HouseModel,
} from '../src/engine/house3d.ts'
import {
  applySuggestions,
  arrangeRoom,
  clearPositions,
  hintOf,
  setPosition,
  tryMove,
} from '../src/engine/layout.ts'

const room = (partial: object) => ({
  type: 'quarto',
  label: 'Suíte',
  xM: 0,
  yM: 0,
  widthM: 3.5,
  depthM: 4,
  openings: [],
  finishes: { floor: 'madeira', floorColor: '#b88a5f', wallColor: '#f2efe8', fromPhoto: true },
  furniture: [],
  ...partial,
})

const model = (rooms: unknown[]): unknown => ({ widthM: 10, depthM: 8, rooms, notes: ' ok ' })

describe('parseHouseModel', () => {
  it('aceita o modelo e completa o que falta com o comum do tipo', () => {
    const parsed = parseHouseModel(
      model([
        room({
          openings: [
            { kind: 'door', wall: 'right', position: 0.8, widthCm: 80, hinge: 'end', swing: 'in' },
            {
              kind: 'window',
              wall: 'left',
              position: 0.5,
              widthCm: 140,
              sillCm: 100,
              heightCm: 110,
            },
            { kind: 'janela', wall: 'left', position: 0.5, widthCm: 140 },
          ],
          furniture: [
            { key: 'quarto-1:cama-box', unit: 0, xCm: 175, yCm: 100, rotation: 'down' },
            { key: 'x', unit: 0, xCm: 10, yCm: 10, rotation: 'diagonal' },
          ],
        }),
        room({ type: 'banheiro', label: 'Banho', xM: 3.5, finishes: { floor: 'marmore' } }),
        room({ type: 'sala', label: '', widthM: 0.1 }),
        'lixo',
      ]),
    )!
    expect(parsed.notes).toBe('ok')
    expect(parsed.rooms).toHaveLength(2)
    expect(parsed.rooms[0].openings).toEqual([
      { kind: 'door', wall: 'right', position: 0.8, widthCm: 80, hinge: 'end', swing: 'in' },
      { kind: 'window', wall: 'left', position: 0.5, widthCm: 140, sillCm: 100, heightCm: 110 },
    ])
    expect(parsed.rooms[0].furniture).toHaveLength(1)
    expect(parsed.rooms[0].finishes.fromPhoto).toBe(true)
    // banheiro com piso inválido: porcelanato, cor clara (o comum do tipo)
    expect(parsed.rooms[1].finishes).toEqual({
      floor: 'porcelanato',
      floorColor: '#e2ded6',
      wallColor: '#f2efe8',
      fromPhoto: false,
    })
    expect(parseHouseModel({ widthM: 10, depthM: 8, rooms: [] })).toBeUndefined()
    expect(parseHouseModel({ widthM: 'x', rooms: [room({})] })).toBeUndefined()
    expect(parseHouseModel(null)).toBeUndefined()
  })
})

describe('linkRooms', () => {
  const parsed = parseHouseModel(
    model([
      room({ label: 'Suíte', widthM: 3.5, depthM: 4 }),
      room({ label: 'Dorm. 2', yM: 4, widthM: 3, depthM: 3 }),
      room({ type: 'sala', label: 'Estar', xM: 3.5, widthM: 4, depthM: 5 }),
    ]),
  )!

  it('pelo nome da planta lida antes: mesmo cômodo e mesmo tipo (dorm. 2 virou quarto do bebê)', () => {
    const saved = [
      { ...parsed.rooms[0], areaM2: 14, x: 0, y: 0, width: 0.3, height: 0.5, instanceId: 'quarto' },
      {
        ...parsed.rooms[1],
        type: 'quarto-bebe',
        label: 'DORM 2',
        areaM2: 9,
        x: 0,
        y: 0.5,
        width: 0.3,
        height: 0.4,
        instanceId: 'quarto-bebe',
      },
    ]
    const linked = linkRooms(parsed, rooms, saved)
    expect(linked.rooms.map((r) => [r.label, r.type, r.instanceId])).toEqual([
      ['Suíte', 'quarto', 'quarto'],
      ['Dorm. 2', 'quarto-bebe', 'quarto-bebe'],
      ['Estar', 'sala', 'sala'],
    ])
  })

  it('sem planta anterior: mesmo algoritmo da planta (maior quarto = Quarto 1)', () => {
    const linked = linkRooms(parsed, rooms)
    expect(linked.rooms.map((r) => r.instanceId)).toEqual(['quarto-1', 'quarto-2', 'sala'])
  })
})

describe('applySuggestions', () => {
  const base = arrangeRoom(
    {
      width: 350,
      depth: 400,
      openings: [{ kind: 'door', wall: 'bottom', position: 0.2, widthCm: 80 }],
    },
    [
      {
        key: 'cama',
        category: 'cama-box',
        label: 'Cama',
        placement: 'floor',
        width: 138,
        depth: 188,
        height: 42,
        qty: 1,
      },
      {
        key: 'comoda',
        category: 'comoda',
        label: 'Cômoda',
        placement: 'floor',
        width: 100,
        depth: 45,
        height: 90,
        qty: 1,
      },
    ],
  )
  const at = (layout: typeof base, key: string) => layout.placed.find((p) => p.key === key)!

  it('aceita a sugestão válida (cama encostada na parede de cima, frente para baixo)', () => {
    const { layout, accepted } = applySuggestions(base, [
      { key: 'cama', unit: 0, xCm: 175, yCm: 94, rotation: 'down' },
    ])
    expect(accepted).toBe(1)
    expect(at(layout, 'cama')).toMatchObject({ x: 106, y: 0, w: 138, d: 188, facing: 'down' })
  })

  it('recusa sugestão fora do cômodo, sobre outro móvel ou na porta', () => {
    const comoda = at(base, 'comoda')
    const { layout, accepted } = applySuggestions(base, [
      { key: 'cama', unit: 0, xCm: 340, yCm: 94, rotation: 'down' }, // sai pela direita
      {
        key: 'cama',
        unit: 0,
        xCm: comoda.x + comoda.w / 2,
        yCm: comoda.y + comoda.d / 2,
        rotation: 'down',
      },
      { key: 'comoda', unit: 0, xCm: 70, yCm: 380, rotation: 'up' }, // no giro da porta
      { key: 'nao-existe', unit: 0, xCm: 100, yCm: 100, rotation: 'down' },
    ])
    expect(accepted).toBe(0)
    expect(layout.placed).toEqual(base.placed)
  })

  it('girar troca largura e profundidade', () => {
    const { layout } = applySuggestions(base, [
      { key: 'cama', unit: 0, xCm: 94, yCm: 175, rotation: 'right' },
    ])
    expect(at(layout, 'cama')).toMatchObject({ w: 188, d: 138, facing: 'right' })
  })
})

describe('furnishHouse e furnitureForSkill', () => {
  it('cada cômodo ligado recebe os móveis da lista; a skill recebe as medidas', () => {
    const house = expandHouse(rooms, products, { quarto: 1, sala: 1 })
    const view = buildList(house.room, house.products, 1_000_000, emptyChoices())
    const linked: HouseModel = linkRooms(
      parseHouseModel(
        model([
          room({ label: 'Quarto' }),
          room({ type: 'sala', label: 'Sala', xM: 3.5, widthM: 4.5, depthM: 5 }),
        ]),
      )!,
      rooms,
    )
    const furnished = furnishHouse(linked, view)
    expect(furnished.map((f) => f.room.instanceId)).toEqual(['quarto', 'sala'])
    expect(furnished[0].layout.placed.some((p) => p.category === 'cama-box')).toBe(true)
    expect(furnished[1].layout.placed.some((p) => p.category === 'sofa')).toBe(true)

    const forSkill = furnitureForSkill(view, ['quarto', 'sala', 'cozinha'])
    expect(forSkill.map((r) => r.instanceId)).toEqual(['quarto', 'sala'])
    expect(forSkill[0].items.find((i) => i.key === 'quarto:cama-box')).toMatchObject({
      widthCm: expect.any(Number),
      depthCm: expect.any(Number),
      placement: 'floor',
    })
  })
})

describe('armários das fotos (builtIns)', () => {
  const kitchen = (builtIns: unknown[]) =>
    parseHouseModel(
      model([room({ type: 'cozinha', label: 'Cozinha', widthM: 3, depthM: 2.5, builtIns })]),
    )!.rooms[0]

  it('confere, recorta na parede e descarta o que não serve', () => {
    const r = kitchen([
      {
        kind: 'bancada',
        wall: 'top',
        startCm: 0,
        lengthCm: 400,
        depthCm: 60,
        heightCm: 90,
        elevationCm: 0,
        finish: 'branco',
        color: '#f0f0f0',
        topColor: '#222222',
        sink: true,
        cooktop: true,
        doors: 4,
      },
      {
        kind: 'aereo',
        wall: 'top',
        startCm: 20,
        lengthCm: 200,
        depthCm: 35,
        heightCm: 150,
        elevationCm: 150,
        finish: 'marmore',
        color: 'azul',
      },
      {
        kind: 'geladeira',
        wall: 'top',
        startCm: 0,
        lengthCm: 80,
        depthCm: 60,
        heightCm: 180,
        elevationCm: 0,
      },
      {
        kind: 'armario',
        wall: 'left',
        startCm: 0,
        lengthCm: 100,
        depthCm: 200,
        heightCm: 200,
        elevationCm: 0,
      },
    ])
    expect(r.builtIns).toEqual([
      {
        kind: 'bancada',
        wall: 'top',
        startCm: 0,
        lengthCm: 300,
        depthCm: 60,
        heightCm: 90,
        elevationCm: 0,
        finish: 'branco',
        color: '#f0f0f0',
        topColor: '#222222',
        sink: true,
        cooktop: true,
        doors: 4,
      },
      // acabamento e cor inválidos → branco; altura até o teto (270 − 150)
      {
        kind: 'aereo',
        wall: 'top',
        startCm: 20,
        lengthCm: 200,
        depthCm: 35,
        heightCm: 120,
        elevationCm: 150,
        finish: 'branco',
        color: '#efece6',
      },
    ])
  })

  it('vira peça fixa encostada na parede certa (chão ou parede pela altura)', () => {
    const r = kitchen([
      {
        kind: 'bancada',
        wall: 'right',
        startCm: 50,
        lengthCm: 150,
        depthCm: 60,
        heightCm: 90,
        elevationCm: 0,
        finish: 'branco',
        color: '#ffffff',
      },
      {
        kind: 'aereo',
        wall: 'bottom',
        startCm: 0,
        lengthCm: 100,
        depthCm: 35,
        heightCm: 70,
        elevationCm: 150,
        finish: 'branco',
        color: '#ffffff',
      },
    ])
    expect(builtInPlaced(r.builtIns[0], 0, r)).toMatchObject({
      key: 'embutido:0',
      x: 240,
      y: 50,
      w: 60,
      d: 150,
      placement: 'floor',
      facing: 'left',
    })
    expect(builtInPlaced(r.builtIns[1], 1, r)).toMatchObject({
      x: 0,
      y: 215,
      w: 100,
      d: 35,
      placement: 'wall',
      elevation: 150,
      facing: 'up',
    })
  })

  it('os móveis da lista desviam do armário embutido; sugestão em cima dele é recusada', () => {
    const house = expandHouse(rooms, products, { quarto: 1 })
    const view = buildList(house.room, house.products, 1_000_000, emptyChoices())
    const parsed = parseHouseModel(
      model([
        room({
          label: 'Quarto',
          widthM: 3.2,
          depthM: 3.6,
          openings: [{ kind: 'door', wall: 'bottom', position: 0.85, widthCm: 80 }],
          builtIns: [
            {
              kind: 'armario',
              wall: 'top',
              startCm: 0,
              lengthCm: 320,
              depthCm: 60,
              heightCm: 250,
              elevationCm: 0,
              finish: 'madeira-clara',
              color: '#d9c3a0',
            },
          ],
          furniture: [{ key: 'quarto:cama-box', unit: 0, xCm: 160, yCm: 30, rotation: 'down' }],
        }),
      ]),
    )!
    const [furnished] = furnishHouse(linkRooms(parsed, rooms), view)
    expect(furnished.fixed).toHaveLength(1)
    expect(furnished.accepted).toBe(0)
    const wardrobe = furnished.fixed[0]
    for (const p of furnished.layout.placed.filter((p) => p.placement === 'floor')) {
      expect(p.y).toBeGreaterThanOrEqual(wardrobe.d) // nada no chão por baixo do armário
    }
    expect(furnished.layout.placed.some((p) => p.category === 'cama-box')).toBe(true)
  })
})

describe('posições escolhidas pela pessoa', () => {
  const base = arrangeRoom(
    {
      width: 350,
      depth: 400,
      openings: [{ kind: 'door', wall: 'bottom', position: 0.2, widthCm: 80 }],
    },
    [
      {
        key: 'cama',
        category: 'cama-box',
        label: 'Cama',
        placement: 'floor',
        width: 138,
        depth: 188,
        height: 42,
        qty: 1,
      },
      {
        key: 'comoda',
        category: 'comoda',
        label: 'Cômoda',
        placement: 'floor',
        width: 100,
        depth: 45,
        height: 90,
        qty: 1,
      },
    ],
  )

  it('salva uma posição por móvel e limpa o cômodo', () => {
    let positions = setPosition({}, 'quarto', {
      key: 'cama',
      unit: 0,
      xCm: 100,
      yCm: 100,
      rotation: 'down',
    })
    positions = setPosition(positions, 'quarto', {
      key: 'cama',
      unit: 0,
      xCm: 175,
      yCm: 94,
      rotation: 'down',
    })
    positions = setPosition(positions, 'sala', {
      key: 'sofa',
      unit: 0,
      xCm: 1,
      yCm: 1,
      rotation: 'up',
    })
    expect(positions.quarto).toEqual([
      { key: 'cama', unit: 0, xCm: 175, yCm: 94, rotation: 'down' },
    ])
    expect(Object.keys(clearPositions(positions, 'quarto'))).toEqual(['sala'])
  })

  it('tryMove: aceita onde cabe, recusa em cima de outro móvel ou no giro da porta', () => {
    const comoda = base.placed.find((p) => p.key === 'comoda')!
    const moved = tryMove(base, { key: 'cama', unit: 0, xCm: 175, yCm: 94, rotation: 'down' })!
    expect(moved.placed.find((p) => p.key === 'cama')).toMatchObject({ x: 106, y: 0 })
    expect(tryMove(base, { ...hintOf(comoda), key: 'cama' })).toBeUndefined()
    expect(
      tryMove(base, { key: 'comoda', unit: 0, xCm: 70, yCm: 380, rotation: 'up' }),
    ).toBeUndefined()
    expect(hintOf(comoda)).toEqual({
      key: 'comoda',
      unit: 0,
      xCm: comoda.x + comoda.w / 2,
      yCm: comoda.y + comoda.d / 2,
      rotation: comoda.facing,
    })
  })

  it('o 3D usa a posição escolhida; o que saiu da lista some', () => {
    const house = expandHouse(rooms, products, { quarto: 1 })
    const view = buildList(house.room, house.products, 1_000_000, emptyChoices())
    const linked = linkRooms(
      parseHouseModel(model([room({ label: 'Quarto', widthM: 3.5, depthM: 4 })]))!,
      rooms,
    )
    const bed = (positions = {}, v = view) =>
      furnishHouse(linked, v, positions)[0].layout.placed.find((p) => p.category === 'cama-box')
    const before = bed()!
    // cama girada no meio do cômodo: posição livre escolhida pela pessoa
    const chosen = { key: before.key, unit: 0, xCm: 175, yCm: 200, rotation: 'right' as const }
    const after = bed({ quarto: [chosen] })!
    expect(after).toMatchObject({ x: 175 - after.w / 2, y: 200 - after.d / 2, facing: 'right' })
    // virada para o lado: o comprimento da cama fica no eixo x
    expect(after.w).toBe(Math.max(before.w, before.d))

    // recusar a cama na lista: sai da vista de cima e do 3D, mesmo com posição salva
    const choices = {
      ...emptyChoices(),
      excluded: { [before.key]: 'refused' as const },
    }
    const without = buildList(house.room, house.products, 1_000_000, choices)
    expect(bed({ quarto: [chosen] }, without)).toBeUndefined()
  })
})

describe('lavanderia sem lugar na casa em 3D', () => {
  it('fica na cozinha do 3D (máquina e varal entre os móveis da cozinha)', () => {
    const house = expandHouse(rooms, products, { cozinha: 1, lavanderia: 1 })
    const view = buildList(house.room, house.products, 1_000_000, emptyChoices())
    const linked = linkRooms(
      parseHouseModel(
        model([room({ type: 'cozinha', label: 'Cozinha', widthM: 4, depthM: 3.5 })]),
      )!,
      rooms,
    )
    const [kitchen] = furnishHouse(linked, view)
    const keys = [
      ...kitchen.layout.placed.map((p) => p.key),
      ...kitchen.layout.unplaced.map((u) => u.key),
    ]
    expect(keys).toEqual(
      expect.arrayContaining(['cozinha:geladeira', 'lavanderia:lava-roupas', 'lavanderia:varal']),
    )
  })
})
