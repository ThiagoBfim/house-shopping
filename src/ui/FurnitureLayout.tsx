import { useMemo, useRef, useState } from 'preact/hooks'
import { formatSize } from '../data/layout.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import {
  guestsByHost,
  roomTypeOf,
  TYPICAL_ROOM_CM,
  TYPICAL_ROOM_DEFAULT,
} from '../engine/floor-plan.ts'
import { furnishHouse } from '../engine/house3d.ts'
import {
  applySuggestions,
  arrangeRoom,
  clearPositions,
  hintOf,
  layoutItems,
  otherItems,
  roomSizeCm,
  setPosition,
  tryMove,
  type ManualPositions,
  type PlacedItem,
  type PositionHint,
} from '../engine/layout.ts'
import { formatBRL } from '../engine/money.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import type { SavedHouse } from './house3d-store.ts'
import { Room3DView } from './Room3DView.tsx'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
  /** Casa gerada em 3D: a vista de cima usa o mesmo cálculo (medidas, armários, posições). */
  house?: SavedHouse
  /** Posições escolhidas arrastando (as mesmas do 3D). */
  positions: ManualPositions
  onPositions: (positions: ManualPositions) => void
}

/** Cômodo dos itens da casa toda (limpeza, ferramentas): não é um lugar. */
const WHOLE_HOUSE = 'utilidades'

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

/** Girar no sentido do relógio, visto de cima. */
const NEXT_FACING: Record<PlacedItem['facing'], PlacedItem['facing']> = {
  down: 'left',
  left: 'up',
  up: 'right',
  right: 'down',
}
const SNAP = 5
const snap = (cm: number) => Math.round(cm / SNAP) * SNAP
const sameItem = (a: { key: string; unit: number }, b: { key: string; unit: number }) =>
  a.key === b.key && a.unit === b.unit

interface Drag {
  key: string
  unit: number
  /** Ponteiro − canto do móvel, no começo (cm). */
  dx: number
  dy: number
  /** Canto de cima à esquerda na posição de agora (cm). */
  x: number
  y: number
  moved: boolean
  ok: boolean
}

/**
 * "Posição dos móveis": vista de cima, em escala, de um cômodo com os móveis da lista. Com a
 * casa em 3D gerada, é exatamente o cômodo do 3D (medidas, armários das fotos, posições). Dá
 * para arrastar um móvel (ou mover com as setas e girar) e o 3D usa as mesmas posições.
 */
export function FurnitureLayout({ plan, view, instances, house, positions, onPositions }: Props) {
  // Sem área de serviço, a lavanderia fica na cozinha: o cômodo + os hóspedes dele.
  const guests = guestsByHost(
    plan.rooms,
    instances.map((i) => i.id),
  )
  const idsOf = (id: string) => [id, ...(guests[id] ?? [])]
  const inPlan = new Set(plan.rooms.map((r) => r.instanceId))
  const hostedIds = new Set(Object.values(guests).flat())
  const linked = [
    ...plan.rooms.map((room, index) => ({
      room: room as SavedPlan['rooms'][number] | undefined,
      index,
      instance: instances.find((i) => i.id === room.instanceId),
    })),
    // Cômodos da lista que não estão na planta (ex.: escritório adicionado depois): medida típica.
    ...instances
      .filter((i) => !inPlan.has(i.id) && !hostedIds.has(i.id) && i.roomId !== WHOLE_HOUSE)
      .map((instance) => ({ room: undefined, index: -1, instance })),
  ].filter(
    (r) =>
      r.instance &&
      (layoutItems(view, idsOf(r.instance.id)).length ||
        otherItems(view, idsOf(r.instance.id)).length),
  )
  const [selected, setSelected] = useState(linked[0]?.instance?.id)
  const [picked, setPicked] = useState<{ key: string; unit: number }>()
  const [show3d, setShow3d] = useState(false)
  const [drag, setDrag] = useState<Drag>()
  const [notice, setNotice] = useState<string>()
  const svg = useRef<SVGSVGElement>(null)
  const dragged = useRef(false)
  const current = linked.find((r) => r.instance!.id === selected) ?? linked[0]
  const id = current?.instance?.id
  // Mesmo cálculo do 3D quando há casa gerada; senão, a planta lida (medida estimada).
  const memo = useMemo(() => {
    if (!current || !id) return undefined
    // A casa toda (a regra da lavanderia na cozinha olha os outros cômodos), depois o cômodo.
    const f =
      house?.model.rooms.some((r) => r.instanceId === id) &&
      furnishHouse(house.model, view, positions).find((r) => r.room.instanceId === id)
    if (f) {
      const size = { width: f.layout.width, depth: f.layout.depth, estimated: false }
      return { size, layout: f.layout, fixed: f.fixed, from3d: true, outside: false }
    }
    const size = current.room
      ? roomSizeCm(plan, current.index)
      : { ...(TYPICAL_ROOM_CM[roomTypeOf(id)] ?? TYPICAL_ROOM_DEFAULT), estimated: true }
    const base = arrangeRoom(
      { width: size.width, depth: size.depth, openings: current.room?.openings ?? [] },
      layoutItems(view, idsOf(id)),
    )
    const { layout } = applySuggestions(base, positions[id] ?? [])
    return { size, layout, fixed: [] as PlacedItem[], from3d: false, outside: !current.room }
  }, [plan, view, house, positions, current?.index, id])
  if (!current || !memo || !id) return null
  const { size, layout, fixed, from3d, outside } = memo
  const pickedItem = picked && layout.placed.find((p) => sameItem(p, picked))
  const details = pickedItem && detailsOf(view, pickedItem.key)
  const meters = (cm: number) => (cm / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const order = { rug: 0, floor: 1, wall: 2 }
  const custom = (positions[id] ?? []).length > 0
  const others = otherItems(view, idsOf(id))
  const hostedTitles = (guests[id] ?? []).map((g) => instances.find((i) => i.id === g)?.title ?? g)

  /** Tenta pôr o móvel na posição; se não couber, avisa e deixa onde estava. */
  const place = (hint: PositionHint, what: string) => {
    if (!tryMove(layout, hint, fixed)) {
      setNotice(`Não dá para ${what} aí: bate em outro móvel, em armário, na porta ou na parede.`)
      return false
    }
    setNotice(undefined)
    onPositions(setPosition(positions, id, hint))
    return true
  }

  const toCm = (e: PointerEvent) => {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
    return { x: point.x, y: point.y }
  }
  const startDrag = (e: PointerEvent, p: PlacedItem) => {
    if (p.placement === 'wall') return
    const at = toCm(e)
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    setDrag({
      key: p.key,
      unit: p.unit,
      dx: at.x - p.x,
      dy: at.y - p.y,
      x: p.x,
      y: p.y,
      moved: false,
      ok: true,
    })
  }
  const moveDrag = (e: PointerEvent) => {
    if (!drag) return
    const p = layout.placed.find((q) => sameItem(q, drag))
    if (!p) return
    const at = toCm(e)
    const x = snap(at.x - drag.dx)
    const y = snap(at.y - drag.dy)
    const moved = drag.moved || Math.hypot(x - p.x, y - p.y) >= SNAP
    const ok = !!tryMove(layout, { ...hintOf(p), xCm: x + p.w / 2, yCm: y + p.d / 2 }, fixed)
    setDrag({ ...drag, x, y, moved, ok })
  }
  const endDrag = () => {
    if (!drag) return
    const p = layout.placed.find((q) => sameItem(q, drag))
    setDrag(undefined)
    if (!p || !drag.moved) return
    dragged.current = true
    setPicked({ key: p.key, unit: p.unit })
    place({ ...hintOf(p), xCm: drag.x + p.w / 2, yCm: drag.y + p.d / 2 }, 'pôr o móvel')
  }
  const rotate = (p: PlacedItem) =>
    place({ ...hintOf(p), rotation: NEXT_FACING[p.facing] }, 'girar o móvel')
  const nudge = (p: PlacedItem, dx: number, dy: number) =>
    place({ ...hintOf(p), xCm: hintOf(p).xCm + dx, yCm: hintOf(p).yCm + dy }, 'mover o móvel')

  return (
    <section class="furniture-layout" aria-labelledby="furniture-layout-title">
      <h4 id="furniture-layout-title">🛋️ Posição dos móveis</h4>
      <div class="chips" role="tablist" aria-label="Cômodo">
        {linked.map(({ instance }) => (
          <button
            key={instance!.id}
            type="button"
            role="tab"
            class={`chip ${instance!.id === id ? 'is-active' : ''}`}
            aria-selected={instance!.id === id}
            onClick={() => {
              setSelected(instance!.id)
              setPicked(undefined)
              setShow3d(false)
              setNotice(undefined)
            }}
          >
            {instance!.title}
          </button>
        ))}
      </div>
      <p class="muted">
        {current.instance!.title}: {meters(size.width)} × {meters(size.depth)} m
        {from3d ? ' (da casa em 3D)' : size.estimated ? ' (medida estimada pela planta)' : ''} ·
        vista de cima, em escala.
      </p>
      {outside && (
        <p class="notice">
          📏 {current.instance!.title} não está na planta: desenhado com a medida típica, sem portas
          e janelas.
        </p>
      )}
      {hostedTitles.length > 0 && (
        <p class="notice">
          🧺 {hostedTitles.join(', ')} fica aqui: a planta não tem um espaço só para ela.
        </p>
      )}
      <svg
        ref={svg}
        class={drag ? 'is-dragging' : ''}
        viewBox={`${-PAD} ${-PAD} ${layout.width + 2 * PAD} ${layout.depth + 2 * PAD}`}
        role="group"
        aria-label={`Planta de ${current.instance!.title} com os móveis`}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(undefined)}
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
        {fixed.map((p) => (
          // Armários das fotos: já estão no imóvel, não saem do lugar.
          <g
            key={p.key}
            class={`layout-fixed is-${p.placement}`}
            aria-label={`${p.label} (das fotos)`}
          >
            {p.placement === 'wall' ? (
              <rect {...wallStrip(p)} rx={2} />
            ) : (
              <rect x={p.x} y={p.y} width={p.w} height={p.d} rx={2} />
            )}
            {p.placement !== 'wall' && p.w > 40 && p.d > 18 && (
              <text
                x={p.x + p.w / 2}
                y={p.y + p.d / 2}
                font-size={11}
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {p.label}
              </text>
            )}
          </g>
        ))}
        {[...layout.placed]
          .sort(
            (a, b) =>
              order[a.placement as keyof typeof order] - order[b.placement as keyof typeof order],
          )
          .map((p) => {
            const info = detailsOf(view, p.key)
            const label = info?.category ?? p.label
            const font = Math.max(9, Math.min(16, p.w / 6, p.d / 2.5))
            const moving = drag && sameItem(drag, p)
            // Enquanto arrasta: o móvel acompanha o dedo (vermelho onde não cabe).
            const x = moving ? drag.x : p.x
            const y = moving ? drag.y : p.y
            const movable = p.placement !== 'wall'
            return (
              <g
                key={`${p.key}-${p.unit}`}
                class={`layout-item is-${p.placement} ${picked && sameItem(picked, p) ? 'is-picked' : ''} ${moving ? 'is-moving' : ''} ${moving && !drag.ok ? 'is-invalid' : ''}`}
                role="button"
                tabindex={0}
                aria-label={`${label}: ${p.label}`}
                data-x={p.x}
                data-y={p.y}
                data-facing={p.facing}
                onPointerDown={(e) => startDrag(e, p)}
                onClick={() => {
                  if (dragged.current) {
                    dragged.current = false
                    return
                  }
                  setPicked({ key: p.key, unit: p.unit })
                }}
                onKeyDown={(e) => {
                  const step = {
                    ArrowLeft: [-10, 0],
                    ArrowRight: [10, 0],
                    ArrowUp: [0, -10],
                    ArrowDown: [0, 10],
                  }[e.key]
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setPicked({ key: p.key, unit: p.unit })
                  } else if (movable && step) {
                    e.preventDefault()
                    setPicked({ key: p.key, unit: p.unit })
                    nudge(p, step[0], step[1])
                  } else if (movable && (e.key === 'r' || e.key === 'R')) {
                    e.preventDefault()
                    rotate(p)
                  }
                }}
              >
                {p.placement === 'wall' ? (
                  // Na parede (TV, ar, espelho): faixa fina encostada, não ocupa chão.
                  <rect {...wallStrip(p)} rx={2} />
                ) : (
                  <rect x={x} y={y} width={p.w} height={p.d} rx={3} />
                )}
                {p.placement !== 'wall' && p.w > 30 && p.d > 18 && (
                  <text
                    x={x + p.w / 2}
                    y={y + p.d / 2}
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
      {pickedItem && pickedItem.placement !== 'wall' && (
        <div class="layout-actions">
          <button type="button" class="small-button" onClick={() => rotate(pickedItem)}>
            ↻ Girar
          </button>
          <span class="muted">arraste o móvel ou use as setas (10 cm) · R gira</span>
        </div>
      )}
      {notice && (
        <p class="notice notice-warn" role="alert">
          {notice}
        </p>
      )}
      {custom && (
        <button
          type="button"
          class="link-button"
          onClick={() => {
            onPositions(clearPositions(positions, id))
            setNotice(undefined)
          }}
        >
          ↩ Voltar às posições sugeridas neste cômodo
        </button>
      )}
      {details && pickedItem && (
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
      {others.length > 0 && (
        <details class="layout-others">
          <summary>Também neste cômodo, sem lugar fixo no desenho ({others.length})</summary>
          <p class="muted">
            Fica na bancada, em cima de um móvel ou guardado:{' '}
            {others.map((o) => (o.qty > 1 ? `${o.label} (×${o.qty})` : o.label)).join(', ')}.
          </p>
        </details>
      )}
      {layout.unplaced.length > 0 && (
        <p class="notice notice-warn">
          Não coube neste cômodo:{' '}
          {layout.unplaced.map((u) => detailsOf(view, u.key)?.category ?? u.label).join(', ')}.
        </p>
      )}
      <p class="muted">
        Posição sugerida por regras (móvel na parede, passagem de 60 cm, nada na frente de porta)
        {from3d ? ', com as medidas e os armários da casa em 3D' : ''}. Arraste um móvel para mudar
        de lugar: a casa em 3D usa as mesmas posições ("🔄 Atualizar o 3D").
      </p>
    </section>
  )
}
