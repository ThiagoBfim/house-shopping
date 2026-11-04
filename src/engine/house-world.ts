import type { HouseModel, HouseOpening } from './house3d.ts'
import { MAX_SWING_DOOR_CM, type RoomLayout } from './layout.ts'

/**
 * Geometria da casa inteira para o 3D, a primeira pessoa e o tour (lógica pura, em metros).
 * Planta vista de cima: x para a direita, z para baixo (o y da planta), altura em y.
 */

export const WALL_HEIGHT = 2.7
export const WALL_THICKNESS = 0.12
export const DOOR_HEIGHT = 2.1
/** Raio de quem anda (para não encostar o nariz na parede). */
export const BODY_RADIUS = 0.22
/** Mesma linha de parede entre dois cômodos (a leitura da planta não é exata ao cm). */
const SAME_LINE = 0.2

type Side = 'top' | 'right' | 'bottom' | 'left'
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** Retângulo no chão (m). */
export interface Rect2 {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

export interface WallPiece extends Rect2 {
  bottom: number
  top: number
  kind: 'wall' | 'glass'
  room: number
  side: Side
}

/** Folha de porta a desenhar (só no cômodo dono da porta, não na cópia do vizinho). */
export interface DoorLeaf {
  room: number
  side: Side
  /** Dobradiça e a outra ponta da abertura, na linha da parede (m). */
  hingeX: number
  hingeZ: number
  freeX: number
  freeZ: number
  /** Para dentro do cômodo dono (+1) ou para fora (−1), na direção normal à parede. */
  into: 1 | -1
  sliding: boolean
  widthM: number
}

export interface Connection {
  from: number
  to: number
  /** Meio do vão da porta (m). */
  x: number
  z: number
  /** Normal da parede, do `from` para o `to`. */
  nx: number
  nz: number
}

export interface HouseWorld {
  walls: WallPiece[]
  doors: DoorLeaf[]
  connections: Connection[]
  /** Portas que dão para fora da casa (entrada). */
  entrances: { room: number; x: number; z: number; nx: number; nz: number }[]
  /** Passagens abertas que a casa ganhou porque a planta não mostrava porta para o cômodo. */
  passages: { from: number; to: number }[]
}

interface Gap {
  kind: 'door' | 'window'
  a: number
  b: number
  sillCm?: number
  heightCm?: number
  /** Veio do cômodo vizinho (porta lida só do outro lado). */
  mirrored?: boolean
  /** Sem parede nenhuma (cômodos unidos): nem a verga em cima da porta. */
  open?: boolean
  source?: HouseOpening
}

/** Linha da parede do cômodo e de onde até onde ela vai, no eixo dela. */
function edgeOf(room: HouseModel['rooms'][number], side: Side) {
  const horizontal = side === 'top' || side === 'bottom'
  const line = {
    top: room.yM,
    bottom: room.yM + room.depthM,
    left: room.xM,
    right: room.xM + room.widthM,
  }[side]
  const start = horizontal ? room.xM : room.yM
  const length = horizontal ? room.widthM : room.depthM
  return { horizontal, line, start, end: start + length, length }
}

/** Normal da parede apontando para dentro do cômodo. */
const INWARD: Record<Side, [number, number]> = {
  top: [0, 1],
  bottom: [0, -1],
  left: [1, 0],
  right: [-1, 0],
}

export function buildWorld(model: HouseModel): HouseWorld {
  const rooms = model.rooms
  const gaps = rooms.map(
    () => ({ top: [], right: [], bottom: [], left: [] }) as Record<Side, Gap[]>,
  )

  // Aberturas lidas em cada cômodo.
  rooms.forEach((room, i) => {
    for (const o of room.openings) {
      const { start, length } = edgeOf(room, o.wall)
      const mid = start + o.position * length
      const half = o.widthCm / 200
      gaps[i][o.wall].push({
        kind: o.kind,
        a: Math.max(start, mid - half),
        b: Math.min(start + length, mid + half),
        sillCm: o.sillCm,
        heightCm: o.heightCm,
        source: o,
        ...(o.open && { open: true }),
      })
    }
  })

  const connections: Connection[] = []
  const entrances: HouseWorld['entrances'] = []
  // Porta lida de um lado só: abre também no vizinho; e liga os dois cômodos.
  rooms.forEach((room, i) => {
    for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
      const edge = edgeOf(room, side)
      for (const gap of gaps[i][side].filter((g) => g.kind === 'door' && !g.mirrored)) {
        const neighbor = rooms.findIndex((other, j) => {
          if (j === i) return false
          const e = edgeOf(other, OPPOSITE[side])
          return Math.abs(e.line - edge.line) < SAME_LINE && e.start < gap.b && gap.a < e.end
        })
        const mid = (gap.a + gap.b) / 2
        const [nx, nz] = INWARD[side]
        const [x, z] = edge.horizontal ? [mid, edge.line] : [edge.line, mid]
        if (neighbor < 0) {
          entrances.push({ room: i, x, z, nx: -nx || 0, nz: -nz || 0 })
          continue
        }
        const theirs = gaps[neighbor][OPPOSITE[side]]
        if (!theirs.some((g) => g.kind === 'door' && g.a < gap.b && gap.a < g.b)) {
          theirs.push({ kind: 'door', a: gap.a, b: gap.b, mirrored: true, open: gap.open })
        }
        if (
          !connections.some(
            (c) => c.from === i && c.to === neighbor && Math.hypot(c.x - x, c.z - z) < 0.5,
          )
        ) {
          connections.push({ from: i, to: neighbor, x, z, nx: -nx || 0, nz: -nz || 0 })
          connections.push({ from: neighbor, to: i, x, z, nx, nz })
        }
      }
    }
  })

  // Cômodo sem porta para o resto da casa (planta sem a porta desenhada): ganha uma passagem
  // aberta de 80 cm na parede mais longa que divide com a parte da casa já alcançável.
  const passages: HouseWorld['passages'] = []
  const reachable = (from: number) => {
    const seen = new Set([from])
    const queue = [from]
    while (queue.length) {
      const i = queue.shift()!
      for (const c of connections) {
        if (c.from === i && !seen.has(c.to)) {
          seen.add(c.to)
          queue.push(c.to)
        }
      }
    }
    return seen
  }
  const root = (() => {
    const outside = entrances[0]?.room
    if (outside !== undefined) return outside
    const areas = rooms.map((r) => r.widthM * r.depthM)
    return areas.indexOf(Math.max(...areas))
  })()
  for (let guard = 0; guard < rooms.length; guard++) {
    const inside = reachable(root)
    if (inside.size === rooms.length) break
    let best: { i: number; j: number; side: Side; a: number; b: number } | undefined
    for (const i of inside) {
      for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
        const edge = edgeOf(rooms[i], side)
        rooms.forEach((other, j) => {
          if (inside.has(j)) return
          const e = edgeOf(other, OPPOSITE[side])
          if (Math.abs(e.line - edge.line) >= SAME_LINE) return
          const a = Math.max(edge.start, e.start)
          const b = Math.min(edge.end, e.end)
          if (b - a >= 0.9 && (!best || b - a > best.b - best.a)) best = { i, j, side, a, b }
        })
      }
    }
    if (!best) break
    const { i, j, side, a, b } = best
    const mid = (a + b) / 2
    gaps[i][side].push({ kind: 'door', a: mid - 0.4, b: mid + 0.4, mirrored: true })
    gaps[j][OPPOSITE[side]].push({ kind: 'door', a: mid - 0.4, b: mid + 0.4, mirrored: true })
    const edge = edgeOf(rooms[i], side)
    const [nx, nz] = INWARD[side]
    const [x, z] = edge.horizontal ? [mid, edge.line] : [edge.line, mid]
    connections.push({ from: i, to: j, x, z, nx: -nx || 0, nz: -nz || 0 })
    connections.push({ from: j, to: i, x, z, nx: nx || 0, nz: nz || 0 })
    passages.push({ from: i, to: j })
  }

  // Paredes: meia espessura para dentro de cada cômodo (as duas metades formam a parede).
  const walls: WallPiece[] = []
  const doors: DoorLeaf[] = []
  const half = WALL_THICKNESS / 2
  rooms.forEach((room, i) => {
    for (const side of ['top', 'right', 'bottom', 'left'] as Side[]) {
      const edge = edgeOf(room, side)
      const [nx, nz] = INWARD[side]
      const piece = (
        a: number,
        b: number,
        bottom: number,
        top: number,
        kind: WallPiece['kind'] = 'wall',
      ) => {
        if (b - a < 0.01 || top - bottom < 0.01) return
        const inner = edge.line + (edge.horizontal ? nz : nx) * half
        const [lo, hi] = [Math.min(edge.line, inner), Math.max(edge.line, inner)]
        walls.push(
          edge.horizontal
            ? { minX: a, maxX: b, minZ: lo, maxZ: hi, bottom, top, kind, room: i, side }
            : { minX: lo, maxX: hi, minZ: a, maxZ: b, bottom, top, kind, room: i, side },
        )
      }
      let cursor = edge.start
      for (const gap of [...gaps[i][side]].sort((p, q) => p.a - q.a)) {
        piece(cursor, gap.a, 0, WALL_HEIGHT)
        if (gap.kind === 'door') {
          if (!gap.open) piece(gap.a, gap.b, DOOR_HEIGHT, WALL_HEIGHT)
          const source = gap.source
          // Vão largo (passagem aberta, partes de um cômodo em L): sem folha de porta.
          const passage = source && !source.sliding && source.widthCm > MAX_SWING_DOOR_CM
          if (source && !gap.mirrored && !passage && !gap.open) {
            const hingeAtStart = source.hinge !== 'end'
            const [h, f] = hingeAtStart ? [gap.a, gap.b] : [gap.b, gap.a]
            const [hingeX, hingeZ] = edge.horizontal ? [h, edge.line] : [edge.line, h]
            const [freeX, freeZ] = edge.horizontal ? [f, edge.line] : [edge.line, f]
            doors.push({
              room: i,
              side,
              hingeX,
              hingeZ,
              freeX,
              freeZ,
              into: source.swing === 'out' ? -1 : 1,
              sliding: source.sliding === true,
              widthM: gap.b - gap.a,
            })
          }
        } else {
          const sill = (gap.sillCm ?? 100) / 100
          const top = Math.min(WALL_HEIGHT - 0.1, sill + (gap.heightCm ?? 110) / 100)
          piece(gap.a, gap.b, 0, sill)
          piece(gap.a, gap.b, top, WALL_HEIGHT)
          piece(gap.a, gap.b, sill, top, 'glass')
        }
        cursor = Math.max(cursor, gap.b)
      }
      piece(cursor, edge.end, 0, WALL_HEIGHT)
    }
  })

  return { walls, doors, connections, entrances, passages }
}

const DINING = new Set(['mesa-de-jantar', 'mesa-externa'])

/** Retângulos que bloqueiam quem anda: paredes até a cintura e móveis de chão (sem tapete). */
export function blockersOf(world: HouseWorld, model: HouseModel, layouts: RoomLayout[]): Rect2[] {
  const walls = world.walls.filter((w) => w.bottom < 1)
  const furniture = layouts.flatMap((layout, i) => {
    // Cômodo em L desenhado como um só: coordenadas a partir do retângulo que envolve o L.
    const o = layout.origin ?? model.rooms[i]
    return layout.placed
      .filter((p) => p.placement === 'floor' && p.height >= 30)
      .map((p) => {
        // Mesa de jantar: as cadeiras (desenhadas em volta) também bloqueiam.
        const chairs = DINING.has(p.category) ? 0.35 : 0
        return {
          minX: o.xM + p.x / 100 - chairs,
          maxX: o.xM + (p.x + p.w) / 100 + chairs,
          minZ: o.yM + p.y / 100 - chairs,
          maxZ: o.yM + (p.y + p.d) / 100 + chairs,
        }
      })
  })
  return [...walls, ...furniture]
}

const hits = (x: number, z: number, r: Rect2, radius: number) =>
  x > r.minX - radius && x < r.maxX + radius && z > r.minZ - radius && z < r.maxZ + radius

/**
 * Anda de (x, z) até (x + dx, z + dz) sem atravessar parede nem móvel: se bater, tenta cada
 * eixo separado (desliza encostado na parede).
 */
export function move(
  from: { x: number; z: number },
  dx: number,
  dz: number,
  blockers: Rect2[],
  radius = BODY_RADIUS,
): { x: number; z: number } {
  const free = (x: number, z: number) => !blockers.some((b) => hits(x, z, b, radius))
  // Passos de até 10 cm: um passo grande pularia por cima de uma parede de 12 cm.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1))
  let at = from
  for (let i = 0; i < steps; i++) {
    const [sx, sz] = [dx / steps, dz / steps]
    if (free(at.x + sx, at.z + sz)) at = { x: at.x + sx, z: at.z + sz }
    else if (free(at.x + sx, at.z)) at = { x: at.x + sx, z: at.z }
    else if (free(at.x, at.z + sz)) at = { x: at.x, z: at.z + sz }
    else break
  }
  return at
}

/** Ponto livre do cômodo (longe dos móveis) mais perto do centro: onde o tour para. */
export function freeSpot(model: HouseModel, layouts: RoomLayout[], index: number) {
  const room = model.rooms[index]
  const items = layouts[index]?.placed.filter((p) => p.placement === 'floor') ?? []
  const o = layouts[index]?.origin ?? room
  const cx = room.xM + room.widthM / 2
  const cz = room.yM + room.depthM / 2
  let best: { x: number; z: number; d: number } | undefined
  for (let x = room.xM + 0.4; x <= room.xM + room.widthM - 0.4; x += 0.1) {
    for (let z = room.yM + 0.4; z <= room.yM + room.depthM - 0.4; z += 0.1) {
      const blocked = items.some((p) =>
        hits(
          x,
          z,
          {
            minX: o.xM + p.x / 100,
            maxX: o.xM + (p.x + p.w) / 100,
            minZ: o.yM + p.y / 100,
            maxZ: o.yM + (p.y + p.d) / 100,
          },
          0.35,
        ),
      )
      if (blocked) continue
      const d = Math.hypot(x - cx, z - cz)
      if (!best || d < best.d) best = { x, z, d }
    }
  }
  return best ? { x: best.x, z: best.z } : { x: cx, z: cz }
}

/** Cômodo de entrada: o que tem porta para fora (de preferência a sala), senão a sala ou o maior. */
export function startRoom(model: HouseModel, world: HouseWorld): number {
  const entranceRooms = world.entrances.map((e) => e.room)
  const isSala = (i: number) => model.rooms[i].type === 'sala'
  const pick = entranceRooms.find(isSala) ?? entranceRooms[0]
  if (pick !== undefined) return pick
  const sala = model.rooms.findIndex((r) => r.type === 'sala')
  if (sala >= 0) return sala
  const areas = model.rooms.map((r) => r.widthM * r.depthM)
  return areas.indexOf(Math.max(...areas))
}

/**
 * Roteiro do tour: começa na entrada e passa por todos os cômodos alcançáveis pelas portas
 * (busca em profundidade, voltando pelo mesmo caminho), parando num ponto livre de cada um.
 * Cada passagem de porta vira três pontos: antes, no vão e depois.
 */
export function tourPath(model: HouseModel, world: HouseWorld, layouts: RoomLayout[]) {
  const start = startRoom(model, world)
  const stops: { x: number; z: number; room: number; pause: boolean }[] = []
  const visited = new Set<number>()
  const spot = (i: number) => freeSpot(model, layouts, i)
  const through = (c: Connection) => {
    stops.push({ x: c.x - c.nx * 0.6, z: c.z - c.nz * 0.6, room: c.from, pause: false })
    stops.push({ x: c.x, z: c.z, room: c.from, pause: false })
    stops.push({ x: c.x + c.nx * 0.6, z: c.z + c.nz * 0.6, room: c.to, pause: false })
  }
  const visit = (i: number) => {
    visited.add(i)
    stops.push({ ...spot(i), room: i, pause: true })
    for (const c of world.connections.filter((c) => c.from === i && !visited.has(c.to))) {
      if (visited.has(c.to)) continue
      through(c)
      visit(c.to)
      const back = world.connections.find(
        (b) => b.from === c.to && b.to === i && Math.hypot(b.x - c.x, b.z - c.z) < 0.5,
      )
      if (back) {
        through(back)
        stops.push({ ...spot(i), room: i, pause: false })
      }
    }
  }
  visit(start)
  // Volta do último retorno à sala é desnecessária: corta o que vem depois da última parada.
  const last = stops.map((s) => s.pause).lastIndexOf(true)
  return { start, stops: stops.slice(0, last + 1) }
}
