import { useEffect, useState } from 'preact/hooks'
import type { Rooms } from '../data/schema.ts'
import type { ListView } from '../engine/budget.ts'
import {
  furnitureForSkill,
  linkRooms,
  parseHouseModel,
  type HouseQuality,
} from '../engine/house3d.ts'
import type { RoomInstance } from '../engine/house.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { readSavedHouse, saveHouse, type SavedHouse } from './house3d-store.ts'
import { startJob, waitForJob } from './local-api.ts'
import { resizeImage } from './resize-image.ts'

interface Props {
  plan: SavedPlan
  rooms: Rooms
  view: ListView
  instances: RoomInstance[]
  /** Abre a casa gerada no visualizador 3D. */
  onOpen: (house: SavedHouse) => void
}

const MAX_PHOTOS = 8
const PLAN_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf'
const PHOTO_ACCEPT = 'image/png,image/jpeg,image/webp'

type State =
  | { step: 'idle' }
  | { step: 'generating'; startedAt: number; quality: HouseQuality }
  | { step: 'error'; message: string }

/**
 * "✨ Gerar casa em 3D": manda a planta, as fotos (reduzidas) e os móveis da lista com medida
 * para a skill /house-3d no backend local; a casa volta em metros, com portas, janelas,
 * acabamentos das fotos e sugestões de posição dos móveis.
 */
export function House3DGenerate({ plan, rooms, view, instances, onOpen }: Props) {
  const [planFile, setPlanFile] = useState<File>()
  const [photos, setPhotos] = useState<File[]>([])
  const [state, setState] = useState<State>({ step: 'idle' })
  const [house, setHouse] = useState<SavedHouse | undefined>(readSavedHouse)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (state.step !== 'generating') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [state.step])

  const generate = async (quality: HouseQuality) => {
    if (!planFile) return
    setState({ step: 'generating', startedAt: Date.now(), quality })
    setNow(Date.now())
    try {
      const form = new FormData()
      form.append('planta', planFile)
      for (const photo of await Promise.all(photos.map(resizeImage))) form.append('fotos', photo)
      form.append(
        'moveis',
        JSON.stringify(
          furnitureForSkill(
            view,
            instances.map((i) => i.id),
          ),
        ),
      )
      const id = await startJob(
        '/api/house-3d',
        form,
        quality === 'realista' ? { quality: 'realista' } : {},
      )
      const job = await waitForJob<unknown>(id, () => {})
      if (job.status === 'error') throw new Error(job.error ?? 'A geração da casa falhou.')
      const model = parseHouseModel(job.result)
      if (!model) throw new Error('A resposta veio num formato inesperado.')
      const saved: SavedHouse = {
        model: linkRooms(model, rooms, plan.rooms),
        generatedAt: new Date().toISOString(),
        photos: photos.length,
        ...(job.costUsd !== undefined && { costUsd: job.costUsd }),
        ...(quality === 'realista' && { quality }),
      }
      saveHouse(saved)
      setHouse(saved)
      setState({ step: 'idle' })
      onOpen(saved)
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const generating = state.step === 'generating'
  const seconds = generating ? Math.round((now - state.startedAt) / 1000) : 0
  const linked = house?.model.rooms.filter((r) => r.instanceId).length ?? 0
  const fromPhoto = house?.model.rooms.filter((r) => r.finishes.fromPhoto).length ?? 0
  const builtIns = house?.model.rooms.reduce((n, r) => n + r.builtIns.length, 0) ?? 0

  return (
    <section class="house-3d-generate" aria-labelledby="house-3d-title">
      <h4 id="house-3d-title">🏠 Casa em 3D</h4>
      <p class="muted">
        A planta e fotos dos cômodos (opcional) viram a casa inteira em 3D com os móveis da lista e
        os armários das fotos, para andar em primeira pessoa e ver um tour. A realista demora mais e
        usa texturas reais, luz do céu e render em alta qualidade.
      </p>
      <div class="house-3d-inputs">
        <label>
          Planta
          <input
            type="file"
            accept={PLAN_ACCEPT}
            disabled={generating}
            onChange={(e) => setPlanFile(e.currentTarget.files?.[0])}
          />
        </label>
        <label>
          Fotos dos cômodos <span class="muted">(até {MAX_PHOTOS})</span>
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            multiple
            disabled={generating}
            onChange={(e) => setPhotos([...(e.currentTarget.files ?? [])].slice(0, MAX_PHOTOS))}
          />
        </label>
      </div>
      <div class="house-3d-actions">
        <button
          type="button"
          class="small-button"
          disabled={!planFile || generating}
          onClick={() => generate('rapida')}
        >
          {generating && state.quality === 'rapida'
            ? `Gerando… ${seconds}s`
            : '✨ Gerar casa em 3D'}
        </button>
        <button
          type="button"
          class="small-button"
          disabled={!planFile || generating}
          onClick={() => generate('realista')}
        >
          {generating && state.quality === 'realista'
            ? `Gerando realista… ${seconds}s`
            : '🌟 Gerar casa em 3D realista'}
        </button>
        {house && !generating && (
          <button type="button" class="small-button" onClick={() => onOpen(house)}>
            🏠 Abrir casa em 3D
          </button>
        )}
      </div>
      {generating && (
        <p class="muted" role="status">
          Lendo a planta{photos.length ? ` e ${photos.length} foto(s)` : ''} com o Claude Code
          {state.quality === 'realista'
            ? ' com cuidado: armários, materiais e cores de cada foto (costuma levar 3–8 minutos).'
            : ' (costuma levar 1–3 minutos).'}
        </p>
      )}
      {state.step === 'error' && (
        <p class="notice notice-warn" role="alert">
          {state.message}
        </p>
      )}
      {house && !generating && (
        <p class="muted" role="status">
          Casa gerada{house.quality === 'realista' ? ' (realista)' : ''}: {house.model.rooms.length}{' '}
          cômodos ({linked} com móveis da lista)
          {builtIns ? `, ${builtIns} armário(s) das fotos` : ''}
          {house.photos ? `, ${fromPhoto} com acabamento pelas fotos` : ''}
          {house.costUsd !== undefined ? ` · US$ ${house.costUsd.toFixed(2)}` : ''}.
          {house.model.notes && ` Atenção: ${house.model.notes}`}
        </p>
      )}
    </section>
  )
}
