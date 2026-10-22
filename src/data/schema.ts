import { z } from 'zod'

/** 1 = barato, 2 = médio, 3 = caro, 4 = muito caro */
export const TierSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

/** essential: sempre entra · important: entra se couber · optional: entra se sobrar */
export const PrioritySchema = z.enum(['essential', 'important', 'optional'])

export const StoreSchema = z.enum(['amazon', 'mercadolivre', 'other'])

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'deve ser kebab-case (ex.: "air-fryer")')
const httpsUrl = z.url({ protocol: /^https$/, error: 'deve ser uma URL https válida' })
const isoDate = z.iso.date({ error: 'deve ser uma data AAAA-MM-DD' })

export const ProductOptionSchema = z.strictObject({
  id: slug,
  tier: TierSchema,
  name: z.string().min(3),
  price: z.number().positive(),
  priceUpdatedAt: isoDate,
  store: StoreSchema,
  url: httpsUrl,
  image: httpsUrl.optional(),
  bullets: z.array(z.string().min(3)).min(3, 'mínimo de 3 bullets').max(5, 'máximo de 5 bullets'),
})

export const ProductCategorySchema = z.strictObject({
  label: z.string().min(2),
  options: z.array(ProductOptionSchema).min(1),
})

/** products.json: categoria (slug) → opções por tier */
export const ProductsSchema = z.record(slug, ProductCategorySchema)

export const RoomItemSchema = z.strictObject({
  category: slug,
  priority: PrioritySchema,
  /** Impacto no dia a dia (1–10): define a ordem dos upgrades de tier. */
  weight: z.int().min(1).max(10),
  qty: z.int().min(1).default(1),
})

export const RoomSchema = z.strictObject({
  name: z.string().min(2),
  items: z.array(RoomItemSchema).min(1),
})

/** rooms.json: cômodo (slug) → itens */
export const RoomsSchema = z.record(slug, RoomSchema)

export type Tier = z.infer<typeof TierSchema>
export type Priority = z.infer<typeof PrioritySchema>
export type Store = z.infer<typeof StoreSchema>
export type ProductOption = z.infer<typeof ProductOptionSchema>
export type ProductCategory = z.infer<typeof ProductCategorySchema>
export type Products = z.infer<typeof ProductsSchema>
export type RoomItem = z.infer<typeof RoomItemSchema>
export type Room = z.infer<typeof RoomSchema>
export type Rooms = z.infer<typeof RoomsSchema>
