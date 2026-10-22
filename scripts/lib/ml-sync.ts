// Atualiza as ofertas do Mercado Livre com preço/disponibilidade atuais (lógica pura).
import { applyBestOffer } from '../../src/data/offers.ts'
import type { Products } from '../../src/data/schema.ts'

/** Situação atual de um produto no Mercado Livre. */
export interface Quote {
  price: number
  available: boolean
  /** "new" | "used" | … */
  condition?: string
  /** seller_reputation.level_id, ex.: "5_green" */
  sellerLevel?: string
}

export type Lookup = (externalId: string) => Promise<Quote | undefined>

/** Regras do programa de afiliados: produto novo e vendedor com reputação verde. */
export const GREEN_LEVELS = ['5_green', '4_light_green']

export function earnsCommission(quote: Quote): boolean {
  return (
    (quote.condition === undefined || quote.condition === 'new') &&
    (quote.sellerLevel === undefined || GREEN_LEVELS.includes(quote.sellerLevel))
  )
}

export interface SyncReport {
  updated: { id: string; from: number; to: number }[]
  unavailable: string[]
  noCommission: string[]
  notFound: string[]
  changedCategories: Set<string>
}

export async function syncOffers(
  products: Products,
  lookup: Lookup,
  today: string,
): Promise<{ products: Products; report: SyncReport }> {
  const next: Products = structuredClone(products)
  const report: SyncReport = {
    updated: [],
    unavailable: [],
    noCommission: [],
    notFound: [],
    changedCategories: new Set(),
  }

  for (const [category, { options }] of Object.entries(next)) {
    for (const [i, option] of options.entries()) {
      const offer = option.offers?.find((o) => o.store === 'mercadolivre' && o.externalId)
      if (!offer?.externalId) continue

      const quote = await lookup(offer.externalId)
      if (!quote) {
        report.notFound.push(option.id)
        continue
      }
      if (quote.price !== offer.price) {
        report.updated.push({ id: option.id, from: offer.price, to: quote.price })
      }
      if (!quote.available) report.unavailable.push(option.id)
      if (!earnsCommission(quote)) report.noCommission.push(option.id)

      offer.price = quote.price
      offer.available = quote.available
      offer.updatedAt = today
      options[i] = applyBestOffer(option)
      report.changedCategories.add(category)
    }
  }
  return { products: next, report }
}
