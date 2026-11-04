import { useMemo, useState } from 'preact/hooks'
import { houseFromPlan, mergeRooms, relinkHouse } from '../engine/house3d.ts'
import type { ListView } from '../engine/budget.ts'
import type { RoomInstance } from '../engine/house.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import { FloorPlanDrawing } from './FloorPlanDrawing.tsx'
import { FurnitureLayout } from './FurnitureLayout.tsx'
import { Project3D } from './Project3D.tsx'
import { House3DView } from './House3DView.tsx'
import { ProjectChat } from './ProjectChat.tsx'
import type { ManualPositions } from '../engine/layout.ts'
import { readSavedHouse, saveHouse, type SavedHouse } from './house3d-store.ts'
import { readPositions, savePositions } from './positions-store.ts'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
  /** Passo do fluxo da planta: posições dos móveis (3D + chat) ou o projeto inteiro em 3D. */
  section: 'positions' | 'project'
  /** Backend com a skill /house-chat: chat do projeto no passo das posições. */
  chat?: boolean
  /** Tirar um item da lista (o chat sugere, a pessoa aplica). */
  onRemove: (key: string, label: string) => void
  /**
   * Pôr na lista um cômodo da planta que não está nela. Devolve a troca de id quando o cômodo
   * que já existia muda de nome ("banheiro" → "banheiro-1"), para as posições irem junto.
   */
  onAddRoom?: (type: string) => { from: string; to: string } | undefined
}

/**
 * Conteúdo dos passos 3 e 4 do fluxo da planta. "Posições em 3D": o desenho do imóvel, cada
 * cômodo em 3D com a vista de cima para arrastar e o chat do projeto. "Projeto em 3D": a casa
 * inteira gerada pela skill /house-3d, para andar e ver o tour.
 */
export function FloorPlanPanel({
  plan,
  view,
  instances,
  section,
  chat,
  onRemove,
  onAddRoom,
}: Props) {
  const [showing, setShowing] = useState<SavedHouse>()
  // Casa gerada em 3D e posições escolhidas: as mesmas na vista de cima e no 3D.
  const [house, setHouse] = useState<SavedHouse | undefined>(readSavedHouse)
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
  /** Unir cômodos: a parede some e o L vira um espaço só (guarda a casa de antes). */
  const merge = (a: number, b: number) => {
    if (!house) return
    const next = {
      ...house,
      model: mergeRooms(house.model, a, b),
      unmerged: house.unmerged ?? house.model,
    }
    setHouse(next)
    saveHouse(next)
  }
  const unmerge = () => {
    if (!house?.unmerged) return
    const { unmerged, ...rest } = house
    const next = { ...rest, model: unmerged }
    setHouse(next)
    saveHouse(next)
  }
  // Projeto em 3D: a casa da leitura com fotos ou, sem fotos, a montada pela própria planta.
  const projectHouse = useMemo<SavedHouse>(
    () =>
      linkedHouse ?? {
        model: houseFromPlan(plan),
        generatedAt: '',
        photos: 0,
      },
    [linkedHouse, plan],
  )
  const changePositions = (next: ManualPositions) => {
    setPositions(next)
    savePositions(next)
  }
  const addRoom = (type: string) => {
    const renamed = onAddRoom?.(type)
    if (!renamed || !positions[renamed.from]) return
    // As posições do cômodo que mudou de id vão junto.
    const { [renamed.from]: moved, ...rest } = positions
    changePositions({ ...rest, [renamed.to]: moved })
  }
  return (
    <section class="floor-plan-panel" aria-labelledby="floor-plan-title">
      <h3 id="floor-plan-title">
        {section === 'positions' ? '🛋️ Os móveis nos cômodos' : '🏠 O projeto em 3D'}{' '}
        <span class="muted">· {plan.fileName}</span>
      </h3>
      {section === 'positions' ? (
        <>
          <FloorPlanDrawing plan={plan} view={view} instances={instances} />
          <FurnitureLayout
            plan={plan}
            view={view}
            instances={instances}
            house={linkedHouse}
            positions={positions}
            onPositions={changePositions}
            open3d
            onMerge={house ? merge : undefined}
            onUnmerge={house?.unmerged ? unmerge : undefined}
            onAddRoom={onAddRoom ? addRoom : undefined}
          />
          {chat && (
            <ProjectChat
              plan={plan}
              view={view}
              instances={instances}
              house={linkedHouse}
              positions={positions}
              onPositions={changePositions}
              onRemove={onRemove}
            />
          )}
        </>
      ) : (
        <Project3D house={projectHouse} fromPlan={!linkedHouse} onOpen={setShowing} />
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
