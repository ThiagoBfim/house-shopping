import type { Choices, ListView, Plan } from '../engine/budget.ts'
import { exclude, lockAt, restore, unlock, type Change } from '../engine/choices.ts'
import { formatBRL, formatBRLWhole } from '../engine/money.ts'
import { TIER_LABELS } from './catalog.ts'
import { ProductCard } from './ProductCard.tsx'
import { ShareBar } from './ShareBar.tsx'

interface Props {
  roomName: string
  view: ListView
  choices: Choices
  changes: Record<string, Change>
  /** Escolhas mudaram desde o último reload. */
  dirty: boolean
  /** `include`: coloca o item de volta na lista (no tier que tinha ou no informado). */
  onChoices: (next: Choices, message: string, include?: Plan) => void
  onReload: () => void
  onEditBudget: () => void
  onChangeRoom: () => void
  share: { url: string; text: string; onCopied: (ok: boolean) => void }
}

const REASON_LABELS = { refused: 'Recusado', owned: 'Já tenho' }

export function ListScreen({
  roomName,
  view,
  choices,
  changes,
  dirty,
  onChoices,
  onReload,
  onEditBudget,
  onChangeRoom,
  share,
}: Props) {
  const over = view.remaining < 0
  const used = view.budget > 0 ? Math.min(100, (view.total / view.budget) * 100) : 100
  const removed = Object.entries(changes).filter(([, change]) => change === 'removed').length

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
            <strong data-testid="remaining">{formatBRL(Math.abs(view.remaining))}</strong>
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
        <button
          type="button"
          class={`reload-button ${dirty ? 'is-pending' : ''}`}
          onClick={onReload}
        >
          ↻ Recalcular lista
          {dirty && !over && view.remaining > 0 && (
            <span> com o saldo de {formatBRLWhole(view.remaining)}</span>
          )}
        </button>
      </div>

      <ShareBar {...share} />

      {over && (
        <p class="notice notice-warn">
          A lista passa do orçamento em {formatBRL(-view.remaining)}. Aumente o orçamento, escolha
          opções mais baratas ou recuse algum item.
        </p>
      )}
      {removed > 0 && (
        <p class="notice">
          {removed === 1 ? '1 item saiu' : `${removed} itens saíram`} da lista para caber no
          orçamento — veja em “Não coube no orçamento”.
        </p>
      )}

      {view.entries.length ? (
        <div class="product-list">
          {view.entries.map((entry) => {
            const { category } = entry.item
            const { label, option, options } = entry
            const moveTo = (direction: -1 | 1) => {
              const index = options.indexOf(option) + direction
              const target = options[index]
              onChoices(
                lockAt(choices, category, target.tier),
                `${label}: ${TIER_LABELS[target.tier].toLowerCase()} (travado).`,
              )
            }
            return (
              <ProductCard
                key={category}
                entry={entry}
                change={changes[category]}
                onCheaper={() => moveTo(-1)}
                onPricier={() => moveTo(1)}
                onToggleLock={() =>
                  entry.locked
                    ? onChoices(unlock(choices, category), `${label} destravado.`)
                    : onChoices(lockAt(choices, category, option.tier), `${label} travado.`)
                }
                onOwned={() =>
                  onChoices(
                    exclude(choices, category, 'owned'),
                    `${label}: marcado como “já tenho”.`,
                  )
                }
                onRefuse={() =>
                  onChoices(exclude(choices, category, 'refused'), `${label} recusado.`)
                }
              />
            )
          })}
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
                <span>
                  {label}
                  <span class="muted"> · a partir de {formatBRL(cheapest.price * item.qty)}</span>
                </span>
                <button
                  type="button"
                  class="small-button"
                  onClick={() =>
                    onChoices(lockAt(choices, item.category, cheapest.tier), `${label} adicionado.`)
                  }
                >
                  + Adicionar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.excluded.length > 0 && (
        <section class="side-section">
          <h3>Recusados e “já tenho”</h3>
          <ul class="compact-list">
            {view.excluded.map(({ item, label, reason, cheapest }) => (
              <li key={item.category}>
                <span>
                  {label}
                  <span class="muted"> · {REASON_LABELS[reason]}</span>
                </span>
                <button
                  type="button"
                  class="small-button"
                  onClick={() =>
                    onChoices(restore(choices, item.category), `${label} reativado.`, {
                      [item.category]: cheapest.tier,
                    })
                  }
                >
                  Reativar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
