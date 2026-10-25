import type { PricePoint } from '../data/schema.ts'
import { CHART_MONTHS } from '../data/price-history.ts'
import { formatBRL } from '../engine/money.ts'

interface Props {
  /** Dias em que o preço mudou (ver `chartPoints`). */
  points: (PricePoint & { carried?: boolean })[]
  /** Fim do eixo: o preço atual vale até hoje. */
  today: string
  direction: 'down' | 'up'
  id: string
}

const W = 320
const H = 150
const PAD = { left: 10, right: 10, top: 26, bottom: 24 }
/** Com muitos pontos, só alguns ganham rótulo de preço (primeiro, último, menor e maior). */
const MAX_LABELS = 5

/** Distância mínima (no viewBox) entre dois rótulos na mesma linha. */
const MIN_GAP = 40

/** Índices com rótulo, da direita para a esquerda, pulando os que encostam no anterior. */
function spaced(xs: number[], candidates: Set<number>): Set<number> {
  const shown = new Set<number>()
  let last = Infinity
  for (let i = xs.length - 1; i >= 0; i--) {
    if (!candidates.has(i) || last - xs[i] < MIN_GAP) continue
    shown.add(i)
    last = xs[i]
  }
  return shown
}

const time = (date: string) => Date.parse(`${date}T00:00:00Z`)
/** 2026-10-01 → 01/10 */
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/** Gráfico em degraus do preço: o preço vale do dia em que mudou até a próxima mudança. */
export function PriceChart({ points, today, direction, id }: Props) {
  const prices = points.map((p) => p.price)
  const [min, max] = [Math.min(...prices), Math.max(...prices)]
  const spread = max - min || max * 0.1 || 1
  const [t0, t1] = [time(points[0].date), Math.max(time(today), time(points.at(-1)!.date) + 1)]
  const x = (date: string) =>
    PAD.left + ((time(date) - t0) / (t1 - t0)) * (W - PAD.left - PAD.right)
  const y = (price: number) =>
    PAD.top + (1 - (price - (min - spread * 0.1)) / (spread * 1.2)) * (H - PAD.top - PAD.bottom)

  const path = points
    .map((p, i) => (i === 0 ? `M${x(p.date)},${y(p.price)}` : `H${x(p.date)}V${y(p.price)}`))
    .join('')
    .concat(`H${W - PAD.right}`)

  const xs = points.map((p) => x(p.date))
  const all = new Set(points.map((_, i) => i))
  const priceLabels = spaced(
    xs,
    points.length <= MAX_LABELS
      ? all
      : new Set([0, points.length - 1, prices.indexOf(min), prices.indexOf(max)]),
  )
  const dates = spaced(xs, all)
  const anchor = (i: number) =>
    points.length === 1 ? 'start' : i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'

  return (
    <figure class={`price-chart trend-${direction}`} id={id}>
      <figcaption>
        Preço nos últimos {CHART_MONTHS} meses <span class="muted">(dias em que mudou)</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true" focusable="false">
        <line
          class="price-chart-axis"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
        />
        <path class="price-chart-line" d={path} />
        {points.map((p, i) => (
          <g key={p.date}>
            <circle class="price-chart-dot" cx={x(p.date)} cy={y(p.price)} r={4} />
            {priceLabels.has(i) && (
              <text
                class="price-chart-price"
                x={x(p.date)}
                y={y(p.price) - 9}
                text-anchor={anchor(i)}
              >
                {formatBRL(p.price)}
              </text>
            )}
            {dates.has(i) && (
              <text class="price-chart-date" x={x(p.date)} y={H - 6} text-anchor={anchor(i)}>
                {dayMonth(p.date)}
              </text>
            )}
          </g>
        ))}
        {W - PAD.right - xs[xs.length - 1] >= MIN_GAP && (
          <text class="price-chart-date" x={W - PAD.right} y={H - 6} text-anchor="end">
            hoje
          </text>
        )}
      </svg>
      <ul class="visually-hidden">
        {points.map((p) => (
          <li key={p.date}>
            {p.carried ? `Em ${dayMonth(p.date)} (início do período)` : `Em ${dayMonth(p.date)}`}:{' '}
            {formatBRL(p.price)}
          </li>
        ))}
      </ul>
      <p class="price-chart-range muted">
        Menor: {formatBRL(min)} · Maior: {formatBRL(max)}
      </p>
    </figure>
  )
}
