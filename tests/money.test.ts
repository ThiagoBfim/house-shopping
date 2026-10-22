import { describe, expect, it } from 'vitest'
import { formatBRL, formatBRLWhole, formatInteger, parseDigits } from '../src/engine/money.ts'

describe('formatBRL', () => {
  it('formata valores em reais', () => {
    expect(formatBRL(30000)).toBe('R$ 30.000,00')
  })

  it('formata centavos', () => {
    expect(formatBRL(2299.9)).toBe('R$ 2.299,90')
  })
})

describe('formatBRLWhole / formatInteger', () => {
  it('formata sem centavos', () => {
    expect(formatBRLWhole(30000)).toBe('R$ 30.000')
    expect(formatBRLWhole(-400.4)).toBe('-R$ 400')
    expect(formatInteger(1234567)).toBe('1.234.567')
  })
})

describe('parseDigits', () => {
  it('lê só os dígitos', () => {
    expect(parseDigits('R$ 30.000')).toBe(30000)
    expect(parseDigits('abc')).toBe(0)
    expect(parseDigits('')).toBe(0)
  })

  it('limita ao máximo', () => {
    expect(parseDigits('999999999999', 1000)).toBe(1000)
  })
})
