import type { ListView } from './budget.ts'
import type { Opening } from './floor-plan.ts'
import { setPosition, type ManualPositions, type PlacedItem, type RoomLayout } from './layout.ts'

/**
 * Chat do projeto (2ª wave, backend local): a pessoa conversa sobre a casa e a IA sugere
 * mudanças. Aqui fica o que a IA recebe (o projeto como está na tela) e a conferência do que ela
 * devolve. Nada é aplicado sozinho: cada sugestão vira um botão "Aplicar" na conversa.
 */

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

/** Sugestões que a IA pode fazer (e a tela sabe aplicar e conferir). */
export type ChatAction =
  | {
      /** Mover/girar um móvel. `room` = cômodo da tela ("sala", ou "sala#1" na parte da sala em L). */
      type: 'move'
      room: string
      key: string
      unit: number
      /** Centro do móvel no cômodo, em cm a partir do canto de cima à esquerda. */
      xCm: number
      yCm: number
      rotation: PlacedItem['facing']
    }
  | { type: 'remove'; key: string }
  | { type: 'reset'; room: string }

export interface ChatReply {
  reply: string
  actions: ChatAction[]
}

const FACINGS = new Set(['down', 'up', 'left', 'right'])
const MAX_ACTIONS = 12
export const MAX_HISTORY = 12
export const MAX_MESSAGE = 1000

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseAction(raw: unknown): ChatAction | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const a = raw as Record<string, unknown>
  if (a.type === 'move') {
    if (typeof a.room !== 'string' || typeof a.key !== 'string') return undefined
    if (!Number.isInteger(a.unit) || (a.unit as number) < 0) return undefined
    if (!isNum(a.xCm) || !isNum(a.yCm) || a.xCm < 0 || a.yCm < 0) return undefined
    if (typeof a.rotation !== 'string' || !FACINGS.has(a.rotation)) return undefined
    return {
      type: 'move',
      room: a.room,
      key: a.key,
      unit: a.unit as number,
      xCm: Math.round(a.xCm),
      yCm: Math.round(a.yCm),
      rotation: a.rotation as PlacedItem['facing'],
    }
  }
  if (a.type === 'remove' && typeof a.key === 'string') return { type: 'remove', key: a.key }
  if (a.type === 'reset' && typeof a.room === 'string') return { type: 'reset', room: a.room }
  return undefined
}

/** Confere a resposta da skill /house-chat (vem de fora). */
export function parseChatReply(data: unknown): ChatReply | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const d = data as Record<string, unknown>
  if (typeof d.reply !== 'string' || !d.reply.trim()) return undefined
  const actions = (Array.isArray(d.actions) ? d.actions : [])
    .map(parseAction)
    .filter((a): a is ChatAction => a !== undefined)
    .slice(0, MAX_ACTIONS)
  return { reply: d.reply.trim(), actions }
}

/** Um cômodo como a IA vê: medidas, portas e janelas, e cada móvel no lugar (cm). */
export interface ChatRoom {
  /** Id da aba ("sala", "sala#1"): é o `room` das ações. */
  id: string
  title: string
  widthCm: number
  depthCm: number
  /** Medida estimada (planta sem cota ou cômodo fora da planta). */
  estimated: boolean
  openings: (Opening & { sliding?: boolean })[]
  furniture: {
    key: string
    unit: number
    name: string
    category: string
    placement: string
    /** Centro (cm) e tamanho ocupado no chão (já girado). */
    xCm: number
    yCm: number
    widthCm: number
    depthCm: number
    heightCm: number
    elevationCm: number
    facing: PlacedItem['facing']
  }[]
  /** Armários das fotos: já estão no imóvel, não se movem. */
  builtIns: { name: string; xCm: number; yCm: number; widthCm: number; depthCm: number }[]
  /** Da lista, mas não coube no cômodo. */
  unplaced: string[]
  /** Da lista, sem lugar fixo no desenho (bancada, guardados). */
  others: string[]
}

export function chatRoom(
  room: { id: string; title: string; estimated: boolean },
  layout: RoomLayout,
  fixed: PlacedItem[],
  others: string[],
  view: ListView,
): ChatRoom {
  const nameOf = (key: string) =>
    view.entries.find((e) => e.item.category === key)?.option.name ??
    view.manual.find((m) => m.item.id === key)?.item.name
  const labelOf = (key: string, fallback: string) =>
    view.entries.find((e) => e.item.category === key)?.label ??
    view.manual.find((m) => m.item.id === key)?.replaced?.label ??
    fallback
  return {
    id: room.id,
    title: room.title,
    widthCm: layout.width,
    depthCm: layout.depth,
    estimated: room.estimated,
    openings: layout.openings,
    furniture: layout.placed.map((p) => ({
      key: p.key,
      unit: p.unit,
      name: `${labelOf(p.key, p.label)}: ${nameOf(p.key) ?? p.label}`,
      category: p.category,
      placement: p.placement,
      xCm: Math.round(p.x + p.w / 2),
      yCm: Math.round(p.y + p.d / 2),
      widthCm: Math.round(p.w),
      depthCm: Math.round(p.d),
      heightCm: Math.round(p.height),
      elevationCm: Math.round(p.elevation),
      facing: p.facing,
    })),
    builtIns: fixed.map((p) => ({
      name: p.label,
      xCm: Math.round(p.x + p.w / 2),
      yCm: Math.round(p.y + p.d / 2),
      widthCm: Math.round(p.w),
      depthCm: Math.round(p.d),
    })),
    unplaced: layout.unplaced.map((u) => labelOf(u.key, u.label)),
    others,
  }
}

/** O que vai para a IA: o projeto como está na tela, a lista com preços e a conversa. */
export function chatRequest(rooms: ChatRoom[], view: ListView, messages: ChatMessage[]) {
  return {
    rooms,
    list: {
      total: view.total,
      budget: view.total + view.remaining,
      items: view.entries.map((e) => ({
        key: e.item.category,
        label: e.label,
        name: e.option.name,
        price: e.option.price,
      })),
    },
    messages: messages
      .slice(-MAX_HISTORY)
      .map((m) => ({ ...m, text: m.text.slice(0, MAX_MESSAGE) })),
  }
}

export type MoveAction = Extract<ChatAction, { type: 'move' }>

/**
 * Aplicar mudanças de lugar (uma ou "Aplicar todas"). Vão juntas para as posições e o motor
 * confere no estado final, sem depender da ordem da IA (trocar o sofá e o rack de parede só dá
 * certo com os dois no lugar novo). A que não ficou onde a IA pediu sai das posições.
 */
export function applyMoves(
  moves: MoveAction[],
  positions: ManualPositions,
  /** Cômodo da lista da ação ("sala#1" → "sala"). */
  instanceOf: (room: string) => string | undefined,
  /** O móvel ficou onde a ação pediu, com estas posições? */
  isAt: (move: MoveAction, positions: ManualPositions) => boolean,
): { positions: ManualPositions; applied: boolean[] } {
  const hint = ({ key, unit, xCm, yCm, rotation }: MoveAction) => ({
    key,
    unit,
    xCm,
    yCm,
    rotation,
  })
  let next = positions
  for (const move of moves) {
    const id = instanceOf(move.room)
    if (id) next = setPosition(next, id, hint(move))
  }
  const applied = moves.map((move) => !!instanceOf(move.room) && isAt(move, next))
  // Sem a posição que não coube (fica a de antes, se havia).
  let result = positions
  moves.forEach((move, i) => {
    if (applied[i]) result = setPosition(result, instanceOf(move.room)!, hint(move))
  })
  return { positions: result, applied }
}
