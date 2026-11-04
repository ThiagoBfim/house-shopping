import { useEffect, useRef, useState } from 'preact/hooks'
import { formatSize } from '../data/layout.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomLayout } from '../engine/layout.ts'
import { formatBRL } from '../engine/money.ts'
import { detailsOf } from './FurnitureLayout.tsx'
import type { Room3D } from './room3d.ts'

interface Props {
  title: string
  layout: RoomLayout
  view: ListView
  onClose: () => void
}

/** Item escolhido: "chave#unidade" (criado-mudo 0 e 1). */
const keyOf = (id: string) => id.slice(0, id.lastIndexOf('#'))

/**
 * "Ver em 3D": o cômodo com os móveis na posição sugerida; arrastar gira, pinçar aproxima e
 * tocar num móvel mostra nome, medida, preço e link. three.js só carrega aqui.
 */
export function Room3DView({ title, layout, view, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const room = useRef<Room3D | undefined>(undefined)
  const [picked, setPicked] = useState<string>()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let disposed = false
    import('./room3d.ts')
      .then(({ mountRoom3D }) => {
        if (disposed || !host.current) return
        room.current = mountRoom3D(host.current, layout, setPicked)
        if (import.meta.env.DEV) {
          // Para os testes E2E acharem um móvel na tela (o canvas não tem DOM).
          ;(window as unknown as { __room3d?: Room3D }).__room3d = room.current
        }
        setState('ready')
      })
      .catch(() => setState('error'))
    return () => {
      disposed = true
      room.current?.dispose()
      room.current = undefined
    }
  }, [layout])

  const choose = (id: string) => {
    setPicked(id)
    room.current?.select(id)
  }
  const details = picked && detailsOf(view, keyOf(picked))
  const items = layout.placed.map((p) => ({
    id: `${p.key}#${p.unit}`,
    label: detailsOf(view, p.key)?.category ?? p.label,
  }))

  return (
    <div class="room-3d">
      <div class="room-3d-bar">
        <strong>🧊 {title} em 3D</strong>
        <span class="muted">arraste para girar · pince para aproximar · toque num móvel</span>
        <button type="button" class="link-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div class="room-3d-canvas" ref={host} role="img" aria-label={`${title} em 3D com os móveis`}>
        {state === 'loading' && <p class="muted">Carregando o 3D…</p>}
        {state === 'error' && (
          <p class="notice notice-warn">Não foi possível abrir o 3D neste aparelho.</p>
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
      <details class="room-3d-list">
        <summary>Móveis na cena ({items.length})</summary>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                class={`link-button ${item.id === picked ? 'is-active' : ''}`}
                onClick={() => choose(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
