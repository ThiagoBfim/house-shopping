import { useMemo, useState } from 'preact/hooks'
import { formatSize } from '../data/layout.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import { arrangeRoom, layoutItems, roomSizeCm, type PlacedItem } from '../engine/layout.ts'
import { formatBRL } from '../engine/money.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { Room3DView } from './Room3DView.tsx'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
}

/** Margem em volta do cômodo no desenho (cm), para a régua e as janelas. */
const PAD = 40

const STRIP = 10

/** Faixa fina do item de parede, colada na parede de trás dele. */
function wallStrip({ x, y, w, d, facing }: PlacedItem) {
  switch (facing) {
    case 'down':
      return { x, y, width: w, height: STRIP }
    case 'up':
      return { x, y: y + d - STRIP, width: w, height: STRIP }
    case 'right':
      return { x, y, width: STRIP, height: d }
    case 'left':
      return { x: x + w - STRIP, y, width: STRIP, height: d }
  }
}

/** O que mostrar ao tocar num móvel: vem da lista (nome, preço, link, medida). */
export function detailsOf(view: ListView, key: string) {
  const entry = view.entries.find((e) => e.item.category === key)
  if (entry) {
    return {
      category: entry.label,
      name: entry.option.name,
      price: entry.option.price,
      url: entry.option.url,
      size: entry.size,
    }
  }
  const manual = view.manual.find((m) => m.item.id === key)
  if (manual) {
    return {
      category: manual.replaced?.label ?? 'Adicionado por você',
      name: manual.item.name,
      price: manual.item.price,
      url: manual.item.url,
      size: manual.size,
    }
  }
  return undefined
}

/**
 * "Posição dos móveis": vista de cima, em escala, de um cômodo da planta com os móveis da
 * lista posicionados pelas regras de `arrangeRoom` (encostados na parede, passagem livre,
 * nada na frente de porta). Tocar num móvel mostra nome, medida e preço.
 */
export function FurnitureLayout({ plan, view, instances }: Props) {
  const linked = plan.rooms
    .map((room, index) => ({
      room,
      index,
      instance: instances.find((i) => i.id === room.instanceId),
    }))
    .filter((r) => r.instance && layoutItems(view, r.instance.id).length)
  const [selected, setSelected] = useState(linked[0]?.instance?.id)
  const [picked, setPicked] = useState<PlacedItem>()
  const [show3d, setShow3d] = useState(false)
  const current = linked.find((r) => r.instance!.id === selected) ?? linked[0]
  // O 3D refaz a cena quando o layout muda: só recalcula com outro cômodo ou outra lista.
  const memo = useMemo(() => {
    if (!current) return undefined
    const size = roomSizeCm(plan, current.index)
    const layout = arrangeRoom(
      { width: size.width, depth: size.depth, openings: current.room.openings },
      layoutItems(view, current.instance!.id),
    )
    return { size, layout }
  }, [plan, view, current?.index, current?.instance?.id])
  if (!current || !memo) return null
  const { size, layout } = memo
  const details = picked && detailsOf(view, picked.key)
  const meters = (cm: number) => (cm / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const order = { rug: 0, floor: 1, wall: 2 }

  return (
    <section class="furniture-layout" aria-labelledby="furniture-layout-title">
      <h4 id="furniture-layout-title">🛋️ Posição dos móveis</h4>
      <div class="chips" role="tablist" aria-label="Cômodo">
        {linked.map(({ instance }) => (
          <button
            key={instance!.id}
            type="button"
            role="tab"
            class={`chip ${instance!.id === current.instance!.id ? 'is-active' : ''}`}
            aria-selected={instance!.id === current.instance!.id}
            onClick={() => {
              setSelected(instance!.id)
              setPicked(undefined)
              setShow3d(false)
            }}
          >
            {instance!.title}
          </button>
        ))}
      </div>
      <p class="muted">
        {current.instance!.title}: {meters(size.width)} × {meters(size.depth)} m
        {size.estimated ? ' (medida estimada pela planta)' : ''} · vista de cima, em escala.
      </p>
      <svg
        viewBox={`${-PAD} ${-PAD} ${layout.width + 2 * PAD} ${layout.depth + 2 * PAD}`}
        role="group"
        aria-label={`Planta de ${current.instance!.title} com os móveis`}
      >
        <rect class="layout-room" x={0} y={0} width={layout.width} height={layout.depth} />
        {layout.openings.map((o, i) => {
          const horizontal = o.wall === 'top' || o.wall === 'bottom'
          const length = horizontal ? layout.width : layout.depth
          const a = Math.max(0, o.position * length - o.widthCm / 2)
          const b = Math.min(length, a + o.widthCm)
          const fixed = { top: 0, bottom: layout.depth, left: 0, right: layout.width }[o.wall]
          const [x1, y1, x2, y2] = horizontal ? [a, fixed, b, fixed] : [fixed, a, fixed, b]
          if (o.kind === 'window') {
            return <line key={i} class="layout-window" x1={x1} y1={y1} x2={x2} y2={y2} />
          }
          // Porta: vão na parede e o arco de abrir para dentro.
          const r = b - a
          const inward = { top: 1, left: 1, bottom: -1, right: -1 }[o.wall]
          const arc = horizontal
            ? `M ${x1} ${y1} L ${x1} ${y1 + inward * r} A ${r} ${r} 0 0 ${inward > 0 ? 0 : 1} ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x1 + inward * r} ${y1} A ${r} ${r} 0 0 ${inward > 0 ? 1 : 0} ${x2} ${y2}`
          return (
            <g key={i} class="layout-door">
              <line class="layout-door-gap" x1={x1} y1={y1} x2={x2} y2={y2} />
              <path d={arc} />
            </g>
          )
        })}
        {[...layout.placed]
          .sort(
            (a, b) =>
              order[a.placement as keyof typeof order] - order[b.placement as keyof typeof order],
          )
          .map((p) => {
            const info = detailsOf(view, p.key)
            const label = info?.category ?? p.label
            const font = Math.max(9, Math.min(16, p.w / 6, p.d / 2.5))
            return (
              <g
                key={`${p.key}-${p.unit}`}
                class={`layout-item is-${p.placement} ${picked?.key === p.key && picked.unit === p.unit ? 'is-picked' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${label}: ${p.label}`}
                onClick={() => setPicked(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setPicked(p)
                  }
                }}
              >
                {p.placement === 'wall' ? (
                  // Na parede (TV, ar, espelho): faixa fina encostada, não ocupa chão.
                  <rect {...wallStrip(p)} rx={2} />
                ) : (
                  <rect x={p.x} y={p.y} width={p.w} height={p.d} rx={3} />
                )}
                {p.placement !== 'wall' && p.w > 30 && p.d > 18 && (
                  <text
                    x={p.x + p.w / 2}
                    y={p.y + p.d / 2}
                    font-size={font}
                    text-anchor="middle"
                    dominant-baseline="middle"
                  >
                    {label.length * font * 0.55 > p.w
                      ? `${label.slice(0, Math.max(3, Math.floor(p.w / (font * 0.55))))}…`
                      : label}
                  </text>
                )}
              </g>
            )
          })}
        <g class="layout-scale" transform={`translate(0 ${layout.depth + 22})`}>
          <line x1={0} y1={0} x2={100} y2={0} />
          <text x={108} y={0} dominant-baseline="middle" font-size={14}>
            1 m
          </text>
        </g>
      </svg>
      {show3d ? (
        <Room3DView
          title={current.instance!.title}
          layout={layout}
          view={view}
          onClose={() => setShow3d(false)}
        />
      ) : (
        <button type="button" class="small-button room-3d-open" onClick={() => setShow3d(true)}>
          🧊 Ver em 3D
        </button>
      )}
      {details && picked && (
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
      {layout.unplaced.length > 0 && (
        <p class="notice notice-warn">
          Não coube neste cômodo:{' '}
          {layout.unplaced.map((u) => detailsOf(view, u.key)?.category ?? u.label).join(', ')}.
        </p>
      )}
      <p class="muted">
        Posição sugerida por regras (móvel na parede, passagem de 60 cm, nada na frente de porta);
        portas e janelas vêm da leitura da planta. Toque num móvel para ver medida e preço.
      </p>
    </section>
  )
}
