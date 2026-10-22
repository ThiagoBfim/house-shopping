/** Sem acento, minúsculo e com espaços simples: "Régua  de Tomada" → "regua de tomada". */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Busca rápida: cada palavra digitada precisa aparecer em algum dos textos
 * (categoria, modelo…), em qualquer ordem e sem diferenciar acento. Busca vazia casa tudo.
 */
export function matchesSearch(query: string, texts: string[]): boolean {
  const words = normalizeText(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const haystack = normalizeText(texts.join(' '))
  return words.every((word) => haystack.includes(word))
}
