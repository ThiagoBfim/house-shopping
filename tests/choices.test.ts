import { describe, expect, it } from 'vitest'
import type { ListView } from '../src/engine/budget.ts'
import { emptyChoices } from '../src/engine/budget.ts'
import {
  diffPlans,
  displayedTiers,
  exclude,
  lockAt,
  restore,
  setVariant,
  summarizeChanges,
  unlock,
} from '../src/engine/choices.ts'
import type { Tier } from '../src/data/schema.ts'

describe('escolhas', () => {
  it('exclude marca o motivo e remove a trava do item', () => {
    const locked = lockAt(emptyChoices(), 'geladeira', 3)
    expect(exclude(locked, 'geladeira', 'owned')).toEqual({
      ...emptyChoices(),
      excluded: { geladeira: 'owned' },
    })
  })

  it('restore reativa o item', () => {
    const choices = exclude(emptyChoices(), 'fogao', 'refused')
    expect(restore(choices, 'fogao')).toEqual(emptyChoices())
  })

  it('setVariant troca a variante e tira a trava (o tier era de outra escada)', () => {
    const locked = lockAt(emptyChoices(), 'fogao', 3)
    expect(setVariant(locked, 'fogao', 'cooktop-inducao')).toEqual({
      ...emptyChoices(),
      variants: { fogao: 'cooktop-inducao' },
    })
  })

  it('lockAt / unlock', () => {
    const locked = lockAt(emptyChoices(), 'fogao', 2)
    expect(locked.locked).toEqual({ fogao: 2 })
    expect(unlock(locked, 'fogao')).toEqual(emptyChoices())
  })

  it('preserva os filtros', () => {
    const filtered = { ...emptyChoices(), minNeed: 3 as const, utensils: false }
    for (const next of [
      exclude(filtered, 'a', 'refused'),
      restore(filtered, 'a'),
      lockAt(filtered, 'a', 2),
      unlock(filtered, 'a'),
    ]) {
      expect(next).toMatchObject({ minNeed: 3, utensils: false })
    }
  })

  it('não muta o objeto original', () => {
    const original = emptyChoices()
    lockAt(original, 'a', 1)
    exclude(original, 'b', 'refused')
    expect(original).toEqual(emptyChoices())
  })
})

describe('diffPlans', () => {
  it('detecta itens adicionados, removidos, que subiram e que desceram', () => {
    expect(diffPlans({ a: 1, b: 2, c: 3, d: 1 }, { a: 1, b: 3, c: 2, e: 1 })).toEqual({
      b: 'up',
      c: 'down',
      d: 'removed',
      e: 'added',
    })
  })

  it('lista igual não tem mudanças', () => {
    expect(diffPlans({ a: 2 }, { a: 2 })).toEqual({})
  })
})

describe('displayedTiers', () => {
  it('extrai o tier de cada item exibido', () => {
    const view = {
      entries: [
        { item: { category: 'a' }, option: { tier: 2 } },
        { item: { category: 'b' }, option: { tier: 4 } },
      ],
    } as unknown as ListView
    expect(displayedTiers(view)).toEqual({ a: 2, b: 4 })
  })
})

describe('summarizeChanges', () => {
  const entry = (category: string, tier: Tier, subtotal: number) =>
    ({
      item: { category, need: 3, qty: 1 },
      option: { tier },
      subtotal,
    }) as ListView['entries'][number]
  const view = (entries: ListView['entries']) =>
    ({ entries, total: entries.reduce((s, e) => s + e.subtotal, 0) }) as ListView

  it('conta itens que entraram/saíram e quantos ficaram mais baratos ou caros', () => {
    const before = view([entry('sofa', 3, 3000), entry('tv', 2, 2000), entry('rack', 1, 500)])
    const after = view([
      entry('sofa', 2, 1800),
      entry('tv', 2, 2000),
      entry('pratos', 1, 129),
      entry('copos', 1, 59),
    ])
    expect(summarizeChanges(before, after)).toEqual({
      added: 2,
      addedCost: 188,
      removed: 1,
      removedCost: 500,
      cheaper: 1,
      pricier: 0,
      totalDelta: 3988 - 5500,
    })
  })
})
