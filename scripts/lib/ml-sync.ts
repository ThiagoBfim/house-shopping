// Atualiza as ofertas do Mercado Livre com preço/disponibilidade atuais (lógica pura).
import { applyBestOffer, isSearchUrl, parseMercadoLivreIds } from '../../src/data/offers.ts'
import { recordPrice } from '../../src/data/price-history.ts'
import type { Offer, ProductOption, Products } from '../../src/data/schema.ts'

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
  /**
   * Oferta nova de vendedor confiável mais barata no mesmo produto de catálogo (outro
   * vendedor). O link de afiliado segue um anúncio só: se o vendedor dele sobe o preço, é
   * aqui que aparece a alternativa.
   */
  cheaper?: { itemId: string; price: number }
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
/** Economia mínima para avisar que outro vendedor do mesmo produto está mais barato. */
export const CHEAPER_MIN_SAVING = 0.05

/** A oferta mais barata vale o aviso: pelo menos CHEAPER_MIN_SAVING abaixo do preço do link. */
export const isWorthSwitching = (price: number, cheaper: number) =>
  cheaper <= price * (1 - CHEAPER_MIN_SAVING)

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
  /** Outro vendedor confiável do mesmo produto vende mais barato: regenerar o link com ele. */
  cheaperInCatalog: {
    id: string
    price: number
    cheaper: number
    itemId: string
    catalogId: string
  }[]
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
    cheaperInCatalog: [],
    changedCategories: new Set(),
  }

  for (const [category, { options: categoryOptions }] of Object.entries(next)) {
    for (const [i, option] of categoryOptions.entries()) {
      const index = option.offers?.findIndex((o) => o.store === 'mercadolivre') ?? -1
      const offer = option.offers?.[index]
      if (index === -1) {
        const synced = await syncDirectLink(option, lookup, today, report)
        if (synced) {
          categoryOptions[i] = synced
          report.changedCategories.add(category)
        }
        continue
      }
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
      if (
        quote.price !== undefined &&
        quote.cheaper &&
        isWorthSwitching(quote.price, quote.cheaper.price)
      ) {
        report.cheaperInCatalog.push({
          id: option.id,
          price: quote.price,
          cheaper: quote.cheaper.price,
          itemId: quote.cheaper.itemId,
          catalogId: offer.catalogId,
        })
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

/**
 * Produto de marca ainda sem link de afiliado: o `url` abre o anúncio direto e o `price` é de
 * referência. Na primeira vez, cria a oferta do Mercado Livre com o link direto (o preço de
 * referência vira o primeiro ponto do histórico); dali em diante ela é sincronizada como as
 * outras. Quando o link de afiliado chegar, o `ml:links import` troca só o `url` da oferta.
 */
async function syncDirectLink(
  option: ProductOption,
  lookup: Lookup,
  today: string,
  report: SyncReport,
): Promise<ProductOption | undefined> {
  if (option.store !== 'mercadolivre' || isSearchUrl(option.url)) return undefined
  const ids = parseMercadoLivreIds(option.url)
  if (!ids) return undefined
  if (!ids.catalogId) {
    report.noCatalog.push(option.id)
    return undefined
  }
  const { catalogId } = ids
  let quote = await lookup({ itemId: ids.itemId ?? catalogId, catalogId })
  // O anúncio do link saiu do catálogo: vale a oferta que a página do produto mostra hoje.
  if (quote?.price === undefined && ids.itemId)
    quote = await lookup({ itemId: catalogId, catalogId })
  if (!quote) {
    report.notFound.push(option.id)
    return undefined
  }
  if (!quote.available) report.unavailable.push(option.id)
  if (quote.price === undefined) return undefined
  if (!earnsCommission(quote)) report.noCommission.push(option.id)
  if (quote.price !== option.price) {
    report.updated.push({ id: option.id, from: option.price, to: quote.price })
  }
  const offer: Offer = {
    store: 'mercadolivre',
    url: option.url,
    price: option.price,
    updatedAt: option.priceUpdatedAt,
    available: quote.available,
    externalId: ids.itemId ?? catalogId,
    catalogId,
    history: [{ date: option.priceUpdatedAt, price: option.price }],
  }
  return applyBestOffer({
    ...option,
    ...(!option.image && quote.image && { image: quote.image }),
    offers: [recordPrice(offer, today, quote.price), ...(option.offers ?? [])],
  })
}
