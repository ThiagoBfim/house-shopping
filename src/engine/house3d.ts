import type { Rooms } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import {
  guestsByHost,
  linkPlanRooms,
  OUTSIDE_TYPE,
  planToHouse,
  type FloorPlan,
  type Opening,
  type PlacedRoom,
  type ReadPlan,
} from './floor-plan.ts'
import {
  applySuggestions,
  arrangeRoom,
  MAX_SWING_DOOR_CM,
  roomSizeCm,
  instancesIn,
  layoutItems,
  type LayoutItem,
  type ManualPositions,
  type PlacedItem,
  type RoomLayout,
} from './layout.ts'

/** Porta ou janela com o que o 3D precisa (dobradiça, abertura, peitoril). */
export interface HouseOpening extends Opening {
  /** Ponta da abertura com a dobradiça (porta de abrir). */
  hinge?: 'start' | 'end'
  /** Abre para dentro deste cômodo ou para fora. */
  swing?: 'in' | 'out'
  sliding?: boolean
  /** Sem parede nenhuma (cômodos unidos pela pessoa: a sala que continua na outra parte). */
  open?: boolean
  /** Janela: altura do peitoril e da janela (cm). */
  sillCm?: number
  heightCm?: number
}

export const FLOORS = ['madeira', 'porcelanato', 'ceramica', 'cimento', 'carpete', 'deck'] as const
export type Floor = (typeof FLOORS)[number]

export interface Finishes {
  floor: Floor
  floorColor: string
  wallColor: string
  /** Veio de uma foto do cômodo (senão, valor comum para o tipo). */
  fromPhoto: boolean
  /** Lado do piso (porcelanato/cerâmica) em cm, quando a foto mostra. */
  tileCm?: number
}

export const BUILT_IN_KINDS = ['armario', 'bancada', 'aereo', 'gabinete', 'prateleira'] as const
export type BuiltInKind = (typeof BUILT_IN_KINDS)[number]
export const BUILT_IN_FINISHES = [
  'madeira-clara',
  'madeira-escura',
  'branco',
  'laca',
  'cinza',
] as const
export type BuiltInFinish = (typeof BUILT_IN_FINISHES)[number]

/**
 * Armário que já está no imóvel (visto nas fotos): embutido, bancada da cozinha com armário
 * embaixo, armário aéreo, gabinete do banheiro, prateleira. Encostado numa parede do cômodo.
 */
export interface BuiltIn {
  kind: BuiltInKind
  wall: Opening['wall']
  /** Começo ao longo da parede (cm a partir da ponta esquerda/de cima) e comprimento. */
  startCm: number
  lengthCm: number
  depthCm: number
  heightCm: number
  /** Do chão até a base (aéreo ~150). */
  elevationCm: number
  finish: BuiltInFinish
  color: string
  /** Bancada: cor do tampo (granito, quartzo) e se tem pia/cooktop. */
  topColor?: string
  sink?: boolean
  cooktop?: boolean
  /** Portas na frente (as fotos mostram). */
  doors?: number
}

/** Posição sugerida pela skill para um móvel (centro, em cm, no retângulo do cômodo). */
export interface Suggestion {
  key: string
  unit: number
  xCm: number
  yCm: number
  rotation: 'down' | 'up' | 'left' | 'right'
}

export interface HouseRoom {
  type: string
  label: string
  /** Retângulo do cômodo na planta, em metros (canto de cima à esquerda). */
  xM: number
  yM: number
  widthM: number
  depthM: number
  openings: HouseOpening[]
  finishes: Finishes
  furniture: Suggestion[]
  /** Armários das fotos (já estão no imóvel; não são da lista). */
  builtIns: BuiltIn[]
  /**
   * Parte de um cômodo em L (sala com estar junto à varanda): nome do cômodo principal. A parte
   * é o mesmo cômodo da lista; o que não cabe no principal vai para ela.
   */
  partOf?: string
  /** Cômodo da lista ("quarto-2"); sem ele, o cômodo aparece vazio. */
  instanceId?: string
}

export type HouseQuality = 'rapida' | 'realista'

export interface HouseModel {
  widthM: number
  depthM: number
  rooms: HouseRoom[]
  notes: string
}

const WALLS = new Set(['top', 'right', 'bottom', 'left'])
const ROTATIONS = new Set(['down', 'up', 'left', 'right'])
const HEX = /^#[0-9a-fA-F]{6}$/
const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

function parseOpening(raw: unknown): HouseOpening | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const o = raw as Record<string, unknown>
  if (o.kind !== 'door' && o.kind !== 'window') return undefined
  if (typeof o.wall !== 'string' || !WALLS.has(o.wall)) return undefined
  if (!num(o.position, 0, 1) || !num(o.widthCm, 40, 400)) return undefined
  return {
    kind: o.kind,
    wall: o.wall as Opening['wall'],
    position: o.position,
    widthCm: o.widthCm,
    ...((o.hinge === 'start' || o.hinge === 'end') && { hinge: o.hinge }),
    ...((o.swing === 'in' || o.swing === 'out') && { swing: o.swing }),
    ...(o.sliding === true && { sliding: true }),
    ...(o.open === true && { open: true }),
    ...(num(o.sillCm, 0, 220) && { sillCm: o.sillCm }),
    ...(num(o.heightCm, 30, 260) && { heightCm: o.heightCm }),
  }
}

/** Valor comum por tipo de cômodo, quando a skill não traz (ou traz inválido). */
function defaultFinishes(type: string): Finishes {
  const wet = ['cozinha', 'banheiro', 'lavanderia'].includes(type)
  const outside = type === 'area-externa'
  return {
    floor: outside ? 'deck' : wet ? 'porcelanato' : 'madeira',
    floorColor: outside ? '#a07850' : wet ? '#e2ded6' : '#b88a5f',
    wallColor: '#f2efe8',
    fromPhoto: false,
  }
}

function parseFinishes(raw: unknown, type: string): Finishes {
  const fallback = defaultFinishes(type)
  if (typeof raw !== 'object' || raw === null) return fallback
  const f = raw as Record<string, unknown>
  return {
    floor: FLOORS.includes(f.floor as Floor) ? (f.floor as Floor) : fallback.floor,
    floorColor:
      typeof f.floorColor === 'string' && HEX.test(f.floorColor)
        ? f.floorColor
        : fallback.floorColor,
    wallColor:
      typeof f.wallColor === 'string' && HEX.test(f.wallColor) ? f.wallColor : fallback.wallColor,
    fromPhoto: f.fromPhoto === true,
    ...(num(f.tileCm, 10, 200) && { tileCm: f.tileCm }),
  }
}

function parseBuiltIn(raw: unknown, room: { widthM: number; depthM: number }): BuiltIn | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const b = raw as Record<string, unknown>
  if (!BUILT_IN_KINDS.includes(b.kind as BuiltInKind)) return undefined
  if (typeof b.wall !== 'string' || !WALLS.has(b.wall)) return undefined
  const wall = b.wall as Opening['wall']
  const wallCm = (wall === 'top' || wall === 'bottom' ? room.widthM : room.depthM) * 100
  const across = (wall === 'top' || wall === 'bottom' ? room.depthM : room.widthM) * 100
  if (!num(b.startCm, 0, 5000) || !num(b.lengthCm, 20, 5000)) return undefined
  if (!num(b.depthCm, 10, 120) || !num(b.heightCm, 3, 300) || !num(b.elevationCm, 0, 250)) {
    return undefined
  }
  // Recorta no tamanho da parede (a leitura da foto não é exata ao cm).
  const startCm = Math.min(b.startCm, wallCm - 20)
  const lengthCm = Math.min(b.lengthCm, wallCm - startCm)
  if (b.depthCm > across / 2) return undefined
  const kind = b.kind as BuiltInKind
  return {
    kind,
    wall,
    startCm,
    lengthCm,
    depthCm: b.depthCm,
    heightCm: Math.min(b.heightCm, 270 - b.elevationCm),
    elevationCm: b.elevationCm,
    finish: BUILT_IN_FINISHES.includes(b.finish as BuiltInFinish)
      ? (b.finish as BuiltInFinish)
      : 'branco',
    color: typeof b.color === 'string' && HEX.test(b.color) ? b.color : '#efece6',
    ...(typeof b.topColor === 'string' && HEX.test(b.topColor) && { topColor: b.topColor }),
    ...(b.sink === true && { sink: true }),
    ...(b.cooktop === true && { cooktop: true }),
    ...(Number.isInteger(b.doors) &&
      (b.doors as number) >= 1 &&
      (b.doors as number) <= 12 && { doors: b.doors as number }),
  }
}

const FACING_FROM: Record<Opening['wall'], PlacedItem['facing']> = {
  top: 'down',
  bottom: 'up',
  left: 'right',
  right: 'left',
}

/** Armário das fotos como peça fixa do cômodo (cm, no retângulo do cômodo). */
export function builtInPlaced(b: BuiltIn, index: number, room: HouseRoom): PlacedItem {
  const W = room.widthM * 100
  const D = room.depthM * 100
  const rect = {
    top: { x: b.startCm, y: 0, w: b.lengthCm, d: b.depthCm },
    bottom: { x: b.startCm, y: D - b.depthCm, w: b.lengthCm, d: b.depthCm },
    left: { x: 0, y: b.startCm, w: b.depthCm, d: b.lengthCm },
    right: { x: W - b.depthCm, y: b.startCm, w: b.depthCm, d: b.lengthCm },
  }[b.wall]
  return {
    key: `embutido:${index}`,
    unit: 0,
    category: `embutido-${b.kind}`,
    label: {
      armario: 'Armário embutido',
      bancada: 'Bancada',
      aereo: 'Armário aéreo',
      gabinete: 'Gabinete',
      prateleira: 'Prateleira',
    }[b.kind],
    // Aéreo e prateleira ficam na parede (não ocupam o chão).
    placement: b.elevationCm >= 100 ? 'wall' : 'floor',
    ...rect,
    height: b.heightCm,
    elevation: b.elevationCm,
    facing: FACING_FROM[b.wall],
  }
}

function parseSuggestion(raw: unknown): Suggestion | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const s = raw as Record<string, unknown>
  if (typeof s.key !== 'string' || !Number.isInteger(s.unit) || (s.unit as number) < 0)
    return undefined
  if (!num(s.xCm, 0, 5000) || !num(s.yCm, 0, 5000)) return undefined
  if (typeof s.rotation !== 'string' || !ROTATIONS.has(s.rotation)) return undefined
  return {
    key: s.key,
    unit: s.unit as number,
    xCm: s.xCm,
    yCm: s.yCm,
    rotation: s.rotation as Suggestion['rotation'],
  }
}

/** Confere a resposta da skill /house-3d (vem de fora). Inválida = undefined. */
export function parseHouseModel(data: unknown): HouseModel | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const d = data as Record<string, unknown>
  if (!num(d.widthM, 1, 200) || !num(d.depthM, 1, 200) || !Array.isArray(d.rooms)) return undefined
  const rooms: HouseRoom[] = []
  for (const raw of d.rooms.slice(0, 30)) {
    if (typeof raw !== 'object' || raw === null) continue
    const r = raw as Record<string, unknown>
    if (typeof r.type !== 'string' || typeof r.label !== 'string') continue
    if (
      ![r.xM, r.yM].every((v) => num(v, 0, 200)) ||
      ![r.widthM, r.depthM].every((v) => num(v, 0.5, 200))
    ) {
      continue
    }
    rooms.push({
      type: r.type,
      label: r.label.trim().slice(0, 40) || r.type,
      xM: r.xM as number,
      yM: r.yM as number,
      widthM: r.widthM as number,
      depthM: r.depthM as number,
      openings: (Array.isArray(r.openings) ? r.openings : [])
        .map(parseOpening)
        .filter((o): o is HouseOpening => o !== undefined)
        .slice(0, 10),
      finishes: parseFinishes(r.finishes, r.type),
      furniture: (Array.isArray(r.furniture) ? r.furniture : [])
        .map(parseSuggestion)
        .filter((s): s is Suggestion => s !== undefined)
        .slice(0, 40),
      builtIns: (Array.isArray(r.builtIns) ? r.builtIns : [])
        .map((b) => parseBuiltIn(b, { widthM: r.widthM as number, depthM: r.depthM as number }))
        .filter((b): b is BuiltIn => b !== undefined)
        .slice(0, 20),
      ...(typeof r.instanceId === 'string' && { instanceId: r.instanceId }),
      ...(typeof r.partOf === 'string' && r.partOf.trim() && { partOf: r.partOf.trim() }),
    })
  }
  if (!rooms.length) return undefined
  return {
    widthM: d.widthM,
    depthM: d.depthM,
    rooms,
    notes: typeof d.notes === 'string' ? d.notes.trim() : '',
  }
}

const normalize = (label: string) =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** Vão largo (passagem aberta, não porta de abrir): liga as partes de um cômodo em L. */
const WIDE_OPENING_CM = 150

/** Os dois retângulos encostam (dividem um trecho de parede de pelo menos 1 m)? */
export function touching(a: HouseRoom, b: HouseRoom): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.2
  const overlap = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0) >= 1
  const vertical =
    (near(a.xM + a.widthM, b.xM) || near(b.xM + b.widthM, a.xM)) &&
    overlap(a.yM, a.yM + a.depthM, b.yM, b.yM + b.depthM)
  const horizontal =
    (near(a.yM + a.depthM, b.yM) || near(b.yM + b.depthM, a.yM)) &&
    overlap(a.xM, a.xM + a.widthM, b.xM, b.xM + b.widthM)
  return vertical || horizontal
}

/**
 * Partes de cômodo em L. A skill marca com `partOf`; casas geradas antes disso trazem a parte
 * como "outro" (ex.: "Sala – estar junto à varanda"): vira parte quando o nome começa com o do
 * cômodo, encosta nele e tem um vão largo entre os dois.
 */
export function resolveParts(model: HouseModel): HouseModel {
  return openPartWalls(findParts(model))
}

function findParts(model: HouseModel): HouseModel {
  const mains = model.rooms.filter((r) => !r.partOf && r.type !== OUTSIDE_TYPE)
  return {
    ...model,
    rooms: model.rooms.map((room) => {
      const byName =
        room.partOf && mains.find((m) => normalize(m.label) === normalize(room.partOf!))
      if (byName) return { ...room, type: byName.type, partOf: byName.label }
      if (room.partOf || room.type !== OUTSIDE_TYPE) {
        const { partOf: _drop, ...rest } = room
        void _drop
        return room.partOf ? rest : room
      }
      const wide = (r: HouseRoom) =>
        r.openings.some((o) => o.kind === 'door' && o.widthCm >= WIDE_OPENING_CM)
      const main = mains.find(
        (m) =>
          normalize(room.label).startsWith(normalize(m.label)) &&
          normalize(m.label).length >= 3 &&
          touching(room, m) &&
          (wide(room) || wide(m)),
      )
      return main ? { ...room, type: main.type, partOf: main.label } : room
    }),
  }
}

/**
 * Entre as partes de um cômodo em L não há parede (a sala continua): a divisão que a leitura
 * desenhou (vão largo, "porta") vira passagem aberta, como ao unir os cômodos.
 */
function openPartWalls(model: HouseModel): HouseModel {
  let result = model
  model.rooms.forEach((part, b) => {
    if (!part.partOf) return
    const member = result.rooms.findIndex(
      (r, a) =>
        a !== b &&
        (r.label === part.partOf || r.partOf === part.partOf) &&
        sharedWall(r, result.rooms[b]) &&
        !r.openings.some((o) => o.open && o.wall === sharedWall(r, result.rooms[b])!.side),
    )
    if (member >= 0) result = mergeRooms(result, member, b)
  })
  return result
}

/** A casa em metros como planta (frações do desenho), para a escolha de cômodos e o desenho. */
export function houseToFloorPlan(model: HouseModel): FloorPlan {
  return {
    aspect: model.widthM / model.depthM,
    notes: model.notes,
    rooms: model.rooms.map((r) => ({
      type: r.type,
      label: r.label,
      areaM2: Math.round(r.widthM * r.depthM * 100) / 100,
      openings: r.openings,
      x: Math.min(1, r.xM / model.widthM),
      y: Math.min(1, r.yM / model.depthM),
      width: Math.min(1, r.widthM / model.widthM),
      height: Math.min(1, r.depthM / model.depthM),
    })),
  }
}

/**
 * Leitura caprichada (planta + fotos, skill /house-3d) no começo do fluxo: os cômodos sugeridos
 * (como a leitura rápida: tipo, quantidade, cama pela área, lavanderia na cozinha) e a casa já
 * ligada à lista, para a posição dos móveis usar as medidas, portas, janelas e armários dela.
 * As partes de cômodo em L não contam como cômodo (são do principal).
 */
export function readHouse(model: HouseModel, rooms: Rooms): { read: ReadPlan; house: HouseModel } {
  const resolved = resolveParts(model)
  const plan = houseToFloorPlan({
    ...resolved,
    rooms: resolved.rooms.map((r) => (r.partOf ? { ...r, type: OUTSIDE_TYPE } : r)),
  })
  // (as partes da sala em L ganham aba própria pela casa, que vai salva junto)
  return { read: planToHouse(plan, rooms), house: linkRooms(model, rooms) }
}

/** Muda o tipo de um cômodo da casa (ex.: "Dorm. 2" vira quarto do bebê). */
export const setHouseRoomType = (model: HouseModel, index: number, type: string): HouseModel => ({
  ...model,
  rooms: model.rooms.map((r, i) => (i === index ? { ...r, type } : r)),
})

/**
 * Liga cada cômodo da casa 3D ao cômodo da lista. Mesmo nome da planta lida antes ("Dorm. 2")
 * = mesmo cômodo e mesmo tipo (a pessoa pode ter feito dele um quarto do bebê); o resto, pelo
 * mesmo algoritmo da planta (maior quarto = Quarto 1).
 */
export function linkRooms(model: HouseModel, rooms: Rooms, saved?: PlacedRoom[]): HouseModel {
  const byLabel = new Map((saved ?? []).map((r) => [normalize(r.label), r]))
  const resolved = resolveParts(model)
  // Parte de cômodo em L não conta como cômodo (fica com o id do principal, no fim).
  const typed = resolved.rooms.map((room) => {
    if (room.partOf) return { ...room, type: OUTSIDE_TYPE }
    const match = byLabel.get(normalize(room.label))
    return match ? { ...room, type: match.type } : room
  })
  const plan = houseToFloorPlan({ ...model, rooms: typed })
  const derived = planToHouse(plan, rooms).rooms
  const used = new Set<string>()
  const linked = typed.map((room, i) => {
    const id = resolved.rooms[i].partOf ? undefined : byLabel.get(normalize(room.label))?.instanceId
    if (id) used.add(id)
    return { room, id, fallback: derived[i].instanceId }
  })
  const mains = linked.map(({ room, id, fallback }, i): HouseRoom | undefined => {
    if (resolved.rooms[i].partOf) return undefined
    const { instanceId: _old, ...rest } = room
    void _old
    const instanceId = id ?? (fallback && !used.has(fallback) ? fallback : undefined)
    if (instanceId) used.add(instanceId)
    return instanceId ? { ...rest, instanceId } : rest
  })
  return {
    ...model,
    rooms: resolved.rooms.map((part, i) => {
      const main = mains[i]
      if (main) return main
      // Parte de cômodo em L: o mesmo cômodo da lista que o principal.
      const { instanceId: _old, ...rest } = part
      void _old
      const owner = mains.find((m) => m && normalize(m.label) === normalize(part.partOf!))
      return owner?.instanceId ? { ...rest, instanceId: owner.instanceId } : rest
    }),
  }
}

export interface FurnishedRoom {
  room: HouseRoom
  /** No cômodo em L, o principal traz o L inteiro (com `origin`) e as partes vêm vazias. */
  layout: RoomLayout
  /** Peças fixas: armários das fotos primeiro (na ordem de `builtInDefs`), depois o que não é chão do cômodo. */
  fixed: PlacedItem[]
  /** Os armários das fotos de `fixed` (para desenhar no 3D). */
  builtInDefs: BuiltIn[]
  /** Sugestões da skill que passaram na conferência (o resto ficou pela regra). */
  accepted: number
}

/**
 * Móveis da lista de cada cômodo (a lista de agora: o que saiu dela some): posição por regra,
 * corrigida pelas sugestões válidas da skill e, por cima, pelas posições que a pessoa escolheu.
 * Cômodo em L (partes com `partOf`) é posicionado como um espaço só.
 */
export function furnishHouse(
  model: HouseModel,
  view: ListView,
  positions: ManualPositions = {},
): FurnishedRoom[] {
  // Sem área de serviço na planta, a lavanderia fica na cozinha (HOST_ROOM).
  const guests = guestsByHost(model.rooms, instancesIn(view))
  const groups = new Map<string, number[]>()
  model.rooms.forEach((r, i) => {
    if (r.instanceId) groups.set(r.instanceId, [...(groups.get(r.instanceId) ?? []), i])
  })
  return model.rooms.map((room, index) => {
    const id = room.instanceId
    const group = id ? (groups.get(id) ?? [index]) : [index]
    const mainIndex = group.find((i) => !model.rooms[i].partOf) ?? group[0]
    const manual = id ? (positions[id] ?? []) : []
    const items: LayoutItem[] = id ? layoutItems(view, [id, ...(guests[id] ?? [])]) : []
    if (group.length > 1) {
      const size = { width: Math.round(room.widthM * 100), depth: Math.round(room.depthM * 100) }
      if (index !== mainIndex) {
        // Parte do L: o principal desenha o L inteiro.
        const empty: RoomLayout = { ...size, openings: [], placed: [], unplaced: [] }
        return { room, layout: empty, fixed: [], builtInDefs: [], accepted: 0 }
      }
      const members = group.map((i) => model.rooms[i])
      const { geometry, openings, fixed, builtInDefs } = groupRoom(members)
      const base = arrangeRoom(
        { width: geometry.width, depth: geometry.depth, openings },
        items,
        fixed,
      )
      // Sugestões da skill vêm no retângulo de cada parte: passam para o L.
      const hints = members.flatMap((m, n) =>
        m.furniture.map((h) => ({
          ...h,
          xCm: h.xCm + geometry.local[n].x,
          yCm: h.yCm + geometry.local[n].y,
        })),
      )
      const suggested = applySuggestions(base, hints, fixed)
      const { layout } = applySuggestions(suggested.layout, manual, fixed)
      return {
        room,
        layout: { ...layout, origin: geometry.origin },
        fixed,
        builtInDefs,
        accepted: suggested.accepted,
      }
    }
    const fixed = room.builtIns.map((b, i) => builtInPlaced(b, i, room))
    const base = arrangeRoom(
      {
        width: Math.round(room.widthM * 100),
        depth: Math.round(room.depthM * 100),
        openings: room.openings.filter((o) => !o.open),
      },
      items,
      fixed,
    )
    const suggested = applySuggestions(base, room.furniture, fixed)
    const { layout } = applySuggestions(suggested.layout, manual, fixed)
    return { room, layout, fixed, builtInDefs: room.builtIns, accepted: suggested.accepted }
  })
}

/**
 * O que a skill recebe em `moveis.json`: os móveis de cada cômodo da lista, com medida. Os
 * hóspedes (lavanderia sem área de serviço) vão junto com o cômodo que os recebe (cozinha).
 */
export function furnitureForSkill(
  view: ListView,
  instanceIds: string[],
  guests: Record<string, string[]> = {},
) {
  const hosted = new Set(Object.values(guests).flat())
  return instanceIds
    .filter((instanceId) => !hosted.has(instanceId))
    .map((instanceId) => ({
      instanceId,
      items: layoutItems(view, [instanceId, ...(guests[instanceId] ?? [])]).map(
        ({ key, label, width, depth, height, placement, qty }) => ({
          key,
          name: label,
          widthCm: width,
          depthCm: depth,
          heightCm: height,
          placement,
          qty,
        }),
      ),
    }))
    .filter((room) => room.items.length)
}

/**
 * Religa a casa em 3D aos cômodos de agora (mudou quantidade ou tipo depois de gerar),
 * reconhecendo as partes de cômodo em L (que ficam com o id do principal).
 */
export function relinkHouse(model: HouseModel, instanceIds: string[]): HouseModel {
  const resolved = resolveParts(model)
  const mains = resolved.rooms.filter((r) => !r.partOf)
  const linked = linkPlanRooms(mains, instanceIds, (r) => r.widthM * r.depthM)
  const idOf = new Map(mains.map((m, i) => [m, linked[i].instanceId]))
  return {
    ...resolved,
    rooms: resolved.rooms.map((room) => {
      const { instanceId: _old, ...rest } = room
      void _old
      const owner = room.partOf
        ? mains.find((m) => normalize(m.label) === normalize(room.partOf!))
        : room
      const instanceId = owner && idOf.get(owner)
      return instanceId ? { ...rest, instanceId } : rest
    }),
  }
}

type Side = Opening['wall']

/** Trecho de parede que `a` divide com `b` (m, no eixo da parede), do lado de `a`. */
export function sharedWall(
  a: HouseRoom,
  b: HouseRoom,
): { side: Side; from: number; to: number } | undefined {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.2
  const span = (a0: number, a1: number, b0: number, b1: number) => ({
    from: Math.max(a0, b0),
    to: Math.min(a1, b1),
  })
  const sides: [Side, boolean, () => { from: number; to: number }][] = [
    [
      'right',
      near(a.xM + a.widthM, b.xM),
      () => span(a.yM, a.yM + a.depthM, b.yM, b.yM + b.depthM),
    ],
    ['left', near(b.xM + b.widthM, a.xM), () => span(a.yM, a.yM + a.depthM, b.yM, b.yM + b.depthM)],
    [
      'bottom',
      near(a.yM + a.depthM, b.yM),
      () => span(a.xM, a.xM + a.widthM, b.xM, b.xM + b.widthM),
    ],
    ['top', near(b.yM + b.depthM, a.yM), () => span(a.xM, a.xM + a.widthM, b.xM, b.xM + b.widthM)],
  ]
  for (const [side, touches, range] of sides) {
    if (!touches) continue
    const { from, to } = range()
    if (to - from >= 0.5) return { side, from, to }
  }
  return undefined
}

/** Cômodos que dividem parede com este (candidatos a unir). */
export function neighbours(model: HouseModel, index: number): number[] {
  const room = model.rooms[index]
  return model.rooms.flatMap((other, i) => (i !== index && sharedWall(room, other) ? [i] : []))
}

/** Começo da parede `side` do cômodo, no eixo dela (m), e o comprimento. */
const wallSpan = (r: HouseRoom, side: Side) =>
  side === 'top' || side === 'bottom'
    ? { start: r.xM, length: r.widthM }
    : { start: r.yM, length: r.depthM }

/** A abertura cai no trecho [from, to] da parede? */
function onSegment(r: HouseRoom, o: HouseOpening, from: number, to: number) {
  const { start, length } = wallSpan(r, o.wall)
  const mid = start + o.position * length
  return mid > from - 0.05 && mid < to + 0.05
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/**
 * Une dois cômodos vizinhos num só (a sala que continua junto à varanda, sem divisão): o
 * segundo vira parte do primeiro (mesmo cômodo da lista) e a parede entre os dois some (no 3D
 * e na posição dos móveis, que desenha o L como um espaço só).
 */
export function mergeRooms(model: HouseModel, a: number, b: number): HouseModel {
  const A = model.rooms[a]
  const B = model.rooms[b]
  const shared = sharedWall(A, B)
  if (!shared || a === b) return model
  // O principal é o de A (ou o cômodo de que A já é parte).
  const main = A.partOf ? (model.rooms.find((r) => r.label === A.partOf) ?? A) : A
  const { start, length } = wallSpan(A, shared.side)
  const open: HouseOpening = {
    kind: 'door',
    wall: shared.side,
    position: ((shared.from + shared.to) / 2 - start) / length,
    widthCm: Math.min(400, Math.max(40, Math.round((shared.to - shared.from) * 100))),
    open: true,
  }
  return {
    ...model,
    rooms: model.rooms.map((r, i) => {
      if (i === a) {
        return {
          ...r,
          openings: [
            ...r.openings.filter(
              (o) => !(o.wall === shared.side && onSegment(r, o, shared.from, shared.to)),
            ),
            open,
          ],
        }
      }
      // B (e o que já era parte de B) vira parte do principal.
      if (i === b || (r.partOf && r.partOf === B.label)) {
        const openings =
          i === b
            ? r.openings.filter(
                (o) =>
                  !(o.wall === OPPOSITE[shared.side] && onSegment(r, o, shared.from, shared.to)),
              )
            : r.openings
        return { ...r, type: main.type, partOf: main.label, openings }
      }
      return r
    }),
  }
}

/** Área fora das partes, dentro do retângulo que as envolve: "fora do cômodo". */
export const OUTSIDE_ROOM = 'fora-do-comodo'
/** Passagem de porta numa parede de dentro do L (precisa ficar livre). */
const DOOR_CLEARANCE = 'passagem-de-porta'

/** Cômodo em L como um espaço só: retângulo que envolve as partes, com o que fica de fora. */
export function groupGeometry(members: HouseRoom[]) {
  const minX = Math.min(...members.map((r) => r.xM))
  const minY = Math.min(...members.map((r) => r.yM))
  const maxX = Math.max(...members.map((r) => r.xM + r.widthM))
  const maxY = Math.max(...members.map((r) => r.yM + r.depthM))
  const W = Math.round((maxX - minX) * 100)
  const D = Math.round((maxY - minY) * 100)
  const local = members.map((r) => ({
    x: Math.round((r.xM - minX) * 100),
    y: Math.round((r.yM - minY) * 100),
    w: Math.round(r.widthM * 100),
    d: Math.round(r.depthM * 100),
  }))
  // Células da grade formada pelas bordas: as que nenhuma parte cobre ficam fora do cômodo.
  const xs = [...new Set([0, W, ...local.flatMap((r) => [r.x, r.x + r.w])])].sort((p, q) => p - q)
  const ys = [...new Set([0, D, ...local.flatMap((r) => [r.y, r.y + r.d])])].sort((p, q) => p - q)
  const outside: { x: number; y: number; w: number; d: number }[] = []
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < ys.length; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2
      const cy = (ys[j] + ys[j + 1]) / 2
      const covered = local.some((r) => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.d)
      if (!covered && xs[i + 1] - xs[i] > 1 && ys[j + 1] - ys[j] > 1) {
        outside.push({ x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], d: ys[j + 1] - ys[j] })
      }
    }
  }
  return { origin: { xM: minX, yM: minY }, width: W, depth: D, local, outside }
}

/** Peça fixa da geometria (fora do cômodo, passagem de porta de dentro do L). */
const blocker = (
  key: string,
  category: string,
  label: string,
  rect: { x: number; y: number; w: number; d: number },
  height: number,
): PlacedItem => ({
  key,
  unit: 0,
  category,
  label,
  placement: 'floor',
  ...rect,
  height,
  elevation: 0,
  facing: 'down',
})

/**
 * Prepara o cômodo em L para o motor de posição: portas e janelas das paredes de fora vão para
 * as paredes do retângulo; porta numa parede de dentro do L vira uma passagem livre; armários
 * das fotos de todas as partes; e o que fica fora do L, ocupado.
 */
function groupRoom(members: HouseRoom[]) {
  const geometry = groupGeometry(members)
  const { width: W, depth: D, local } = geometry
  const openings: HouseOpening[] = []
  const fixed: PlacedItem[] = []
  const builtInDefs: BuiltIn[] = []
  members.forEach((room, m) => {
    const r = local[m]
    room.builtIns.forEach((b, i) => {
      const p = builtInPlaced(b, i, room)
      fixed.push({ ...p, key: `embutido:${m}-${i}`, x: p.x + r.x, y: p.y + r.y })
      builtInDefs.push(b)
    })
  })
  members.forEach((room, m) => {
    const r = local[m]
    for (const o of room.openings) {
      if (o.open) continue
      const horizontal = o.wall === 'top' || o.wall === 'bottom'
      const length = horizontal ? r.w : r.d
      const mid = (horizontal ? r.x : r.y) + o.position * length
      const line = { top: r.y, bottom: r.y + r.d, left: r.x, right: r.x + r.w }[o.wall]
      const edge = { top: 0, bottom: D, left: 0, right: W }[o.wall]
      if (Math.abs(line - edge) <= 3) {
        openings.push({ ...o, position: mid / (horizontal ? W : D) })
        continue
      }
      // Parede de dentro do L: entre as partes (vão) não conta; porta para outro cômodo fica livre.
      const between = members.some((other, n) => {
        if (n === m) return false
        const s = sharedWall(room, other)
        return s?.side === o.wall
      })
      if (between || o.kind !== 'door') continue
      const swings = !o.sliding && o.widthCm <= MAX_SWING_DOOR_CM
      const reach = swings ? o.widthCm + 10 : 60
      const span = o.widthCm + 20
      const rect = {
        top: { x: mid - span / 2, y: line, w: span, d: reach },
        bottom: { x: mid - span / 2, y: line - reach, w: span, d: reach },
        left: { x: line, y: mid - span / 2, w: reach, d: span },
        right: { x: line - reach, y: mid - span / 2, w: reach, d: span },
      }[o.wall]
      fixed.push(
        blocker(`porta:${m}-${fixed.length}`, DOOR_CLEARANCE, 'Passagem da porta', rect, 210),
      )
    }
  })
  geometry.outside.forEach((rect, i) =>
    fixed.push(blocker(`fora:${i}`, OUTSIDE_ROOM, 'Fora do cômodo', rect, 300)),
  )
  return { geometry, openings, fixed, builtInDefs }
}

/** Peça só de geometria do L (fora do cômodo, passagem de porta): não é móvel nem obstáculo no 3D. */
export const isGeometry = (p: PlacedItem) =>
  p.category === OUTSIDE_ROOM || p.category === DOOR_CLEARANCE

/**
 * Casa em metros a partir da planta lida sem fotos (leitura rápida): cada cômodo no lugar do
 * desenho, com a medida que a posição dos móveis usa (pela área escrita e a proporção do
 * desenho), portas e janelas da leitura e o acabamento comum do tipo. É o projeto em 3D de
 * quem não mandou fotos — sem enviar nada de novo.
 */
export function houseFromPlan(
  plan: Pick<FloorPlan, 'aspect'> & { rooms: PlacedRoom[] },
): HouseModel {
  const sizes = plan.rooms.map((_, i) => roomSizeCm(plan, i))
  // Escala do desenho: largura do cômodo em metros ÷ fração da largura da planta (mediana).
  const scales = plan.rooms
    .flatMap((r, i) => (r.width > 0.05 ? [sizes[i].width / 100 / r.width] : []))
    .sort((a, b) => a - b)
  const width = scales.length ? scales[Math.floor(scales.length / 2)] : 10
  const depth = width / plan.aspect
  return {
    widthM: Math.round(width * 100) / 100,
    depthM: Math.round(depth * 100) / 100,
    notes: 'Casa montada pela planta: medidas estimadas pela área de cada cômodo.',
    rooms: plan.rooms.map((r, i) => ({
      type: r.type,
      label: r.label,
      xM: Math.round(r.x * width * 100) / 100,
      yM: Math.round(r.y * depth * 100) / 100,
      widthM: sizes[i].width / 100,
      depthM: sizes[i].depth / 100,
      openings: r.openings,
      finishes: defaultFinishes(r.type),
      furniture: [],
      builtIns: [],
      ...(r.instanceId && { instanceId: r.instanceId }),
    })),
  }
}
