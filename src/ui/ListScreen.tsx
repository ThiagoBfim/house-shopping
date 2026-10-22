import { useState } from 'preact/hooks'
import type { Choices, ListEntry, ListView, Plan } from '../engine/budget.ts'
import { exclude, lockAt, restore, unlock, type Change } from '../engine/choices.ts'
import { splitItemKey, type RoomInstance } from '../engine/house.ts'
import { formatBRL, formatBRLWhole } from '../engine/money.ts'
import { matchesSearch } from '../engine/search.ts'
import { categoryIcon, NEED_LABELS, TIER_LABELS } from './catalog.ts'
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

/** Cômodos recolhidos ficam salvos só neste navegador (conveniência, não vai no link). */
const COLLAPSED_KEY = 'house-shopping:collapsed'

function readCollapsed(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveCollapsed(ids: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(ids))
  } catch {
    // Sem localStorage (aba anônima, bloqueado): vale só até recarregar a página.
  }
}

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
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed)
  const updateCollapsed = (ids: string[]) => {
    setCollapsed(ids)
    saveCollapsed(ids)
  }
  const toggleRoom = (id: string) =>
    updateCollapsed(collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id])

  const over = view.remaining < 0
  const used = view.budget > 0 ? Math.min(100, (view.total / view.budget) * 100) : 100
  // Só conta quem saiu por falta de saldo (não quem foi escondido pelos filtros).
  const removed = view.skipped.filter((s) => changes[s.item.category] === 'removed').length
  const filters = { minNeed: choices.minNeed, utensils: choices.utensils, helpers: choices.helpers }
  const activeFilters = [
    choices.minNeed > 1 && `necessidade ${choices.minNeed}+`,
    !choices.utensils && 'sem utensílios',
    choices.helpers && 'com facilitadores',
  ].filter(Boolean)
  // Facilitadores começam fora: em vez de listar um por um, um convite para incluir.
  const hiddenHelpers = view.filtered.filter((f) => f.reason === 'helper')
  const hiddenOthers = view.filtered.filter((f) => f.reason !== 'helper')

  const grouped = instances.length > 1
  const titles = new Map(instances.map((instance) => [instance.id, instance.title]))
  /** Nome do item para avisos e listas: "Colchão (Quarto 2)" quando há vários cômodos. */
  const nameOf = (key: string, label: string) =>
    grouped ? `${label} (${titles.get(splitItemKey(key).instanceId)})` : label
  const searching = query.trim() !== ''
  const found = view.entries.filter((entry) =>
    matchesSearch(query, [
      entry.label,
      entry.option.name,
      titles.get(splitItemKey(entry.item.category).instanceId) ?? '',
    ]),
  )
  const entriesOf = (instanceId: string) =>
    found.filter((entry) => splitItemKey(entry.item.category).instanceId === instanceId)
  // Na busca, mostra só os cômodos com resultado, todos abertos.
  const shownInstances = searching
    ? instances.filter((instance) => entriesOf(instance.id).length)
    : instances
  const allCollapsed = instances.every((instance) => collapsed.includes(instance.id))

  const renderCard = (entry: ListEntry) => {
    const { category } = entry.item
    const { option, options } = entry
    const name = nameOf(category, entry.label)
    const { instanceId, category: productId } = splitItemKey(category)
    const roomId = instances.find((instance) => instance.id === instanceId)?.roomId ?? ''
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
        icon={categoryIcon(productId, roomId)}
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

      {view.entries.length > 0 && (
        <div class="list-tools">
          <label class="search-field">
            <span class="visually-hidden">Buscar produto</span>
            <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar produto na lista…"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </label>
        </div>
      )}

      {searching && (
        <p class="search-summary muted" role="status">
          {found.length
            ? `${found.length} ${found.length === 1 ? 'item encontrado' : 'itens encontrados'} para “${query.trim()}”.`
            : `Nenhum item da lista com “${query.trim()}”.`}
        </p>
      )}

      {grouped && !searching && (
        <nav class="room-jump" aria-label="Ir para o cômodo">
          {instances.map((instance) => (
            <button
              key={instance.id}
              type="button"
              class="chip"
              onClick={() => {
                if (collapsed.includes(instance.id)) toggleRoom(instance.id)
                document
                  .getElementById(`room-${instance.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {instance.title}
            </button>
          ))}
          <button
            type="button"
            class="link-button"
            onClick={() =>
              updateCollapsed(allCollapsed ? [] : instances.map((instance) => instance.id))
            }
          >
            {allCollapsed ? 'Abrir todos' : 'Recolher todos'}
          </button>
        </nav>
      )}

      {!view.entries.length ? (
        <p class="empty-state">Nenhum item na lista.</p>
      ) : grouped ? (
        shownInstances.map((instance) => {
          const entries = entriesOf(instance.id)
          const all = view.entries.filter(
            (entry) => splitItemKey(entry.item.category).instanceId === instance.id,
          )
          const subtotal = all.reduce((sum, entry) => sum + entry.subtotal, 0)
          const open = searching || !collapsed.includes(instance.id)
          const bodyId = `room-items-${instance.id}`
          return (
            <section
              key={instance.id}
              id={`room-${instance.id}`}
              class={`room-group ${open ? '' : 'is-collapsed'}`}
            >
              <header class="room-group-header">
                <h3>
                  <button
                    type="button"
                    class="room-toggle"
                    aria-expanded={open}
                    aria-controls={bodyId}
                    disabled={searching}
                    onClick={() => toggleRoom(instance.id)}
                  >
                    {instance.title}
                  </button>
                </h3>
                <span>
                  {all.length} {all.length === 1 ? 'item' : 'itens'} ·{' '}
                  <strong>{formatBRL(subtotal)}</strong>
                </span>
              </header>
              {open && (
                <div id={bodyId}>
                  {entries.length ? (
                    <div class="product-list">{entries.map(renderCard)}</div>
                  ) : (
                    <p class="muted room-group-empty">Nada para comprar neste cômodo.</p>
                  )}
                </div>
              )}
            </section>
          )
        })
      ) : (
        <div class="product-list">{found.map(renderCard)}</div>
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

      {hiddenHelpers.length > 0 && (
        <section class="side-section helper-invite">
          <h3>✨ Facilitadores</h3>
          <p class="muted">
            {hiddenHelpers.length === 1
              ? '1 item que facilita'
              : `${hiddenHelpers.length} itens que facilitam`}{' '}
            o dia a dia:{' '}
            {[...new Set(hiddenHelpers.map(({ label }) => label.toLowerCase()))]
              .slice(0, 4)
              .join(', ')}
            …
          </p>
          <button
            type="button"
            class="small-button"
            onClick={() => onFilters({ ...filters, helpers: true })}
          >
            + Incluir facilitadores
          </button>
        </section>
      )}

      {hiddenOthers.length > 0 && (
        <section class="side-section">
          <h3>Escondidos pelos filtros</h3>
          <ul class="compact-list">
            {hiddenOthers.map(({ item, label, reason }) => (
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
