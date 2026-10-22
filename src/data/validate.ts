import type { z } from 'zod'
import { applyBestOffer } from './offers.ts'
import {
  ProductCategorySchema,
  ProductsSchema,
  RoomsSchema,
  type Products,
  type Rooms,
} from './schema.ts'

/** Produto cuja opção mais cara atinge este valor precisa ter os 4 tiers. */
export const EXPENSIVE_THRESHOLD = 1000

export const ALL_TIERS = [1, 2, 3, 4] as const

export type ValidationResult =
  { ok: true; rooms: Rooms; products: Products } | { ok: false; errors: string[] }

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(raiz)'
    return `${file} › ${path}: ${issue.message}`
  })
}

/** Erros de products: o primeiro trecho do caminho é a categoria, ou seja, o arquivo. */
function formatProductIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const [category, ...rest] = issue.path.map(String)
    const path = rest.length ? rest.join('.') : '(raiz)'
    return `${productFile(category)} › ${path}: ${issue.message}`
  })
}

export const productFile = (category: string) => `products/${category}.json`

function checkProducts(products: Products): string[] {
  const errors: string[] = []
  const seenIds = new Map<string, string>()

  for (const [category, { options }] of Object.entries(products)) {
    const at = productFile(category)

    for (const option of options) {
      const other = seenIds.get(option.id)
      if (other) errors.push(`${at}: id "${option.id}" repetido (também em ${other})`)
      seenIds.set(option.id, category)

      const shown = applyBestOffer(option)
      const fields = (['price', 'priceUpdatedAt', 'store', 'url'] as const).filter(
        (field) => shown[field] !== option[field],
      )
      if (fields.length) {
        errors.push(
          `${at}: "${option.id}" mostra ${fields.join(', ')} diferente da melhor oferta em offers (rode npm run ml:links import ou corrija à mão)`,
        )
      }

      for (const offer of option.offers ?? []) {
        const history = offer.history
        if (!history) continue
        const where = `${at}: "${option.id}" (${offer.store}) history`
        if (history.some((point, i) => i > 0 && point.date <= history[i - 1].date)) {
          errors.push(`${where}: datas fora de ordem ou repetidas`)
        }
        const last = history[history.length - 1]
        if (last.price !== offer.price || last.date > offer.updatedAt) {
          errors.push(
            `${where}: o último ponto deve ter o preço atual (${offer.price}) e data até ${offer.updatedAt}`,
          )
        }
      }
    }

    const tiers = options.map((o) => o.tier)
    const duplicated = tiers.filter((t, i) => tiers.indexOf(t) !== i)
    if (duplicated.length) errors.push(`${at}: tier ${duplicated.join(', ')} repetido`)

    const maxPrice = Math.max(...options.map((o) => o.price))
    if (maxPrice >= EXPENSIVE_THRESHOLD) {
      const missing = ALL_TIERS.filter((t) => !tiers.includes(t))
      if (missing.length) {
        errors.push(
          `${at}: produto caro (até R$ ${maxPrice}) precisa dos 4 tiers — faltando tier ${missing.join(', ')}`,
        )
      }
    }

    const sorted = [...options].sort((a, b) => a.tier - b.tier)
    for (let i = 1; i < sorted.length; i++) {
      const [prev, cur] = [sorted[i - 1], sorted[i]]
      if (cur.price <= prev.price) {
        errors.push(
          `${at}: preço do tier ${cur.tier} (R$ ${cur.price}) deve ser maior que o do tier ${prev.tier} (R$ ${prev.price})`,
        )
      }
    }
  }
  return errors
}

function checkRooms(rooms: Rooms, products: Products): string[] {
  const errors: string[] = []
  for (const [roomId, room] of Object.entries(rooms)) {
    const seen = new Set<string>()
    for (const item of room.items) {
      const at = `rooms.json › ${roomId} › ${item.category}`
      if (!(item.category in products)) {
        errors.push(`${at}: categoria não existe (falta ${productFile(item.category)})`)
      }
      if (seen.has(item.category)) errors.push(`${at}: categoria repetida no cômodo`)
      seen.add(item.category)
    }
  }
  return errors
}

/**
 * Valida o catálogo (formato + regras de negócio). Recebe o JSON já parseado.
 * Cada categoria é validada separadamente para reportar todos os erros de uma vez.
 */
export function validateCatalog(rawRooms: unknown, rawProducts: unknown): ValidationResult {
  const rooms = RoomsSchema.safeParse(rawRooms)
  const products = ProductsSchema.safeParse(rawProducts)

  const errors = [
    ...(rooms.success ? [] : formatIssues('rooms.json', rooms.error)),
    ...(products.success ? [] : formatProductIssues(products.error)),
  ]

  // Regras de negócio rodam também nas categorias válidas de um catálogo com erros.
  const validProducts: Products = {}
  if (rawProducts && typeof rawProducts === 'object') {
    for (const [category, raw] of Object.entries(rawProducts)) {
      const parsed = ProductCategorySchema.safeParse(raw)
      if (parsed.success) validProducts[category] = parsed.data
    }
  }
  errors.push(...checkProducts(validProducts))
  if (rooms.success && products.success) errors.push(...checkRooms(rooms.data, products.data))

  if (errors.length || !rooms.success || !products.success) return { ok: false, errors }
  return { ok: true, rooms: rooms.data, products: products.data }
}
