import type { ListView } from '../engine/budget.ts'
import { contentsByInstance, guestsByHost } from '../engine/floor-plan.ts'
import type { RoomInstance } from '../engine/house.ts'
import { categoryIcon } from './catalog.ts'
import type { SavedPlan } from './floor-plan-store.ts'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
}

/** Largura do desenho (a altura sai da proporção da planta). */
const WIDTH = 1000
const PAD = 12
const ICON = 34

/**
 * "Sua planta": desenho esquemático do imóvel. Cada cômodo fica na posição da planta, com os
 * ícones dos itens da lista (os mais importantes primeiro); tocar leva aos itens do cômodo.
 */
export function FloorPlanDrawing({ plan, view, instances }: Props) {
  const height = WIDTH / plan.aspect
  const contents = contentsByInstance(view)
  const byId = new Map(instances.map((instance) => [instance.id, instance]))
  // Sem área de serviço, a lavanderia aparece dentro da cozinha.
  const guests = guestsByHost(
    plan.rooms,
    instances.map((i) => i.id),
  )
  const goTo = (instanceId: string) =>
    document
      .getElementById(`room-${instanceId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div class="floor-plan-drawing">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        role="group"
        aria-label="Desenho do imóvel com os móveis da lista"
      >
        {plan.rooms.map((room, i) => {
          const instance = room.instanceId ? byId.get(room.instanceId) : undefined
          const x = room.x * WIDTH
          const y = room.y * height
          const w = room.width * WIDTH
          const h = room.height * height
          const hosted = instance
            ? (guests[instance.id] ?? []).map((id) => byId.get(id)).filter((g) => !!g)
            : []
          const title = [instance?.title ?? room.label, ...hosted.map((g) => g.title)].join(' + ')
          const area = room.areaM2 ? `${room.areaM2.toLocaleString('pt-BR')} m²` : ''
          const font = Math.max(14, Math.min(26, w / 9, h / 5))
          const all = (instance ? [instance, ...hosted] : []).flatMap((inst) => {
            const items = contents[inst.id]
            return items
              ? [
                  ...items.categories.map((c) => categoryIcon(c, inst.roomId)),
                  ...items.manual.map((m) =>
                    m.category ? categoryIcon(m.category, inst.roomId) : '🛍️',
                  ),
                ]
              : []
          })
          // Cada ícone uma vez só (cama, colchão e roupa de cama dividem o 🛏).
          const icons = [...new Set(all)]
          const top = y + PAD + font * 2.4
          const cols = Math.max(0, Math.floor((w - 2 * PAD) / ICON))
          const rows = Math.max(0, Math.floor((y + h - PAD - top) / ICON))
          const slots = cols * rows
          const shown = icons.length > slots ? icons.slice(0, Math.max(0, slots - 1)) : icons
          const hidden = icons.length - shown.length
          const label = instance
            ? `${title}${area ? `, ${area}` : ''}: ${all.length} ${all.length === 1 ? 'item' : 'itens'}`
            : `${title} (fora da lista)`

          return (
            <g
              key={i}
              class={`plan-room ${instance ? 'is-linked' : ''}`}
              role={instance ? 'button' : 'img'}
              tabindex={instance ? 0 : undefined}
              aria-label={label}
              onClick={instance && (() => goTo(instance.id))}
              onKeyDown={
                instance &&
                ((e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    goTo(instance.id)
                  }
                })
              }
            >
              <rect x={x} y={y} width={w} height={h} />
              <text x={x + PAD} y={y + PAD + font} font-size={font} class="plan-room-title">
                {title}
              </text>
              {area && (
                <text x={x + PAD} y={y + PAD + font * 2.05} font-size={font * 0.75}>
                  {area}
                </text>
              )}
              {shown.map((icon, n) => (
                <text
                  key={n}
                  x={x + PAD + (n % cols) * ICON + ICON / 2}
                  y={top + Math.floor(n / cols) * ICON + ICON * 0.75}
                  font-size={ICON * 0.72}
                  text-anchor="middle"
                  aria-hidden="true"
                >
                  {icon}
                </text>
              ))}
              {hidden > 0 && (
                <text
                  x={x + PAD + (shown.length % cols) * ICON + ICON / 2}
                  y={top + Math.floor(shown.length / cols) * ICON + ICON * 0.7}
                  font-size={ICON * 0.5}
                  text-anchor="middle"
                  class="plan-room-more"
                >
                  +{hidden}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p class="muted">
        Desenho esquemático pela planta enviada: os ícones são os itens da lista, os mais
        importantes primeiro (cada ícone aparece uma vez). Toque num cômodo para ver os itens dele.
      </p>
    </div>
  )
}
