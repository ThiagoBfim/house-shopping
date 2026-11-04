import type { Placement } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import type { FloorPlan, Opening } from './floor-plan.ts'
import { splitItemKey } from './house.ts'

/**
 * Posição dos móveis num cômodo retangular, por regras (vista de cima, em cm; x da esquerda
 * para a direita, y de cima para baixo, como na planta). Não é a disposição ótima: é o que um
 * decorador faria primeiro — móvel encostado na parede, passagem livre na frente, nada na frente
 * de porta, móvel alto fora da janela, cama centralizada com criados dos lados, sofá de frente
 * para o rack, mesa de jantar no meio com espaço para as cadeiras.
 */

export type Wall = 'top' | 'right' | 'bottom' | 'left'

export interface LayoutItem {
  /** Chave do item na lista ("quarto-1:cama-box") ou id do item adicionado. */
  key: string
  /** Categoria do catálogo ("cama-box"): decide a regra. */
  category: string
  label: string
  placement: Placement
  width: number
  depth: number
  height: number
  /** Quantas unidades (criado-mudo × 2). */
  qty: number
}

export interface PlacedItem {
  key: string
  /** Unidade (0, 1…) quando qty > 1. */
  unit: number
  category: string
  label: string
  placement: Placement
  /** Retângulo ocupado no chão (já girado), em cm. */
  x: number
  y: number
  w: number
  d: number
  /** Altura do móvel e do chão até a base (TV e ar-condicionado ficam na parede). */
  height: number
  elevation: number
  /** Para onde a frente aponta (a parede de trás é a oposta). */
  facing: 'down' | 'left' | 'up' | 'right'
  /** Mesa encostada na parede (cômodo pequeno): sem cadeiras do lado da parede (o de trás). */
  againstWall?: boolean
  /** TV em pé em cima de um móvel (rack, cômoda), na altura dele: no 3D, com pé. */
  standing?: boolean
}

export interface RoomLayout {
  width: number
  depth: number
  openings: Opening[]
  placed: PlacedItem[]
  /** O que não coube (sem parede livre, porta ou passagem no caminho). */
  unplaced: { key: string; label: string }[]
  /**
   * Cômodo em L desenhado como um só: canto de cima à esquerda do retângulo que envolve as
   * partes (m, na casa). Sem isso, as coordenadas são do próprio retângulo do cômodo.
   */
  origin?: { xM: number; yM: number }
}

interface Rect {
  x: number
  y: number
  w: number
  d: number
}

/** Passagem livre na frente de um móvel. */
export const FRONT_CLEARANCE = 60
/** Espaço dos lados da cama para deitar e levantar. */
export const BED_SIDE_CLEARANCE = 50
/** Móvel mais alto que isso não fica na frente de janela. */
export const WINDOW_SAFE_HEIGHT = 110
const STEP = 5
const CHAIR_SPACE = 60
const COFFEE_GAP = 40

const contains = (outer: Rect, r: Rect) =>
  r.x >= outer.x &&
  r.y >= outer.y &&
  r.x + r.w <= outer.x + outer.w &&
  r.y + r.d <= outer.y + outer.d

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d

const wallLength = (wall: Wall, W: number, D: number) =>
  wall === 'top' || wall === 'bottom' ? W : D

const FACING: Record<Wall, PlacedItem['facing']> = {
  top: 'down',
  bottom: 'up',
  left: 'right',
  right: 'left',
}

/** Retângulo do móvel encostado na parede, a `offset` cm do início dela. */
function againstWall(wall: Wall, offset: number, w: number, d: number, W: number, D: number): Rect {
  switch (wall) {
    case 'top':
      return { x: offset, y: 0, w, d }
    case 'bottom':
      return { x: offset, y: D - d, w, d }
    case 'left':
      return { x: 0, y: offset, w: d, d: w }
    case 'right':
      return { x: W - d, y: offset, w: d, d: w }
  }
}

/** Faixa na frente do móvel (para onde ele abre), com `depth` cm. */
function frontOf(rect: Rect, facing: PlacedItem['facing'], depth: number): Rect {
  switch (facing) {
    case 'down':
      return { x: rect.x, y: rect.y + rect.d, w: rect.w, d: depth }
    case 'up':
      return { x: rect.x, y: rect.y - depth, w: rect.w, d: depth }
    case 'right':
      return { x: rect.x + rect.w, y: rect.y, w: depth, d: rect.d }
    case 'left':
      return { x: rect.x - depth, y: rect.y, w: depth, d: rect.d }
  }
}

/** Retângulo que a abertura ocupa na parede (fino) e, para porta, o giro dela. */
/** Porta de abrir vai até ~1,10 m; mais larga que isso é vão aberto (sala ↔ jantar, varanda). */
export const MAX_SWING_DOOR_CM = 110
/** Passagem livre na frente de um vão ou de porta de correr. */
const PASSAGE_CM = 60

function openingZone(
  { kind, wall, position, widthCm, sliding }: Opening & { sliding?: boolean },
  W: number,
  D: number,
) {
  const length = wallLength(wall, W, D)
  const start = Math.max(0, position * length - widthCm / 2 - 10)
  const span = Math.min(length - start, widthCm + 20)
  // Porta de abrir: o giro da folha (quadrado do tamanho da porta). Vão largo ou porta de
  // correr não giram: só a passagem de 60 cm (senão um vão de 2,5 m tomaria metade da sala).
  const swings = kind === 'door' && !sliding && widthCm <= MAX_SWING_DOOR_CM
  const reach = kind !== 'door' ? 15 : swings ? widthCm + 10 : PASSAGE_CM
  return againstWall(
    wall,
    start,
    span,
    Math.min(reach, wall === 'top' || wall === 'bottom' ? D : W),
    W,
    D,
  )
}

export function arrangeRoom(
  room: { width: number; depth: number; openings: Opening[] },
  items: LayoutItem[],
  /** Peças que já estão no cômodo (armários embutidos das fotos): ocupam lugar e não se movem. */
  fixed: PlacedItem[] = [],
): RoomLayout {
  const W = room.width
  const D = room.depth
  const doors = room.openings.filter((o) => o.kind === 'door').map((o) => openingZone(o, W, D))
  const windows = room.openings.filter((o) => o.kind === 'window').map((o) => openingZone(o, W, D))
  const placed: PlacedItem[] = [...fixed]
  const unplaced: RoomLayout['unplaced'] = []
  /** Passagens reservadas (frente dos móveis, lados da cama): nada de chão em cima. */
  const reserved: Rect[] = fixed
    .filter((p) => p.placement === 'floor')
    .map((p) => frontOf(p, p.facing, FRONT_CLEARANCE))
  const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.d <= D
  const floorTaken = () => placed.filter((p) => p.placement === 'floor')

  /** O móvel cabe aqui? (dentro, sem bater em móvel, porta, passagem; alto fora da janela) */
  const fits = (rect: Rect, height: number, own: Rect[] = []) =>
    inside(rect) &&
    !floorTaken().some((p) => overlaps(rect, p)) &&
    !doors.some((z) => overlaps(rect, z)) &&
    !reserved.some((z) => overlaps(rect, z)) &&
    !(height > WINDOW_SAFE_HEIGHT && windows.some((z) => overlaps(rect, z))) &&
    own.every((z) => inside(z) && !floorTaken().some((p) => overlaps(z, p)))

  const put = (
    item: LayoutItem,
    unit: number,
    rect: Rect,
    facing: PlacedItem['facing'],
    elevation = 0,
  ) =>
    placed.push({
      key: item.key,
      unit,
      category: item.category,
      label: item.label,
      placement: item.placement,
      ...rect,
      height: item.height,
      elevation,
      facing,
    })

  type Candidate = { wall: Wall; offset: number; rect: Rect; score: number }
  /** Melhor posição encostada na parede, pela nota de cada regra. */
  const bestOnWalls = (
    item: LayoutItem,
    score: (c: Omit<Candidate, 'score'>, length: number) => number,
    extra: (rect: Rect, facing: PlacedItem['facing']) => Rect[] = (rect, facing) => [
      frontOf(rect, facing, FRONT_CLEARANCE),
    ],
    within?: Rect,
  ) => {
    let best: Candidate | undefined
    for (const wall of ['top', 'right', 'bottom', 'left'] as Wall[]) {
      const length = wallLength(wall, W, D)
      for (let offset = 0; offset + item.width <= length; offset += STEP) {
        const rect = againstWall(wall, offset, item.width, item.depth, W, D)
        if (within && !contains(within, rect)) continue
        const own = extra(rect, FACING[wall])
        if (!fits(rect, item.height, own)) continue
        const candidate = { wall, offset, rect }
        const value = score(candidate, length)
        if (!best || value > best.score) best = { ...candidate, score: value }
      }
    }
    return best
  }

  const center = (c: { offset: number }, length: number, width: number) =>
    -Math.abs(c.offset + width / 2 - length / 2)
  const corner = (c: { offset: number }, length: number, width: number) =>
    -Math.min(c.offset, length - width - c.offset)

  const ofCategory = (category: string) => items.filter((i) => i.category === category)
  const done = new Set<LayoutItem>()
  const fail = (item: LayoutItem) => unplaced.push({ key: item.key, label: item.label })

  // 1. Cama (ou berço): parede mais longa, centralizada, com espaço dos dois lados.
  for (const item of [...ofCategory('cama-box'), ...ofCategory('berco')]) {
    done.add(item)
    const isBed = item.category === 'cama-box'
    const best = bestOnWalls(
      item,
      (c, length) => length * 2 + center(c, length, item.width),
      (rect, facing) => {
        const sides =
          facing === 'down' || facing === 'up'
            ? [
                { x: rect.x - BED_SIDE_CLEARANCE, y: rect.y, w: BED_SIDE_CLEARANCE, d: rect.d },
                { x: rect.x + rect.w, y: rect.y, w: BED_SIDE_CLEARANCE, d: rect.d },
              ]
            : [
                { x: rect.x, y: rect.y - BED_SIDE_CLEARANCE, w: rect.w, d: BED_SIDE_CLEARANCE },
                { x: rect.x, y: rect.y + rect.d, w: rect.w, d: BED_SIDE_CLEARANCE },
              ]
        return [frontOf(rect, facing, FRONT_CLEARANCE), ...(isBed ? sides : [])]
      },
    )
    if (!best) {
      fail(item)
      continue
    }
    const facing = FACING[best.wall]
    put(item, 0, best.rect, facing)
    reserved.push(frontOf(best.rect, facing, FRONT_CLEARANCE))
    if (!isBed) continue
    // Criados-mudos: um de cada lado, encostados na cabeceira (ocupam a passagem lateral).
    const tables = ofCategory('criado-mudo')
    for (const table of tables) {
      done.add(table)
      for (let unit = 0; unit < table.qty; unit++) {
        const side = unit % 2 === 0 ? -1 : 1
        const r = best.rect
        const rect =
          facing === 'down' || facing === 'up'
            ? {
                x: side < 0 ? r.x - table.width - 5 : r.x + r.w + 5,
                y: facing === 'down' ? r.y : r.y + r.d - table.depth,
                w: table.width,
                d: table.depth,
              }
            : {
                x: facing === 'right' ? r.x : r.x + r.w - table.depth,
                y: side < 0 ? r.y - table.width - 5 : r.y + r.d + 5,
                w: table.depth,
                d: table.width,
              }
        if (fits(rect, table.height)) put(table, unit, rect, facing)
        else fail(table)
      }
    }
    // Passagens dos lados da cama (o que sobrou ao lado dos criados).
    if (facing === 'down' || facing === 'up') {
      reserved.push(
        {
          x: best.rect.x - BED_SIDE_CLEARANCE,
          y: best.rect.y,
          w: BED_SIDE_CLEARANCE,
          d: best.rect.d,
        },
        { x: best.rect.x + best.rect.w, y: best.rect.y, w: BED_SIDE_CLEARANCE, d: best.rect.d },
      )
    } else {
      reserved.push(
        {
          x: best.rect.x,
          y: best.rect.y - BED_SIDE_CLEARANCE,
          w: best.rect.w,
          d: BED_SIDE_CLEARANCE,
        },
        { x: best.rect.x, y: best.rect.y + best.rect.d, w: best.rect.w, d: BED_SIDE_CLEARANCE },
      )
    }
  }

  // Sala de estar e jantar: metade para o estar (a mais longe da porta), metade para a mesa.
  const DINING = new Set(['mesa-de-jantar', 'mesa-externa'])
  let livingZone: Rect | undefined
  let diningZone: Rect | undefined
  if (ofCategory('sofa').length && items.some((i) => DINING.has(i.category))) {
    const halves: [Rect, Rect] =
      D >= W
        ? [
            { x: 0, y: 0, w: W, d: D / 2 },
            { x: 0, y: D / 2, w: W, d: D / 2 },
          ]
        : [
            { x: 0, y: 0, w: W / 2, d: D },
            { x: W / 2, y: 0, w: W / 2, d: D },
          ]
    const fromDoor = (r: Rect) =>
      Math.min(
        Infinity,
        ...doors.map((z) =>
          Math.hypot(z.x + z.w / 2 - (r.x + r.w / 2), z.y + z.d / 2 - (r.y + r.d / 2)),
        ),
      )
    ;[livingZone, diningZone] =
      fromDoor(halves[0]) >= fromDoor(halves[1]) ? halves : [halves[1], halves[0]]
  }

  // 2. Sofá na parede mais longa; rack na parede da frente, alinhado com ele.
  const sofa = ofCategory('sofa')[0]
  let sofaPlaced: PlacedItem | undefined
  if (sofa) {
    done.add(sofa)
    // Na sala dividida, sofá e rack precisam de paredes opostas dentro da metade do estar:
    // as laterais (a parede "da frente" do sofá estaria na metade do jantar).
    const sideWalls: Wall[] = D >= W ? ['left', 'right'] : ['top', 'bottom']
    const score = (c: Omit<Candidate, 'score'>, length: number) =>
      (livingZone && sideWalls.includes(c.wall) ? 10000 : 0) +
      length +
      center(c, length, sofa.width)
    const best = bestOnWalls(sofa, score, undefined, livingZone) ?? bestOnWalls(sofa, score)
    if (best) {
      put(sofa, 0, best.rect, FACING[best.wall])
      sofaPlaced = placed.at(-1)
    } else fail(sofa)
  }
  const OPPOSITE: Record<Wall, Wall> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }
  const rack = ofCategory('rack')[0]
  if (rack) {
    done.add(rack)
    const sofaWall =
      sofaPlaced && (Object.keys(FACING) as Wall[]).find((w) => FACING[w] === sofaPlaced!.facing)
    const sofaMid =
      sofaPlaced &&
      (sofaWall === 'top' || sofaWall === 'bottom'
        ? sofaPlaced.x + sofaPlaced.w / 2
        : sofaPlaced.y + sofaPlaced.d / 2)
    const score = (c: Omit<Candidate, 'score'>, length: number) =>
      sofaWall && sofaMid !== undefined
        ? (c.wall === OPPOSITE[sofaWall] ? 1000 : 0) - Math.abs(c.offset + rack.width / 2 - sofaMid)
        : center(c, length, rack.width)
    const best = bestOnWalls(rack, score, undefined, livingZone) ?? bestOnWalls(rack, score)
    if (best) put(rack, 0, best.rect, FACING[best.wall])
    else fail(rack)
  }
  // Reserva a frente do sofá e do rack depois de posicionar os dois (um fica de frente para o outro).
  for (const p of placed.filter((p) => p.category === 'sofa' || p.category === 'rack')) {
    reserved.push(frontOf(p, p.facing, FRONT_CLEARANCE))
  }

  // 3. Mesa de centro na frente do sofá (dentro da passagem, é o lugar dela).
  for (const table of ofCategory('mesa-de-centro')) {
    done.add(table)
    if (!sofaPlaced) {
      fail(table)
      continue
    }
    const vertical = sofaPlaced.facing === 'down' || sofaPlaced.facing === 'up'
    const [w, d] = vertical ? [table.width, table.depth] : [table.depth, table.width]
    const front = frontOf(sofaPlaced, sofaPlaced.facing, COFFEE_GAP)
    const rect = vertical
      ? {
          x: sofaPlaced.x + sofaPlaced.w / 2 - w / 2,
          y: sofaPlaced.facing === 'down' ? front.y + front.d : front.y - d,
          w,
          d,
        }
      : {
          x: sofaPlaced.facing === 'right' ? front.x + front.w : front.x - w,
          y: sofaPlaced.y + sofaPlaced.d / 2 - d / 2,
          w,
          d,
        }
    const free =
      inside(rect) &&
      !floorTaken().some((p) => overlaps(rect, p)) &&
      !doors.some((z) => overlaps(rect, z))
    if (free) put(table, 0, rect, sofaPlaced.facing)
    else fail(table)
  }

  // 4. Mesas no meio (antes dos móveis pequenos, que tomariam o lugar), com espaço para as
  //    cadeiras em volta; nas duas orientações, o mais perto do centro possível.
  for (const item of items.filter((i) => i.placement === 'floor' && DINING.has(i.category))) {
    done.add(item)
    let best: { rect: Rect; distance: number; inZone: boolean } | undefined
    for (const [w, d] of [
      [item.width, item.depth],
      [item.depth, item.width],
    ]) {
      for (let x = CHAIR_SPACE; x + w + CHAIR_SPACE <= W; x += STEP) {
        for (let y = CHAIR_SPACE; y + d + CHAIR_SPACE <= D; y += STEP) {
          const zone = {
            x: x - CHAIR_SPACE,
            y: y - CHAIR_SPACE,
            w: w + 2 * CHAIR_SPACE,
            d: d + 2 * CHAIR_SPACE,
          }
          if (
            floorTaken().some((p) => overlaps(zone, p)) ||
            doors.some((z) => overlaps(zone, z)) ||
            reserved.some((z) => overlaps({ x, y, w, d }, z))
          )
            continue
          // Na metade do jantar, quando há; o mais perto do centro dela.
          const inZone = !diningZone || contains(diningZone, zone)
          const target = diningZone ?? { x: 0, y: 0, w: W, d: D }
          const distance = Math.hypot(
            x + w / 2 - (target.x + target.w / 2),
            y + d / 2 - (target.y + target.d / 2),
          )
          const better =
            !best ||
            (inZone && !best.inZone) ||
            (inZone === best.inZone && distance < best.distance)
          if (better) best = { rect: { x, y, w, d }, distance, inZone }
        }
      }
    }
    if (best) {
      put(item, 0, best.rect, 'down')
      // As cadeiras ficam em volta: ninguém encosta móvel ali.
      const r = best.rect
      reserved.push({
        x: r.x - CHAIR_SPACE,
        y: r.y - CHAIR_SPACE,
        w: r.w + 2 * CHAIR_SPACE,
        d: r.d + 2 * CHAIR_SPACE,
      })
      continue
    }
    // Cômodo pequeno: mesa encostada numa parede, cadeiras nos outros três lados.
    const C = CHAIR_SPACE
    let wallBest: { rect: Rect; zone: Rect; wall: Wall; distance: number } | undefined
    const target = diningZone ?? { x: 0, y: 0, w: W, d: D }
    for (const [w, d] of [
      [item.width, item.depth],
      [item.depth, item.width],
    ]) {
      for (const wall of ['top', 'bottom', 'left', 'right'] as Wall[]) {
        const along = wall === 'top' || wall === 'bottom'
        const length = along ? W : D
        const size = along ? w : d
        for (let o = C; o + size + C <= length; o += STEP) {
          const rect = {
            top: { x: o, y: 0, w, d },
            bottom: { x: o, y: D - d, w, d },
            left: { x: 0, y: o, w, d },
            right: { x: W - w, y: o, w, d },
          }[wall]
          const zone = {
            top: { x: o - C, y: 0, w: w + 2 * C, d: d + C },
            bottom: { x: o - C, y: D - d - C, w: w + 2 * C, d: d + C },
            left: { x: 0, y: o - C, w: w + C, d: d + 2 * C },
            right: { x: W - w - C, y: o - C, w: w + C, d: d + 2 * C },
          }[wall]
          if (
            zone.x < 0 ||
            zone.y < 0 ||
            zone.x + zone.w > W ||
            zone.y + zone.d > D ||
            floorTaken().some((p) => overlaps(zone, p)) ||
            doors.some((z) => overlaps(zone, z)) ||
            reserved.some((z) => overlaps(rect, z))
          )
            continue
          const distance = Math.hypot(
            rect.x + w / 2 - (target.x + target.w / 2),
            rect.y + d / 2 - (target.y + target.d / 2),
          )
          if (!wallBest || distance < wallBest.distance) wallBest = { rect, zone, wall, distance }
        }
      }
    }
    if (wallBest) {
      put(item, 0, wallBest.rect, FACING[wallBest.wall])
      placed[placed.length - 1].againstWall = true
      reserved.push(wallBest.zone)
    } else fail(item)
  }

  // 5. Encostados na parede: grandes primeiro; armário, geladeira e freezer nos cantos.
  const CORNER = new Set([
    'guarda-roupa',
    'guarda-roupa-infantil',
    'geladeira',
    'freezer',
    'sapateira',
  ])
  const wallItems = items
    .filter((i) => i.placement === 'floor' && !done.has(i))
    .sort((a, b) => b.width * b.depth - a.width * a.depth)
  for (const item of wallItems) {
    done.add(item)
    for (let unit = 0; unit < item.qty; unit++) {
      const best = bestOnWalls(item, (c, length) =>
        CORNER.has(item.category)
          ? corner(c, length, item.width)
          : corner(c, length, item.width) / 4,
      )
      if (!best) {
        fail(item)
        continue
      }
      const facing = FACING[best.wall]
      put(item, unit, best.rect, facing)
      reserved.push(frontOf(best.rect, facing, FRONT_CLEARANCE))
    }
  }

  // 6. Tapete: sob a área de estar (sofá + mesa de centro) ou no meio do cômodo; pode ficar sob os móveis.
  for (const rug of items.filter((i) => i.placement === 'rug')) {
    const coffee = placed.find((p) => p.category === 'mesa-de-centro')
    const cx = coffee ? coffee.x + coffee.w / 2 : W / 2
    const cy = coffee ? coffee.y + coffee.d / 2 : D / 2
    const vertical = !sofaPlaced || sofaPlaced.facing === 'down' || sofaPlaced.facing === 'up'
    const [w, d] = vertical ? [rug.width, rug.depth] : [rug.depth, rug.width]
    const rect = {
      x: Math.min(Math.max(0, cx - w / 2), Math.max(0, W - w)),
      y: Math.min(Math.max(0, cy - d / 2), Math.max(0, D - d)),
      w: Math.min(w, W),
      d: Math.min(d, D),
    }
    put(rug, 0, rect, 'down')
  }

  // 7. Na parede: não ocupam chão. TV acima do rack ou de frente para a cama/sofá; o resto
  //    (ar-condicionado no alto, espelho) num trecho de parede livre: sem outro item de parede
  //    nem móvel encostado que chegue à altura dele (espelho atrás da cama, ar em cima do armário).
  /** Item de parede que vai em cima de um móvel: TV no rack, coifa no fogão. */
  const alongWall = (wall: Wall, r: Rect) =>
    wall === 'top' || wall === 'bottom'
      ? { start: r.x, end: r.x + r.w }
      : { start: r.y, end: r.y + r.d }
  const touches = (wall: Wall, r: Rect) =>
    wall === 'top'
      ? r.y <= 5
      : wall === 'bottom'
        ? r.y + r.d >= D - 5
        : wall === 'left'
          ? r.x <= 5
          : r.x + r.w >= W - 5
  const wallOf = (p: PlacedItem) =>
    (Object.keys(FACING) as Wall[]).find((w) => FACING[w] === p.facing)!

  for (const item of items.filter((i) => i.placement === 'wall')) {
    const elevation = ELEVATION[item.category] ?? 30
    const anchor =
      item.category === 'tv'
        ? (placed.find((p) => p.category === 'rack') ??
          placed.find((p) => p.category === 'cama-box' || p.category === 'sofa'))
        : placed.find((p) => p.category === ABOVE[item.category])
    if (anchor && anchor.category === ABOVE[item.category]) {
      // TV do rack, coifa do fogão: na parede dele, centralizada em cima dele.
      const wall = wallOf(anchor)
      const length = wallLength(wall, W, D)
      if (item.width > length) {
        fail(item)
        continue
      }
      const { start, end } = alongWall(wall, anchor)
      const offset = Math.min(Math.max(0, (start + end) / 2 - item.width / 2), length - item.width)
      put(item, 0, againstWall(wall, offset, item.width, item.depth, W, D), FACING[wall], elevation)
      continue
    }
    // Sem rack: trecho livre de parede. TV de frente para a cama/sofá (parede oposta, alinhada
    // com o centro deles); o resto no meio da parede. Nada de TV na porta do guarda-roupa.
    const preferred = anchor ? OPPOSITE[wallOf(anchor)] : undefined
    const target = (wall: Wall, length: number) => {
      if (!anchor || wall !== preferred) return length / 2
      const { start, end } = alongWall(wall, anchor)
      return (start + end) / 2
    }
    let best: { wall: Wall; offset: number; score: number } | undefined
    for (const wall of ['top', 'left', 'right', 'bottom'] as Wall[]) {
      const length = wallLength(wall, W, D)
      for (let offset = 0; offset + item.width <= length; offset += STEP) {
        const span = { start: offset, end: offset + item.width }
        const hit = (r: Rect) => {
          const other = alongWall(wall, r)
          return other.start < span.end && span.start < other.end
        }
        const blocked =
          placed.some((p) => p.placement === 'wall' && wallOf(p) === wall && hit(p)) ||
          placed.some(
            (p) =>
              p.placement === 'floor' && touches(wall, p) && hit(p) && p.height > elevation - 5,
          ) ||
          [...doors, ...(elevation < 100 ? windows : [])].some((z) => touches(wall, z) && hit(z))
        if (blocked) continue
        const score =
          (preferred && wall !== preferred ? -10000 : 0) -
          Math.abs(offset + item.width / 2 - target(wall, length))
        if (!best || score > best.score) best = { wall, offset, score }
      }
    }
    if (!best) {
      fail(item)
      continue
    }
    put(
      item,
      0,
      againstWall(best.wall, best.offset, item.width, item.depth, W, D),
      FACING[best.wall],
      elevation,
    )
  }

  return {
    width: W,
    depth: D,
    openings: room.openings,
    placed: placed.slice(fixed.length),
    unplaced,
  }
}

/**
 * Medida real do cômodo (cm) pela área e pela proporção do retângulo na planta. Sem área,
 * usa a escala dos outros cômodos da planta (m² por unidade do desenho); sem nenhuma, 3 × 3 m.
 */
export function roomSizeCm(plan: Pick<FloorPlan, 'aspect' | 'rooms'>, index: number) {
  const room = plan.rooms[index]
  const planArea = (r: { width: number; height: number }) => r.width * plan.aspect * r.height
  const scales = plan.rooms
    .filter((r) => r.areaM2 !== null && planArea(r) > 0)
    .map((r) => r.areaM2! / planArea(r))
    .sort((a, b) => a - b)
  const scale = scales[Math.floor(scales.length / 2)]
  const area = room.areaM2 ?? (scale ? scale * planArea(room) : 9)
  const ratio = planArea(room) > 0 ? (room.width * plan.aspect) / room.height : 1
  return {
    width: Math.round(Math.sqrt(area * ratio) * 100),
    depth: Math.round(Math.sqrt(area / ratio) * 100),
    estimated: room.areaM2 === null,
  }
}

/** Itens da lista de um cômodo que entram no desenho (com medida e lugar), já como LayoutItem. */
export function layoutItems(view: ListView, instanceId: string | string[]): LayoutItem[] {
  // Um cômodo ou ele + os hóspedes (cozinha + lavanderia, quando não há área de serviço).
  const ids = new Set(Array.isArray(instanceId) ? instanceId : [instanceId])
  const items: LayoutItem[] = []
  for (const entry of view.entries) {
    const { instanceId: id, category } = splitItemKey(entry.item.category)
    if (!ids.has(id) || !entry.size) continue
    const { width, depth, height, placement } = entry.size
    items.push({
      key: entry.item.category,
      category,
      label: entry.option.name,
      placement,
      width,
      depth,
      height,
      qty: entry.item.qty,
    })
  }
  for (const { item, replaced, size } of view.manual) {
    if (!ids.has(item.instanceId) || !replaced || !size) continue
    const { width, depth, height, placement } = size
    items.push({
      key: item.id,
      category: splitItemKey(replaced.item.category).category,
      label: item.name,
      placement,
      width,
      depth,
      height,
      qty: item.qty,
    })
  }
  return items
}

/**
 * O resto do cômodo na lista, que não tem lugar fixo no desenho: o que fica na bancada ou em
 * cima de móvel (micro-ondas, air fryer), guardado (panelas, toalhas) ou que você adicionou sem
 * medida. Assim a "Posição dos móveis" mostra tudo o que está na lista para o cômodo.
 */
export function otherItems(
  view: ListView,
  instanceId: string | string[],
): { key: string; label: string; name: string; qty: number }[] {
  const ids = new Set(Array.isArray(instanceId) ? instanceId : [instanceId])
  const out: { key: string; label: string; name: string; qty: number }[] = []
  for (const entry of view.entries) {
    const { instanceId: id } = splitItemKey(entry.item.category)
    if (!ids.has(id) || entry.size) continue
    out.push({
      key: entry.item.category,
      label: entry.label,
      name: entry.option.name,
      qty: entry.item.qty,
    })
  }
  for (const { item, replaced, size } of view.manual) {
    if (!ids.has(item.instanceId) || (replaced && size)) continue
    out.push({ key: item.id, label: replaced?.label ?? item.name, name: item.name, qty: item.qty })
  }
  return out
}

/** Cômodos com itens na lista (para saber quais ficam sem lugar na planta). */
export function instancesIn(view: ListView): string[] {
  const ids = new Set<string>()
  for (const entry of view.entries) ids.add(splitItemKey(entry.item.category).instanceId)
  for (const { item } of view.manual) if (item.instanceId) ids.add(item.instanceId)
  return [...ids]
}

/** Altura (cm) do chão até a base dos itens de parede. */
const ELEVATION: Record<string, number> = {
  'ar-condicionado': 210,
  tv: 95,
  coifa: 165,
  purificador: 120,
}

/** Móveis que aguentam a TV em cima (em pé, onde o móvel estiver). */
const STANDS: Record<string, Set<string>> = {
  tv: new Set(['rack', 'comoda', 'comoda-trocador']),
}

/** Item de parede que vai em cima de um móvel: TV no rack, coifa no fogão (e segue ele). */
const ABOVE: Record<string, string> = { tv: 'rack', coifa: 'fogao' }

/** Parede de trás de quem olha para cada lado. */
const BACK_WALL: Record<PlacedItem['facing'], Wall> = {
  down: 'top',
  up: 'bottom',
  right: 'left',
  left: 'right',
}

/** Posição sugerida para um móvel (centro em cm no cômodo e para onde a frente aponta). */
export interface PositionHint {
  key: string
  unit: number
  xCm: number
  yCm: number
  rotation: PlacedItem['facing']
}

/**
 * Aplica as posições sugeridas (skill /house-3d, pela planta e pelas fotos) só quando passam na
 * conferência: dentro do cômodo, sem bater em outro móvel de chão e fora do giro das portas.
 * O que não passa fica na posição da regra.
 */
export function applySuggestions(
  layout: RoomLayout,
  hints: PositionHint[],
  /** Peças fixas do cômodo (armários embutidos): a sugestão também não pode bater nelas. */
  fixed: PlacedItem[] = [],
): { layout: RoomLayout; accepted: number } {
  const W = layout.width
  const D = layout.depth
  const doors = layout.openings.filter((o) => o.kind === 'door').map((o) => openingZone(o, W, D))
  const id = (p: { key: string; unit: number }) => `${p.key}#${p.unit}`
  // Uma posição por móvel (a última vale).
  const byItem = new Map(hints.map((h) => [id(h), h]))
  // Retângulo novo de cada sugestão que tem forma válida (dentro do cômodo, na parede certa).
  const targets = new Map<string, PlacedItem>()
  /** TV fora da parede: só vale em cima de um rack/cômoda (conferido no estado final). */
  const onTop = new Map<string, PlacedItem>()
  for (const [key, hint] of byItem) {
    const p = layout.placed.find((q) => id(q) === key)
    if (!p) continue
    // Largura (frente) e profundidade do móvel, independentes de como ele estava girado.
    const sideways = p.facing === 'left' || p.facing === 'right'
    const [width, depth] = sideways ? [p.d, p.w] : [p.w, p.d]
    const [w, d] =
      hint.rotation === 'left' || hint.rotation === 'right' ? [depth, width] : [width, depth]
    const rect = { x: hint.xCm - w / 2, y: hint.yCm - d / 2, w, d }
    const inside = rect.x >= -1 && rect.y >= -1 && rect.x + w <= W + 1 && rect.y + d <= D + 1
    // Na parede (TV, ar): encostado na parede de trás; tapete: qualquer lugar dentro (fica por
    // baixo dos móveis); no chão: sem porta nem armário fixo (os outros móveis, abaixo).
    const againstBack = {
      top: rect.y <= 3,
      bottom: rect.y + d >= D - 3,
      left: rect.x <= 3,
      right: rect.x + w >= W - 3,
    }[BACK_WALL[hint.rotation]]
    const moved = { ...p, ...rect, facing: hint.rotation }
    if (p.placement === 'wall') {
      if (inside && againstBack) {
        // De volta à parede: a TV que estava em pé no rack volta à altura de parede.
        const { standing: _s, ...rest } = moved
        void _s
        targets.set(key, p.standing ? { ...rest, elevation: ELEVATION[p.category] ?? 30 } : rest)
      } else if (inside && STANDS[p.category]) onTop.set(key, moved)
      continue
    }
    const shapeOk =
      inside &&
      (p.placement === 'rug' ||
        (!fixed.some((o) => o.placement === 'floor' && overlaps(rect, o)) &&
          !doors.some((z) => overlaps(rect, z))))
    if (shapeOk) targets.set(key, moved)
  }
  // Todas juntas, no estado final: a ordem não importa (trocar o sofá e o rack de parede só
  // dá certo com os dois no lugar novo). Sai quem bate em alguém; repete até assentar.
  for (;;) {
    const final = layout.placed.map((p) => targets.get(id(p)) ?? p)
    const clash = [...targets.keys()].filter((key) => {
      const t = targets.get(key)!
      return (
        t.placement === 'floor' &&
        final.some((o) => id(o) !== key && o.placement === 'floor' && overlaps(t, o))
      )
    })
    if (!clash.length) break
    for (const key of clash) targets.delete(key)
  }
  // TV em cima do rack (onde o rack ficou): na altura dele, em pé.
  const settled = layout.placed.map((p) => targets.get(id(p)) ?? p)
  for (const [key, tv] of onTop) {
    const cx = tv.x + tv.w / 2
    const cy = tv.y + tv.d / 2
    const stand = settled.find(
      (q) =>
        STANDS[tv.category].has(q.category) &&
        cx >= q.x &&
        cx <= q.x + q.w &&
        cy >= q.y &&
        cy <= q.y + q.d,
    )
    if (stand) targets.set(key, { ...tv, elevation: stand.height, standing: true })
  }
  const placed = layout.placed.map((p) => targets.get(id(p)) ?? p)
  const moved = new Set(targets.keys())
  const accepted = targets.size
  // TV segue o rack, coifa segue o fogão (quando só o móvel de baixo foi mudado de lugar): na
  // parede de trás dele se ele está encostado nela; senão, a TV fica em pé em cima do rack.
  placed.forEach((q, i) => {
    const below = ABOVE[q.category]
    if (q.placement !== 'wall' || !below || moved.has(id(q))) return
    const anchor = placed.find((a) => a.category === below && moved.has(id(a)))
    if (!anchor) return
    const wall = BACK_WALL[anchor.facing]
    const sideways = q.facing === 'left' || q.facing === 'right'
    const [width, depth] = sideways ? [q.d, q.w] : [q.w, q.d]
    const length = wallLength(wall, W, D)
    const touchesWall = {
      top: anchor.y <= 3,
      bottom: anchor.y + anchor.d >= D - 3,
      left: anchor.x <= 3,
      right: anchor.x + anchor.w >= W - 3,
    }[wall]
    const { standing: _s, ...rest } = q
    void _s
    if (touchesWall && width <= length) {
      const center =
        wall === 'top' || wall === 'bottom' ? anchor.x + anchor.w / 2 : anchor.y + anchor.d / 2
      const offset = Math.min(Math.max(0, center - width / 2), length - width)
      placed[i] = {
        ...rest,
        ...againstWall(wall, offset, width, depth, W, D),
        facing: FACING[wall],
        elevation: q.standing ? (ELEVATION[q.category] ?? 30) : q.elevation,
      }
      return
    }
    if (!STANDS[q.category]?.has(anchor.category)) return
    // Em pé no meio do rack, virada para onde o rack está virado.
    const [w, d] =
      anchor.facing === 'left' || anchor.facing === 'right' ? [depth, width] : [width, depth]
    placed[i] = {
      ...rest,
      x: anchor.x + anchor.w / 2 - w / 2,
      y: anchor.y + anchor.d / 2 - d / 2,
      w,
      d,
      facing: anchor.facing,
      elevation: anchor.height,
      standing: true,
    }
  })
  return { layout: { ...layout, placed }, accepted }
}

/** Posições escolhidas pela pessoa (arrastando na vista de cima), por cômodo da lista. */
export type ManualPositions = Record<string, PositionHint[]>

/** Uma posição por móvel (chave + unidade): a nova substitui a anterior. */
export function setPosition(
  positions: ManualPositions,
  instanceId: string,
  hint: PositionHint,
): ManualPositions {
  const room = (positions[instanceId] ?? []).filter(
    (p) => !(p.key === hint.key && p.unit === hint.unit),
  )
  return { ...positions, [instanceId]: [...room, hint] }
}

/** Volta o cômodo às posições sugeridas (regra + leitura da planta/fotos). */
export function clearPositions(positions: ManualPositions, instanceId: string): ManualPositions {
  const { [instanceId]: _removed, ...rest } = positions
  void _removed
  return rest
}

/**
 * Tenta pôr um móvel numa posição: devolve o layout novo só se couber (dentro do cômodo, sem
 * bater em outro móvel, em armário fixo ou no giro da porta).
 */
export function tryMove(
  layout: RoomLayout,
  hint: PositionHint,
  fixed: PlacedItem[] = [],
): RoomLayout | undefined {
  const { layout: moved, accepted } = applySuggestions(layout, [hint], fixed)
  return accepted ? moved : undefined
}

/** Centro e direção atuais de um móvel (ponto de partida para arrastar ou girar). */
export const hintOf = (p: PlacedItem): PositionHint => ({
  key: p.key,
  unit: p.unit,
  xCm: p.x + p.w / 2,
  yCm: p.y + p.d / 2,
  rotation: p.facing,
})
