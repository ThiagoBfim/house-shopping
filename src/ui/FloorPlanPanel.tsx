import { useState } from 'preact/hooks'
import type { Rooms } from '../data/schema.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { FloorPlanDrawing } from './FloorPlanDrawing.tsx'
import { FurnitureLayout } from './FurnitureLayout.tsx'
import { House3DGenerate } from './House3DGenerate.tsx'
import { House3DView } from './House3DView.tsx'
import type { SavedHouse } from './house3d-store.ts'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
  /** Backend local com a skill /house-3d: dá para gerar a casa inteira em 3D. */
  house3d?: { rooms: Rooms }
}

/** Aberta ou escondida, só neste navegador (como os cômodos recolhidos da lista). */
const OPEN_KEY = 'house-shopping:floor-plan-open'

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false'
  } catch {
    return true
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open))
  } catch {
    // sem localStorage: vale até recarregar a página
  }
}

/**
 * "📐 Sua planta": o desenho do imóvel e, dentro, a posição dos móveis (vista de cima e 3D).
 * Dá para esconder tudo; escondida, nada disso é calculado nem desenhado.
 */
export function FloorPlanPanel({ plan, view, instances, house3d }: Props) {
  const [open, setOpen] = useState(readOpen)
  const [showing, setShowing] = useState<SavedHouse>()
  const toggle = () => {
    setOpen(!open)
    saveOpen(!open)
  }
  return (
    <section
      class={`floor-plan-panel ${open ? '' : 'is-collapsed'}`}
      aria-labelledby="floor-plan-title"
    >
      <h3 id="floor-plan-title">
        <button
          type="button"
          class="floor-plan-toggle"
          aria-expanded={open}
          aria-controls="floor-plan-body"
          onClick={toggle}
        >
          📐 Sua planta <span class="muted">· {plan.fileName}</span>
        </button>
      </h3>
      {open && (
        <div id="floor-plan-body">
          <FloorPlanDrawing plan={plan} view={view} instances={instances} />
          <FurnitureLayout plan={plan} view={view} instances={instances} />
          {house3d && (
            <House3DGenerate
              plan={plan}
              rooms={house3d.rooms}
              view={view}
              instances={instances}
              onOpen={setShowing}
            />
          )}
        </div>
      )}
      {showing && <House3DView house={showing} view={view} onClose={() => setShowing(undefined)} />}
    </section>
  )
}
