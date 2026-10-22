import type { Rooms } from '../data/schema.ts'
import { ROOM_CARDS } from './catalog.ts'

interface Props {
  rooms: Rooms
  onPick: (roomId: string) => void
}

export function RoomPicker({ rooms, onPick }: Props) {
  return (
    <section>
      <h2 class="step-title">Qual cômodo você vai montar?</h2>
      <div class="room-grid">
        {ROOM_CARDS.map(({ id, name, icon }) => {
          const room = rooms[id]
          return (
            <button
              key={id}
              type="button"
              class="room-card"
              disabled={!room}
              onClick={() => onPick(id)}
            >
              <span class="room-icon" aria-hidden="true">
                {icon}
              </span>
              <span class="room-name">{room?.name ?? name}</span>
              <span class="room-meta">{room ? `${room.items.length} itens` : 'Em breve'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
