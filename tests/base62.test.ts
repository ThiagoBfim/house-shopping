import { describe, expect, it } from 'vitest'
import { fromBase62, toBase62 } from '../src/engine/base62.ts'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('base62', () => {
  it('ida e volta em todos os tamanhos de bloco, só com letras e números', () => {
    for (let length = 0; length <= 23; length++) {
      const input = Uint8Array.from({ length }, (_, i) => (i * 97 + 255) % 256)
      const text = toBase62(input)
      expect(text).toMatch(/^[0-9A-Za-z]*$/)
      expect(fromBase62(text)).toEqual(input)
    }
  })

  it('extremos: zeros e 0xFF', () => {
    expect(fromBase62(toBase62(bytes(0, 0, 0, 0, 0, 0)))).toEqual(bytes(0, 0, 0, 0, 0, 0))
    const max = new Uint8Array(12).fill(255)
    expect(fromBase62(toBase62(max))).toEqual(max)
  })

  it('5 bytes viram 7 caracteres', () => {
    expect(toBase62(new Uint8Array(10))).toHaveLength(14)
    expect(toBase62(bytes(1))).toHaveLength(2)
  })

  it('texto inválido = undefined', () => {
    expect(fromBase62('ab-cd')).toBeUndefined() // caractere fora do alfabeto
    expect(fromBase62('abcd')).toBeUndefined() // 4 caracteres não correspondem a nenhum tamanho
    expect(fromBase62('zz')).toBeUndefined() // 61×62+61 > 255
    expect(fromBase62('')).toEqual(new Uint8Array())
  })
})
