/** Passos do fluxo da planta (só com "Planta da casa" ligada e uma planta lida). */
export type FlowStep = 'moveis' | 'posicoes' | 'projeto'

const KEY = 'house-shopping:flow-step'
const STEPS: FlowStep[] = ['moveis', 'posicoes', 'projeto']

export function readFlowStep(): FlowStep {
  try {
    const value = localStorage.getItem(KEY)
    return STEPS.includes(value as FlowStep) ? (value as FlowStep) : 'moveis'
  } catch {
    return 'moveis'
  }
}

export function saveFlowStep(step: FlowStep): void {
  try {
    localStorage.setItem(KEY, step)
  } catch {
    // sem localStorage: vale até recarregar
  }
}

interface Props {
  step: FlowStep
  onStep: (step: FlowStep) => void
  /** Passo 1: volta para a planta e a escolha de cômodos. */
  onRooms: () => void
}

const LABELS: { id: FlowStep | 'comodos'; label: string }[] = [
  { id: 'comodos', label: 'Planta e cômodos' },
  { id: 'moveis', label: 'Móveis' },
  { id: 'posicoes', label: 'Posições em 3D' },
  { id: 'projeto', label: 'Projeto em 3D' },
]

/**
 * Fluxo da planta: 1 planta e cômodos → 2 móveis → 3 posições em 3D (com o chat) → 4 projeto
 * em 3D. Cada passo é clicável (dá para voltar e avançar).
 */
export function PlanFlowSteps({ step, onStep, onRooms }: Props) {
  return (
    <nav class="plan-flow" aria-label="Passos do projeto">
      <ol>
        {LABELS.map(({ id, label }, i) => {
          const current = id === step
          const done = id === 'comodos' || STEPS.indexOf(id as FlowStep) < STEPS.indexOf(step)
          return (
            <li key={id} class={`${current ? 'is-current' : ''} ${done ? 'is-done' : ''}`}>
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                onClick={() => (id === 'comodos' ? onRooms() : onStep(id as FlowStep))}
              >
                <span class="plan-flow-number" aria-hidden="true">
                  {done && !current ? '✓' : i + 1}
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** "← Voltar" e "Próximo →" no fim de cada passo. */
export function PlanFlowNav({
  back,
  next,
}: {
  back?: { label: string; run: () => void }
  next?: { label: string; run: () => void }
}) {
  return (
    <div class="plan-flow-nav">
      {back && (
        <button type="button" class="link-button" onClick={back.run}>
          ← {back.label}
        </button>
      )}
      {next && (
        <button type="button" class="small-button plan-flow-next" onClick={next.run}>
          {next.label} →
        </button>
      )}
    </div>
  )
}
