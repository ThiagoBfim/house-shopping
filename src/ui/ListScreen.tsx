import type { Choices, ListEntry, ListView, Plan } from '../engine/budget.ts'
import { exclude, lockAt, restore, unlock, type Change } from '../engine/choices.ts'
import { splitItemKey, type RoomInstance } from '../engine/house.ts'
import { formatBRL, formatBRLWhole } from '../engine/money.ts'
import { NEED_LABELS, TIER_LABELS } from './catalog.ts'
import { Filters, type FilterValues } from './Filters.tsx'
import { ProductCard } from './ProductCard.tsx'
import { ShareBar } from './ShareBar.tsx'

interface Props {
  roomName: string
  /** Cômodos da casa; com mais de um, a lista é agrupada por cômodo. */
  instances: RoomInstance[]
  view: ListView
  choices: Choices
  changes: Record<string, Change>
  /** Escolhas mudaram desde o último reload. */
  dirty: boolean
  /** `include`: coloca o item de volta na lista (no tier que tinha ou no informado). */
  onChoices: (next: Choices, message: string, include?: Plan) => void
  onReload: () => void
  onFilters: (next: FilterValues) => void
  onEditBudget: () => void
  onChangeRoom: () => void
  share: { url: string; text: string; onCopied: (ok: boolean) => void }
}

const REASON_LABELS = { refused: 'Recusado', owned: 'Já tenho' }

export function ListScreen({
  roomName,
  instances,
  view,
  choices,
  changes,
  dirty,
  onChoices,
  onReload,
  onFilters,
  onEditBudget,
  onChangeRoom,
  share,
}: Props) {
  const over = view.remaining < 0
  const used = view.budget > 0 ? Math.min(100, (view.total / view.budget) * 100) : 100
  // Só conta quem saiu por falta de saldo (não quem foi escondido pelos filtros).
  const removed = view.skipped.filter((s) => changes[s.item.category] === 'removed').length
  const filters = { minNeed: choices.minNeed, utensils: choices.utensils }
  const activeFilters = [
    choices.minNeed > 1 && `necessidade ${choices.minNeed}+`,
    !choices.utensils && 'sem utensílios',
  ].filter(Boolean)

  const grouped = instances.length > 1
  const titles = new Map(instances.map((instance) => [instance.id, instance.title]))
  /** Nome do item para avisos e listas: "Colchão (Quarto 2)" quando há vários cômodos. */
  const nameOf = (key: string, label: string) =>
    grouped ? `${label} (${titles.get(splitItemKey(key).instanceId)})` : label
  const entriesOf = (instanceId: string) =>
    view.entries.filter((entry) => splitItemKey(entry.item.category).instanceId === instanceId)

  const renderCard = (entry: ListEntry) => {
    const { category } = entry.item
    const { option, options } = entry
    const name = nameOf(category, entry.label)
    const moveTo = (direction: -1 | 1) => {
      const target = options[options.indexOf(option) + direction]
      onChoices(
        lockAt(choices, category, target.tier),
        `${name}: ${TIER_LABELS[target.tier].toLowerCase()} (travado).`,
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
            ? onChoices(unlock(choices, category), `${name} destravado.`)
            : onChoices(lockAt(choices, category, option.tier), `${name} travado.`)
        }
        onOwned={() =>
          onChoices(exclude(choices, category, 'owned'), `${name}: marcado como “já tenho”.`)
        }
        onRefuse={() => onChoices(exclude(choices, category, 'refused'), `${name} recusado.`)}
      />
    )
  }

  return (
    <section>
      <div class="list-nav">
        <button type="button" class="link-button" onClick={onChangeRoom}>
          ← Cômodos
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

      <details class="filters-panel">
        <summary>
          Filtros
          <span class="muted"> · {activeFilters.length ? activeFilters.join(' · ') : 'tudo'}</span>
        </summary>
        <Filters value={filters} onChange={onFilters} />
      </details>

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

      {grouped && (
        <nav class="room-jump" aria-label="Ir para o cômodo">
          {instances.map((instance) => (
            <button
              key={instance.id}
              type="button"
              class="chip"
              onClick={() =>
                document
                  .getElementById(`room-${instance.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {instance.title}
            </button>
          ))}
        </nav>
      )}

      {!view.entries.length ? (
        <p class="empty-state">Nenhum item na lista.</p>
      ) : grouped ? (
        instances.map((instance) => {
          const entries = entriesOf(instance.id)
          const subtotal = entries.reduce((sum, entry) => sum + entry.subtotal, 0)
          return (
            <section key={instance.id} id={`room-${instance.id}`} class="room-group">
              <header class="room-group-header">
                <h3>{instance.title}</h3>
                <span>
                  {entries.length} {entries.length === 1 ? 'item' : 'itens'} ·{' '}
                  <strong>{formatBRL(subtotal)}</strong>
                </span>
              </header>
              {entries.length ? (
                <div class="product-list">{entries.map(renderCard)}</div>
              ) : (
                <p class="muted room-group-empty">Nada para comprar neste cômodo.</p>
              )}
            </section>
          )
        })
      ) : (
        <div class="product-list">{view.entries.map(renderCard)}</div>
      )}

      {view.skipped.length > 0 && (
        <section class="side-section">
          <h3>Não coube no orçamento</h3>
          <ul class="compact-list">
            {view.skipped.map(({ item, label, cheapest }) => (
              <li key={item.category}>
                <span>
                  {nameOf(item.category, label)}
                  <span class="muted"> · a partir de {formatBRL(cheapest.price * item.qty)}</span>
                </span>
                <button
                  type="button"
                  class="small-button"
                  onClick={() =>
                    onChoices(
                      lockAt(choices, item.category, cheapest.tier),
                      `${nameOf(item.category, label)} adicionado.`,
                    )
                  }
                >
                  + Adicionar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.filtered.length > 0 && (
        <section class="side-section">
          <h3>Escondidos pelos filtros</h3>
          <ul class="compact-list">
            {view.filtered.map(({ item, label, reason }) => (
              <li key={item.category}>
                <span>{nameOf(item.category, label)}</span>
                <span class="muted">
                  {reason === 'utensil'
                    ? 'Utensílio'
                    : `Necessidade: ${NEED_LABELS[item.need].toLowerCase()} (${item.need}/5)`}
                </span>
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
                  {nameOf(item.category, label)}
                  <span class="muted"> · {REASON_LABELS[reason]}</span>
                </span>
                <button
                  type="button"
                  class="small-button"
                  onClick={() =>
                    onChoices(
                      restore(choices, item.category),
                      `${nameOf(item.category, label)} reativado.`,
                      {
                        [item.category]: cheapest.tier,
                      },
                    )
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
