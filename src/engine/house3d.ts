import type { Rooms } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import {
  guestsByHost,
  planToHouse,
  type FloorPlan,
  type Opening,
  type PlacedRoom,
} from './floor-plan.ts'
import {
  applySuggestions,
  arrangeRoom,
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

/**
 * Liga cada cômodo da casa 3D ao cômodo da lista. Mesmo nome da planta lida antes ("Dorm. 2")
 * = mesmo cômodo e mesmo tipo (a pessoa pode ter feito dele um quarto do bebê); o resto, pelo
 * mesmo algoritmo da planta (maior quarto = Quarto 1).
 */
export function linkRooms(model: HouseModel, rooms: Rooms, saved?: PlacedRoom[]): HouseModel {
  const byLabel = new Map((saved ?? []).map((r) => [normalize(r.label), r]))
  const typed = model.rooms.map((room) => {
    const match = byLabel.get(normalize(room.label))
    return match ? { ...room, type: match.type } : room
  })
  const plan: FloorPlan = {
    aspect: model.widthM / model.depthM,
    notes: '',
    rooms: typed.map((r) => ({
      type: r.type,
      label: r.label,
      areaM2: r.widthM * r.depthM,
      openings: r.openings,
      x: Math.min(1, r.xM / model.widthM),
      y: Math.min(1, r.yM / model.depthM),
      width: Math.min(1, r.widthM / model.widthM),
      height: Math.min(1, r.depthM / model.depthM),
    })),
  }
  const derived = planToHouse(plan, rooms).rooms
  const used = new Set<string>()
  const linked = typed.map((room, i) => {
    const id = byLabel.get(normalize(room.label))?.instanceId
    if (id) used.add(id)
    return { room, id, fallback: derived[i].instanceId }
  })
  return {
    ...model,
    rooms: linked.map(({ room, id, fallback }) => {
      const { instanceId: _old, ...rest } = room
      void _old
      const instanceId = id ?? (fallback && !used.has(fallback) ? fallback : undefined)
      if (instanceId) used.add(instanceId)
      return instanceId ? { ...rest, instanceId } : rest
    }),
  }
}

export interface FurnishedRoom {
  room: HouseRoom
  layout: RoomLayout
  /** Armários das fotos, já como peças no cômodo (mesma ordem de `room.builtIns`). */
  fixed: PlacedItem[]
  /** Sugestões da skill que passaram na conferência (o resto ficou pela regra). */
  accepted: number
}

/**
 * Móveis da lista de cada cômodo (a lista de agora: o que saiu dela some): posição por regra,
 * corrigida pelas sugestões válidas da skill e, por cima, pelas posições que a pessoa escolheu.
 */
export function furnishHouse(
  model: HouseModel,
  view: ListView,
  positions: ManualPositions = {},
): FurnishedRoom[] {
  // Sem área de serviço na planta, a lavanderia fica na cozinha (HOST_ROOM).
  const guests = guestsByHost(model.rooms, instancesIn(view))
  return model.rooms.map((room) => {
    const id = room.instanceId
    const items: LayoutItem[] = id ? layoutItems(view, [id, ...(guests[id] ?? [])]) : []
    const fixed = room.builtIns.map((b, i) => builtInPlaced(b, i, room))
    const base = arrangeRoom(
      {
        width: Math.round(room.widthM * 100),
        depth: Math.round(room.depthM * 100),
        openings: room.openings,
      },
      items,
      fixed,
    )
    const suggested = applySuggestions(base, room.furniture, fixed)
    const manual = room.instanceId ? (positions[room.instanceId] ?? []) : []
    const { layout } = applySuggestions(suggested.layout, manual, fixed)
    return { room, layout, fixed, accepted: suggested.accepted }
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
