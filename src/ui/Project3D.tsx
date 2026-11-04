import type { HouseModel } from '../engine/house3d.ts'
import type { SavedHouse } from './house3d-store.ts'

interface Props {
  /** A casa do projeto: a da leitura com fotos ou a montada pela planta. */
  house: SavedHouse
  /** Veio da planta lida sem fotos (medidas estimadas). */
  fromPlan: boolean
  onOpen: (house: SavedHouse) => void
}

const count = (model: HouseModel) => ({
  rooms: model.rooms.filter((r) => !r.partOf).length,
  linked: new Set(model.rooms.flatMap((r) => (r.instanceId ? [r.instanceId] : []))).size,
  builtIns: model.rooms.reduce((n, r) => n + r.builtIns.length, 0),
})

/**
 * Passo 4 do fluxo da planta: o projeto em 3D, sem enviar nada de novo. A casa vem do passo 1
 * (planta + fotos: medidas, portas e armários; só planta: montada pelas áreas da planta) com a
 * lista e as posições de agora.
 */
export function Project3D({ house, fromPlan, onOpen }: Props) {
  const { rooms, linked, builtIns } = count(house.model)
  return (
    <section class="house-3d-generate" aria-labelledby="house-3d-title">
      <h4 id="house-3d-title">🏠 Casa em 3D</h4>
      <p class="muted">
        {fromPlan
          ? 'Montada pela planta do passo 1 (medidas estimadas pela área de cada cômodo). Para portas de correr, janelas e armários como são, leia a planta com fotos no passo 1.'
          : `Da leitura da planta com ${house.photos} foto(s): medidas da planta, portas, janelas e armários das fotos.`}{' '}
        Abre com a lista e as posições de agora: o que você tirou da lista some e o que você
        arrastou vai junto.
      </p>
      <div class="house-3d-actions">
        <button type="button" class="small-button" onClick={() => onOpen(house)}>
          🏠 Abrir o projeto em 3D
        </button>
      </div>
      <p class="muted" role="status">
        Casa{house.quality === 'realista' ? ' (realista)' : ''}: {rooms} cômodos ({linked} com
        móveis da lista){builtIns ? `, ${builtIns} armário(s) das fotos` : ''}
        {house.costUsd !== undefined ? ` · US$ ${house.costUsd.toFixed(2)}` : ''}.
        {house.model.notes && !fromPlan && ` Atenção: ${house.model.notes}`}
      </p>
    </section>
  )
}
