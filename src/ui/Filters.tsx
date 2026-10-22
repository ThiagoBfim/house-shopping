import type { Need } from '../data/schema.ts'
import type { Choices } from '../engine/budget.ts'
import { NEED_LABELS, NEEDS } from './catalog.ts'

export type FilterValues = Pick<Choices, 'minNeed' | 'utensils'>

interface Props {
  value: FilterValues
  onChange: (next: FilterValues) => void
}

export function Filters({ value, onChange }: Props) {
  return (
    <fieldset class="filters">
      <legend class="filters-title">Necessidade mínima</legend>
      <div class="need-picker" role="radiogroup" aria-label="Necessidade mínima">
        {NEEDS.map((need: Need) => (
          <button
            key={need}
            type="button"
            role="radio"
            aria-checked={value.minNeed === need}
            class={`need-option ${value.minNeed === need ? 'is-active' : ''}`}
            onClick={() => onChange({ ...value, minNeed: need })}
          >
            <strong>{need === 1 ? 'Tudo' : `${need}+`}</strong>
            <span>{NEED_LABELS[need]}</span>
          </button>
        ))}
      </div>

      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          checked={value.utensils}
          onChange={(e) => onChange({ ...value, utensils: e.currentTarget.checked })}
        />
        <span class="switch-track" aria-hidden="true" />
        <span>
          Incluir utensílios <span class="muted">(pratos, talheres, panelas, toalhas…)</span>
        </span>
      </label>
    </fieldset>
  )
}
