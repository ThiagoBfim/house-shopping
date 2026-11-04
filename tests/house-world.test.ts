import { describe, expect, it } from 'vitest'
import {
  BODY_RADIUS,
  DOOR_HEIGHT,
  WALL_THICKNESS,
  blockersOf,
  buildWorld,
  freeSpot,
  move,
  startRoom,
  tourPath,
} from '../src/engine/house-world.ts'
import { parseHouseModel, type HouseModel } from '../src/engine/house3d.ts'
import { arrangeRoom } from '../src/engine/layout.ts'

const finishes = { floor: 'madeira', floorColor: '#b88a5f', wallColor: '#f2efe8', fromPhoto: false }
// Sala 4×4 à esquerda, quarto 3×4 à direita, banheiro 3×2 abaixo do quarto.
// Porta sala→quarto lida só na sala; porta quarto→banheiro nos dois; entrada no fundo da sala.
const house: HouseModel = parseHouseModel({
  widthM: 7,
  depthM: 6,
  notes: '',
  rooms: [
    {
      type: 'sala',
      label: 'Sala',
      xM: 0,
      yM: 0,
      widthM: 4,
      depthM: 4,
      finishes,
      furniture: [],
      openings: [
        { kind: 'door', wall: 'right', position: 0.5, widthCm: 80, hinge: 'start', swing: 'out' },
        { kind: 'door', wall: 'bottom', position: 0.5, widthCm: 90 },
        { kind: 'window', wall: 'left', position: 0.5, widthCm: 150, sillCm: 100, heightCm: 120 },
      ],
    },
    {
      type: 'quarto',
      label: 'Quarto',
      xM: 4,
      yM: 0,
      widthM: 3,
      depthM: 4,
      finishes,
      furniture: [],
      openings: [{ kind: 'door', wall: 'bottom', position: 0.5, widthCm: 70, swing: 'in' }],
    },
    {
      type: 'banheiro',
      label: 'Banho',
      xM: 4,
      yM: 4,
      widthM: 3,
      depthM: 2,
      finishes,
      furniture: [],
      openings: [{ kind: 'door', wall: 'top', position: 0.5, widthCm: 70, swing: 'out' }],
    },
  ],
})!

describe('buildWorld', () => {
  const world = buildWorld(house)

  it('liga os cômodos pelas portas (também a lida de um lado só) e acha a entrada', () => {
    const pairs = world.connections.map((c) => `${c.from}>${c.to}`).sort()
    expect(pairs).toEqual(['0>1', '1>0', '1>2', '2>1'])
    expect(world.entrances).toEqual([{ room: 0, x: 2, z: 4, nx: 0, nz: 1 }])
  })

  it('a porta lida só na sala abre também a parede do quarto', () => {
    // parede esquerda do quarto (x = 4): vão entre z 1,6 e 2,4 só acima da porta
    const left = world.walls.filter((w) => w.room === 1 && w.side === 'left')
    const atDoor = left.filter((w) => w.minZ < 2 && w.maxZ > 2)
    expect(atDoor).toHaveLength(1)
    expect(atDoor[0].bottom).toBe(DOOR_HEIGHT)
  })

  it('folha de porta só no cômodo que leu a porta; dobradiça e sentido', () => {
    expect(world.doors).toHaveLength(4)
    const salaQuarto = world.doors.find((d) => d.room === 0 && d.side === 'right')!
    expect(salaQuarto).toMatchObject({ hingeX: 4, hingeZ: 1.6, freeX: 4, into: -1 })
    expect(salaQuarto.freeZ).toBeCloseTo(2.4)
  })

  it('janela: parede abaixo do peitoril, vidro e parede acima', () => {
    const win = world.walls.filter(
      (w) => w.room === 0 && w.side === 'left' && w.minZ < 2 && w.maxZ > 2,
    )
    expect(win.map((w) => [w.kind, w.bottom, w.top])).toEqual([
      ['wall', 0, 1],
      ['wall', 2.2, 2.7],
      ['glass', 1, 2.2],
    ])
  })
})

describe('andar e tour', () => {
  const world = buildWorld(house)
  const layouts = house.rooms.map((r) =>
    arrangeRoom({ width: r.widthM * 100, depth: r.depthM * 100, openings: r.openings }, []),
  )
  const blockers = blockersOf(world, house, layouts)

  it('não atravessa parede, desliza encostado e passa pela porta', () => {
    const wall = move({ x: 3.5, z: 1 }, 1, 0, blockers)
    expect(wall.x).toBeLessThan(4 - WALL_THICKNESS / 2 - BODY_RADIUS)
    expect(wall.z).toBe(1)
    const slide = move({ x: 3.5, z: 1 }, 1, 0.3, blockers)
    expect(slide.x).toBeLessThan(4 - BODY_RADIUS)
    expect(slide.z).toBeCloseTo(1.3)
    const door = move({ x: 3.5, z: 2 }, 1, 0, blockers)
    expect(door.x).toBeCloseTo(4.5)
  })

  it('móvel de chão bloqueia; tapete não', () => {
    const withBed = [
      arrangeRoom({ width: 400, depth: 400, openings: [] }, []),
      arrangeRoom({ width: 300, depth: 400, openings: [] }, [
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
          key: 'tapete',
          category: 'tapete',
          label: 'Tapete',
          placement: 'rug',
          width: 150,
          depth: 100,
          height: 1,
          qty: 1,
        },
      ]),
      arrangeRoom({ width: 300, depth: 200, openings: [] }, []),
    ]
    const furnitureBlockers = blockersOf(world, house, withBed).length - blockers.length
    expect(furnitureBlockers).toBe(1)
    const spot = freeSpot(house, withBed, 1)
    const bed = withBed[1].placed[0]
    const inside = (x: number, z: number) =>
      x > 4 + bed.x / 100 &&
      x < 4 + (bed.x + bed.w) / 100 &&
      z > bed.y / 100 &&
      z < (bed.y + bed.d) / 100
    expect(inside(spot.x, spot.z)).toBe(false)
  })

  it('tour começa na entrada e passa por todos os cômodos, cruzando as portas', () => {
    expect(startRoom(house, world)).toBe(0)
    const { start, stops } = tourPath(house, world, layouts)
    expect(start).toBe(0)
    const paused = stops.filter((s) => s.pause).map((s) => s.room)
    expect(paused).toEqual([0, 1, 2])
    // nenhum trecho do tour atravessa parede
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]]
      let at = { x: a.x, z: a.z }
      const steps = 40
      for (let s = 0; s < steps; s++) {
        at = move(at, (b.x - a.x) / steps, (b.z - a.z) / steps, blockers, 0.05)
      }
      expect(Math.hypot(at.x - b.x, at.z - b.z)).toBeLessThan(0.01)
    }
  })

  it('sem porta para fora, começa na sala (ou no maior)', () => {
    const closed = { ...house, rooms: house.rooms.map((r) => ({ ...r, openings: [] })) }
    expect(startRoom(closed, buildWorld(closed))).toBe(0)
    const noSala = { ...closed, rooms: closed.rooms.map((r) => ({ ...r, type: 'quarto' })) }
    expect(startRoom(noSala, buildWorld(noSala))).toBe(0)
  })
})

describe('cômodo sem porta', () => {
  it('ganha passagem aberta para a parte alcançável, na parede mais longa em comum', () => {
    const closed: HouseModel = {
      ...house,
      rooms: house.rooms.map((r, i) => (i === 2 ? { ...r, openings: [] } : r)),
    }
    const plain: HouseModel = {
      ...closed,
      rooms: closed.rooms.map((r, i) => (i === 1 ? { ...r, openings: [] } : r)),
    }
    const world = buildWorld(plain)
    // quarto e banheiro sem porta lida neles: o quarto já tem a porta lida na sala; só o banheiro
    // ganha passagem, pela parede que divide com o quarto
    expect(world.passages).toEqual([{ from: 1, to: 2 }])
    expect(world.doors.every((d) => d.room === 0)).toBe(true)
    const layouts = plain.rooms.map((r) =>
      arrangeRoom({ width: r.widthM * 100, depth: r.depthM * 100, openings: r.openings }, []),
    )
    const paused = tourPath(plain, world, layouts).stops.filter((s) => s.pause)
    expect(paused.map((s) => s.room)).toEqual([0, 1, 2])
  })
})

describe('resposta real da skill /house-3d (planta com só 3 portas)', () => {
  it('casa toda navegável: o tour passa por todos os cômodos sem atravessar parede', async () => {
    const real = parseHouseModel((await import('./fixtures/house-3d-apto.json')).default)!
    const world = buildWorld(real)
    const layouts = real.rooms.map((r) =>
      arrangeRoom(
        {
          width: Math.round(r.widthM * 100),
          depth: Math.round(r.depthM * 100),
          openings: r.openings,
        },
        [],
      ),
    )
    expect(world.entrances.length).toBeGreaterThan(0)
    const { stops } = tourPath(real, world, layouts)
    const visited = new Set(stops.filter((s) => s.pause).map((s) => s.room))
    expect(visited.size).toBe(real.rooms.length)
    const blockers = blockersOf(world, real, layouts)
    for (let i = 1; i < stops.length; i++) {
      const [a, b] = [stops[i - 1], stops[i]]
      const end = move(a, b.x - a.x, b.z - a.z, blockers, 0.05)
      expect(Math.hypot(end.x - b.x, end.z - b.z)).toBeLessThan(0.01)
    }
  })
})
