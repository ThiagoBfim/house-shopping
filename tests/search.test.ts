import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeText } from '../src/engine/search.ts'

describe('busca rápida', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizeText('  Régua   de TOMADA ')).toBe('regua de tomada')
  })

  it('busca vazia casa tudo', () => {
    expect(matchesSearch('', ['Geladeira'])).toBe(true)
    expect(matchesSearch('   ', ['Geladeira'])).toBe(true)
  })

  it('casa pedaço de palavra, sem acento e em qualquer texto', () => {
    const texts = ['Régua de tomada', 'Filtro de Linha Clamper Energia 8 Tomadas']
    expect(matchesSearch('regua', texts)).toBe(true)
    expect(matchesSearch('CLAMP', texts)).toBe(true)
    expect(matchesSearch('lanterna', texts)).toBe(false)
  })

  it('todas as palavras precisam aparecer, em qualquer ordem', () => {
    const texts = ['Geladeira', 'Geladeira Brastemp Frost Free 375 L']
    expect(matchesSearch('frost brastemp', texts)).toBe(true)
    expect(matchesSearch('frost electrolux', texts)).toBe(false)
  })
})
