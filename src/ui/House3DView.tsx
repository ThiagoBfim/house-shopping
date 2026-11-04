import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { formatSize } from '../data/layout.ts'
import type { ListView } from '../engine/budget.ts'
import type { ManualPositions } from '../engine/layout.ts'
import { furnishHouse } from '../engine/house3d.ts'
import { formatBRL } from '../engine/money.ts'
import { detailsOf } from './FurnitureLayout.tsx'
import type { SavedHouse } from './house3d-store.ts'
import type { HouseScene, ViewMode } from './house-scene.ts'
import type { RealisticKit } from './realistic-materials.ts'

interface Props {
  house: SavedHouse
  view: ListView
  /** Posições escolhidas na vista de cima (as mesmas da "Posição dos móveis"). */
  positions: ManualPositions
  onClose: () => void
}

const keyOf = (id: string) => id.slice(0, id.lastIndexOf('#'))
const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/**
 * A casa gerada em 3D, em tela cheia: de cima (maquete), andando em primeira pessoa ou no tour
 * pelos cômodos, que pode ser gravado em vídeo. Tocar num móvel mostra nome, medida e preço.
 */
export function House3DView({ house, view, positions, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<HouseScene | undefined>(undefined)
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [mode, setMode] = useState<ViewMode>('orbit')
  const [room, setRoom] = useState<number>(-1)
  const [picked, setPicked] = useState<string>()
  const [recording, setRecording] = useState(false)
  const [video, setVideo] = useState<{ url: string; name: string }>()
  const [realistic, setRealistic] = useState(house.quality === 'realista')
  const [render, setRender] = useState<
    { step: 'running'; cancel: () => void } | { step: 'ready'; url: string }
  >()
  const furnished = useMemo(
    () => furnishHouse(house.model, view, positions),
    [house, view, positions],
  )

  useEffect(() => {
    let disposed = false
    let kit: RealisticKit | undefined
    setLoad('loading')
    Promise.all([
      import('./house-scene.ts'),
      realistic
        ? import('./realistic-materials.ts').then(async (m) => (kit = await m.loadRealisticKit()))
        : undefined,
    ])
      .then(([{ mountHouse }]) => {
        if (disposed || !host.current) return
        scene.current = mountHouse(
          host.current,
          house.model,
          furnished,
          { onPick: setPicked, onRoom: setRoom, onMode: setMode },
          kit,
        )
        if (import.meta.env.DEV) {
          ;(window as unknown as { __house3d?: HouseScene }).__house3d = scene.current
        }
        setLoad('ready')
      })
      .catch(() => setLoad('error'))
    return () => {
      disposed = true
      scene.current?.dispose()
      scene.current = undefined
      kit?.dispose()
    }
  }, [house, furnished, realistic])

  /** "📸 Render realista": a mesma vista em alta qualidade, para baixar. */
  const startRender = () => {
    const job = scene.current?.renderRealistic()
    if (!job) return
    setRender({ step: 'running', cancel: job.cancel })
    void job.done.then((url) => setRender(url ? { step: 'ready', url } : undefined))
  }

  useEffect(() => () => video && URL.revokeObjectURL(video.url), [video])

  // Esc fecha (fora do modo andar, onde o teclado é das setas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tour = (record: boolean) => {
    setRecording(record)
    setPicked(undefined)
    scene.current?.select(undefined)
    scene.current?.startTour({
      record,
      onEnd: (blob) => {
        setRecording(false)
        if (!blob?.size) return
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
        setVideo({ url: URL.createObjectURL(blob), name: `tour-da-casa.${ext}` })
      },
    })
  }

  const photo = () => {
    const url = scene.current?.screenshot()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = 'casa-3d.png'
    a.click()
  }

  const details = picked && detailsOf(view, keyOf(picked))
  const roomLabel = room >= 0 ? house.model.rooms[room]?.label : undefined
  const unplaced = furnished.flatMap((f) => f.layout.unplaced.map((u) => u.label))
  const accepted = furnished.reduce((sum, f) => sum + f.accepted, 0)

  return (
    <div class="house-3d" role="dialog" aria-modal="true" aria-label="Casa em 3D">
      <div class="house-3d-bar">
        <strong>🏠 Casa em 3D</strong>
        <div class="house-3d-modes" role="group" aria-label="Como ver a casa">
          <button
            type="button"
            class="small-button"
            aria-pressed={mode === 'orbit'}
            onClick={() => scene.current?.setMode('orbit')}
          >
            🛰️ De cima
          </button>
          <button
            type="button"
            class="small-button"
            aria-pressed={mode === 'walk'}
            onClick={() => scene.current?.setMode('walk')}
          >
            🚶 Andar
          </button>
          {mode === 'tour' ? (
            <button type="button" class="small-button" onClick={() => scene.current?.stopTour()}>
              ⏹️ Parar {recording ? 'e salvar vídeo' : 'tour'}
            </button>
          ) : (
            <>
              <button type="button" class="small-button" onClick={() => tour(false)}>
                🎬 Tour
              </button>
              <button type="button" class="small-button" onClick={() => tour(true)}>
                ⏺️ Gravar tour em vídeo
              </button>
            </>
          )}
          <button type="button" class="small-button" onClick={photo}>
            📷 Foto
          </button>
          {realistic && (
            <button
              type="button"
              class="small-button"
              disabled={load !== 'ready' || mode === 'tour' || render?.step === 'running'}
              onClick={startRender}
            >
              📸 Render realista
            </button>
          )}
          <button
            type="button"
            class="small-button"
            aria-pressed={realistic}
            disabled={mode === 'tour' || render?.step === 'running'}
            onClick={() => setRealistic(!realistic)}
          >
            ✨ Realista
          </button>
        </div>
        <button type="button" class="link-button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <div class="house-3d-canvas" ref={host} role="img" aria-label="A casa em 3D com os móveis">
        {load === 'loading' && <p class="muted">Carregando a casa…</p>}
        {load === 'error' && (
          <p class="notice notice-warn">Não foi possível abrir o 3D neste aparelho.</p>
        )}
        {mode !== 'orbit' && roomLabel && (
          <span class="house-3d-room" role="status">
            {recording && <span class="house-3d-rec">● REC</span>} {roomLabel}
          </span>
        )}
        {mode === 'walk' && (
          <span class="house-3d-help muted">
            {isTouch()
              ? 'arraste à esquerda para andar · à direita para olhar · toque num móvel'
              : 'W A S D ou setas para andar · arraste para olhar · clique num móvel'}
          </span>
        )}
      </div>

      {details && (
        <div class="layout-details" role="status">
          <strong>{details.category}</strong> · {details.name}
          <br />
          {details.size && (
            <>
              📐 {details.size.estimated ? '~' : ''}
              {formatSize(details.size)}
              {details.size.estimated ? ' (medida típica)' : ''} ·{' '}
            </>
          )}
          {formatBRL(details.price)} ·{' '}
          <a href={details.url} target="_blank" rel="noopener noreferrer">
            ver produto ↗
          </a>
        </div>
      )}
      {render?.step === 'running' && (
        <p class="notice" role="status">
          📸 Renderizando em alta qualidade…{' '}
          <button type="button" class="link-button" onClick={render.cancel}>
            Cancelar
          </button>
        </p>
      )}
      {render?.step === 'ready' && (
        <div class="house-3d-render" role="dialog" aria-label="Render realista">
          <img src={render.url} alt="Render realista da casa" />
          <p>
            <a href={render.url} download="casa-render-realista.png">
              Baixar imagem
            </a>{' '}
            ·{' '}
            <button type="button" class="link-button" onClick={() => setRender(undefined)}>
              Voltar ao 3D
            </button>
          </p>
        </div>
      )}
      {video && (
        <p class="notice" role="status">
          🎞️ Vídeo do tour pronto ·{' '}
          <a href={video.url} download={video.name}>
            Baixar vídeo
          </a>
        </p>
      )}
      <p class="muted house-3d-foot">
        {accepted > 0 && `${accepted} móvel(is) na posição lida da planta/fotos. `}
        {unplaced.length > 0 && `Não couberam: ${unplaced.join(', ')}.`}
      </p>
    </div>
  )
}
