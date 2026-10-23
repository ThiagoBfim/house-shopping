import { useState } from 'preact/hooks'
import {
  MAX_NAME_LENGTH,
  MAX_QTY,
  parseManualInput,
  type ManualErrors,
  type ManualFields,
  type ManualInput,
} from '../engine/manual.ts'

interface Props {
  /** Prefixo dos ids dos campos (um formulário por cômodo/item). */
  id: string
  /** Valores ao editar um item. */
  initial?: ManualFields
  submitLabel: string
  onSave: (fields: ManualFields) => void
  onCancel: () => void
}

const priceText = (price: number) => price.toFixed(2).replace('.', ',')

/** Formulário de item adicionado pelo usuário: nome, preço unitário, quantidade e link. */
export function ManualForm({ id, initial, submitLabel, onSave, onCancel }: Props) {
  const [input, setInput] = useState<ManualInput>({
    name: initial?.name ?? '',
    price: initial ? priceText(initial.price) : '',
    qty: String(initial?.qty ?? 1),
    url: initial?.url ?? '',
  })
  /** Erros só aparecem depois da primeira tentativa de salvar. */
  const [errors, setErrors] = useState<ManualErrors>()

  const set = (field: keyof ManualInput, value: string) => {
    const next = { ...input, [field]: value }
    setInput(next)
    if (errors) {
      const parsed = parseManualInput(next)
      setErrors(parsed.ok ? {} : parsed.errors)
    }
  }
  const qty = Number(input.qty) || 1
  const step = (delta: number) => set('qty', String(Math.min(MAX_QTY, Math.max(1, qty + delta))))

  const field = (name: keyof ManualInput) => ({
    id: `${id}-${name}`,
    'aria-invalid': errors?.[name] ? true : undefined,
    'aria-describedby': errors?.[name] ? `${id}-${name}-error` : undefined,
    value: input[name],
    onInput: (e: { currentTarget: HTMLInputElement }) => set(name, e.currentTarget.value),
  })
  const error = (name: keyof ManualInput) =>
    errors?.[name] && (
      <span class="manual-error" id={`${id}-${name}-error`}>
        {errors[name]}
      </span>
    )

  return (
    <form
      class="manual-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseManualInput(input)
        if (parsed.ok) onSave(parsed.value)
        else setErrors(parsed.errors)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <div class="manual-field manual-field-name">
        <label for={`${id}-name`}>Nome do produto</label>
        <input
          {...field('name')}
          autoFocus
          autoComplete="off"
          maxLength={MAX_NAME_LENGTH}
          placeholder="Ex.: Cadeira de jantar"
        />
        {error('name')}
      </div>
      <div class="manual-field">
        <label for={`${id}-price`}>Preço unitário</label>
        <span class="manual-money">
          <span aria-hidden="true">R$</span>
          <input {...field('price')} inputMode="decimal" autoComplete="off" placeholder="0,00" />
        </span>
        {error('price')}
      </div>
      <div class="manual-field">
        <label for={`${id}-qty`}>Quantidade</label>
        <span class="manual-qty">
          <button
            type="button"
            aria-label="Diminuir quantidade"
            disabled={qty <= 1}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input {...field('qty')} inputMode="numeric" autoComplete="off" />
          <button
            type="button"
            aria-label="Aumentar quantidade"
            disabled={qty >= MAX_QTY}
            onClick={() => step(1)}
          >
            +
          </button>
        </span>
        {error('qty')}
      </div>
      <div class="manual-field manual-field-url">
        <label for={`${id}-url`}>Link do produto</label>
        <input {...field('url')} type="url" autoComplete="off" placeholder="https://" />
        {error('url')}
      </div>
      <div class="manual-form-actions">
        <button type="button" class="link-button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" class="small-button manual-save">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
