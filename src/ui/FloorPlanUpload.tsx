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
import { parseHouseModel, readHouse, setHouseRoomType, type HouseModel } from '../engine/house3d.ts'
import type { SavedHouse } from './house3d-store.ts'
import { startJob, waitForJob } from './local-api.ts'
import { resizeImage } from './resize-image.ts'

interface Props {
  rooms: Rooms
  /**
   * Planta lida: a casa vai para a escolha de cômodos, para a pessoa conferir. Com fotos, vem
   * também a casa em metros (portas, janelas, armários), que a posição dos móveis e o 3D usam.
   */
  onRead: (plan: ReadPlan, fileName: string, house?: SavedHouse) => void
}

type State =
  | { step: 'idle' }
  | { step: 'reading'; fileName: string; startedAt: number; photos: number }
  | {
      step: 'done'
      source: FloorPlan
      plan: ReadPlan
      file: File
      costUsd?: number
      /** Leitura caprichada (planta + fotos): a casa em metros. */
      model?: HouseModel
      photos: number
    }
  | { step: 'error'; message: string }

const MAX_PHOTOS = 8
const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp'

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

  const [photos, setPhotos] = useState<File[]>([])
  /** Leitura realista: a skill olha cada foto com mais cuidado (mais demorada e mais cara). */
  const [realistic, setRealistic] = useState(false)

  /** Casa salva junto com a leitura caprichada (já ligada à lista). */
  const savedHouse = (
    house: HouseModel,
    count: number,
    costUsd?: number,
    quality?: 'realista',
  ): SavedHouse => ({
    model: house,
    generatedAt: new Date().toISOString(),
    photos: count,
    ...(costUsd !== undefined && { costUsd }),
    ...(quality && { quality }),
  })

  const read = async (file: File) => {
    const count = photos.length
    setState({ step: 'reading', fileName: file.name, startedAt: Date.now(), photos: count })
    setNow(Date.now())
    try {
      if (count) {
        // Planta + fotos: a skill /house-3d tira as medidas da planta e, das fotos, o tipo de
        // cada porta (de correr ou de abrir), as janelas e os armários.
        const form = new FormData()
        form.append('planta', file)
        for (const photo of await Promise.all(photos.map(resizeImage))) {
          form.append('fotos', photo)
        }
        form.append('moveis', '[]')
        const id = await startJob('/api/house-3d', form, realistic ? { quality: 'realista' } : {})
        const job = await waitForJob<unknown>(id, () => {})
        if (job.status === 'error') throw new Error(job.error ?? 'A leitura da planta falhou.')
        const model = parseHouseModel(job.result)
        if (!model) throw new Error('A resposta da leitura veio num formato inesperado.')
        const { read, house } = readHouse(model, rooms)
        if (!Object.keys(read.house).length) {
          throw new Error(model.notes || 'Nenhum cômodo reconhecido nesta planta.')
        }
        setState({
          step: 'done',
          source: { aspect: read.aspect, notes: read.notes, rooms: read.rooms },
          plan: read,
          file,
          costUsd: job.costUsd,
          model,
          photos: count,
        })
        onRead(
          read,
          file.name,
          savedHouse(house, count, job.costUsd, realistic ? 'realista' : undefined),
        )
        return
      }
      const id = await startJob('/api/floor-plan', file, { name: file.name })
      const job = await waitForJob<unknown>(id, () => {})
      if (job.status === 'error') throw new Error(job.error ?? 'A leitura da planta falhou.')
      const plan = parseFloorPlan(job.result)
      if (!plan) throw new Error('A resposta da leitura veio num formato inesperado.')
      const read = planToHouse(plan, rooms)
      if (!Object.keys(read.house).length) {
        throw new Error(plan.notes || 'Nenhum cômodo reconhecido nesta planta.')
      }
      setState({ step: 'done', source: plan, plan: read, file, costUsd: job.costUsd, photos: 0 })
      // Leitura rápida: uma casa em 3D de outra leitura não vale mais.
      onRead(read, file.name)
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  /** A pessoa muda o tipo de um cômodo (ex.: "Dorm. 2" vira quarto do bebê): refaz a casa. */
  const retype = (index: number, type: string) => {
    if (state.step !== 'done') return
    if (state.model) {
      const model = setHouseRoomType(state.model, index, type)
      const { read, house } = readHouse(model, rooms)
      setState({ ...state, model, source: { ...state.source, rooms: read.rooms }, plan: read })
      onRead(read, state.file.name, savedHouse(house, state.photos, state.costUsd))
      return
    }
    const source = setRoomType(state.source, index, type)
    const plan = planToHouse(source, rooms)
    setState({ ...state, source, plan })
    onRead(plan, state.file.name)
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
            ? state.photos
              ? `Lendo ${state.fileName} e ${state.photos} foto(s)… ${seconds}s (costuma levar 2–3 minutos)`
              : `Lendo ${state.fileName}… ${seconds}s (costuma levar 1 minuto)`
            : 'Imagem ou PDF: os cômodos e o tamanho de cada um saem da planta.'}
        </span>
      </div>
      <div class="floor-plan-upload-row">
        <label class="floor-plan-photos">
          📷 Fotos dos cômodos <span class="muted">(opcional, até {MAX_PHOTOS})</span>
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            disabled={state.step === 'reading'}
            onChange={(e) => setPhotos([...(e.currentTarget.files ?? [])].slice(0, MAX_PHOTOS))}
          />
        </label>
        <span class="muted">
          Planta de imobiliária nem sempre é fiel: com fotos, a leitura confere onde há porta de
          correr (não ocupa espaço para abrir), as janelas e os armários embutidos.
        </span>
      </div>
      {photos.length > 0 && (
        <label class="floor-plan-realistic">
          <input
            type="checkbox"
            checked={realistic}
            disabled={state.step === 'reading'}
            onChange={(e) => setRealistic(e.currentTarget.checked)}
          />
          🌟 Leitura realista: olha cada foto com mais cuidado (armários, materiais, cores) e o
          projeto em 3D já abre com texturas reais. Mais demorada (3–8 min) e mais cara.
        </label>
      )}
      {state.step === 'done' && photos.length > 0 && state.photos !== photos.length && (
        <button type="button" class="small-button" onClick={() => void read(state.file)}>
          🔄 Ler de novo a planta com {photos.length} foto(s)
        </button>
      )}
      {state.step === 'reading' && <progress aria-label="Lendo a planta" />}
      {state.step === 'error' && (
        <p class="notice notice-warn" role="alert">
          {state.message}
        </p>
      )}
      {state.step === 'done' && state.model && (
        <p class="muted" role="status">
          {photoFindings(state.model, state.photos)}
        </p>
      )}
      {state.step === 'done' && (
        <PlanSummary plan={state.plan} rooms={rooms} costUsd={state.costUsd} onRetype={retype} />
      )}
    </section>
  )
}

/** O que a leitura com fotos achou além da planta. */
function photoFindings(model: HouseModel, photos: number): string {
  const doors = model.rooms.flatMap((r) => r.openings.filter((o) => o.kind === 'door'))
  const sliding = doors.filter((o) => o.sliding).length
  const windows = model.rooms.flatMap((r) => r.openings.filter((o) => o.kind === 'window')).length
  const builtIns = model.rooms.reduce((n, r) => n + r.builtIns.length, 0)
  const parts = [
    `${windows} janela(s)`,
    `${sliding} porta(s) de correr`,
    `${builtIns} armário(s) embutido(s)`,
  ]
  return `Lida com ${photos} foto(s): ${parts.join(', ')}. A posição dos móveis e o 3D usam essas medidas, portas e armários.`
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
        {plan.hosted.map(({ guest, host }) => (
          <p key={guest} class="muted">
            {rooms[guest]?.name ?? guest} na {(rooms[host]?.name ?? host).toLowerCase()}: a planta
            não tem um espaço só para ela.
          </p>
        ))}
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
