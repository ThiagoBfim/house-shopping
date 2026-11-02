import type { Features } from './features.ts'
import type { Health } from './local-api.ts'

interface Props {
  health: Health
  features: Features
  onChange: (features: Features) => void
}

/** Painel "Recursos em teste": só aparece com o backend local rodando. */
export function LabsPanel({ health, features, onChange }: Props) {
  const toggle = (feature: keyof Features, label: string, hint: string, available: boolean) => (
    <label class={`labs-toggle ${available ? '' : 'is-disabled'}`}>
      <input
        type="checkbox"
        role="switch"
        checked={available && features[feature]}
        disabled={!available}
        onChange={(e) => onChange({ ...features, [feature]: e.currentTarget.checked })}
      />
      <span>
        <strong>{label}</strong>
        <span class="muted"> · {hint}</span>
      </span>
    </label>
  )

  return (
    <details class="labs-panel">
      <summary>
        🧪 Recursos em teste
        <span class="muted"> · backend local conectado</span>
      </summary>
      {toggle(
        'floorPlan',
        'Planta da casa',
        'envie a planta: cômodos, móveis e desenho do imóvel',
        health.floorPlan,
      )}
      {toggle(
        'cheaperPrices',
        'Preços mais baratos',
        health.cheaperPrices
          ? 'procura os itens da lista mais baratos em outras lojas'
          : 'precisa da skill /search-better-prices nesta máquina',
        health.cheaperPrices,
      )}
    </details>
  )
}
