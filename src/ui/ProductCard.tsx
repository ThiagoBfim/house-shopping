import { neighborOption, type ListEntry } from '../engine/budget.ts'
import type { Change } from '../engine/choices.ts'
import { formatBRL, formatBRLWhole } from '../engine/money.ts'
import { NEED_LABELS, TIER_LABELS } from './catalog.ts'

interface Props {
  entry: ListEntry
  change?: Change
  onCheaper: () => void
  onPricier: () => void
  onToggleLock: () => void
  onOwned: () => void
  onRefuse: () => void
}

const CHANGE_LABELS: Partial<Record<Change, string>> = {
  up: '↑ Melhorou',
  down: '↓ Mais barato',
  added: '+ Novo',
}

export function ProductCard({
  entry,
  change,
  onCheaper,
  onPricier,
  onToggleLock,
  onOwned,
  onRefuse,
}: Props) {
  const { option, options, item, label, subtotal, locked, utensil } = entry
  const cheaper = neighborOption(options, option.tier, -1)
  const pricier = neighborOption(options, option.tier, 1)
  const delta = (other: { price: number }) =>
    formatBRLWhole(Math.abs(other.price - option.price) * item.qty)

  return (
    <article
      class={`product-card ${change ? `is-${change}` : ''}`}
      aria-label={`${label}: ${option.name}`}
    >
      <div class="product-media">
        {option.image ? (
          <img src={option.image} alt="" loading="lazy" />
        ) : (
          <span class="product-placeholder" aria-hidden="true">
            {label.charAt(0)}
          </span>
        )}
      </div>

      <div class="product-body">
        <header class="product-header">
          <span class="product-category">{label}</span>
          <span class={`tier-badge tier-${option.tier}`}>{TIER_LABELS[option.tier]}</span>
          {utensil && <span class="utensil-badge">Utensílio</span>}
          {locked && <span class="lock-badge">🔒 Travado</span>}
          {change && CHANGE_LABELS[change] && (
            <span class={`change-badge change-${change}`}>{CHANGE_LABELS[change]}</span>
          )}
        </header>
        <h3 class="product-name">{option.name}</h3>
        <p class="need-meter" title={`Necessidade ${item.need} de 5`}>
          <span class="need-dots" aria-hidden="true">
            {'●'.repeat(item.need)}
            <span class="need-dots-off">{'●'.repeat(5 - item.need)}</span>
          </span>
          <span>
            Necessidade: {NEED_LABELS[item.need].toLowerCase()} ({item.need}/5)
          </span>
        </p>
        <ul class="product-bullets">
          {option.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <div class="product-actions">
        <div class="tier-stepper">
          <button type="button" disabled={!cheaper} onClick={onCheaper}>
            ↓ Mais barato
            {cheaper && <span class="stepper-delta">−{delta(cheaper)}</span>}
          </button>
          <button type="button" disabled={!pricier} onClick={onPricier}>
            ↑ Mais caro
            {pricier && <span class="stepper-delta">+{delta(pricier)}</span>}
          </button>
        </div>

        <div class="card-actions">
          <button type="button" aria-pressed={locked} onClick={onToggleLock}>
            {locked ? '🔓 Destravar' : '🔒 Travar'}
          </button>
          <button type="button" onClick={onOwned}>
            ✓ Já tenho
          </button>
          <button type="button" class="danger" onClick={onRefuse}>
            ✕ Recusar
          </button>
        </div>
      </div>

      <footer class="product-footer">
        <div class="product-price">
          <strong>{formatBRL(subtotal)}</strong>
          {item.qty > 1 && (
            <span class="muted">
              {item.qty} × {formatBRL(option.price)}
            </span>
          )}
        </div>
        <a class="buy-button" href={option.url} target="_blank" rel="sponsored noopener noreferrer">
          Comprar ↗
        </a>
      </footer>
    </article>
  )
}
