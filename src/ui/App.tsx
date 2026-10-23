import { useEffect, useState } from 'preact/hooks'
import { applyAnswers, type Answers } from '../engine/assistant.ts'
import {
  budgetPresets,
  describeList,
  emptyChoices,
  planList,
  type Choices,
  type Plan,
  type PresetId,
} from '../engine/budget.ts'
import { diffPlans, displayedTiers, type Change } from '../engine/choices.ts'
import { expandHouse, type HouseSpec } from '../engine/house.ts'
import { keepManualIn } from '../engine/manual.ts'
import { applyPreferences } from '../engine/preferences.ts'
import { formatBRLWhole } from '../engine/money.ts'
import type { ListState } from '../engine/share.ts'
import { BudgetForm } from './BudgetForm.tsx'
import { downloadList } from './download.ts'
import { loadCatalog, type Catalog } from './catalog.ts'
import type { FilterValues } from './Filters.tsx'
import { ListScreen } from './ListScreen.tsx'
import { Assistant, type AssistantNext } from './Assistant.tsx'
import {
  persistState,
  readAnswers,
  readInitialState,
  saveAnswers,
  shareUrl,
} from './persistence.ts'
import { RoomPicker } from './RoomPicker.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { Toast, type ToastMessage } from './Toast.tsx'

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: Catalog }

interface Session {
  /** Cômodos escolhidos e quantidades (um cômodo só = { cozinha: 1 }). */
  house: HouseSpec
  /** Mostra a escolha de cômodos. */
  picking: boolean
  budget?: number
  /** Resultado do último reload. */
  plan: Plan
  choices: Choices
  /** Mostra o formulário de orçamento mesmo já tendo um orçamento. */
  editingBudget: boolean
  /** Mostra o assistente "Monte pra mim". */
  assisting?: boolean
  /** Orçamento sugerido escolhido no assistente (pré-seleciona a tela de orçamento). */
  preset?: PresetId
}

const listState = ({ house, budget, plan, choices }: Session): ListState | undefined =>
  Object.keys(house).length && budget !== undefined ? { house, budget, plan, choices } : undefined

const newSession = (): Session => ({
  house: {},
  picking: true,
  plan: {},
  choices: emptyChoices(),
  editingBudget: false,
})

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [session, setSession] = useState<Session>(newSession())
  /** Escolhas mudaram desde o último reload. */
  const [dirty, setDirty] = useState(false)
  const [changes, setChanges] = useState<Record<string, Change>>({})
  const [toast, setToast] = useState<ToastMessage>()
  /** A lista aberta veio de um link compartilhado. */
  const [shared, setShared] = useState(false)

  /** Restaura a lista da URL (link compartilhado) ou do localStorage. */
  const restore = (catalog: Catalog) => {
    const initial = readInitialState(catalog.rooms)
    if (initial.state) setSession({ ...initial.state, picking: false, editingBudget: false })
    setShared(initial.shared)
    setChanges({})
    setDirty(false)
  }

  const fetchCatalog = () => {
    setLoad({ status: 'loading' })
    loadCatalog()
      .then((catalog) => {
        restore(catalog)
        setLoad({ status: 'ready', catalog })
      })
      .catch(() => setLoad({ status: 'error' }))
  }
  useEffect(fetchCatalog, [])

  // Link colado na mesma aba (o replaceState do persistState não dispara este evento).
  useEffect(() => {
    if (load.status !== 'ready') return
    const onHashChange = () => restore(load.catalog)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [load])

  useEffect(() => {
    if (load.status === 'ready') persistState(listState(session))
  }, [session, load])

  return (
    <>
      <header class="app-header">
        <div class="container">
          <h1 class="brand">
            <img class="brand-icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
            House Shopping
          </h1>
          <p class="tagline">Sua lista de compras por cômodo, dentro do orçamento.</p>
          <ThemeToggle />
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

    const { rooms, assistant } = load.catalog

    if (session.assisting) {
      const finish = (answers: Answers, next: AssistantNext) => {
        saveAnswers(answers)
        const previous = listState(session) && { ...session, assisting: false }
        const result = applyAnswers(assistant, answers, rooms)
        // Itens adicionados pelo usuário seguem nos cômodos que continuam na casa.
        const choices = keepManualIn(
          { ...result.choices, manual: session.choices.manual },
          expandHouse(rooms, {}, result.house).instances.map((instance) => instance.id),
        )
        if (!Object.keys(result.house).length) {
          // Sem as perguntas da casa: segue o fluxo normal a partir da escolha de cômodos.
          setSession({ ...newSession(), choices, preset: result.preset })
          return
        }
        const expanded = expandHouse(rooms, load.catalog.products, result.house)
        const custom = applyPreferences(expanded.room, expanded.products, choices)
        const presetId = result.preset ?? 'equilibrado'
        const budget = budgetPresets(custom.room, custom.products, choices).find(
          (p) => p.id === presetId,
        )!.value
        setSession({
          house: result.house,
          picking: false,
          budget,
          choices,
          plan: next === 'list' ? planList(custom.room, custom.products, budget, choices) : {},
          editingBudget: next === 'budget',
          preset: presetId,
        })
        setChanges({})
        setDirty(false)
        setShared(false)
        if (previous) {
          setToast({
            message: 'Lista montada com as suas respostas.',
            action: { label: 'Desfazer', run: () => setSession(previous) },
          })
        }
      }
      return (
        <Assistant
          assistant={assistant}
          rooms={rooms}
          initial={readAnswers()}
          onFinish={finish}
          onSkipAll={(answers) =>
            Object.keys(answers).length
              ? finish(answers, 'budget')
              : setSession({ ...session, assisting: false })
          }
        />
      )
    }

    const house = expandHouse(rooms, load.catalog.products, session.house)
    // Variantes e necessidades ajustadas valem para tudo o que o motor calcula.
    const { room, products } = applyPreferences(house.room, house.products, session.choices)

    const changeRooms = () => {
      setSession({ ...session, picking: true })
      setChanges({})
      setDirty(false)
      setShared(false)
    }

    if (session.picking || !house.instances.length) {
      return (
        <RoomPicker
          rooms={rooms}
          products={load.catalog.products}
          initial={session.house}
          onAssistant={() => setSession({ ...session, assisting: true })}
          onConfirm={(spec) => {
            // Itens de cômodos removidos ficam nas escolhas, mas o motor os ignora. Os
            // adicionados pelo usuário saem junto com o cômodo (com "Desfazer").
            const choices = keepManualIn(
              session.choices,
              expandHouse(rooms, {}, spec).instances.map((instance) => instance.id),
            )
            const lost = session.choices.manual.length - choices.manual.length
            const previous = session
            setSession({ ...session, house: spec, choices, picking: false, editingBudget: true })
            if (lost) {
              setToast({
                message: `${lost === 1 ? '1 item adicionado por você saiu' : `${lost} itens adicionados por você saíram`} junto com o cômodo.`,
                action: { label: 'Desfazer', run: () => setSession(previous) },
              })
            }
          }}
        />
      )
    }

    if (session.editingBudget || session.budget === undefined) {
      return (
        <BudgetForm
          room={room}
          products={products}
          initial={session.budget}
          initialPreset={session.preset}
          initialFilters={{
            minNeed: session.choices.minNeed,
            utensils: session.choices.utensils,
            helpers: session.choices.helpers,
          }}
          onBack={changeRooms}
          onSubmit={(budget, filters) => {
            const choices = { ...session.choices, ...filters }
            setSession({
              ...session,
              budget,
              choices,
              plan: planList(room, products, budget, choices),
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

    /** Recalcula o plano (reload) e destaca o que mudou na lista exibida. */
    const replan = (nextChoices: Choices) => {
      const nextPlan = planList(room, products, budget, nextChoices)
      const nextView = describeList(room, products, budget, nextPlan, nextChoices)
      const diff = diffPlans(displayedTiers(view), displayedTiers(nextView))
      setSession({ ...session, choices: nextChoices, plan: nextPlan })
      setChanges(diff)
      setDirty(false)
      const count = Object.keys(diff).length
      return count ? `${count} ${count === 1 ? 'item mudou' : 'itens mudaram'}` : 'nada mudou'
    }

    const reload = () => setToast({ message: `Lista recalculada: ${replan(choices)}.` })

    const applyFilters = (filters: FilterValues) => {
      const previous = { choices, plan }
      setToast({
        message: `Filtros aplicados: ${replan({ ...choices, ...filters })}.`,
        action: {
          label: 'Desfazer',
          run: () => {
            setSession((current) => ({ ...current, ...previous }))
            setChanges({})
          },
        },
      })
    }

    const url = shareUrl(listState(session)!)
    const shareText = `Minha lista (${room.name}) no House Shopping: ${formatBRLWhole(view.total)} de ${formatBRLWhole(budget)}.`

    return (
      <>
        {shared && (
          <div class="notice shared-banner" role="note">
            <span>
              <strong>Lista compartilhada.</strong> Ajuste à vontade: suas mudanças não alteram a
              lista de quem enviou.
            </span>
            <button
              type="button"
              class="link-button"
              aria-label="Fechar aviso"
              onClick={() => setShared(false)}
            >
              ✕
            </button>
          </div>
        )}
        <ListScreen
          roomName={room.name}
          instances={house.instances}
          view={view}
          choices={choices}
          changes={changes}
          dirty={dirty}
          onChoices={updateChoices}
          onReload={reload}
          onFilters={applyFilters}
          onEditBudget={() => setSession({ ...session, editingBudget: true })}
          onAssistant={() => setSession({ ...session, assisting: true })}
          onChangeRoom={changeRooms}
          share={{
            url,
            text: shareText,
            onCopied: (ok) =>
              setToast({
                message: ok
                  ? 'Link copiado!'
                  : 'Não foi possível copiar. Copie o endereço da barra.',
              }),
            onExport: () =>
              downloadList(view, house.instances).then(
                () => setToast({ message: 'Planilha baixada.' }),
                () => setToast({ message: 'Não foi possível gerar a planilha. Tente de novo.' }),
              ),
          }}
        />
      </>
    )
  }
}
