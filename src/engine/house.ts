import type { Products, Room, Rooms } from '../data/schema.ts'
import type { Choices } from './budget.ts'
import { moveInstance } from './choices.ts'

/** Quantos de cada cômodo (id do cômodo → quantidade). Ex.: { cozinha: 1, quarto: 2 }. */
export type HouseSpec = Record<string, number>

export const MAX_PER_ROOM = 5

/** Separa a instância do cômodo da categoria na chave do item: "quarto-2:colchao". */
const SEPARATOR = ':'

export interface RoomInstance {
  /** "cozinha", ou "quarto-1", "quarto-2" quando há mais de um. */
  id: string
  roomId: string
  /** "Cozinha", ou "Quarto 1", "Quarto 2". */
  title: string
}

export interface House {
  /** Todos os itens da casa num cômodo só, para o motor planejar com um orçamento único. */
  room: Room
  /** Catálogo com um apelido por item da casa ("quarto-2:colchao" → colchao). */
  products: Products
  instances: RoomInstance[]
}

export const itemKey = (instanceId: string, category: string) =>
  `${instanceId}${SEPARATOR}${category}`

/** "quarto-2:colchao" → { instanceId: "quarto-2", category: "colchao" } */
export function splitItemKey(key: string): { instanceId: string; category: string } {
  const i = key.indexOf(SEPARATOR)
  return { instanceId: key.slice(0, i), category: key.slice(i + 1) }
}

/** Só cômodos que existem no catálogo, com quantidade inteira entre 1 e MAX_PER_ROOM. */
export function normalizeSpec(spec: HouseSpec, rooms: Rooms): HouseSpec {
  return Object.fromEntries(
    Object.keys(rooms)
      .filter((roomId) => Number.isInteger(spec[roomId]) && spec[roomId] > 0)
      .map((roomId) => [roomId, Math.min(spec[roomId], MAX_PER_ROOM)]),
  )
}

export const roomCount = (spec: HouseSpec) =>
  Object.values(spec).reduce((total, count) => total + count, 0)

/** "Cozinha" · "Cozinha, 2 Quartos e Banheiro" */
export function describeSpec(spec: HouseSpec, rooms: Rooms): string {
  const parts = Object.entries(spec).map(([roomId, count]) =>
    count > 1 ? `${count} ${plural(rooms[roomId].name)}` : rooms[roomId].name,
  )
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}` : (parts[0] ?? '')
}

// "Quarto do bebê" → "Quartos do bebê"; "Área externa" → "Áreas externas"
function plural(name: string): string {
  const [first, ...rest] = name.split(' ')
  const pluralWord = (word: string) => (/[aeiouê]$/i.test(word) ? `${word}s` : word)
  if (rest[0] === 'do' || rest[0] === 'de') return [pluralWord(first), ...rest].join(' ')
  return [first, ...rest].map(pluralWord).join(' ')
}

/**
 * Expande a casa em instâncias de cômodo, na ordem do catálogo. Cada item ganha a chave
 * "instância:categoria", então recusar/travar/filtrar funcionam por cômodo (o colchão do
 * Quarto 1 é independente do colchão do Quarto 2).
 */
export function expandHouse(rooms: Rooms, products: Products, spec: HouseSpec): House {
  const instances: RoomInstance[] = []
  const items: Room['items'] = []
  const aliases: Products = {}

  const normalized = normalizeSpec(spec, rooms)
  for (const [roomId, count] of Object.entries(normalized)) {
    const room = rooms[roomId]
    for (let n = 1; n <= count; n++) {
      const id = count > 1 ? `${roomId}-${n}` : roomId
      instances.push({ id, roomId, title: count > 1 ? `${room.name} ${n}` : room.name })
      for (const item of room.items) {
        const key = itemKey(id, item.category)
        items.push({ ...item, category: key })
        aliases[key] = products[item.category]
      }
    }
  }

  return { room: { name: describeSpec(normalized, rooms), items }, products: aliases, instances }
}

/** Chaves de todos os itens da casa (sem precisar do catálogo de produtos). */
export function houseItemKeys(rooms: Rooms, spec: HouseSpec): Set<string> {
  return new Set(expandHouse(rooms, {}, spec).room.items.map((item) => item.category))
}

/**
 * Mais um cômodo do tipo na casa (ex.: a planta tem 3 banheiros e a lista só 1). De 1 para 2,
 * o que já existia vira "-1" ("banheiro" → "banheiro-1") e as escolhas dele vão junto.
 * No máximo MAX_PER_ROOM por tipo: acima disso, nada muda.
 */
export function addRoomInstance(
  spec: HouseSpec,
  type: string,
  choices: Choices,
): { house: HouseSpec; choices: Choices; renamed?: { from: string; to: string } } {
  const count = spec[type] ?? 0
  if (count >= MAX_PER_ROOM) return { house: spec, choices }
  const house = { ...spec, [type]: count + 1 }
  if (count !== 1) return { house, choices }
  const renamed = { from: type, to: `${type}-1` }
  return { house, choices: moveInstance(choices, renamed.from, renamed.to), renamed }
}
