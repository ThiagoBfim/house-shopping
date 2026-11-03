import { describe, expect, it } from 'vitest'
import { parseFloorPlan, type Opening } from '../src/engine/floor-plan.ts'
import {
  arrangeRoom,
  BED_SIDE_CLEARANCE,
  roomSizeCm,
  WINDOW_SAFE_HEIGHT,
  type LayoutItem,
  type PlacedItem,
  type RoomLayout,
} from '../src/engine/layout.ts'
// Resposta real da skill /floor-plan para a planta com portas e janelas (Drop 36).
import aptoPortas from './fixtures/floor-plan-apto-portas.json'

const item = (
  category: string,
  [width, depth, height]: [number, number, number],
  extra: Partial<LayoutItem> = {},
): LayoutItem => ({
  key: `quarto:${category}`,
  category,
  label: category,
  placement: 'floor',
  width,
  depth,
  height,
  qty: 1,
  ...extra,
})

const overlap = (a: PlacedItem, b: PlacedItem) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d

/** Regras que valem para qualquer cômodo: dentro, sem sobrepor, nada na frente da porta. */
function expectSane(layout: RoomLayout) {
  const floor = layout.placed.filter((p) => p.placement === 'floor')
  for (const p of layout.placed) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x + p.w).toBeLessThanOrEqual(layout.width)
    expect(p.y + p.d).toBeLessThanOrEqual(layout.depth)
  }
  for (const [i, a] of floor.entries()) {
    for (const b of floor.slice(i + 1)) expect(overlap(a, b), `${a.label} × ${b.label}`).toBe(false)
  }
  for (const door of layout.openings.filter((o) => o.kind === 'door')) {
    // porta na parede de baixo: nada de chão na faixa da porta até o giro
    if (door.wall !== 'bottom') continue
    const start = door.position * layout.width - door.widthCm / 2
    const zone = { x: start, y: layout.depth - door.widthCm, w: door.widthCm, d: door.widthCm }
    for (const p of floor) {
      const hit =
        p.x < zone.x + zone.w && zone.x < p.x + p.w && p.y < zone.y + zone.d && zone.y < p.y + p.d
      expect(hit, `${p.label} na frente da porta`).toBe(false)
    }
  }
}

const door = (wall: Opening['wall'], position: number, widthCm = 80): Opening => ({
  kind: 'door',
  wall,
  position,
  widthCm,
})
const window = (wall: Opening['wall'], position: number, widthCm = 150): Opening => ({
  kind: 'window',
  wall,
  position,
  widthCm,
})

describe('quarto', () => {
  const room = { width: 350, depth: 400, openings: [door('bottom', 0.15), window('right', 0.5)] }
  const items = [
    item('cama-box', [138, 188, 42]),
    item('criado-mudo', [45, 35, 55], { qty: 2 }),
    item('guarda-roupa', [230, 55, 220]),
    item('comoda', [100, 45, 90]),
  ]
  const layout = arrangeRoom(room, items)
  const bed = layout.placed.find((p) => p.category === 'cama-box')!

  it('tudo coube, dentro do cômodo, sem sobrepor e sem bloquear a porta', () => {
    expect(layout.unplaced).toEqual([])
    expect(layout.placed).toHaveLength(5)
    expectSane(layout)
  })

  it('cama encostada na parede, centralizada, com passagem dos dois lados', () => {
    const touchesWall =
      bed.x === 0 || bed.y === 0 || bed.x + bed.w === room.width || bed.y + bed.d === room.depth
    expect(touchesWall).toBe(true)
    const vertical = bed.facing === 'down' || bed.facing === 'up'
    const [before, after] = vertical
      ? [bed.x, room.width - bed.x - bed.w]
      : [bed.y, room.depth - bed.y - bed.d]
    expect(before).toBeGreaterThanOrEqual(BED_SIDE_CLEARANCE)
    expect(after).toBeGreaterThanOrEqual(BED_SIDE_CLEARANCE)
  })

  it('criados-mudos dos dois lados da cama, na cabeceira', () => {
    const tables = layout.placed.filter((p) => p.category === 'criado-mudo')
    expect(tables).toHaveLength(2)
    expect(tables.map((t) => t.unit).sort()).toEqual([0, 1])
    // um antes e outro depois da cama, ao longo da cabeceira (eixo depende da parede)
    const vertical = bed.facing === 'down' || bed.facing === 'up'
    const sides = tables.map((t) =>
      vertical
        ? Math.sign(t.x + t.w / 2 - (bed.x + bed.w / 2))
        : Math.sign(t.y + t.d / 2 - (bed.y + bed.d / 2)),
    )
    expect(sides.sort()).toEqual([-1, 1])
  })

  it('guarda-roupa (alto) não fica na frente da janela', () => {
    const wardrobe = layout.placed.find((p) => p.category === 'guarda-roupa')!
    expect(wardrobe.height).toBeGreaterThan(WINDOW_SAFE_HEIGHT)
    const onRightWall = wardrobe.x + wardrobe.w === room.width
    if (onRightWall) {
      const windowStart = 0.5 * room.depth - 75
      const windowEnd = 0.5 * room.depth + 75
      expect(wardrobe.y + wardrobe.d <= windowStart || wardrobe.y >= windowEnd).toBe(true)
    }
  })
})

describe('sala', () => {
  const room = { width: 450, depth: 420, openings: [door('bottom', 0.85, 90)] }
  const layout = arrangeRoom(room, [
    item('sofa', [210, 90, 90]),
    item('rack', [180, 40, 55]),
    item('mesa-de-centro', [90, 50, 40]),
    item('tapete', [200, 150, 1], { placement: 'rug' }),
    item('tv', [122, 6, 71], { placement: 'wall' }),
    item('poltrona', [75, 80, 90]),
  ])
  const at = (category: string) => layout.placed.find((p) => p.category === category)!

  it('sofá de frente para o rack, mesa de centro entre os dois', () => {
    expect(layout.unplaced).toEqual([])
    expectSane(layout)
    const sofa = at('sofa')
    const rack = at('rack')
    const opposite = { down: 'up', up: 'down', left: 'right', right: 'left' }
    expect(rack.facing).toBe(opposite[sofa.facing])
    const table = at('mesa-de-centro')
    if (sofa.facing === 'down') {
      expect(table.y).toBeGreaterThan(sofa.y + sofa.d)
      expect(table.y + table.d).toBeLessThan(rack.y)
    }
  })

  it('TV na parede do rack, acima dele; tapete sob a mesa de centro', () => {
    const tv = at('tv')
    const rack = at('rack')
    expect(tv.facing).toBe(rack.facing)
    expect(tv.elevation).toBeGreaterThan(rack.height)
    const table = at('mesa-de-centro')
    const rug = at('tapete')
    expect(rug.x).toBeLessThanOrEqual(table.x)
    expect(rug.x + rug.w).toBeGreaterThanOrEqual(table.x + table.w)
  })
})

describe('casos de borda', () => {
  it('móvel que não cabe vai para "não coube"', () => {
    const layout = arrangeRoom({ width: 200, depth: 200, openings: [] }, [
      item('guarda-roupa', [230, 55, 220]),
      item('comoda', [100, 45, 90]),
    ])
    expect(layout.unplaced).toEqual([{ key: 'quarto:guarda-roupa', label: 'guarda-roupa' }])
    expect(layout.placed.map((p) => p.category)).toEqual(['comoda'])
  })

  it('mesa de jantar no meio, com espaço para as cadeiras', () => {
    const layout = arrangeRoom({ width: 400, depth: 350, openings: [] }, [
      item('mesa-de-jantar', [160, 90, 76]),
    ])
    const table = layout.placed[0]
    expect(table.x).toBeGreaterThanOrEqual(60)
    expect(table.y).toBeGreaterThanOrEqual(60)
    expect(table.x + table.w).toBeLessThanOrEqual(400 - 60)
    expect(Math.abs(table.x + table.w / 2 - 200)).toBeLessThanOrEqual(10)
  })

  it('mesa de centro sem sofá e TV maior que a parede não entram', () => {
    const layout = arrangeRoom({ width: 100, depth: 100, openings: [] }, [
      item('mesa-de-centro', [90, 50, 40]),
      item('tv', [190, 6, 110], { placement: 'wall' }),
    ])
    expect(layout.unplaced.map((u) => u.key)).toEqual(['quarto:mesa-de-centro', 'quarto:tv'])
  })

  it('ar-condicionado na parede, no alto', () => {
    const layout = arrangeRoom({ width: 300, depth: 300, openings: [] }, [
      item('ar-condicionado', [80, 20, 30], { placement: 'wall' }),
    ])
    expect(layout.placed[0]).toMatchObject({ elevation: 210, placement: 'wall' })
  })
})

describe('itens de parede e mesa de jantar (correções do primeiro desenho)', () => {
  const along = (p: PlacedItem, vertical: boolean) =>
    vertical ? { a: p.y, b: p.y + p.d } : { a: p.x, b: p.x + p.w }

  it('espelho não fica atrás da cama; ar-condicionado não fica em cima do guarda-roupa', () => {
    const layout = arrangeRoom({ width: 350, depth: 400, openings: [] }, [
      item('cama-box', [158, 198, 42]),
      item('guarda-roupa', [230, 55, 220]),
      item('ar-condicionado', [80, 20, 30], { placement: 'wall' }),
      item('espelho-corpo-inteiro', [50, 3, 160], { placement: 'wall' }),
    ])
    expect(layout.unplaced).toEqual([])
    const at = (c: string) => layout.placed.find((p) => p.category === c)!
    for (const [wallItem, floorItem] of [
      ['espelho-corpo-inteiro', 'cama-box'],
      ['ar-condicionado', 'guarda-roupa'],
    ]) {
      const w = at(wallItem)
      const f = at(floorItem)
      if (w.facing !== f.facing) continue // paredes diferentes: sem conflito
      const vertical = w.facing === 'left' || w.facing === 'right'
      const a = along(w, vertical)
      const b = along(f, vertical)
      expect(a.b <= b.a || b.b <= a.a, `${wallItem} na frente de ${floorItem}`).toBe(true)
    }
  })

  it('TV de frente para a cama, mas não na porta do guarda-roupa', () => {
    const layout = arrangeRoom({ width: 350, depth: 400, openings: [] }, [
      item('cama-box', [158, 198, 42]),
      item('guarda-roupa', [230, 55, 220]),
      item('tv', [122, 6, 71], { placement: 'wall' }),
    ])
    const tv = layout.placed.find((p) => p.category === 'tv')!
    const wardrobe = layout.placed.find((p) => p.category === 'guarda-roupa')!
    if (tv.facing === wardrobe.facing) {
      const vertical = tv.facing === 'left' || tv.facing === 'right'
      const a = along(tv, vertical)
      const b = along(wardrobe, vertical)
      expect(a.b <= b.a || b.b <= a.a, 'TV na frente do guarda-roupa').toBe(true)
    }
  })

  it('sala de estar e jantar: a mesa de jantar cabe junto com o sofá', () => {
    const layout = arrangeRoom({ width: 420, depth: 480, openings: [door('bottom', 0.85, 90)] }, [
      item('sofa', [210, 90, 90]),
      item('rack', [180, 40, 55]),
      item('mesa-de-centro', [90, 50, 40]),
      item('mesa-de-jantar', [160, 90, 76]),
      item('poltrona', [75, 80, 90]),
      item('luminaria-de-chao', [40, 40, 160]),
    ])
    expect(layout.placed.some((p) => p.category === 'mesa-de-jantar')).toBe(true)
    expectSane(layout)
    // sofá de frente para o rack, os dois na metade do estar
    const sofa = layout.placed.find((p) => p.category === 'sofa')!
    const rack = layout.placed.find((p) => p.category === 'rack')!
    const opposite = { down: 'up', up: 'down', left: 'right', right: 'left' }
    expect(rack.facing).toBe(opposite[sofa.facing])
  })
})

describe('roomSizeCm', () => {
  const room = (areaM2: number | null, width: number, height: number) => ({
    type: 'quarto',
    label: 'Q',
    areaM2,
    openings: [],
    x: 0,
    y: 0,
    width,
    height,
  })

  it('área + proporção do retângulo na planta → largura × profundidade', () => {
    // planta 1,5 : 1; cômodo com 0,3 × 0,5 do desenho → proporção 0,45/0,5 = 0,9; 12 m²
    const size = roomSizeCm({ aspect: 1.5, rooms: [room(12, 0.3, 0.5)] }, 0)
    expect(size.estimated).toBe(false)
    expect((size.width * size.depth) / 10000).toBeCloseTo(12, 0)
    expect(size.width / size.depth).toBeCloseTo(0.9, 1)
  })

  it('sem área: usa a escala dos outros cômodos; sem nenhuma, 3 × 3 m', () => {
    const plan = { aspect: 1, rooms: [room(10, 0.25, 0.4), room(null, 0.25, 0.4)] }
    const size = roomSizeCm(plan, 1)
    expect(size.estimated).toBe(true)
    expect((size.width * size.depth) / 10000).toBeCloseTo(10, 0)
    const lone = roomSizeCm({ aspect: 1, rooms: [room(null, 0.5, 0.5)] }, 0)
    expect(lone).toEqual({ width: 300, depth: 300, estimated: true })
  })
})

describe('planta real com portas e janelas (resposta da skill, 03/11)', () => {
  it('cada cômodo da planta recebe os móveis sem bloquear as portas lidas', async () => {
    const plan = parseFloorPlan(aptoPortas)!
    const suite = plan.rooms.findIndex((r) => r.label === 'Suíte')
    expect(plan.rooms[suite].openings.filter((o) => o.kind === 'door')).toHaveLength(2)
    const size = roomSizeCm(plan, suite)
    const layout = arrangeRoom({ ...size, openings: plan.rooms[suite].openings }, [
      item('cama-box', [158, 198, 42]),
      item('criado-mudo', [45, 35, 55], { qty: 2 }),
      item('guarda-roupa', [230, 55, 220]),
      item('comoda', [100, 45, 90]),
    ])
    expect(layout.unplaced).toEqual([])
    expectSane(layout)
  })
})
