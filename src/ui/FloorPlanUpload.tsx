import { useEffect, useState } from 'preact/hooks'
import type { Rooms } from '../data/schema.ts'
import {
  OUTSIDE_TYPE,
  parseFloorPlan,
  planToHouse,
  setRoomType,
  type FloorPlan,
  type ReadPlan,
} from '../engine/floor-plan.ts'
import { describeSpec } from '../engine/house.ts'
import { startJob, waitForJob } from './local-api.ts'

interface Props {
  rooms: Rooms
  /** Planta lida: a casa vai para a escolha de cômodos, para a pessoa conferir. */
  onRead: (plan: ReadPlan, fileName: string) => void
}

type State =
  | { step: 'idle' }
  | { step: 'reading'; fileName: string; startedAt: number }
  | { step: 'done'; source: FloorPlan; plan: ReadPlan; fileName: string; costUsd?: number }
  | { step: 'error'; message: string }

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'

/** "📐 Enviar a planta": lê a planta com o Claude Code (backend local) e monta a casa. */
export function FloorPlanUpload({ rooms, onRead }: Props) {
  const [state, setState] = useState<State>({ step: 'idle' })
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (state.step !== 'reading') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state.step])

  const read = async (file: File) => {
    setState({ step: 'reading', fileName: file.name, startedAt: Date.now() })
    setNow(Date.now())
    try {
      const id = await startJob('/api/floor-plan', file, { name: file.name })
      const job = await waitForJob<unknown>(id, () => {})
      if (job.status === 'error') throw new Error(job.error ?? 'A leitura da planta falhou.')
      const plan = parseFloorPlan(job.result)
      if (!plan) throw new Error('A resposta da leitura veio num formato inesperado.')
      const read = planToHouse(plan, rooms)
      if (!Object.keys(read.house).length) {
        throw new Error(plan.notes || 'Nenhum cômodo reconhecido nesta planta.')
      }
      setState({
        step: 'done',
        source: plan,
        plan: read,
        fileName: file.name,
        costUsd: job.costUsd,
      })
      onRead(read, file.name)
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  /** A pessoa muda o tipo de um cômodo (ex.: "Dorm. 2" vira quarto do bebê): refaz a casa. */
  const retype = (index: number, type: string) => {
    if (state.step !== 'done') return
    const source = setRoomType(state.source, index, type)
    const plan = planToHouse(source, rooms)
    setState({ ...state, source, plan })
    onRead(plan, state.fileName)
  }

  const seconds = state.step === 'reading' ? Math.round((now - state.startedAt) / 1000) : 0

  return (
    <section class="floor-plan-upload" aria-label="Planta da casa">
      <div class="floor-plan-upload-row">
        <label class={`small-button ${state.step === 'reading' ? 'is-disabled' : ''}`}>
          📐 {state.step === 'done' ? 'Enviar outra planta' : 'Enviar a planta'}
          <input
            type="file"
            class="visually-hidden"
            accept={ACCEPT}
            aria-label="Planta da casa (imagem ou PDF)"
            disabled={state.step === 'reading'}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0]
              e.currentTarget.value = ''
              if (file) void read(file)
            }}
          />
        </label>
        <span class="muted">
          {state.step === 'reading'
            ? `Lendo ${state.fileName}… ${seconds}s (costuma levar 1 minuto)`
            : 'Imagem ou PDF: os cômodos e o tamanho de cada um saem da planta.'}
        </span>
      </div>
      {state.step === 'reading' && <progress aria-label="Lendo a planta" />}
      {state.step === 'error' && (
        <p class="notice notice-warn" role="alert">
          {state.message}
        </p>
      )}
      {state.step === 'done' && (
        <PlanSummary plan={state.plan} rooms={rooms} costUsd={state.costUsd} onRetype={retype} />
      )}
    </section>
  )
}

interface SummaryProps {
  plan: ReadPlan
  rooms: Rooms
  costUsd?: number
  onRetype: (index: number, type: string) => void
}

/** Cômodo de itens da casa toda: não é um ambiente da planta. */
const NOT_A_PLACE = 'utilidades'

function PlanSummary({ plan, rooms, costUsd, onRetype }: SummaryProps) {
  const types = Object.entries(rooms).filter(([id]) => id !== NOT_A_PLACE)
  const beds = Object.entries(plan.variants).filter(([key]) => key.endsWith(':cama-box'))
  return (
    <>
      <div class="notice" role="status">
        <p>
          <strong>Planta lida:</strong> {describeSpec(plan.house, rooms)}. Confira os cômodos abaixo
          e continue.
        </p>
        {beds.length > 0 && (
          <p class="muted">
            Cama pelo tamanho do quarto:{' '}
            {beds
              .map(([key, size]) => {
                const room = plan.rooms.find((r) => `${r.instanceId}:cama-box` === key)
                return `${room?.label ?? key} (${room?.areaM2?.toLocaleString('pt-BR')} m²) → ${size}`
              })
              .join(' · ')}
          </p>
        )}
        {plan.ignored.length > 0 && <p class="muted">Fora da lista: {plan.ignored.join(', ')}.</p>}
        {plan.notes && <p class="muted">Atenção: {plan.notes}</p>}
        {costUsd !== undefined && (
          <p class="muted">Custo da leitura no Claude Code: US$ {costUsd.toFixed(2)}</p>
        )}
      </div>
      <fieldset class="plan-room-types">
        <legend>Tipo de cada cômodo</legend>
        <p class="muted">
          Um quarto pode virar quarto do bebê ou escritório; o que não for comprar, deixe fora da
          lista.
        </p>
        <ul>
          {plan.rooms.map((room, i) => (
            <li key={i}>
              <label for={`plan-room-${i}`}>
                {room.label}
                {room.areaM2 !== null && (
                  <span class="muted"> · {room.areaM2.toLocaleString('pt-BR')} m²</span>
                )}
              </label>
              <select
                id={`plan-room-${i}`}
                value={Object.hasOwn(rooms, room.type) ? room.type : OUTSIDE_TYPE}
                onChange={(e) => onRetype(i, e.currentTarget.value)}
              >
                {types.map(([id, { name }]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
                <option value={OUTSIDE_TYPE}>Fora da lista</option>
              </select>
            </li>
          ))}
        </ul>
      </fieldset>
    </>
  )
}
