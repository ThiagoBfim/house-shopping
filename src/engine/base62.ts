/**
 * Bytes ↔ texto só com letras e números. O WhatsApp quebra links longos em "-" e "+" (os
 * símbolos do `compressToEncodedURIComponent`); sem símbolos, o link chega inteiro.
 *
 * Blocos de 5 bytes (40 bits, cabe num `number`) viram 7 caracteres; o último bloco, menor,
 * usa só os caracteres necessários (1 byte → 2, 2 → 3, 3 → 5, 4 → 6).
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const BASE = ALPHABET.length
const BLOCK_BYTES = 5
/** Caracteres para N bytes (índice = N). */
const CHARS_FOR_BYTES = [0, 2, 3, 5, 6, 7]

export function toBase62(bytes: Uint8Array): string {
  let text = ''
  for (let start = 0; start < bytes.length; start += BLOCK_BYTES) {
    const block = bytes.subarray(start, start + BLOCK_BYTES)
    let value = 0
    for (const byte of block) value = value * 256 + byte
    let chars = ''
    for (let i = 0; i < CHARS_FOR_BYTES[block.length]; i++) {
      chars = ALPHABET[value % BASE] + chars
      value = Math.floor(value / BASE)
    }
    text += chars
  }
  return text
}

/** Texto inválido (caractere fora do alfabeto, tamanho impossível, valor grande demais) = undefined. */
export function fromBase62(text: string): Uint8Array | undefined {
  const fullBlocks = Math.floor(text.length / CHARS_FOR_BYTES[BLOCK_BYTES])
  const restChars = text.length % CHARS_FOR_BYTES[BLOCK_BYTES]
  const restBytes = CHARS_FOR_BYTES.indexOf(restChars)
  if (restBytes < 0) return undefined

  const bytes = new Uint8Array(fullBlocks * BLOCK_BYTES + restBytes)
  let position = 0
  let offset = 0
  while (offset < bytes.length) {
    const size = Math.min(BLOCK_BYTES, bytes.length - offset)
    const chars = text.slice(position, position + CHARS_FOR_BYTES[size])
    position += chars.length
    let value = 0
    for (const char of chars) {
      const digit = ALPHABET.indexOf(char)
      if (digit < 0) return undefined
      value = value * BASE + digit
    }
    if (value >= 256 ** size) return undefined
    for (let i = size - 1; i >= 0; i--) {
      bytes[offset + i] = value % 256
      value = Math.floor(value / 256)
    }
    offset += size
  }
  return bytes
}
