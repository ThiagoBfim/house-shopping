import type { Priority, ProductOption, Products, Room, RoomItem, Tier } from '../data/schema.ts'

/** Tier escolhido para cada categoria incluída na lista. */
export type Plan = Record<string, Tier>

export type ExclusionReason = 'refused' | 'owned'

/** Escolhas do usuário que o motor respeita. */
export interface Choices {
  /** Tier fixado pelo usuário (travado ou "mais barato/mais caro"). */
  locked: Record<string, Tier>
  /** Itens recusados ou que o usuário já tem. */
  excluded: Record<string, ExclusionReason>
}

export interface ListEntry {
  item: RoomItem
  label: string
  option: ProductOption
  /** Todas as opções da categoria, do tier mais barato ao mais caro. */
  options: ProductOption[]
  subtotal: number
  locked: boolean
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
}

export interface ListView {
  entries: ListEntry[]
  /** Itens que não couberam no orçamento. */
  skipped: SkippedEntry[]
  excluded: ExcludedEntry[]
  budget: number
  total: number
  /** Saldo; negativo quando a lista passa do orçamento ("faltam R$ X"). */
  remaining: number
}

export const emptyChoices = (): Choices => ({ locked: {}, excluded: {} })

const PRIORITY_ORDER: Priority[] = ['essential', 'important', 'optional']

// Cálculos em centavos para não acumular erro de ponto flutuante.
const cents = (reais: number) => Math.round(reais * 100)

/** Ordem de importância: prioridade, depois peso, depois nome (determinístico). */
export function byImportance(a: RoomItem, b: RoomItem): number {
  return (
    PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
    b.weight - a.weight ||
    a.category.localeCompare(b.category)
  )
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
 * Decide o tier de cada item:
 * 1. travados entram com o tier escolhido;
 * 2. os demais entram no tier mais barato — essenciais sempre, importantes e
 *    desejáveis só se couberem;
 * 3. o saldo vai para upgrades de um tier por vez, escolhendo o maior
 *    `weight / tier atual` (itens importantes sobem primeiro, mas sem
 *    concentrar tudo num só).
 */
export function planList(room: Room, products: Products, budget: number, choices: Choices): Plan {
  const plan: Plan = {}
  const limit = cents(budget)
  const cost = (item: RoomItem, option: ProductOption) => cents(option.price) * item.qty
  let spent = 0

  const active = room.items.filter((item) => !choices.excluded[item.category]).sort(byImportance)
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
    if (item.priority === 'essential' || spent + price <= limit) {
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
      const score = item.weight / current.tier
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
  const view: ListView = { entries: [], skipped: [], excluded: [], budget, total: 0, remaining: 0 }
  let total = 0

  for (const item of [...room.items].sort(byImportance)) {
    const label = products[item.category].label
    const options = sortedOptions(products, item.category)
    const reason = choices.excluded[item.category]
    const tier = choices.locked[item.category] ?? plan[item.category]

    if (reason) {
      view.excluded.push({ item, label, reason })
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
      })
    }
  }

  view.total = total / 100
  view.remaining = (cents(budget) - total) / 100
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
  /** Mínimo para os essenciais no tier mais barato. */
  essentials: number
  /** Todos os itens no tier mais barato. */
  allCheapest: number
  /** Todos os itens no tier mais caro. */
  allTop: number
}

/** Faixa de orçamento de um cômodo, para orientar o usuário antes de montar a lista. */
export function budgetRange(room: Room, products: Products): BudgetRange {
  let essentials = 0
  let allCheapest = 0
  let allTop = 0
  for (const item of room.items) {
    const options = sortedOptions(products, item.category)
    const cheapest = cents(options[0].price) * item.qty
    allCheapest += cheapest
    allTop += cents(options[options.length - 1].price) * item.qty
    if (item.priority === 'essential') essentials += cheapest
  }
  return { essentials: essentials / 100, allCheapest: allCheapest / 100, allTop: allTop / 100 }
}
