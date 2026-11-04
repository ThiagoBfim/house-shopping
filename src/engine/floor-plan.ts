import type { Rooms } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import { itemKey, MAX_PER_ROOM, splitItemKey, type HouseSpec } from './house.ts'

/** Porta ou janela numa parede do cômodo. */
export interface Opening {
  kind: 'door' | 'window'
  /** Parede do retângulo do cômodo, como na planta (top = a de cima). */
  wall: 'top' | 'right' | 'bottom' | 'left'
  /** Centro da abertura ao longo da parede: 0 = esquerda/topo, 1 = direita/fundo. */
  position: number
  widthCm: number
}

const WALLS = new Set(['top', 'right', 'bottom', 'left'])

function parseOpenings(raw: unknown): Opening[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
    .filter(
      (o) =>
        (o.kind === 'door' || o.kind === 'window') &&
        typeof o.wall === 'string' &&
        WALLS.has(o.wall) &&
        isFraction(o.position) &&
        typeof o.widthCm === 'number' &&
        o.widthCm >= 40 &&
        o.widthCm <= 400,
    )
    .slice(0, 8)
    .map(({ kind, wall, position, widthCm }) => ({
      kind: kind as Opening['kind'],
      wall: wall as Opening['wall'],
      position: position as number,
      widthCm: widthCm as number,
    }))
}

/** Cômodo lido da planta pela skill /floor-plan (posição em frações do desenho, 0–1). */
export interface PlanRoom {
  /** Id do cômodo no catálogo ("quarto", "sala"…) ou "outro" (hall, closet…). */
  type: string
  /** Nome escrito na planta ("Suíte", "Dorm. 2"). */
  label: string
  areaM2: number | null
  /** Portas e janelas (vazio quando a leitura não trouxe). */
  openings: Opening[]
  x: number
  y: number
  width: number
  height: number
}

export interface FloorPlan {
  /** Largura ÷ altura do desenho. */
  aspect: number
  rooms: PlacedRoom[]
  notes: string
}

/** Cômodo da planta ligado ao cômodo da casa ("quarto-2"); sem ligação = só desenhado. */
export interface PlacedRoom extends PlanRoom {
  instanceId?: string
}

export interface ReadPlan {
  house: HouseSpec
  rooms: PlacedRoom[]
  aspect: number
  /** Variantes escolhidas pelo tamanho do cômodo (cama do quarto). */
  variants: Record<string, string>
  notes: string
  /** Ambientes da planta que não viram cômodo da lista (hall, closet, excedentes). */
  ignored: string[]
  /** Cômodos da lista sem lugar na planta que ficam dentro de outro (lavanderia na cozinha). */
  hosted: { guest: string; host: string }[]
}

/**
 * Cômodo que, sem lugar próprio na planta, fica dentro de outro: sem área de serviço, a
 * lavanderia (máquina, varal, tábua…) vai para a cozinha.
 */
export const HOST_ROOM: Record<string, string> = { lavanderia: 'cozinha' }

/**
 * Religa os cômodos da planta aos cômodos da lista de agora. A ligação é feita na leitura
 * ("quarto-1", "quarto-2"); se depois a pessoa muda a quantidade de cômodos ou o tipo, o id
 * antigo some e o cômodo sumiria da posição dos móveis. Ligação válida fica; o resto vai para o
 * cômodo livre do mesmo tipo, maior primeiro (como na leitura: o maior quarto é o Quarto 1).
 */
export function linkPlanRooms<R extends { type: string; instanceId?: string }>(
  planRooms: R[],
  instanceIds: string[],
  /** Área do cômodo (planta lida: `areaM2`; casa em 3D: largura × profundidade). */
  area: (room: R) => number | null | undefined = (room) =>
    (room as { areaM2?: number | null }).areaM2,
): R[] {
  const ids = new Set(instanceIds)
  const used = new Set<string>()
  const keep = planRooms.map((room) => {
    const id = room.instanceId
    if (!id || !ids.has(id) || used.has(id)) return false
    used.add(id)
    return true
  })
  const free = (type: string) =>
    instanceIds.filter((id) => !used.has(id) && roomTypeOf(id) === type)
  const order = planRooms
    .map((room, i) => ({ room, i }))
    .filter(({ i }) => !keep[i])
    .sort((a, b) => (area(b.room) ?? -1) - (area(a.room) ?? -1))
  const next = [...planRooms]
  for (const { room, i } of order) {
    const id = free(room.type)[0]
    const { instanceId: _old, ...rest } = room
    void _old
    if (id) used.add(id)
    next[i] = (id ? { ...rest, instanceId: id } : rest) as R
  }
  return next
}

/** Medida típica (cm) de um cômodo que está na lista mas não na planta. */
export const TYPICAL_ROOM_CM: Record<string, { width: number; depth: number }> = {
  quarto: { width: 300, depth: 350 },
  'quarto-bebe': { width: 280, depth: 300 },
  escritorio: { width: 260, depth: 300 },
  sala: { width: 350, depth: 450 },
  cozinha: { width: 250, depth: 350 },
  banheiro: { width: 150, depth: 220 },
  lavanderia: { width: 150, depth: 200 },
  'area-externa': { width: 250, depth: 400 },
}
export const TYPICAL_ROOM_DEFAULT = { width: 300, depth: 300 }

/** Tipo do cômodo pelo id ("cozinha-2" → "cozinha"). */
export const roomTypeOf = (instanceId: string) => instanceId.replace(/-\d+$/, '')

/**
 * Hóspedes de cada cômodo da planta: os cômodos da lista sem lugar na planta que ficam dentro
 * dele pela regra de HOST_ROOM (o primeiro cômodo do tipo, ex.: a cozinha). Host → hóspedes.
 */
export function guestsByHost(
  planRooms: { instanceId?: string }[],
  instanceIds: Iterable<string>,
): Record<string, string[]> {
  const inPlan = new Set(planRooms.map((r) => r.instanceId).filter((id): id is string => !!id))
  const out: Record<string, string[]> = {}
  for (const id of instanceIds) {
    if (inPlan.has(id)) continue
    const hostType = HOST_ROOM[roomTypeOf(id)]
    const host = hostType && [...inPlan].find((h) => roomTypeOf(h) === hostType)
    if (host) out[host] = [...(out[host] ?? []), id]
  }
  return out
}

/** Cômodo de itens da casa toda (limpeza, ferramentas): entra sempre, não está na planta. */
const WHOLE_HOUSE = 'utilidades'
const MAX_ROOMS = 30

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1

/**
 * Confere a resposta da skill (veio de fora: o backend local) ou a planta salva no navegador
 * (que traz o `instanceId` de cada cômodo). Inválida = undefined.
 */
export function parseFloorPlan(data: unknown): FloorPlan | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const { aspect, rooms, notes } = data as Record<string, unknown>
  if (!Array.isArray(rooms)) return undefined
  const valid: PlacedRoom[] = []
  for (const room of rooms.slice(0, MAX_ROOMS)) {
    if (typeof room !== 'object' || room === null) continue
    const { type, label, areaM2, x, y, width, height, instanceId, openings } = room as Record<
      string,
      unknown
    >
    if (typeof type !== 'string' || typeof label !== 'string') continue
    if (![x, y, width, height].every(isFraction)) continue
    const area = typeof areaM2 === 'number' && areaM2 > 0 && areaM2 < 1000 ? areaM2 : null
    valid.push({
      type,
      label: label.trim().slice(0, 40) || type,
      areaM2: area,
      openings: parseOpenings(openings),
      x: x as number,
      y: y as number,
      width: Math.min(width as number, 1 - (x as number)),
      height: Math.min(height as number, 1 - (y as number)),
      ...(typeof instanceId === 'string' && { instanceId }),
    })
  }
  return {
    aspect: typeof aspect === 'number' && aspect >= 0.2 && aspect <= 5 ? aspect : 1,
    rooms: valid,
    notes: typeof notes === 'string' ? notes.trim() : '',
  }
}

/** Itens de cama que acompanham o tamanho da cama. */
const BED_CATEGORIES = ['cama-box', 'colchao', 'edredom', 'jogo-de-cama', 'protetor-de-colchao']

/** Tipo que tira o cômodo da lista (hall, closet…). */
export const OUTSIDE_TYPE = 'outro'

/**
 * A pessoa muda o tipo de um cômodo lido (ex.: "Dorm. 2" vira quarto do bebê ou escritório).
 * Devolve uma planta nova; rodar `planToHouse` de novo refaz a casa e as camas.
 */
export function setRoomType(plan: FloorPlan, index: number, type: string): FloorPlan {
  return {
    ...plan,
    rooms: plan.rooms.map((room, i) => (i === index ? { ...room, type } : room)),
  }
}

/**
 * Tira as camas escolhidas pela área (de uma leitura anterior) antes de aplicar as novas: com
 * outro tipo de cômodo, os quartos mudam de número e a cama ficaria no quarto errado.
 */
export function withoutBedVariants(variants: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variants).filter(([key]) => {
      const { instanceId, category } = splitItemKey(key)
      return !(/^quarto(-\d+)?$/.test(instanceId) && BED_CATEGORIES.includes(category))
    }),
  )
}

/**
 * Tamanho da cama pela área do quarto, deixando espaço para circular e para o guarda-roupa:
 * até 9 m² solteiro, até 12 m² casal, até 16 m² queen, acima king.
 */
export function bedSizeForArea(areaM2: number): string {
  if (areaM2 < 9) return 'solteiro'
  if (areaM2 < 12) return 'casal'
  if (areaM2 < 16) return 'queen'
  return 'king'
}

/**
 * Planta → casa: conta os cômodos de cada tipo (até MAX_PER_ROOM), liga cada um a um
 * cômodo da casa (o maior quarto vira o Quarto 1) e escolhe a cama de cada quarto pela área.
 * Utilidades (itens da casa toda) entra sempre.
 */
export function planToHouse(plan: FloorPlan, rooms: Rooms): ReadPlan {
  const byType = new Map<string, PlanRoom[]>()
  const ignored: string[] = []
  for (const room of plan.rooms) {
    if (!Object.hasOwn(rooms, room.type) || room.type === WHOLE_HOUSE) {
      ignored.push(room.label)
      continue
    }
    byType.set(room.type, [...(byType.get(room.type) ?? []), room])
  }

  const house: HouseSpec = {}
  const variants: Record<string, string> = {}
  const instanceOf = new Map<PlacedRoom, string>()
  for (const [type, list] of byType) {
    // Maior primeiro (área desconhecida por último): "Quarto 1" é a suíte.
    const ordered = [...list].sort((a, b) => (b.areaM2 ?? -1) - (a.areaM2 ?? -1))
    const kept = ordered.slice(0, MAX_PER_ROOM)
    ignored.push(...ordered.slice(MAX_PER_ROOM).map((room) => room.label))
    house[type] = kept.length
    kept.forEach((room, i) => {
      const instanceId = kept.length > 1 ? `${type}-${i + 1}` : type
      instanceOf.set(room, instanceId)
      if (type !== 'quarto' || room.areaM2 === null) return
      const size = bedSizeForArea(room.areaM2)
      const categories = new Set(rooms[type].items.map((item) => item.category))
      for (const category of BED_CATEGORIES) {
        if (categories.has(category)) variants[itemKey(instanceId, category)] = size
      }
    })
  }
  if (Object.keys(house).length && Object.hasOwn(rooms, WHOLE_HOUSE)) house[WHOLE_HOUSE] = 1
  // Sem lugar próprio na planta (ex.: sem área de serviço), o cômodo entra na lista mesmo assim
  // e fica dentro do outro (lavanderia na cozinha): a máquina de lavar não some da lista.
  const hosted: ReadPlan['hosted'] = []
  for (const [guest, host] of Object.entries(HOST_ROOM)) {
    if (house[guest] || !house[host] || !Object.hasOwn(rooms, guest)) continue
    house[guest] = 1
    hosted.push({ guest, host })
  }

  return {
    house,
    rooms: plan.rooms.map((room) => {
      // Ligação nova (a de uma leitura anterior, se houver, não vale para esta casa).
      const { type, label, areaM2, openings, x, y, width, height } = room
      const instanceId = instanceOf.get(room)
      return {
        type,
        label,
        areaM2,
        openings,
        x,
        y,
        width,
        height,
        ...(instanceId && { instanceId }),
      }
    }),
    aspect: plan.aspect,
    variants,
    notes: plan.notes,
    ignored,
    hosted,
  }
}

/** O que desenhar dentro de cada cômodo: categorias da lista e itens adicionados/trocados. */
export interface RoomContents {
  /** Categorias do catálogo na lista ("geladeira"), na ordem da lista. */
  categories: string[]
  /** Itens do usuário: adicionados (sem categoria) e trocas (com a categoria trocada). */
  manual: { name: string; category?: string }[]
}

export function contentsByInstance(view: ListView): Record<string, RoomContents> {
  const contents: Record<string, RoomContents> = {}
  const of = (instanceId: string) => (contents[instanceId] ??= { categories: [], manual: [] })
  for (const entry of view.entries) {
    const { instanceId, category } = splitItemKey(entry.item.category)
    of(instanceId).categories.push(category)
  }
  for (const { item, replaced } of view.manual) {
    of(item.instanceId).manual.push(
      replaced
        ? { name: item.name, category: splitItemKey(replaced.item.category).category }
        : { name: item.name },
    )
  }
  return contents
}
