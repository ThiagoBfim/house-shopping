import type { Rooms } from '../data/schema.ts'
import type { ListView } from './budget.ts'
import { itemKey, MAX_PER_ROOM, splitItemKey, type HouseSpec } from './house.ts'

/** Cômodo lido da planta pela skill /floor-plan (posição em frações do desenho, 0–1). */
export interface PlanRoom {
  /** Id do cômodo no catálogo ("quarto", "sala"…) ou "outro" (hall, closet…). */
  type: string
  /** Nome escrito na planta ("Suíte", "Dorm. 2"). */
  label: string
  areaM2: number | null
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
    const { type, label, areaM2, x, y, width, height, instanceId } = room as Record<string, unknown>
    if (typeof type !== 'string' || typeof label !== 'string') continue
    if (![x, y, width, height].every(isFraction)) continue
    const area = typeof areaM2 === 'number' && areaM2 > 0 && areaM2 < 1000 ? areaM2 : null
    valid.push({
      type,
      label: label.trim().slice(0, 40) || type,
      areaM2: area,
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

  return {
    house,
    rooms: plan.rooms.map((room) => {
      // Ligação nova (a de uma leitura anterior, se houver, não vale para esta casa).
      const { type, label, areaM2, x, y, width, height } = room
      const instanceId = instanceOf.get(room)
      return { type, label, areaM2, x, y, width, height, ...(instanceId && { instanceId }) }
    }),
    aspect: plan.aspect,
    variants,
    notes: plan.notes,
    ignored,
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
