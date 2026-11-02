import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Need, Rooms, Tier } from '../data/schema.ts'
import type { Choices, ExclusionReason, Plan } from './budget.ts'
import {
  expandHouse,
  houseItemKeys,
  itemKey,
  normalizeSpec,
  splitItemKey,
  type HouseSpec,
} from './house.ts'
import type { Answers } from './assistant.ts'
import { isValidManual, MAX_MANUAL_ITEMS, type ManualItem } from './manual.ts'

/** Tudo o que é preciso para reproduzir uma lista. */
export interface ListState {
  /** Cômodos e quantidades (um cômodo só = { cozinha: 1 }). */
  house: HouseSpec
  budget: number
  /** Chaves "instância:categoria" (ver house.ts). */
  plan: Plan
  choices: Choices
  /** Respostas do "Monte pra mim" que montaram a lista (painel "Suas respostas"). */
  answers?: Answers
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
  /** Facilitadores: 1 = com (ausente = sem). */
  f?: number
  /** Variante escolhida por item (ausente = todas na padrão). */
  t?: Record<string, string>
  /** Necessidade ajustada por item. */
  e?: Record<string, number>
  /**
   * Itens adicionados pelo usuário: [cômodo, nome, preço, link, quantidade (ausente = 1),
   * item do catálogo que substitui (ausente = só adicionado)].
   */
  m?: WireManual[]
  /** Respostas do assistente: pergunta → ids das respostas. */
  a?: Answers
}

type WireManual = [string, string, number, string, number?, string?]

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
  if (state.choices.helpers) wire.f = 1
  if (Object.keys(state.choices.variants).length) wire.t = state.choices.variants
  if (Object.keys(state.choices.needs).length) wire.e = state.choices.needs
  if (state.choices.manual.length) {
    wire.m = state.choices.manual.map(({ instanceId, name, price, url, qty, replaces }) =>
      replaces
        ? [instanceId, name, price, url, qty, replaces]
        : qty === 1
          ? [instanceId, name, price, url]
          : [instanceId, name, price, url, qty],
    )
  }
  if (state.answers && Object.keys(state.answers).length) wire.a = state.answers
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
      helpers: wire.f === 1,
      variants: Object.fromEntries(
        entries(wire.t).filter(([, variant]) => typeof variant === 'string'),
      ) as Record<string, string>,
      needs: Object.fromEntries(entries(wire.e).filter(([, need]) => isNeed(need))) as Record<
        string,
        Need
      >,
      manual: manualItems(wire.m, house, rooms, keys),
    },
    ...(answers(wire.a) && { answers: answers(wire.a) }),
  }
}

const ID = /^[a-z0-9-]{1,40}$/

/** Respostas com formato válido (ids curtos); pergunta ou resposta que não existe é ignorada depois. */
function answers(raw: unknown): Answers | undefined {
  if (!isRecord(raw)) return undefined
  const valid = Object.entries(raw)
    .filter(([question]) => ID.test(question))
    .map(([question, ids]) => [
      question,
      Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === 'string' && ID.test(id))
        : [],
    ])
    .filter(([, ids]) => ids.length)
    .slice(0, 40)
  return valid.length ? (Object.fromEntries(valid) as Answers) : undefined
}

/**
 * Itens adicionados válidos e de cômodos que estão na casa; ids regerados pela posição. Troca de
 * um item que não existe mais (ou repetida) vira um item adicionado comum.
 */
function manualItems(
  raw: unknown,
  house: HouseSpec,
  rooms: Rooms,
  keys: Set<string>,
): ManualItem[] {
  if (!Array.isArray(raw)) return []
  const instances = new Set(expandHouse(rooms, {}, house).instances.map((i) => i.id))
  const items: ManualItem[] = []
  for (const entry of raw) {
    if (!Array.isArray(entry)) continue
    const [instanceId, name, price, url, qty = 1, replaces] = entry as unknown[]
    if (typeof instanceId !== 'string' || !instances.has(instanceId)) continue
    if (typeof name !== 'string' || typeof price !== 'number') continue
    if (typeof url !== 'string' || typeof qty !== 'number') continue
    const fields = { name: name.trim(), price, qty, url }
    if (!isValidManual(fields)) continue
    const item: ManualItem = { id: `m${items.length + 1}`, instanceId, ...fields }
    if (
      typeof replaces === 'string' &&
      keys.has(replaces) &&
      splitItemKey(replaces).instanceId === instanceId &&
      !items.some((other) => other.replaces === replaces)
    ) {
      item.replaces = replaces
    }
    items.push(item)
  }
  return items.slice(0, MAX_MANUAL_ITEMS)
}
