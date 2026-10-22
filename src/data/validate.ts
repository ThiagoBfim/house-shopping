import type { z } from 'zod'
import { applyBestOffer } from './offers.ts'
import {
  AssistantSchema,
  ProductCategorySchema,
  ProductsSchema,
  RoomsSchema,
  type Assistant,
  type ProductCategory,
  type ProductOption,
  type Products,
  type Rooms,
} from './schema.ts'

/** Produto cuja opção mais cara atinge este valor precisa ter os 4 tiers. */
export const EXPENSIVE_THRESHOLD = 1000

export const ALL_TIERS = [1, 2, 3, 4] as const

export type ValidationResult =
  | { ok: true; rooms: Rooms; products: Products; assistant?: Assistant }
  | { ok: false; errors: string[] }

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

    errors.push(...checkVariants(at, products[category]))
    const groups = products[category].variants
      ? products[category].variants.map(({ id }) => ({
          where: `${at} (variante ${id})`,
          group: options.filter((o) => o.variants?.includes(id)),
        }))
      : [{ where: at, group: options }]
    for (const { where, group } of groups) errors.push(...checkTiers(where, group))
  }
  return errors
}

/** Variantes declaradas na categoria × variantes de cada opção. */
function checkVariants(at: string, { variants, options }: ProductCategory): string[] {
  const errors: string[] = []
  if (!variants) {
    for (const option of options) {
      if (option.variants) {
        errors.push(`${at}: "${option.id}" tem variants, mas a categoria não declara variantes`)
      }
    }
    return errors
  }
  const ids = variants.map((v) => v.id)
  const repeated = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (repeated.length) errors.push(`${at}: variante ${repeated.join(', ')} repetida`)
  for (const option of options) {
    if (!option.variants)
      errors.push(`${at}: "${option.id}" precisa dizer em quais variantes entra`)
    for (const id of option.variants ?? []) {
      if (!ids.includes(id))
        errors.push(`${at}: "${option.id}" usa a variante "${id}", que não existe`)
    }
  }
  for (const id of ids) {
    if (!options.some((o) => o.variants?.includes(id))) {
      errors.push(`${at}: variante "${id}" sem nenhuma opção`)
    }
  }
  return errors
}

/** Uma escada de tiers (a categoria inteira ou uma variante): sem tier repetido, preço subindo. */
function checkTiers(at: string, options: ProductOption[]): string[] {
  const errors: string[] = []
  if (!options.length) return errors
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

/** Perguntas do assistente × catálogo: cômodos, categorias e variantes citados existem. */
function checkAssistant(assistant: Assistant, rooms: Rooms, products: Products): string[] {
  const errors: string[] = []
  const usedCategories = new Set(
    Object.values(rooms).flatMap((r) => r.items.map((i) => i.category)),
  )
  const seen = new Set<string>()
  for (const question of assistant.questions) {
    const at = `assistant.json › ${question.id}`
    if (seen.has(question.id)) errors.push(`${at}: pergunta repetida`)
    seen.add(question.id)

    const roomRef = (roomId: string) => {
      if (!(roomId in rooms)) errors.push(`${at}: cômodo "${roomId}" não existe`)
    }
    const categoryRef = (where: string, category: string) => {
      if (!usedCategories.has(category)) {
        errors.push(`${where}: categoria "${category}" não está em nenhum cômodo`)
      }
    }
    question.when?.rooms.forEach(roomRef)

    const answerIds = question.answers.map((a) => a.id)
    for (const id of answerIds.filter((id, i) => answerIds.indexOf(id) !== i)) {
      errors.push(`${at}: resposta "${id}" repetida`)
    }
    for (const answer of question.answers) {
      const where = `${at} › ${answer.id}`
      for (const effect of answer.effects) {
        if ('rooms' in effect) Object.keys(effect.rooms).forEach(roomRef)
        else if ('roomVariant' in effect)
          [effect.roomVariant.from, effect.roomVariant.to].forEach(roomRef)
        else if ('owned' in effect) effect.owned.forEach((c) => categoryRef(where, c))
        else if ('skip' in effect) effect.skip.forEach((c) => categoryRef(where, c))
        else if ('need' in effect) categoryRef(where, effect.need.category)
        else if ('variant' in effect) {
          const { category, variant } = effect.variant
          categoryRef(where, category)
          const variants = products[category]?.variants
          if (products[category] && !variants?.some((v) => v.id === variant)) {
            errors.push(`${where}: "${category}" não tem a variante "${variant}"`)
          }
        }
      }
    }
  }
  return errors
}

/**
 * Valida o catálogo (formato + regras de negócio). Recebe o JSON já parseado.
 * Cada categoria é validada separadamente para reportar todos os erros de uma vez.
 * As perguntas do assistente (opcionais aqui) são conferidas contra o catálogo.
 */
export function validateCatalog(
  rawRooms: unknown,
  rawProducts: unknown,
  rawAssistant?: unknown,
): ValidationResult {
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

  const assistant = rawAssistant === undefined ? undefined : AssistantSchema.safeParse(rawAssistant)
  if (assistant && !assistant.success) {
    errors.push(...formatIssues('assistant.json', assistant.error))
  } else if (assistant?.success && rooms.success && products.success) {
    errors.push(...checkAssistant(assistant.data, rooms.data, products.data))
  }

  if (errors.length || !rooms.success || !products.success) return { ok: false, errors }
  return { ok: true, rooms: rooms.data, products: products.data, assistant: assistant?.data }
}
