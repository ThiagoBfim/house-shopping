import { useState } from 'preact/hooks'
import type { Products, Room } from '../data/schema.ts'
import { budgetPresets, budgetRange, type PresetId } from '../engine/budget.ts'
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

const PRESET_TEXT: Record<PresetId, { name: string; description: string }> = {
  economico: {
    name: 'Econômico',
    description: 'Tudo o que a casa precisa, nos modelos mais em conta.',
  },
  equilibrado: {
    name: 'Equilibrado',
    description: 'Bons modelos na maior parte, com melhor custo-benefício.',
  },
  premium: {
    name: 'Premium',
    description: 'Os itens mais importantes em modelos caros e topo de linha.',
  },
}

export function BudgetForm({ room, products, initial, initialFilters, onSubmit, onBack }: Props) {
  const [filters, setFilters] = useState(initialFilters)
  const presets = budgetPresets(room, products, filters)
  const range = budgetRange(room, products, filters)

  // Opção escolhida acompanha os filtros (o valor muda com eles); valor digitado fica fixo.
  const [preset, setPreset] = useState<PresetId | undefined>(() =>
    initial === undefined
      ? 'equilibrado'
      : budgetPresets(room, products, initialFilters).find((p) => p.value === initial)?.id,
  )
  const [custom, setCustom] = useState(initial ?? 0)
  const value = preset ? presets.find((p) => p.id === preset)!.value : custom

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
        <div class="presets" role="radiogroup" aria-label="Orçamentos sugeridos">
          {presets.map(({ id, value: presetValue }) => (
            <label key={id} class={`preset ${preset === id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="preset"
                checked={preset === id}
                onChange={() => setPreset(id)}
              />
              <span class="preset-name">{PRESET_TEXT[id].name}</span>
              <strong class="preset-value">{formatBRLWhole(presetValue)}</strong>
              <span class="preset-description">{PRESET_TEXT[id].description}</span>
            </label>
          ))}
        </div>

        <div class="custom-budget">
          <span class="custom-budget-label" id="custom-budget-label">
            Ou digite outro valor
          </span>
          <label class={`budget-field ${preset ? '' : 'is-active'}`}>
            <span class="budget-prefix">R$</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label="Orçamento em reais"
              aria-describedby="custom-budget-label budget-range"
              placeholder={formatInteger(presets[1]?.value ?? 30000)}
              value={value ? formatInteger(value) : ''}
              onInput={(e) => {
                setPreset(undefined)
                setCustom(parseDigits(e.currentTarget.value))
              }}
            />
          </label>
          <p class="budget-range" id="budget-range">
            Só o necessário sai por {formatBRLWhole(range.required)}; tudo topo de linha, por{' '}
            {formatBRLWhole(range.allTop)}.
          </p>
        </div>

        <Filters value={filters} onChange={setFilters} />

        <button type="submit" class="primary-button" disabled={value <= 0}>
          Montar minha lista
        </button>
      </form>
    </section>
  )
}
