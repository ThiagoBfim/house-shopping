import type { ListEntry } from '../engine/budget.ts'
import { formatBRL } from '../engine/money.ts'
import { TIER_LABELS } from './catalog.ts'

interface Props {
  entry: ListEntry
}

export function ProductCard({ entry }: Props) {
  const { option, item, label, subtotal } = entry

  return (
    <article class="product-card">
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
        </header>
        <h3 class="product-name">{option.name}</h3>
        <ul class="product-bullets">
          {option.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
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
