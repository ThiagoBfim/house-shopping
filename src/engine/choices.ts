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
