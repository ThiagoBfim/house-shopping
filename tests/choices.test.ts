import { describe, expect, it } from 'vitest'
import type { ListView } from '../src/engine/budget.ts'
import { emptyChoices } from '../src/engine/budget.ts'
import {
  diffPlans,
  displayedTiers,
  exclude,
  lockAt,
  restore,
  unlock,
} from '../src/engine/choices.ts'

describe('escolhas', () => {
  it('exclude marca o motivo e remove a trava do item', () => {
    const locked = lockAt(emptyChoices(), 'geladeira', 3)
    expect(exclude(locked, 'geladeira', 'owned')).toEqual({
      locked: {},
      excluded: { geladeira: 'owned' },
    })
  })

  it('restore reativa o item', () => {
    const choices = exclude(emptyChoices(), 'fogao', 'refused')
    expect(restore(choices, 'fogao')).toEqual(emptyChoices())
  })

  it('lockAt / unlock', () => {
    const locked = lockAt(emptyChoices(), 'fogao', 2)
    expect(locked.locked).toEqual({ fogao: 2 })
    expect(unlock(locked, 'fogao')).toEqual(emptyChoices())
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
