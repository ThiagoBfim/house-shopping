import { useEffect, useState } from 'preact/hooks'
import { describeList, emptyChoices, planList, type Choices, type Plan } from '../engine/budget.ts'
import { diffPlans, displayedTiers, type Change } from '../engine/choices.ts'
import { BudgetForm } from './BudgetForm.tsx'
import { loadCatalog, type Catalog } from './catalog.ts'
import { ListScreen } from './ListScreen.tsx'
import { RoomPicker } from './RoomPicker.tsx'
import { Toast, type ToastMessage } from './Toast.tsx'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: Catalog }

interface Session {
  roomId?: string
  budget?: number
  /** Resultado do último reload. */
  plan: Plan
  choices: Choices
  /** Mostra o formulário de orçamento mesmo já tendo um orçamento. */
  editingBudget: boolean
}

const newSession = (roomId?: string): Session => ({
  roomId,
  plan: {},
  choices: emptyChoices(),
  editingBudget: roomId !== undefined,
})

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [session, setSession] = useState<Session>(newSession())
  /** Escolhas mudaram desde o último reload. */
  const [dirty, setDirty] = useState(false)
  const [changes, setChanges] = useState<Record<string, Change>>({})
  const [toast, setToast] = useState<ToastMessage>()

  const fetchCatalog = () => {
    setLoad({ status: 'loading' })
    loadCatalog()
      .then((catalog) => setLoad({ status: 'ready', catalog }))
      .catch(() => setLoad({ status: 'error' }))
  }
  useEffect(fetchCatalog, [])

  return (
    <>
      <header class="app-header">
        <div class="container">
          <h1 class="brand">
            <span aria-hidden="true">🏠</span> House Shopping
          </h1>
          <p class="tagline">Sua lista de compras por cômodo, dentro do orçamento.</p>
        </div>
      </header>
      <main class="container">{renderStep()}</main>
      {toast && <Toast toast={toast} onClose={() => setToast(undefined)} />}
    </>
  )

  function renderStep() {
    if (load.status === 'loading') return <p class="empty-state">Carregando catálogo…</p>
    if (load.status === 'error') {
      return (
        <div class="empty-state">
          <p>Não foi possível carregar o catálogo.</p>
          <button type="button" class="primary-button" onClick={fetchCatalog}>
            Tentar de novo
          </button>
        </div>
      )
    }

    const { rooms, products } = load.catalog
    const room = session.roomId ? rooms[session.roomId] : undefined

    const changeRoom = () => {
      setSession(newSession())
      setChanges({})
      setDirty(false)
    }

    if (!room) {
      return <RoomPicker rooms={rooms} onPick={(roomId) => setSession(newSession(roomId))} />
    }

    if (session.editingBudget || session.budget === undefined) {
      return (
        <BudgetForm
          room={room}
          products={products}
          initial={session.budget}
          onBack={changeRoom}
          onSubmit={(budget) => {
            setSession({
              ...session,
              budget,
              plan: planList(room, products, budget, session.choices),
              editingBudget: false,
            })
            setChanges({})
            setDirty(false)
          }}
        />
      )
    }

    const { budget, plan, choices } = session
    const view = describeList(room, products, budget, plan, choices)

    const updateChoices = (next: Choices, message: string, include?: Plan) => {
      const previous = { choices, plan }
      // O tier que o item já tinha no plano tem precedência sobre o de `include`.
      setSession({ ...session, choices: next, plan: { ...include, ...plan } })
      setDirty(true)
      setChanges({})
      setToast({
        message,
        action: {
          label: 'Desfazer',
          run: () => setSession((current) => ({ ...current, ...previous })),
        },
      })
    }

    const reload = () => {
      const nextPlan = planList(room, products, budget, choices)
      const nextView = describeList(room, products, budget, nextPlan, choices)
      const diff = diffPlans(displayedTiers(view), displayedTiers(nextView))
      setSession({ ...session, plan: nextPlan })
      setChanges(diff)
      setDirty(false)
      const count = Object.keys(diff).length
      setToast({
        message: count
          ? `Lista recalculada: ${count} ${count === 1 ? 'item mudou' : 'itens mudaram'}.`
          : 'Lista recalculada: nada mudou.',
      })
    }

    return (
      <ListScreen
        roomName={room.name}
        view={view}
        choices={choices}
        changes={changes}
        dirty={dirty}
        onChoices={updateChoices}
        onReload={reload}
        onEditBudget={() => setSession({ ...session, editingBudget: true })}
        onChangeRoom={changeRoom}
      />
    )
  }
}
