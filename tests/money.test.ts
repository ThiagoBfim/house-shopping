import { describe, expect, it } from 'vitest'
import { formatBRL } from '../src/engine/money.ts'

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(30000)).toBe('R$ 30.000,00')
  })

  it('formata centavos', () => {
    expect(formatBRL(2299.9)).toBe('R$ 2.299,90')
  })
})
