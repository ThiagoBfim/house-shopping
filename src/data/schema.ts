import { z } from 'zod'

/** 1 = barato, 2 = médio, 3 = caro, 4 = muito caro */
export const TierSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])

/** Necessidade do item no cômodo: 5 essencial · 4 necessário · 3 importante · 2 útil · 1 supérfluo. */
export const NeedSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])

export const StoreSchema = z.enum(['amazon', 'mercadolivre', 'other'])

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'deve ser kebab-case (ex.: "air-fryer")')
const httpsUrl = z.url({ protocol: /^https$/, error: 'deve ser uma URL https válida' })
const isoDate = z.iso.date({ error: 'deve ser uma data AAAA-MM-DD' })

/** Preço visto numa data. */
export const PricePointSchema = z.strictObject({ date: isoDate, price: z.number().positive() })

/** Onde comprar um modelo: uma oferta por loja. */
export const OfferSchema = z.strictObject({
  store: StoreSchema,
  url: httpsUrl,
  price: z.number().positive(),
  updatedAt: isoDate,
  /** Id do anúncio na loja (Mercado Livre: MLB…; Amazon: ASIN). */
  externalId: z.string().min(3).optional(),
  /** Mercado Livre: produto de catálogo (`/p/MLB…`). Sem ele, a API não informa o preço. */
  catalogId: z
    .string()
    .regex(/^MLB\d+$/)
    .optional(),
  /** false = sem estoque / anúncio pausado na última sincronização. */
  available: z.boolean().default(true),
  /** Preços já vistos, em ordem de data; só ganha ponto novo quando o preço muda. */
  history: z.array(PricePointSchema).min(1).optional(),
})

/** Medidas em centímetros: largura (frente), profundidade e altura. */
export const DimensionsSchema = z.strictObject({
  width: z.number().positive().max(1000),
  depth: z.number().positive().max(1000),
  height: z.number().positive().max(500),
})

/**
 * Onde o item fica no cômodo, para o desenho em escala e o 3D: `floor` ocupa chão (cama,
 * sofá, geladeira), `wall` fica na parede (TV, ar-condicionado), `rug` fica sob os móveis
 * (tapete) e `none` não entra no desenho (cooktop na bancada, colchão sobre a cama).
 */
export const PlacementSchema = z.enum(['floor', 'wall', 'rug', 'none'])

/** Medida típica da categoria (estimativa quando a opção não tem a medida real). */
export const CategoryLayoutSchema = z.strictObject({
  placement: PlacementSchema,
  size: DimensionsSchema,
  /** Por variante: cama casal × king, fogão de piso × cooktop (que não ocupa chão). */
  variants: z
    .record(
      slug,
      z.strictObject({ placement: PlacementSchema.optional(), size: DimensionsSchema.optional() }),
    )
    .optional(),
})

/**
 * `price`, `priceUpdatedAt`, `store` e `url` são sempre os da melhor oferta (a mais barata
 * disponível em `offers`). Sem `offers`, valem como estão (preço de referência + link de busca).
 */
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
  offers: z.array(OfferSchema).min(1).optional(),
  /**
   * Produto genérico (sem marca/modelo, ex.: "Tapete Sala 2,00 x 1,50 m"): o link pode ser de
   * busca. Sem a flag, é um modelo específico e o `url` precisa abrir o produto.
   */
  generic: z.boolean().optional(),
  /** Variantes da categoria em que esta opção entra (obrigatório quando a categoria tem variantes). */
  variants: z.array(slug).min(1).optional(),
  /** Medidas reais do produto (da API do Mercado Livre ou da página); sem elas, vale a típica. */
  dimensions: DimensionsSchema.optional(),
})

/** Tipo de produto dentro da categoria (fogão de piso × cooktop, PlayStation × Xbox, casal × queen). */
export const VariantSchema = z.strictObject({ id: slug, label: z.string().min(2) })

export const ProductCategorySchema = z.strictObject({
  label: z.string().min(2),
  /** Pratos, talheres, panelas, toalhas… (o usuário pode tirar todos da lista de uma vez). */
  utensil: z.boolean({ error: 'informe true ou false' }),
  /** Facilitador: organizadores, potes de congelar… Só entra na lista se o usuário pedir. */
  helper: z.boolean().optional(),
  /**
   * Cada variante tem a sua escada de tiers (as opções dizem em quais variantes entram).
   * A primeira é a padrão; o usuário troca no card ou pelo assistente.
   */
  variants: z.array(VariantSchema).min(2).optional(),
  /** Onde fica e tamanho típico (móveis e eletros que entram no desenho em escala e no 3D). */
  layout: CategoryLayoutSchema.optional(),
  options: z.array(ProductOptionSchema).min(1),
})

/** Catálogo: categoria (nome do arquivo em data/products/) → opções por tier */
export const ProductsSchema = z.record(slug, ProductCategorySchema)

export const RoomItemSchema = z.strictObject({
  category: slug,
  /** Define o que entra primeiro e o que ganha upgrade primeiro. */
  need: NeedSchema,
  qty: z.int().min(1).default(1),
})

export const RoomSchema = z.strictObject({
  name: z.string().min(2),
  items: z.array(RoomItemSchema).min(1),
})

/** rooms.json: cômodo (slug) → itens */
export const RoomsSchema = z.record(slug, RoomSchema)

export type Tier = z.infer<typeof TierSchema>
export type Need = z.infer<typeof NeedSchema>
export type Store = z.infer<typeof StoreSchema>
export type Offer = z.infer<typeof OfferSchema>
export type PricePoint = z.infer<typeof PricePointSchema>
export type ProductOption = z.infer<typeof ProductOptionSchema>
export type Variant = z.infer<typeof VariantSchema>
export type Dimensions = z.infer<typeof DimensionsSchema>
export type Placement = z.infer<typeof PlacementSchema>
export type CategoryLayout = z.infer<typeof CategoryLayoutSchema>
export type ProductCategory = z.infer<typeof ProductCategorySchema>
export type Products = z.infer<typeof ProductsSchema>
export type RoomItem = z.infer<typeof RoomItemSchema>
export type Room = z.infer<typeof RoomSchema>
export type Rooms = z.infer<typeof RoomsSchema>

// Assistente "Monte pra mim" (data/assistant.json). Ver docs/project/Assistente.md.

const PresetIdSchema = z.enum(['economico', 'equilibrado', 'premium'])

/** O que uma resposta muda. Cada efeito é um objeto com uma chave só. */
export const EffectSchema = z.union([
  /** Soma cômodos à casa (fica o maior número pedido). */
  z.strictObject({ rooms: z.record(slug, z.int().min(1).max(5)) }),
  /** Troca um cômodo pela versão alternativa (escritório → escritório gamer). */
  z.strictObject({ roomVariant: z.strictObject({ from: slug, to: slug }) }),
  z.strictObject({ preset: PresetIdSchema }),
  /** "Já tenho" nestas categorias, em todos os cômodos. */
  z.strictObject({ owned: z.array(slug).min(1) }),
  /** Tira estas categorias da lista (recusadas). */
  z.strictObject({ skip: z.array(slug).min(1) }),
  z.strictObject({
    filters: z.strictObject({ utensils: z.boolean().optional(), helpers: z.boolean().optional() }),
  }),
  /** Escolhe a variante da categoria (fogão → cooktop de indução). */
  z.strictObject({ variant: z.strictObject({ category: slug, variant: slug }) }),
  /** Ajusta a necessidade da categoria (quem quase não cozinha: batedeira → 1). */
  z.strictObject({ need: z.strictObject({ category: slug, need: NeedSchema }) }),
])

export const AnswerSchema = z.strictObject({
  id: slug,
  icon: z.string().min(1),
  label: z.string().min(2),
  effects: z.array(EffectSchema).default([]),
})

export const QuestionSchema = z.strictObject({
  id: slug,
  icon: z.string().min(1),
  text: z.string().min(5),
  /** Nome curto no resumo final ("Fogão", "Café"). */
  short: z.string().min(2),
  /** Uma linha de "por que perguntamos", quando não for óbvio. */
  why: z.string().min(5).optional(),
  /** single: um toque responde e avança; multiple: marca vários e confirma. */
  kind: z.enum(['single', 'multiple']),
  /** Só aparece se a casa tiver algum destes cômodos (casa ainda desconhecida = aparece). */
  when: z.strictObject({ rooms: z.array(slug).min(1) }).optional(),
  answers: z.array(AnswerSchema).min(2),
})

export const AssistantSchema = z.strictObject({ questions: z.array(QuestionSchema).min(1) })

export type PresetId = z.infer<typeof PresetIdSchema>
export type Effect = z.infer<typeof EffectSchema>
export type Answer = z.infer<typeof AnswerSchema>
export type Question = z.infer<typeof QuestionSchema>
export type Assistant = z.infer<typeof AssistantSchema>
