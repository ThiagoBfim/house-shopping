import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Rooms, Tier } from '../data/schema.ts'
import type { Choices, ExclusionReason, Plan } from './budget.ts'

/** Tudo o que é preciso para reproduzir uma lista. */
export interface ListState {
  roomId: string
  budget: number
  plan: Plan
  choices: Choices
}

/**
 * Versão do formato. Mudou o formato de forma incompatível? Incremente e trate
 * a versão antiga em `decodeState` para não quebrar links já compartilhados.
 */
export const STATE_VERSION = 1

const REASON_CODES: Record<ExclusionReason, string> = { refused: 'r', owned: 'o' }
const REASONS_BY_CODE: Record<string, ExclusionReason> = { r: 'refused', o: 'owned' }

/** Formato compacto que vai na URL. */
interface Wire {
  v: number
  r: string
  b: number
  p: Record<string, number>
  l: Record<string, number>
  x: Record<string, string>
}

export function encodeState(state: ListState): string {
  const wire: Wire = {
    v: STATE_VERSION,
    r: state.roomId,
    b: state.budget,
    p: state.plan,
    l: state.choices.locked,
    x: Object.fromEntries(
      Object.entries(state.choices.excluded).map(([category, reason]) => [
        category,
        REASON_CODES[reason],
      ]),
    ),
  }
  return compressToEncodedURIComponent(JSON.stringify(wire))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTier = (value: unknown): value is Tier =>
  value === 1 || value === 2 || value === 3 || value === 4

/**
 * Lê um estado vindo da URL ou do localStorage. Nunca lança: entrada inválida
 * devolve undefined. Categorias que não existem mais no cômodo são descartadas,
 * para que links antigos continuem abrindo depois de mudanças no catálogo.
 */
export function decodeState(encoded: string, rooms: Rooms): ListState | undefined {
  let wire: unknown
  try {
    wire = JSON.parse(decompressFromEncodedURIComponent(encoded) || 'null')
  } catch {
    return undefined
  }
  if (!isRecord(wire) || wire.v !== STATE_VERSION) return undefined

  const { r: roomId, b: budget } = wire
  if (typeof roomId !== 'string' || !Object.hasOwn(rooms, roomId)) return undefined
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) return undefined

  const categories = new Set(rooms[roomId].items.map((item) => item.category))
  const tiers = (raw: unknown): Record<string, Tier> => {
    if (!isRecord(raw)) return {}
    return Object.fromEntries(
      Object.entries(raw).filter(([category, tier]) => categories.has(category) && isTier(tier)),
    ) as Record<string, Tier>
  }
  const excluded: Record<string, ExclusionReason> = {}
  if (isRecord(wire.x)) {
    for (const [category, code] of Object.entries(wire.x)) {
      const reason = typeof code === 'string' ? REASONS_BY_CODE[code] : undefined
      if (categories.has(category) && reason) excluded[category] = reason
    }
  }

  return { roomId, budget, plan: tiers(wire.p), choices: { locked: tiers(wire.l), excluded } }
}
