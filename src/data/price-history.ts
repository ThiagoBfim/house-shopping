import type { Offer, PricePoint, ProductOption } from './schema.ts'

/** Promoção = menor preço dos últimos N dias… */
export const PROMO_WINDOW_DAYS = 90
/** …e pelo menos este percentual abaixo do maior preço do período. */
export const PROMO_MIN_DROP = 0.05
/** Pontos mais antigos que isso saem do histórico (exceto o que estava em vigor na data de corte). */
export const HISTORY_MAX_DAYS = 365

const DAY_MS = 86_400_000

/** Soma dias a uma data AAAA-MM-DD. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Histórico da oferta (sem histórico gravado, o preço atual é o único ponto). */
export function historyOf(offer: Offer): PricePoint[] {
  return offer.history ?? [{ date: offer.updatedAt, price: offer.price }]
}

/**
 * Registra o preço visto em `date`: atualiza a oferta e grava no histórico só quando o preço
 * muda (no mesmo dia, o último preço vale). Observação mais antiga que a atual é ignorada.
 */
export function recordPrice(offer: Offer, date: string, price: number): Offer {
  if (offer.history && date < offer.updatedAt) return offer

  const history = [...historyOf(offer)]
  const last = history[history.length - 1]
  if (last.date === date) {
    history[history.length - 1] = { date, price }
    // voltou ao preço anterior no mesmo dia: o ponto deixa de ser uma mudança
    if (history.length > 1 && history[history.length - 2].price === price) history.pop()
  } else if (last.price !== price) {
    history.push({ date, price })
  }

  const cutoff = addDays(date, -HISTORY_MAX_DAYS)
  const firstKept = Math.max(
    0,
    history.findLastIndex((point) => point.date <= cutoff),
  )
  return { ...offer, price, updatedAt: date, history: history.slice(firstKept) }
}

export interface PriceTrend {
  direction: 'down' | 'up'
  /** Diferença em reais (negativa = caiu). */
  delta: number
  /** Diferença relativa ao preço anterior (−0,13 = caiu 13%). */
  percent: number
  /** Data do preço anterior. */
  since: string
}

/** Variação em relação ao preço anterior do histórico. */
export function priceTrend(offer: Offer): PriceTrend | undefined {
  const history = historyOf(offer)
  if (history.length < 2) return undefined
  const previous = history[history.length - 2]
  const delta = Math.round((offer.price - previous.price) * 100) / 100
  if (delta === 0) return undefined
  return {
    direction: delta < 0 ? 'down' : 'up',
    delta,
    percent: delta / previous.price,
    since: previous.date,
  }
}

/** Menor preço da janela e pelo menos PROMO_MIN_DROP abaixo do maior preço dela. */
export function isPromo(offer: Offer, today: string, windowDays = PROMO_WINDOW_DAYS): boolean {
  const history = historyOf(offer)
  const start = addDays(today, -windowDays)
  // preços em vigor na janela: o último antes do início + os que mudaram dentro dela
  const before = history.filter((point) => point.date < start).at(-1)
  const prices = [
    ...(before ? [before.price] : []),
    ...history.filter((point) => point.date >= start).map((point) => point.price),
  ]
  if (prices.length < 2) return false
  return (
    offer.price <= Math.min(...prices) && Math.max(...prices) >= offer.price * (1 + PROMO_MIN_DROP)
  )
}

/** A oferta que está sendo exibida (a melhor), se a opção tiver ofertas. */
export function shownOffer(option: ProductOption): Offer | undefined {
  return option.offers?.find((offer) => offer.store === option.store && offer.url === option.url)
}
