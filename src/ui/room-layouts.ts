import type { ListView } from '../engine/budget.ts'
import {
  guestsByHost,
  roomTypeOf,
  TYPICAL_ROOM_CM,
  TYPICAL_ROOM_DEFAULT,
} from '../engine/floor-plan.ts'
import type { RoomInstance } from '../engine/house.ts'
import { furnishHouse } from '../engine/house3d.ts'
import {
  applySuggestions,
  arrangeRoom,
  layoutItems,
  otherItems,
  roomSizeCm,
  type ManualPositions,
  type PlacedItem,
  type RoomLayout,
} from '../engine/layout.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import type { SavedHouse } from './house3d-store.ts'

/**
 * Cômodos da "Posição dos móveis" e o desenho de cada um. Usado pela vista de cima e pelo chat
 * do projeto: os dois veem exatamente o mesmo (medidas, móveis, posições, armários das fotos).
 */

/** Cômodo dos itens da casa toda (limpeza, ferramentas): não é um lugar. */
const WHOLE_HOUSE = 'utilidades'

export interface RoomTab {
  tab: string
  title: string
  room: SavedPlan['rooms'][number] | undefined
  index: number
  instance: RoomInstance | undefined
  /** Parte de cômodo em L na casa em 3D (índice do retângulo). */
  part?: number
}

export interface RoomView {
  size: { width: number; depth: number; estimated: boolean }
  layout: RoomLayout
  /** Armários das fotos (peças fixas). */
  fixed: PlacedItem[]
  from3d: boolean
  /** Cômodo da lista fora da planta (medida típica). */
  outside: boolean
}

export interface RoomTabs {
  tabs: RoomTab[]
  /** Cômodo + hóspedes (sem área de serviço, a lavanderia fica na cozinha). */
  idsOf: (id: string) => string[]
  guests: Record<string, string[]>
}

export function roomTabs(
  plan: SavedPlan,
  view: ListView,
  instances: RoomInstance[],
  house?: SavedHouse,
): RoomTabs {
  const guests = guestsByHost(
    plan.rooms,
    instances.map((i) => i.id),
  )
  const idsOf = (id: string) => [id, ...(guests[id] ?? [])]
  const inPlan = new Set(plan.rooms.map((r) => r.instanceId))
  const hostedIds = new Set(Object.values(guests).flat())
  const tabFor = (instance: RoomInstance | undefined, room: RoomTab['room'], index: number) => ({
    tab: instance?.id ?? `plan-${index}`,
    title: instance?.title ?? room?.label ?? '',
    room,
    index,
    instance,
  })
  // Na casa em 3D, a sala em L tem mais de um retângulo: uma aba para cada parte.
  const partsOf = (instance: RoomInstance): RoomTab[] =>
    (house?.model.rooms ?? []).flatMap((r, part) =>
      r.partOf && r.instanceId === instance.id
        ? [
            {
              tab: `${instance.id}#${part}`,
              title: `${instance.title} · ${r.label.replace(/^.*?[–-]\s*/, '')}`,
              room: undefined,
              index: -1,
              instance,
              part,
            },
          ]
        : [],
    )
  const tabs: RoomTab[] = [
    ...plan.rooms.map((room, index) =>
      tabFor(
        instances.find((i) => i.id === room.instanceId),
        room,
        index,
      ),
    ),
    // Cômodos da lista que não estão na planta (ex.: escritório adicionado depois): medida típica.
    ...instances
      .filter((i) => !inPlan.has(i.id) && !hostedIds.has(i.id) && i.roomId !== WHOLE_HOUSE)
      .map((instance) => tabFor(instance, undefined, -1)),
  ]
    .filter(
      (r) =>
        r.instance &&
        (layoutItems(view, idsOf(r.instance.id)).length ||
          otherItems(view, idsOf(r.instance.id)).length),
    )
    .flatMap((r) => [r, ...partsOf(r.instance!)])
  return { tabs, idsOf, guests }
}

/** Desenho de um cômodo: o mesmo do 3D quando há casa gerada; senão, a planta lida. */
export function layoutOfTab(
  tab: RoomTab,
  {
    plan,
    view,
    house,
    positions,
    idsOf,
  }: {
    plan: SavedPlan
    view: ListView
    house?: SavedHouse
    positions: ManualPositions
    idsOf: (id: string) => string[]
  },
): RoomView | undefined {
  const id = tab.instance?.id
  if (!id) return undefined
  // A casa toda (a regra da lavanderia na cozinha olha os outros cômodos), depois o cômodo.
  // (sala em L: a aba da parte mostra o retângulo dela; a do cômodo, o principal)
  const f =
    house?.model.rooms.some((r) => r.instanceId === id) &&
    furnishHouse(house.model, view, positions).find((r, i) =>
      tab.part !== undefined ? i === tab.part : r.room.instanceId === id && !r.room.partOf,
    )
  if (f) {
    const size = { width: f.layout.width, depth: f.layout.depth, estimated: false }
    return { size, layout: f.layout, fixed: f.fixed, from3d: true, outside: false }
  }
  const size = tab.room
    ? roomSizeCm(plan, tab.index)
    : { ...(TYPICAL_ROOM_CM[roomTypeOf(id)] ?? TYPICAL_ROOM_DEFAULT), estimated: true }
  const base = arrangeRoom(
    { width: size.width, depth: size.depth, openings: tab.room?.openings ?? [] },
    layoutItems(view, idsOf(id)),
  )
  const { layout } = applySuggestions(base, positions[id] ?? [])
  return { size, layout, fixed: [], from3d: false, outside: !tab.room }
}
