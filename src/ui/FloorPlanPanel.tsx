import { useState } from 'preact/hooks'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { FloorPlanDrawing } from './FloorPlanDrawing.tsx'
import { FurnitureLayout } from './FurnitureLayout.tsx'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
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
export function FloorPlanPanel({ plan, view, instances }: Props) {
  const [open, setOpen] = useState(readOpen)
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
        </div>
      )}
    </section>
  )
}
