// Quanto a mesma lista custava antes: os itens de hoje com os preços do histórico.
import { addDays, historyOf, shownOffer } from '../data/price-history.ts'
import type { PricePoint } from '../data/schema.ts'
import type { ListView } from './budget.ts'

/** Períodos de comparação, do mais curto ao mais longo. */
export const LIST_PERIODS = [
  { id: 'day', days: 1, label: 'Ontem', since: 'ontem' },
  { id: 'week', days: 7, label: '7 dias', since: 'há 7 dias' },
  { id: 'month', days: 30, label: '30 dias', since: 'há 30 dias' },
] as const

export type ListPeriod = (typeof LIST_PERIODS)[number]['id']

export interface ItemChange {
  /** Chave do item na lista (`instância:categoria`). */
  key: string
  label: string
  name: string
  qty: number
  /** Subtotal (preço × quantidade) na data de comparação e hoje. */
  from: number
  to: number
  delta: number
}

export interface ListChange {
  /** Data de comparação. */
  since: string
  from: number
  to: number
  /** Negativo = a lista ficou mais barata. */
  delta: number
  /** Itens cujo preço mudou no período, da maior variação para a menor. */
  items: ItemChange[]
  /** Total da lista em cada dia em que algum preço mudou (o primeiro é o da data de comparação). */
  points: (PricePoint & { carried?: boolean })[]
}

const cents = (value: number) => Math.round(value * 100) / 100

/** Preço em vigor numa data. Antes do primeiro ponto conhecido, vale o primeiro. */
export function priceOn(history: PricePoint[], date: string): number {
  return (history.findLast((point) => point.date <= date) ?? history[0]).price
}

/**
 * Compara o total de hoje com o da mesma lista `days` dias antes. Itens sem histórico (preço de
 * referência) e itens adicionados à mão contam com o preço de hoje nas duas pontas.
 */
export function listChange(view: ListView, today: string, days: number): ListChange {
  const since = addDays(today, -days)
  const tracked = view.entries.flatMap((entry) => {
    const offer = shownOffer(entry.option)
    return offer ? [{ entry, history: historyOf(offer) }] : []
  })
  // Total num dia: o de hoje mais a diferença de preço de cada item com histórico.
  const totalOn = (date: string) =>
    cents(
      tracked.reduce(
        (sum, { entry, history }) =>
          sum + (priceOn(history, date) - entry.option.price) * entry.item.qty,
        view.total,
      ),
    )

  const items = tracked
    .map(({ entry, history }) => {
      const from = cents(priceOn(history, since) * entry.item.qty)
      const to = cents(entry.option.price * entry.item.qty)
      return {
        key: entry.item.category,
        label: entry.label,
        name: entry.option.name,
        qty: entry.item.qty,
        from,
        to,
        delta: cents(to - from),
      }
    })
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const changeDates = [
    ...new Set(
      tracked.flatMap(({ history }) =>
        history.map((point) => point.date).filter((date) => date > since && date <= today),
      ),
    ),
  ].sort()
  const points: ListChange['points'] = [{ date: since, price: totalOn(since), carried: true }]
  for (const date of changeDates) {
    const price = totalOn(date)
    if (price !== points[points.length - 1].price) points.push({ date, price })
  }

  const from = totalOn(since)
  const to = cents(view.total)
  return { since, from, to, delta: cents(to - from), items, points }
}
