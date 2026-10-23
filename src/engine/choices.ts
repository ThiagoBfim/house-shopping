import type { Tier } from '../data/schema.ts'
import type { Choices, ExclusionReason, ListView, Plan } from './budget.ts'

// Funções puras que devolvem novas Choices (o estado da UI nunca é mutado).

export function exclude(choices: Choices, category: string, reason: ExclusionReason): Choices {
  const locked = { ...choices.locked }
  delete locked[category]
  return { ...choices, locked, excluded: { ...choices.excluded, [category]: reason } }
}

export function restore(choices: Choices, category: string): Choices {
  const excluded = { ...choices.excluded }
  delete excluded[category]
  return { ...choices, excluded }
}

/** Troca a variante do item (fogão → cooktop). A trava sai: o tier era de outra escada. */
export function setVariant(choices: Choices, category: string, variant: string): Choices {
  return { ...unlock(choices, category), variants: { ...choices.variants, [category]: variant } }
}

export function lockAt(choices: Choices, category: string, tier: Tier): Choices {
  return { ...choices, locked: { ...choices.locked, [category]: tier } }
}

export function unlock(choices: Choices, category: string): Choices {
  const locked = { ...choices.locked }
  delete locked[category]
  return { ...choices, locked }
}

/** Tier de cada item que está na lista exibida. */
export function displayedTiers(view: ListView): Plan {
  return Object.fromEntries(view.entries.map((e) => [e.item.category, e.option.tier]))
}

export type Change = 'added' | 'removed' | 'up' | 'down'

/** Resumo de uma mudança na lista (ex.: ligar utensílios), em itens e reais. */
export interface ChangeSummary {
  added: number
  addedCost: number
  removed: number
  removedCost: number
  /** Itens que ficaram num tier mais barato / mais caro. */
  cheaper: number
  pricier: number
  totalDelta: number
}

export function summarizeChanges(before: ListView, after: ListView): ChangeSummary {
  const diff = diffPlans(displayedTiers(before), displayedTiers(after))
  const cost = (view: ListView, change: Change) =>
    view.entries
      .filter((e) => diff[e.item.category] === change)
      .reduce((sum, e) => sum + e.subtotal, 0)
  const count = (change: Change) => Object.values(diff).filter((c) => c === change).length
  return {
    added: count('added'),
    addedCost: cost(after, 'added'),
    removed: count('removed'),
    removedCost: cost(before, 'removed'),
    cheaper: count('down'),
    pricier: count('up'),
    totalDelta: after.total - before.total,
  }
}

/** O que mudou entre duas listas (usado para destacar o resultado do reload). */
export function diffPlans(before: Plan, after: Plan): Record<string, Change> {
  const changes: Record<string, Change> = {}
  for (const category of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const [a, b] = [before[category], after[category]]
    if (a === b) continue
    if (a === undefined) changes[category] = 'added'
    else if (b === undefined) changes[category] = 'removed'
    else changes[category] = b > a ? 'up' : 'down'
  }
  return changes
}
