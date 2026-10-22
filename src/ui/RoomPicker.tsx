import { useState } from 'preact/hooks'
import type { Products, Rooms } from '../data/schema.ts'
import {
  expandHouse,
  MAX_PER_ROOM,
  normalizeSpec,
  roomCount,
  type HouseSpec,
} from '../engine/house.ts'
import { ROOM_CARDS } from './catalog.ts'

interface Props {
  rooms: Rooms
  products: Products
  initial: HouseSpec
  onConfirm: (house: HouseSpec) => void
}

/** "Casa completa": um de cada, menos o quarto do bebê (nem toda casa tem). */
const FULL_HOUSE_EXCLUDES = ['quarto-bebe']

/** Cômodos grandes ocupam duas colunas na planta. */
const WIDE_ROOMS = ['sala', 'cozinha', 'area-externa']

export function RoomPicker({ rooms, products, initial, onConfirm }: Props) {
  const [spec, setSpec] = useState<HouseSpec>(initial)
  const available = ROOM_CARDS.filter(({ id }) => rooms[id])
  const total = roomCount(normalizeSpec(spec, rooms))
  const { instances } = expandHouse(rooms, products, spec)
  const iconOf = (roomId: string) => ROOM_CARDS.find((card) => card.id === roomId)?.icon

  const setCount = (roomId: string, count: number) =>
    setSpec((current) => ({ ...current, [roomId]: Math.max(0, Math.min(MAX_PER_ROOM, count)) }))

  return (
    <section class="picker">
      <h2 class="step-title">Quais cômodos você vai montar?</h2>
      <p class="picker-hint">Pode ser um só. Com vários, o orçamento vale para a casa toda.</p>

      <div
        class={`floor-plan ${instances.length ? '' : 'is-empty'}`}
        role="img"
        aria-label={
          instances.length
            ? `Sua planta: ${instances.map((i) => i.title).join(', ')}`
            : 'Sua planta ainda está vazia'
        }
      >
        {instances.length ? (
          instances.map((instance) => (
            <div
              key={instance.id}
              class={`plan-room ${WIDE_ROOMS.includes(instance.roomId) ? 'is-wide' : ''}`}
            >
              <span aria-hidden="true">{iconOf(instance.roomId)}</span>
              {instance.title}
            </div>
          ))
        ) : (
          <p class="plan-empty">Sua planta aparece aqui</p>
        )}
      </div>

      <div class="picker-presets">
        <button
          type="button"
          class="chip"
          onClick={() =>
            setSpec(
              Object.fromEntries(
                available.map(({ id }) => [id, FULL_HOUSE_EXCLUDES.includes(id) ? 0 : 1]),
              ),
            )
          }
        >
          Casa completa
        </button>
        {total > 0 && (
          <button type="button" class="chip" onClick={() => setSpec({})}>
            Limpar
          </button>
        )}
      </div>

      <ul class="room-rows">
        {ROOM_CARDS.map(({ id, name, icon }) => {
          const room = rooms[id]
          const count = spec[id] ?? 0
          if (!room) {
            return (
              <li key={id} class="room-row is-soon">
                <span class="room-row-icon" aria-hidden="true">
                  {icon}
                </span>
                <span class="room-row-name">{name}</span>
                <span class="room-row-meta">Em breve</span>
              </li>
            )
          }
          return (
            <li key={id} class={`room-row ${count ? 'is-selected' : ''}`}>
              <button
                type="button"
                class="room-row-toggle"
                aria-pressed={count > 0}
                onClick={() => setCount(id, count ? 0 : 1)}
              >
                <span class="room-row-icon" aria-hidden="true">
                  {icon}
                </span>
                <span class="room-row-name">{room.name}</span>
                <span class="room-row-meta">{room.items.length} itens</span>
              </button>
              <div class="stepper" role="group" aria-label={`Quantidade de ${room.name}`}>
                <button
                  type="button"
                  aria-label={`Remover um ${room.name}`}
                  disabled={count === 0}
                  onClick={() => setCount(id, count - 1)}
                >
                  −
                </button>
                <output aria-live="polite">{count}</output>
                <button
                  type="button"
                  aria-label={`Adicionar um ${room.name}`}
                  disabled={count >= MAX_PER_ROOM}
                  onClick={() => setCount(id, count + 1)}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div class="picker-footer">
        <button
          type="button"
          class="primary-button"
          disabled={total === 0}
          onClick={() => onConfirm(normalizeSpec(spec, rooms))}
        >
          {total === 0
            ? 'Escolha pelo menos um cômodo'
            : total === 1
              ? 'Continuar com 1 cômodo'
              : `Continuar com ${total} cômodos`}
        </button>
      </div>
    </section>
  )
}
