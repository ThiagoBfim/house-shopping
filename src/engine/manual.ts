import type { Store } from '../data/schema.ts'
import type { Choices } from './budget.ts'

/** Item que o usuário adicionou num cômodo, fora do catálogo (link, nome, preço e quantidade). */
export interface ManualItem {
  /** Local: não vai no link compartilhado (é regerado ao abrir). */
  id: string
  /** Cômodo da casa ("cozinha", "quarto-2"). */
  instanceId: string
  name: string
  /** Preço de uma unidade, em reais. */
  price: number
  qty: number
  url: string
}

/** Limite por lista, para o link compartilhado não ficar grande demais. */
export const MAX_MANUAL_ITEMS = 30
export const MAX_NAME_LENGTH = 80
export const MAX_PRICE = 1_000_000
export const MAX_QTY = 99

/** O que o formulário envia (texto digitado). */
export interface ManualInput {
  name: string
  price: string
  qty: string
  url: string
}

export type ManualFields = Pick<ManualItem, 'name' | 'price' | 'qty' | 'url'>

export type ManualErrors = Partial<Record<keyof ManualInput, string>>

export type ParsedManual = { ok: true; value: ManualFields } | { ok: false; errors: ManualErrors }

/**
 * Preço digitado em reais: "399,90", "1.599,90", "R$ 1.599", "399.90". Vírgula é o separador
 * decimal; ponto só é decimal quando sozinho e seguido de 1–2 dígitos. Inválido = undefined.
 */
export function parsePrice(text: string): number | undefined {
  let clean = text.replace(/R\$|\s/gi, '')
  if (!/^[\d.,]+$/.test(clean)) return undefined
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (!/^\d+\.\d{1,2}$/.test(clean)) {
    clean = clean.replace(/\./g, '')
  }
  if (!/^\d+(\.\d+)?$/.test(clean)) return undefined
  return Math.round(Number(clean) * 100) / 100
}

/** Só links http(s) (evita `javascript:` e afins). */
export function isWebUrl(text: string): boolean {
  try {
    const { protocol, hostname } = new URL(text)
    return (protocol === 'https:' || protocol === 'http:') && hostname.includes('.')
  } catch {
    return false
  }
}

const isValidName = (name: string) => name.length > 0 && name.length <= MAX_NAME_LENGTH
const isValidPrice = (price: number) => price > 0 && price <= MAX_PRICE
const isValidQty = (qty: number) => Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY

/** Confere um item vindo de fora (link compartilhado / localStorage). */
export const isValidManual = ({ name, price, qty, url }: ManualFields): boolean =>
  isValidName(name) && isValidPrice(price) && isValidQty(qty) && isWebUrl(url)

/** Valida e normaliza o formulário. Quantidade vazia = 1. */
export function parseManualInput(input: ManualInput): ParsedManual {
  const errors: ManualErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  const price = parsePrice(input.price)
  const qtyText = input.qty.trim()
  const qty = qtyText === '' ? 1 : /^\d+$/.test(qtyText) ? Number(qtyText) : NaN
  const url = input.url.trim()

  if (!name) errors.name = 'Informe o nome do produto.'
  else if (!isValidName(name)) errors.name = `Use no máximo ${MAX_NAME_LENGTH} caracteres.`
  if (price === undefined || price <= 0) errors.price = 'Informe o preço (ex.: 399,90).'
  else if (!isValidPrice(price)) errors.price = 'Preço alto demais.'
  if (!isValidQty(qty)) errors.qty = `Quantidade de 1 a ${MAX_QTY}.`
  if (!url) errors.url = 'Cole o link do produto.'
  else if (!isWebUrl(url)) errors.url = 'Link inválido: comece com https://'

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { name, price: price!, qty, url } }
}

/** Loja pelo endereço do link. */
export function storeFromUrl(url: string): Store {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return 'other'
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`)
  if (['mercadolivre.com.br', 'mercadolibre.com', 'meli.la'].some(is)) return 'mercadolivre'
  if (['amazon.com.br', 'amazon.com', 'amzn.to', 'a.co'].some(is)) return 'amazon'
  return 'other'
}

/** Id curto e local. */
export const newManualId = () => crypto.randomUUID().slice(0, 8)

// Funções puras que devolvem novas Choices, como em choices.ts.

export function addManual(choices: Choices, item: ManualItem): Choices {
  return { ...choices, manual: [...choices.manual, item] }
}

export function updateManual(choices: Choices, id: string, fields: ManualFields): Choices {
  return {
    ...choices,
    manual: choices.manual.map((item) => (item.id === id ? { ...item, ...fields } : item)),
  }
}

export function removeManual(choices: Choices, id: string): Choices {
  return { ...choices, manual: choices.manual.filter((item) => item.id !== id) }
}

/** Só os itens de cômodos que estão na casa. */
export function keepManualIn(choices: Choices, instanceIds: Iterable<string>): Choices {
  const ids = new Set(instanceIds)
  return { ...choices, manual: choices.manual.filter((item) => ids.has(item.instanceId)) }
}
