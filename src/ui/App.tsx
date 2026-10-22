import { useEffect, useState } from 'preact/hooks'
import { buildList, emptyChoices } from '../engine/budget.ts'
import { BudgetForm } from './BudgetForm.tsx'
import { loadCatalog, type Catalog } from './catalog.ts'
import { ListScreen } from './ListScreen.tsx'
import { RoomPicker } from './RoomPicker.tsx'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: Catalog }

interface Session {
  roomId?: string
  budget?: number
  /** Mostra o formulário de orçamento mesmo já tendo um orçamento. */
  editingBudget: boolean
}

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [session, setSession] = useState<Session>({ editingBudget: false })

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
    const changeRoom = () => setSession({ editingBudget: false })

    if (!room) {
      return (
        <RoomPicker
          rooms={rooms}
          onPick={(roomId) => setSession({ roomId, editingBudget: true })}
        />
      )
    }

    if (session.editingBudget || session.budget === undefined) {
      return (
        <BudgetForm
          room={room}
          products={products}
          initial={session.budget}
          onBack={changeRoom}
          onSubmit={(budget) => setSession({ ...session, budget, editingBudget: false })}
        />
      )
    }

    return (
      <ListScreen
        roomName={room.name}
        view={buildList(room, products, session.budget, emptyChoices())}
        onEditBudget={() => setSession({ ...session, editingBudget: true })}
        onChangeRoom={changeRoom}
      />
    )
  }
}
