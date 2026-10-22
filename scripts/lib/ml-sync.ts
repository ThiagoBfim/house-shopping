// Atualiza as ofertas do Mercado Livre com preço/disponibilidade atuais (lógica pura).
import { applyBestOffer } from '../../src/data/offers.ts'
import { recordPrice } from '../../src/data/price-history.ts'
import type { Products } from '../../src/data/schema.ts'

/** Situação atual de um anúncio no Mercado Livre. */
export interface Quote {
  /** Ausente quando o anúncio não aparece mais nas ofertas do catálogo. */
  price?: number
  available: boolean
  /** "new" | "used" | … */
  condition?: string
  /** seller_reputation.level_id, ex.: "5_green" (null para vendedor novo). */
  sellerLevel?: string
  /** Vendido por loja oficial. */
  official?: boolean
  /** Vendas concluídas do vendedor. */
  sellerSales?: number
  /** Foto principal (https). */
  image?: string
}

/** O que identifica a oferta: o anúncio escolhido e o produto de catálogo. */
export interface OfferIds {
  itemId: string
  catalogId: string
}

export type Lookup = (ids: OfferIds) => Promise<Quote | undefined>

export const GREEN_LEVELS = ['5_green', '4_light_green']
/** Vendas mínimas para confiar num vendedor que não é loja oficial. */
export const MIN_SALES = 50

/**
 * Vendedor confiável: loja oficial (mesmo sem reputação verde: a loja oficial da Electrolux é
 * "amarela" com 374 mil vendas e gera comissão) ou reputação verde com histórico de vendas.
 * Vendedor sem reputação e sem vendas costuma ser anúncio arriscado.
 */
export function isTrustedSeller(quote: Pick<Quote, 'official' | 'sellerLevel' | 'sellerSales'>) {
  if (quote.official) return true
  if (quote.sellerLevel === undefined) return true // sem informação: não acusa
  return GREEN_LEVELS.includes(quote.sellerLevel) && (quote.sellerSales ?? MIN_SALES) >= MIN_SALES
}

/** Produto novo de vendedor confiável (o programa de afiliados exige novo e boa reputação). */
export function earnsCommission(quote: Quote): boolean {
  return (quote.condition === undefined || quote.condition === 'new') && isTrustedSeller(quote)
}

export interface SyncReport {
  updated: { id: string; from: number; to: number }[]
  unavailable: string[]
  noCommission: string[]
  notFound: string[]
  /** Anúncio sem produto de catálogo: a API não informa preço (fica o da planilha). */
  noCatalog: string[]
  changedCategories: Set<string>
}

export interface SyncOptions {
  /**
   * Recomeça o histórico no preço da API, sem registrar mudança. Use uma vez quando a base
   * de preço mudar (ex.: a planilha tinha preço no Pix e a API dá o preço normal).
   */
  rebase?: boolean
}

export async function syncOffers(
  products: Products,
  lookup: Lookup,
  today: string,
  options: SyncOptions = {},
): Promise<{ products: Products; report: SyncReport }> {
  const next: Products = structuredClone(products)
  const report: SyncReport = {
    updated: [],
    unavailable: [],
    noCommission: [],
    notFound: [],
    noCatalog: [],
    changedCategories: new Set(),
  }

  for (const [category, { options: categoryOptions }] of Object.entries(next)) {
    for (const [i, option] of categoryOptions.entries()) {
      const index = option.offers?.findIndex((o) => o.store === 'mercadolivre') ?? -1
      const offer = option.offers?.[index]
      if (!option.offers || !offer?.externalId) continue
      if (!offer.catalogId) {
        report.noCatalog.push(option.id)
        continue
      }

      const quote = await lookup({ itemId: offer.externalId, catalogId: offer.catalogId })
      if (!quote) {
        report.notFound.push(option.id)
        continue
      }

      let updated = offer
      if (quote.price !== undefined) {
        if (options.rebase) {
          updated = {
            ...offer,
            price: quote.price,
            updatedAt: today,
            history: [{ date: today, price: quote.price }],
          }
        } else {
          if (quote.price !== offer.price) {
            report.updated.push({ id: option.id, from: offer.price, to: quote.price })
          }
          updated = recordPrice(offer, today, quote.price)
        }
      }
      if (!quote.available) report.unavailable.push(option.id)
      if (quote.price !== undefined && !earnsCommission(quote)) report.noCommission.push(option.id)

      option.offers[index] = { ...updated, available: quote.available }
      if (!option.image && quote.image) option.image = quote.image
      categoryOptions[i] = applyBestOffer(option)
      report.changedCategories.add(category)
    }
  }
  return { products: next, report }
}
