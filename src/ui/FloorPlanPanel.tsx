import { useMemo, useState } from 'preact/hooks'
import { relinkHouse } from '../engine/house3d.ts'
import type { Rooms } from '../data/schema.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { FloorPlanDrawing } from './FloorPlanDrawing.tsx'
import { FurnitureLayout } from './FurnitureLayout.tsx'
import { House3DGenerate } from './House3DGenerate.tsx'
import { House3DView } from './House3DView.tsx'
import type { ManualPositions } from '../engine/layout.ts'
import { readSavedHouse, type SavedHouse } from './house3d-store.ts'
import { readPositions, savePositions } from './positions-store.ts'

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
  // Casa gerada em 3D e posições escolhidas: as mesmas na vista de cima e no 3D.
  const [house, setHouse] = useState<SavedHouse | undefined>(() =>
    house3d ? readSavedHouse() : undefined,
  )
  const [positions, setPositions] = useState<ManualPositions>(readPositions)
  // Casa em 3D religada aos cômodos de agora (mudou a quantidade ou o tipo depois de gerar).
  const ids = instances.map((i) => i.id).join()
  const linkedHouse = useMemo(
    () =>
      house && {
        ...house,
        model: {
          ...house.model,
          ...relinkHouse(house.model, ids.split(',')),
        },
      },
    [house, ids],
  )
  const changePositions = (next: ManualPositions) => {
    setPositions(next)
    savePositions(next)
  }
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
          <FurnitureLayout
            plan={plan}
            view={view}
            instances={instances}
            house={linkedHouse}
            positions={positions}
            onPositions={changePositions}
          />
          {house3d && (
            <House3DGenerate
              plan={plan}
              rooms={house3d.rooms}
              view={view}
              instances={instances}
              house={linkedHouse}
              onGenerated={setHouse}
              onOpen={setShowing}
            />
          )}
        </div>
      )}
      {showing && (
        <House3DView
          house={showing}
          view={view}
          positions={positions}
          onClose={() => setShowing(undefined)}
        />
      )}
    </section>
  )
}
