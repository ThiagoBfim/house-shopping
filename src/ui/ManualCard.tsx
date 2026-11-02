import type { ManualEntry } from '../engine/budget.ts'
import { STORE_WHERE } from '../data/offers.ts'
import { formatBRL } from '../engine/money.ts'

interface Props {
  entry: ManualEntry
  onEdit: () => void
  onRemove: () => void
}

/**
 * Card de item adicionado pelo usuário: sem tiers, travar ou recusar; só editar e remover.
 * Numa troca, mostra o item do catálogo que ele substitui e "Desfazer troca" no lugar de remover.
 */
export function ManualCard({ entry, onEdit, onRemove }: Props) {
  const { item, store, subtotal, replaced } = entry
  return (
    <article
      class={`manual-card ${replaced ? 'is-replacement' : ''}`}
      aria-label={`${replaced ? `Trocado por você (${replaced.label})` : 'Adicionado por você'}: ${item.name}`}
    >
      <span class="manual-icon" aria-hidden="true">
        {replaced ? '⇄' : '🛍️'}
      </span>
      <div class="manual-body">
        {replaced ? (
          <header class="product-header">
            <span class="product-category">{replaced.label}</span>
            <span class="manual-badge">Trocado por você</span>
          </header>
        ) : (
          <span class="manual-badge">Adicionado por você</span>
        )}
        <h3 class="product-name">{item.name}</h3>
        <p class="product-price">
          <strong>{formatBRL(subtotal)}</strong>
          {item.qty > 1 && (
            <span class="muted">
              {item.qty} × {formatBRL(item.price)}
            </span>
          )}
        </p>
      </div>
      <div class="manual-actions">
        <div class="card-actions">
          <button type="button" onClick={onEdit}>
            ✎ Editar
          </button>
          {replaced ? (
            <button type="button" onClick={onRemove}>
              ↺ Desfazer troca
            </button>
          ) : (
            <button type="button" class="danger" onClick={onRemove}>
              ✕ Remover
            </button>
          )}
        </div>
        <a class="buy-button" href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          Ver anúncio {STORE_WHERE[store]} ↗
        </a>
      </div>
    </article>
  )
}
