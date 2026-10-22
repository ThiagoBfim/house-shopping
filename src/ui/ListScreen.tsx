import type { ListView } from '../engine/budget.ts'
import { formatBRL, formatBRLWhole } from '../engine/money.ts'
import { ProductCard } from './ProductCard.tsx'

interface Props {
  roomName: string
  view: ListView
  onEditBudget: () => void
  onChangeRoom: () => void
}

export function ListScreen({ roomName, view, onEditBudget, onChangeRoom }: Props) {
  const over = view.remaining < 0
  const used = view.budget > 0 ? Math.min(100, (view.total / view.budget) * 100) : 100

  return (
    <section>
      <div class="list-nav">
        <button type="button" class="link-button" onClick={onChangeRoom}>
          ← Trocar cômodo
        </button>
        <button type="button" class="link-button" onClick={onEditBudget}>
          Alterar orçamento
        </button>
      </div>

      <div class="summary" role="status">
        <div class="summary-row">
          <div>
            <span class="summary-label">{roomName}</span>
            <strong class="summary-total">{formatBRL(view.total)}</strong>
            <span class="muted"> de {formatBRLWhole(view.budget)}</span>
          </div>
          <div class={`summary-remaining ${over ? 'is-over' : ''}`}>
            <span class="summary-label">{over ? 'Faltam' : 'Saldo'}</span>
            <strong>{formatBRL(Math.abs(view.remaining))}</strong>
          </div>
        </div>
        <div
          class={`progress ${over ? 'is-over' : ''}`}
          role="progressbar"
          aria-label="Orçamento usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(used)}
        >
          <span style={{ width: `${used}%` }} />
        </div>
      </div>

      {over && (
        <p class="notice notice-warn">
          Os itens essenciais passam do orçamento em {formatBRL(-view.remaining)}. Aumente o
          orçamento ou recuse algum item.
        </p>
      )}

      {view.entries.length ? (
        <div class="product-list">
          {view.entries.map((entry) => (
            <ProductCard key={entry.item.category} entry={entry} />
          ))}
        </div>
      ) : (
        <p class="empty-state">Nenhum item na lista.</p>
      )}

      {view.skipped.length > 0 && (
        <section class="side-section">
          <h3>Não coube no orçamento</h3>
          <ul class="compact-list">
            {view.skipped.map(({ item, label, cheapest }) => (
              <li key={item.category}>
                <span>{label}</span>
                <span class="muted">a partir de {formatBRL(cheapest.price * item.qty)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
