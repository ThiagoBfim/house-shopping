import { useEffect, useRef, useState } from 'preact/hooks'
import type { ListView } from '../engine/budget.ts'
import {
  applyMoves,
  chatRequest,
  chatRoom,
  MAX_MESSAGE,
  parseChatReply,
  type ChatAction,
  type ChatMessage,
  type MoveAction,
} from '../engine/chat.ts'
import type { RoomInstance } from '../engine/house.ts'
import { clearPositions, otherItems, type ManualPositions } from '../engine/layout.ts'
import type { SavedPlan } from './floor-plan-store.ts'
import type { SavedHouse } from './house3d-store.ts'
import { startJob, waitForJob } from './local-api.ts'
import { layoutOfTab, roomTabs } from './room-layouts.ts'

interface Props {
  plan: SavedPlan
  view: ListView
  instances: RoomInstance[]
  house?: SavedHouse
  positions: ManualPositions
  onPositions: (positions: ManualPositions) => void
  /** Tira o item da lista (recusar), com a mensagem do aviso. */
  onRemove: (key: string, label: string) => void
}

type Status = 'pending' | 'applied' | 'refused'

interface Entry extends ChatMessage {
  actions?: ChatAction[]
  status?: Status[]
  costUsd?: number
}

const KEY = 'house-shopping:project-chat'
const FACING_TEXT = {
  down: 'frente para baixo',
  up: 'frente para cima',
  left: 'frente para a esquerda',
  right: 'frente para a direita',
}

function readChat(): Entry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter(
          (m): m is Entry =>
            typeof m === 'object' &&
            m !== null &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.text === 'string',
        )
      : []
  } catch {
    return []
  }
}

function saveChat(entries: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-40)))
  } catch {
    // sem localStorage: a conversa vale até recarregar
  }
}

/**
 * Chat do projeto (passo "Posições em 3D"): a pessoa conta o que sabe do imóvel e pede
 * mudanças; a IA (skill /house-chat no backend local) responde vendo o projeto como está na
 * tela e sugere ações. Nada muda sozinho: cada sugestão tem "Aplicar" e passa pela mesma
 * conferência de arrastar (dentro do cômodo, sem bater em móvel, armário ou porta).
 */
export function ProjectChat({
  plan,
  view,
  instances,
  house,
  positions,
  onPositions,
  onRemove,
}: Props) {
  const [entries, setEntries] = useState<Entry[]>(readChat)
  const [text, setText] = useState('')
  const [waiting, setWaiting] = useState<number>()
  const [error, setError] = useState<string>()
  const [now, setNow] = useState(Date.now())
  const end = useRef<HTMLDivElement>(null)
  const { tabs, idsOf } = roomTabs(plan, view, instances, house)
  const context = { plan, view, house, positions, idsOf }

  useEffect(() => saveChat(entries), [entries])
  useEffect(() => end.current?.scrollIntoView?.({ block: 'nearest' }), [entries.length, waiting])
  useEffect(() => {
    if (waiting === undefined) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [waiting])

  const labelOf = (key: string) =>
    view.entries.find((e) => e.item.category === key)?.label ??
    view.manual.find((m) => m.item.id === key)?.item.name ??
    key
  const tabOf = (room: string) => tabs.find((t) => t.tab === room || t.instance?.id === room)

  const describe = (a: ChatAction) => {
    if (a.type === 'remove') return `Tirar ${labelOf(a.key)} da lista`
    const tab = tabOf(a.room)
    const room = tab?.title ?? a.room
    if (a.type === 'reset') return `Voltar ${room} às posições sugeridas`
    return `${labelOf(a.key)} em ${room}: centro a ${a.xCm} × ${a.yCm} cm, ${FACING_TEXT[a.rotation]}`
  }

  /** O móvel ficou onde a ação pediu, com estas posições? (mesma conta da tela) */
  const isAt = (move: MoveAction, next: ManualPositions) => {
    const tab = tabOf(move.room)
    const room = tab && layoutOfTab(tab, { ...context, positions: next })
    const p = room?.layout.placed.find((q) => q.key === move.key && q.unit === move.unit)
    return (
      !!p &&
      Math.abs(p.x + p.w / 2 - move.xCm) <= 1 &&
      Math.abs(p.y + p.d / 2 - move.yCm) <= 1 &&
      p.facing === move.rotation
    )
  }

  /** Aplica uma ou várias ações da mesma resposta (mudanças de lugar conferidas juntas). */
  const apply = (entryIndex: number, actionIndexes: number[]) => {
    const entry = entries[entryIndex]
    const status = [...(entry.status ?? entry.actions!.map(() => 'pending' as Status))]
    let next = positions
    const moves: { index: number; move: MoveAction }[] = []
    for (const index of actionIndexes) {
      const action = entry.actions![index]
      if (action.type === 'remove') {
        onRemove(action.key, labelOf(action.key))
        status[index] = 'applied'
      } else if (action.type === 'reset') {
        const id = tabOf(action.room)?.instance?.id
        if (id) next = clearPositions(next, id)
        status[index] = id ? 'applied' : 'refused'
      } else moves.push({ index, move: action })
    }
    if (moves.length) {
      const result = applyMoves(
        moves.map((m) => m.move),
        next,
        (room) => tabOf(room)?.instance?.id,
        isAt,
      )
      next = result.positions
      moves.forEach(({ index }, i) => (status[index] = result.applied[i] ? 'applied' : 'refused'))
    }
    if (next !== positions) onPositions(next)
    setEntries(entries.map((e, i) => (i === entryIndex ? { ...e, status } : e)))
  }

  const send = async () => {
    const question = text.trim().slice(0, MAX_MESSAGE)
    if (!question || waiting !== undefined) return
    const next = [...entries, { role: 'user' as const, text: question }]
    setEntries(next)
    setText('')
    setError(undefined)
    setWaiting(Date.now())
    setNow(Date.now())
    try {
      const rooms = tabs.flatMap((tab) => {
        const room = layoutOfTab(tab, context)
        if (!room || !tab.instance) return []
        const others =
          tab.part === undefined ? otherItems(view, idsOf(tab.instance.id)).map((o) => o.label) : []
        return [
          chatRoom(
            { id: tab.tab, title: tab.title, estimated: room.size.estimated },
            room.layout,
            room.fixed,
            others,
            view,
          ),
        ]
      })
      const body = chatRequest(
        rooms,
        view,
        next.map(({ role, text }) => ({ role, text })),
      )
      const id = await startJob(
        '/api/chat',
        new Blob([JSON.stringify(body)], { type: 'application/json' }),
        {},
      )
      const job = await waitForJob<unknown>(id, () => {})
      if (job.status === 'error') throw new Error(job.error ?? 'A IA não respondeu.')
      const reply = parseChatReply(job.result)
      if (!reply) throw new Error('A resposta veio num formato inesperado.')
      setEntries([
        ...next,
        {
          role: 'assistant',
          text: reply.reply,
          ...(reply.actions.length && {
            actions: reply.actions,
            status: reply.actions.map(() => 'pending' as Status),
          }),
          ...(job.costUsd !== undefined && { costUsd: job.costUsd }),
        },
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setWaiting(undefined)
    }
  }

  return (
    <section class="project-chat" aria-labelledby="project-chat-title">
      <h4 id="project-chat-title">💬 Converse sobre o projeto</h4>
      <p class="muted">
        Conte o que você sabe do imóvel (onde fica a tomada da TV, o ponto de água, de onde bate o
        sol) e peça mudanças. A IA vê os cômodos, as medidas e os móveis como estão aqui; nada muda
        sem você clicar em "Aplicar".
      </p>
      <div class="chat-log" role="log" aria-live="polite">
        {entries.map((entry, i) => (
          <div key={i} class={`chat-message is-${entry.role}`}>
            <p>{entry.text}</p>
            {entry.actions && (
              <ul class="chat-actions">
                {entry.actions.map((action, j) => {
                  const status = entry.status?.[j] ?? 'pending'
                  return (
                    <li key={j}>
                      <span>{describe(action)}</span>
                      {status === 'pending' ? (
                        <button type="button" class="small-button" onClick={() => apply(i, [j])}>
                          Aplicar
                        </button>
                      ) : (
                        <span class={status === 'applied' ? 'chat-ok' : 'chat-refused'}>
                          {status === 'applied' ? '✓ aplicado' : '✗ não coube nesse lugar'}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {entry.actions && (entry.status ?? []).filter((st) => st === 'pending').length > 1 && (
              <button
                type="button"
                class="small-button chat-apply-all"
                onClick={() =>
                  apply(
                    i,
                    entry.actions!.map((_, j) => j).filter((j) => entry.status?.[j] === 'pending'),
                  )
                }
              >
                Aplicar todas
              </button>
            )}
            {entry.costUsd !== undefined && (
              <span class="muted chat-cost">US$ {entry.costUsd.toFixed(2)}</span>
            )}
          </div>
        ))}
        {waiting !== undefined && (
          <div class="chat-message is-assistant" role="status">
            <p class="muted">Pensando… {Math.round((now - waiting) / 1000)}s</p>
          </div>
        )}
        <div ref={end} />
      </div>
      {error && (
        <p class="notice notice-warn" role="alert">
          {error}
        </p>
      )}
      <form
        class="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <label class="visually-hidden" for="project-chat-input">
          Mensagem
        </label>
        <textarea
          id="project-chat-input"
          rows={2}
          maxLength={MAX_MESSAGE}
          placeholder="Ex.: a tomada da TV fica na parede da janela; dá para virar o sofá?"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <div class="chat-form-actions">
          {entries.length > 0 && (
            <button
              type="button"
              class="link-button"
              disabled={waiting !== undefined}
              onClick={() => setEntries([])}
            >
              Limpar conversa
            </button>
          )}
          <button
            type="submit"
            class="small-button"
            disabled={!text.trim() || waiting !== undefined}
          >
            Enviar
          </button>
        </div>
      </form>
    </section>
  )
}
