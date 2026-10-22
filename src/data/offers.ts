import type { Offer, ProductOption, Store } from './schema.ts'

/** "Comprar {onde}": com a preposição certa ("na Amazon", "no Mercado Livre"). */
export const STORE_WHERE: Record<Store, string> = {
  amazon: 'na Amazon',
  mercadolivre: 'no Mercado Livre',
  other: '',
}

/** Ofertas disponíveis em outras lojas além da exibida (para "Também na Amazon: R$ X"). */
export function otherOffers(option: ProductOption): Offer[] {
  return (option.offers ?? []).filter(
    (offer) => offer.available !== false && offer.store !== option.store,
  )
}

/** Oferta mais barata entre as disponíveis (empate: a primeira da lista). */
export function bestOffer(offers: Offer[]): Offer | undefined {
  return offers
    .filter((offer) => offer.available !== false)
    .reduce<Offer | undefined>(
      (best, offer) => (!best || offer.price < best.price ? offer : best),
      undefined,
    )
}

/** Copia a melhor oferta para os campos exibidos (price, priceUpdatedAt, store, url). */
export function applyBestOffer(option: ProductOption): ProductOption {
  const best = option.offers && bestOffer(option.offers)
  if (!best) return option
  return {
    ...option,
    price: best.price,
    priceUpdatedAt: best.updatedAt,
    store: best.store,
    url: best.url,
  }
}

/** Link que gera comissão (link curto do gerador do Mercado Livre ou com tag de afiliado). */
export function isAffiliateUrl(url: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname
  return (
    host === 'meli.la' ||
    (host === 'mercadolivre.com' && path.startsWith('/sec/')) ||
    (host === 'mercadolivre.com.br' && path.startsWith('/social/')) ||
    parsed.searchParams.has('matt_tool') ||
    host === 'amzn.to' ||
    (host.startsWith('amazon.') && parsed.searchParams.has('tag'))
  )
}

export interface MercadoLivreIds {
  /** Anúncio (MLB + número): o que foi escolhido para o link de afiliado. */
  itemId?: string
  /** Produto de catálogo (`/p/MLB…`): é por ele que a API informa preço e disponibilidade. */
  catalogId?: string
}

/**
 * Extrai os ids de uma página de produto do Mercado Livre:
 * - catálogo: `…/p/MLB19615251` → catalogId
 * - anúncio escolhido: `?pdp_filters=item_id:MLB123…` (também em `/up/MLBU…`) → itemId
 * - anúncio clássico: `produto.mercadolivre.com.br/MLB-1234567890-…` ou só `MLB1234567890` → itemId
 */
export function parseMercadoLivreIds(url: string): MercadoLivreIds | undefined {
  let decoded = url
  try {
    decoded = decodeURIComponent(url)
  } catch {
    // URL com % inválido: usa como veio
  }
  const catalogId = decoded.match(/\/p\/(MLB\d+)/i)?.[1].toUpperCase()
  const chosen = decoded.match(/item_id:(MLB\d+)/i)?.[1].toUpperCase()
  const classic = catalogId ? undefined : decoded.match(/\b(MLB)-?(\d{6,})/i)
  const itemId = chosen ?? (classic ? `MLB${classic[2]}` : undefined)
  if (!itemId && !catalogId) return undefined
  return { ...(itemId && { itemId }), ...(catalogId && { catalogId }) }
}
