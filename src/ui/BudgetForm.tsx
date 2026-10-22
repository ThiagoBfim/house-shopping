import { useState } from 'preact/hooks'
import type { Products, Room } from '../data/schema.ts'
import { budgetRange, suggestBudgets } from '../engine/budget.ts'
import { formatBRLWhole, formatInteger, parseDigits } from '../engine/money.ts'
import { Filters, type FilterValues } from './Filters.tsx'

interface Props {
  room: Room
  products: Products
  initial?: number
  initialFilters: FilterValues
  onSubmit: (budget: number, filters: FilterValues) => void
  onBack: () => void
}

export function BudgetForm({ room, products, initial, initialFilters, onSubmit, onBack }: Props) {
  const [value, setValue] = useState(initial ?? 0)
  const [filters, setFilters] = useState(initialFilters)
  const range = budgetRange(room, products, filters)
  const suggestions = suggestBudgets(range)

  return (
    <section>
      <button type="button" class="link-button" onClick={onBack}>
        ← Cômodos
      </button>
      <h2 class="step-title">{room.name}: quanto você quer gastar?</h2>

      <form
        class="budget-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (value > 0) onSubmit(value, filters)
        }}
      >
        <label class="budget-field">
          <span class="budget-prefix">R$</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            aria-label="Orçamento em reais"
            placeholder="30.000"
            value={value ? formatInteger(value) : ''}
            onInput={(e) => setValue(parseDigits(e.currentTarget.value))}
          />
        </label>

        <div class="chips">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              class={`chip ${suggestion === value ? 'chip-active' : ''}`}
              onClick={() => setValue(suggestion)}
            >
              {formatBRLWhole(suggestion)}
            </button>
          ))}
        </div>

        <Filters value={filters} onChange={setFilters} />

        <ul class="range-hints">
          <li>
            Só o necessário, no mais barato: <strong>{formatBRLWhole(range.required)}</strong>
          </li>
          <li>
            Tudo, no mais barato: <strong>{formatBRLWhole(range.allCheapest)}</strong>
          </li>
          <li>
            Tudo, topo de linha: <strong>{formatBRLWhole(range.allTop)}</strong>
          </li>
        </ul>

        <button type="submit" class="primary-button" disabled={value <= 0}>
          Montar minha lista
        </button>
      </form>
    </section>
  )
}
