import type { Need, ProductOption, Products, Room, RoomItem, Tier } from '../data/schema.ts'

/** Tier escolhido para cada categoria incluída na lista. */
export type Plan = Record<string, Tier>

export type ExclusionReason = 'refused' | 'owned'

/** Escolhas do usuário que o motor respeita. */
export interface Choices {
  /** Tier fixado pelo usuário (travado ou "mais barato/mais caro"). */
  locked: Record<string, Tier>
  /** Itens recusados ou que o usuário já tem. */
  excluded: Record<string, ExclusionReason>
  /** Filtro: só entram itens com necessidade ≥ minNeed. */
  minNeed: Need
  /** Filtro: incluir utensílios (pratos, talheres, panelas…). */
  utensils: boolean
  /** Filtro: incluir facilitadores (organizadores, potes de congelar…). Começa desligado. */
  helpers: boolean
}

/** Escolhas que funcionam como filtro da lista. */
export type FilterChoices = Pick<Choices, 'minNeed' | 'utensils' | 'helpers'>

/** A partir desta necessidade o item é "necessário": entra sempre, mesmo passando do orçamento. */
export const REQUIRED_NEED = 4

export interface ListEntry {
  item: RoomItem
  label: string
  option: ProductOption
  /** Todas as opções da categoria, do tier mais barato ao mais caro. */
  options: ProductOption[]
  subtotal: number
  locked: boolean
  utensil: boolean
  helper: boolean
}

export interface SkippedEntry {
  item: RoomItem
  label: string
  cheapest: ProductOption
}

export interface ExcludedEntry {
  item: RoomItem
  label: string
  reason: ExclusionReason
  cheapest: ProductOption
  /** Quanto deixou de gastar: a opção mais barata × quantidade (o mínimo que custaria). */
  saved: number
}

export type FilterReason = 'need' | 'helper' | 'utensil'

export interface FilteredEntry {
  item: RoomItem
  label: string
  reason: FilterReason
}

export interface ListView {
  entries: ListEntry[]
  /** Itens que não couberam no orçamento. */
  skipped: SkippedEntry[]
  excluded: ExcludedEntry[]
  /** Itens escondidos pelos filtros (necessidade mínima / utensílios / facilitadores). */
  filtered: FilteredEntry[]
  budget: number
  total: number
  /** Saldo; negativo quando a lista passa do orçamento ("faltam R$ X"). */
  remaining: number
  /** Economia com os recusados e os "já tenho" (soma de `saved` de cada um). */
  saved: Record<ExclusionReason, number>
}

export const emptyChoices = (): Choices => ({
  locked: {},
  excluded: {},
  minNeed: 1,
  utensils: true,
  helpers: false,
})

// Cálculos em centavos para não acumular erro de ponto flutuante.
const cents = (reais: number) => Math.round(reais * 100)

/** Ordem de importância: maior necessidade primeiro, depois nome (determinístico). */
export function byImportance(a: RoomItem, b: RoomItem): number {
  return b.need - a.need || a.category.localeCompare(b.category)
}

/** Por que o item foi escondido pelos filtros (ou undefined se passa). */
export function filterReason(
  item: RoomItem,
  products: Products,
  choices: FilterChoices,
): FilterReason | undefined {
  if (item.need < choices.minNeed) return 'need'
  if (!choices.helpers && products[item.category].helper) return 'helper'
  if (!choices.utensils && products[item.category].utensil) return 'utensil'
  return undefined
}

export function sortedOptions(products: Products, category: string): ProductOption[] {
  return [...products[category].options].sort((a, b) => a.tier - b.tier)
}

/**
 * Opção do tier pedido. Se o tier não existir mais no catálogo (ex.: link antigo),
 * usa o tier mais próximo abaixo; se não houver, o mais próximo acima.
 */
export function optionForTier(options: ProductOption[], tier: Tier): ProductOption {
  const below = options.filter((o) => o.tier <= tier)
  return below.length ? below[below.length - 1] : options[0]
}

/** Opção vizinha (mais barata = -1, mais cara = 1), ou undefined no extremo. */
export function neighborOption(
  options: ProductOption[],
  tier: Tier,
  direction: -1 | 1,
): ProductOption | undefined {
  const index = options.findIndex((o) => o.tier === optionForTier(options, tier).tier)
  return options[index + direction]
}

/**
 * Decide o tier de cada item (fora os recusados e os escondidos pelos filtros):
 * 1. travados entram com o tier escolhido;
 * 2. os demais entram no tier mais barato, da maior necessidade para a menor —
 *    necessários (≥ REQUIRED_NEED) sempre, os outros só se couberem;
 * 3. o saldo vai para upgrades de um tier por vez, escolhendo o maior
 *    `necessidade / tier atual` (os mais necessários sobem primeiro, mas sem
 *    concentrar tudo num só).
 */
export function planList(room: Room, products: Products, budget: number, choices: Choices): Plan {
  const plan: Plan = {}
  const limit = cents(budget)
  const cost = (item: RoomItem, option: ProductOption) => cents(option.price) * item.qty
  let spent = 0

  const active = room.items
    .filter((item) => !choices.excluded[item.category] && !filterReason(item, products, choices))
    .sort(byImportance)
  const free = active.filter((item) => choices.locked[item.category] === undefined)

  for (const item of active) {
    const tier = choices.locked[item.category]
    if (tier === undefined) continue
    const option = optionForTier(sortedOptions(products, item.category), tier)
    plan[item.category] = option.tier
    spent += cost(item, option)
  }

  for (const item of free) {
    const cheapest = sortedOptions(products, item.category)[0]
    const price = cost(item, cheapest)
    if (item.need >= REQUIRED_NEED || spent + price <= limit) {
      plan[item.category] = cheapest.tier
      spent += price
    }
  }

  for (;;) {
    let best: { item: RoomItem; next: ProductOption; delta: number; score: number } | undefined
    for (const item of free) {
      if (plan[item.category] === undefined) continue
      const options = sortedOptions(products, item.category)
      const current = optionForTier(options, plan[item.category])
      const next = neighborOption(options, current.tier, 1)
      if (!next) continue
      const delta = cost(item, next) - cost(item, current)
      if (spent + delta > limit) continue
      const score = item.need / current.tier
      if (!best || score > best.score) best = { item, next, delta, score }
    }
    if (!best) break
    plan[best.item.category] = best.next.tier
    spent += best.delta
  }

  return plan
}

/**
 * Monta a lista exibida a partir de um plano. As escolhas atuais têm precedência:
 * itens excluídos saem e itens travados usam o tier travado, mesmo sem reload.
 */
export function describeList(
  room: Room,
  products: Products,
  budget: number,
  plan: Plan,
  choices: Choices,
): ListView {
  const view: ListView = {
    entries: [],
    skipped: [],
    excluded: [],
    filtered: [],
    budget,
    total: 0,
    remaining: 0,
    saved: { refused: 0, owned: 0 },
  }
  let total = 0
  const saved = { refused: 0, owned: 0 }

  for (const item of [...room.items].sort(byImportance)) {
    const { label, utensil, helper = false } = products[item.category]
    const options = sortedOptions(products, item.category)
    const reason = choices.excluded[item.category]
    const hiddenBy = filterReason(item, products, choices)
    const tier = choices.locked[item.category] ?? plan[item.category]

    if (reason) {
      const cost = cents(options[0].price) * item.qty
      saved[reason] += cost
      view.excluded.push({ item, label, reason, cheapest: options[0], saved: cost / 100 })
    } else if (hiddenBy) {
      view.filtered.push({ item, label, reason: hiddenBy })
    } else if (tier === undefined) {
      view.skipped.push({ item, label, cheapest: options[0] })
    } else {
      const option = optionForTier(options, tier)
      const subtotal = cents(option.price) * item.qty
      total += subtotal
      view.entries.push({
        item,
        label,
        option,
        options,
        subtotal: subtotal / 100,
        locked: choices.locked[item.category] !== undefined,
        utensil,
        helper,
      })
    }
  }

  view.total = total / 100
  view.remaining = (cents(budget) - total) / 100
  view.saved = { refused: saved.refused / 100, owned: saved.owned / 100 }
  return view
}

/** Planeja e descreve a lista de uma vez (equivale a um "reload"). */
export function buildList(
  room: Room,
  products: Products,
  budget: number,
  choices: Choices = emptyChoices(),
): ListView {
  return describeList(room, products, budget, planList(room, products, budget, choices), choices)
}

export interface BudgetRange {
  /** Mínimo para os itens necessários (≥ REQUIRED_NEED) no tier mais barato. */
  required: number
  /** Todos os itens no tier mais barato. */
  allCheapest: number
  /** Todos os itens no tier mais caro. */
  allTop: number
}

/**
 * Faixa de orçamento de um cômodo, para orientar o usuário antes de montar a lista.
 * Considera só os itens que passam pelos filtros.
 */
export function budgetRange(
  room: Room,
  products: Products,
  filters: FilterChoices = emptyChoices(),
): BudgetRange {
  let required = 0
  let allCheapest = 0
  let allTop = 0
  for (const item of room.items) {
    if (filterReason(item, products, filters)) continue
    const options = sortedOptions(products, item.category)
    const cheapest = cents(options[0].price) * item.qty
    allCheapest += cheapest
    allTop += cents(options[options.length - 1].price) * item.qty
    if (item.need >= REQUIRED_NEED) required += cheapest
  }
  return { required: required / 100, allCheapest: allCheapest / 100, allTop: allTop / 100 }
}

/** Arredonda para cima num passo "redondo" para o tamanho do valor (R$ 1 mil, 5 mil, 10 mil). */
function roundUpNicely(value: number): number {
  const step = value < 20_000 ? 1_000 : value < 100_000 ? 5_000 : 10_000
  return Math.ceil(value / step) * step
}

export type PresetId = 'economico' | 'equilibrado' | 'premium'

export interface BudgetPreset {
  id: PresetId
  /** Tier que a maior parte dos itens alcança com este orçamento. */
  tier: Tier
  value: number
}

const PRESET_TIERS: [PresetId, Tier][] = [
  ['economico', 1],
  ['equilibrado', 2],
  ['premium', 3],
]

/** Total com todos os itens (que passam pelos filtros) no tier pedido (ou o mais próximo abaixo). */
export function tierTotal(
  room: Room,
  products: Products,
  tier: Tier,
  filters: FilterChoices = emptyChoices(),
): number {
  let total = 0
  for (const item of room.items) {
    if (filterReason(item, products, filters)) continue
    total += cents(optionForTier(sortedOptions(products, item.category), tier).price) * item.qty
  }
  return total / 100
}

/**
 * Três orçamentos prontos: econômico (tudo no tier 1), equilibrado (tudo no 2) e
 * premium (tudo no 3), arredondados para cima para caberem com folga.
 */
export function budgetPresets(
  room: Room,
  products: Products,
  filters: FilterChoices = emptyChoices(),
): BudgetPreset[] {
  return PRESET_TIERS.map(([id, tier]) => ({
    id,
    tier,
    value: roundUpNicely(tierTotal(room, products, tier, filters)),
  }))
}
