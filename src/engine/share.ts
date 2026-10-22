import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Need, Rooms, Tier } from '../data/schema.ts'
import type { Choices, ExclusionReason, Plan } from './budget.ts'
import { houseItemKeys, itemKey, normalizeSpec, type HouseSpec } from './house.ts'

/** Tudo o que é preciso para reproduzir uma lista. */
export interface ListState {
  /** Cômodos e quantidades (um cômodo só = { cozinha: 1 }). */
  house: HouseSpec
  budget: number
  /** Chaves "instância:categoria" (ver house.ts). */
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
  /** Cômodos e quantidades. */
  h?: Record<string, number>
  /** Formato antigo (um cômodo só, chaves sem instância). Só lido, nunca gravado. */
  r?: string
  b: number
  p: Record<string, number>
  l: Record<string, number>
  x: Record<string, string>
  /** Necessidade mínima (ausente = 1). Campos novos são opcionais: links antigos continuam válidos. */
  n?: number
  /** Utensílios: 0 = sem (ausente = com). */
  u?: number
}

export function encodeState(state: ListState): string {
  const wire: Wire = {
    v: STATE_VERSION,
    h: state.house,
    b: state.budget,
    p: state.plan,
    l: state.choices.locked,
    x: Object.fromEntries(
      Object.entries(state.choices.excluded).map(([key, reason]) => [key, REASON_CODES[reason]]),
    ),
  }
  if (state.choices.minNeed !== 1) wire.n = state.choices.minNeed
  if (!state.choices.utensils) wire.u = 0
  return compressToEncodedURIComponent(JSON.stringify(wire))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isTier = (value: unknown): value is Tier =>
  value === 1 || value === 2 || value === 3 || value === 4

const isNeed = (value: unknown): value is Need => isTier(value) || value === 5

/**
 * Lê um estado vindo da URL ou do localStorage. Nunca lança: entrada inválida
 * devolve undefined. Itens que não existem mais na casa são descartados, para que
 * links antigos continuem abrindo depois de mudanças no catálogo. Links do formato
 * antigo (`r`: um cômodo, chaves sem instância) são convertidos.
 */
export function decodeState(encoded: string, rooms: Rooms): ListState | undefined {
  let wire: unknown
  try {
    wire = JSON.parse(decompressFromEncodedURIComponent(encoded) || 'null')
  } catch {
    return undefined
  }
  if (!isRecord(wire) || wire.v !== STATE_VERSION) return undefined

  const { b: budget } = wire
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) return undefined

  let house: HouseSpec
  let toKey = (key: string) => key
  if (isRecord(wire.h)) {
    house = normalizeSpec(wire.h as HouseSpec, rooms)
  } else if (typeof wire.r === 'string' && Object.hasOwn(rooms, wire.r)) {
    const roomId = wire.r
    house = { [roomId]: 1 }
    toKey = (category) => itemKey(roomId, category)
  } else {
    return undefined
  }
  if (!Object.keys(house).length) return undefined

  const keys = houseItemKeys(rooms, house)
  const entries = (raw: unknown) =>
    isRecord(raw)
      ? Object.entries(raw)
          .map(([key, value]) => [toKey(key), value] as const)
          .filter(([key]) => keys.has(key))
      : []
  const tiers = (raw: unknown) =>
    Object.fromEntries(entries(raw).filter(([, tier]) => isTier(tier))) as Record<string, Tier>
  const excluded: Record<string, ExclusionReason> = {}
  for (const [key, code] of entries(wire.x)) {
    const reason = typeof code === 'string' ? REASONS_BY_CODE[code] : undefined
    if (reason) excluded[key] = reason
  }

  return {
    house,
    budget,
    plan: tiers(wire.p),
    choices: {
      locked: tiers(wire.l),
      excluded,
      minNeed: isNeed(wire.n) ? wire.n : 1,
      utensils: wire.u !== 0,
    },
  }
}
