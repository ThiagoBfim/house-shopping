import { useMemo, useState } from 'preact/hooks'
import type { ListView } from '../engine/budget.ts'
import { LIST_PERIODS, listChange, type ListPeriod } from '../engine/list-history.ts'
import { formatBRL } from '../engine/money.ts'
import { PriceChart } from './PriceChart.tsx'

/** Ordem de escolha do período mostrado de cara: a semana, se mudou; senão ontem; senão o mês. */
const DEFAULT_ORDER: ListPeriod[] = ['week', 'day', 'month']

/**
 * "Sua lista ficou R$ X mais barata": compara o total de hoje com o da mesma lista ontem, há 7
 * dias e há 30 dias (os itens de hoje com os preços do histórico). Some quando nada mudou.
 */
export function ListPriceChange({ view }: { view: ListView }) {
  const today = new Date().toLocaleDateString('sv-SE')
  const changes = useMemo(
    () => LIST_PERIODS.map((period) => ({ period, change: listChange(view, today, period.days) })),
    [view, today],
  )
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ListPeriod>()

  const fallback = DEFAULT_ORDER.find(
    (id) => changes.find((c) => c.period.id === id)!.change.delta !== 0,
  )
  if (!fallback) return null
  const { period, change } = changes.find((c) => c.period.id === (picked ?? fallback))!
  const down = change.delta < 0
  const direction = down ? 'down' : 'up'
  const amount = formatBRL(Math.abs(change.delta))

  return (
    <div class="list-change">
      <button
        type="button"
        class={`list-change-toggle trend-${direction}`}
        aria-expanded={open}
        aria-controls="list-change-panel"
        onClick={() => setOpen(!open)}
      >
        <span>
          <span aria-hidden="true">{change.delta === 0 ? '＝' : down ? '📉' : '📈'} </span>
          {change.delta === 0 ? (
            <>Mesmo total de {period.since}</>
          ) : (
            <>
              Lista <strong>{amount}</strong> mais {down ? 'barata' : 'cara'} que {period.since}
            </>
          )}
        </span>
        <span class="list-change-more">{open ? 'Esconder' : 'Ver variação'}</span>
      </button>

      {open && (
        <div id="list-change-panel" class="list-change-panel">
          <div class="list-change-periods" role="radiogroup" aria-label="Comparar com">
            {changes.map(({ period: p, change: c }) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === period.id}
                class={`answers-chip ${p.id === period.id ? 'is-active' : ''}`}
                onClick={() => setPicked(p.id)}
              >
                {p.label}
                <span
                  class={`list-change-chip-delta ${c.delta ? `trend-${c.delta < 0 ? 'down' : 'up'}` : 'muted'}`}
                >
                  {' '}
                  {c.delta === 0
                    ? '='
                    : `${c.delta < 0 ? '−' : '+'}${formatBRL(Math.abs(c.delta))}`}
                </span>
              </button>
            ))}
          </div>

          {change.delta === 0 ? (
            <p class="muted">Nenhum preço desta lista mudou desde {dayMonth(change.since)}.</p>
          ) : (
            <>
              <p class="list-change-text">
                Em {dayMonth(change.since)}, esta mesma lista custava{' '}
                <strong>{formatBRL(change.from)}</strong>. Hoje custa{' '}
                <strong>{formatBRL(change.to)}</strong>:{' '}
                <strong class={`trend-${direction}`}>
                  {down ? '−' : '+'}
                  {amount} ({percent(change.delta, change.from)})
                </strong>
                .
              </p>
              {change.points.length >= 2 && (
                <PriceChart
                  id="list-change-chart"
                  points={change.points}
                  today={today}
                  direction={direction}
                  caption={
                    <>
                      Total da lista <span class="muted">(dias em que algum preço mudou)</span>
                    </>
                  }
                />
              )}
              <h3 class="list-change-heading">
                {change.items.length === 1
                  ? '1 item mudou de preço'
                  : `${change.items.length} itens mudaram de preço`}
              </h3>
              <ul class="list-change-items">
                {change.items.map((item) => (
                  <li key={item.key}>
                    <span class="list-change-name">
                      <span class="muted">{item.label}:</span> {item.name}
                      {item.qty > 1 && <span class="muted"> ({item.qty}×)</span>}
                    </span>
                    <span class={`list-change-delta trend-${item.delta < 0 ? 'down' : 'up'}`}>
                      {item.delta < 0 ? '−' : '+'}
                      {formatBRL(Math.abs(item.delta))}
                      <span class="muted">
                        {' '}
                        ({formatBRL(item.from)} → {formatBRL(item.to)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p class="list-change-note muted">
            Compara os itens de hoje com os preços que eles tinham na data. Itens sem histórico de
            preço e os adicionados à mão contam com o preço de hoje.
          </p>
        </div>
      )}
    </div>
  )
}

/** 2026-10-23 → 23/10 */
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

const percent = (delta: number, from: number) =>
  `${delta < 0 ? '−' : '+'}${Math.max(1, Math.round((Math.abs(delta) / from) * 100))}%`
