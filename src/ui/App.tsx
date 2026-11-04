import { useEffect, useState } from 'preact/hooks'
import { applyAnswers, reapplyAnswers, type Answers } from '../engine/assistant.ts'
import {
  budgetPresets,
  describeList,
  emptyChoices,
  planList,
  type Choices,
  type Plan,
  type PresetId,
} from '../engine/budget.ts'
import {
  diffPlans,
  displayedTiers,
  summarizeChanges,
  type Change,
  type ChangeSummary,
} from '../engine/choices.ts'
import { expandHouse, type HouseSpec } from '../engine/house.ts'
import { keepManualIn } from '../engine/manual.ts'
import { applyPreferences } from '../engine/preferences.ts'
import { formatBRLWhole } from '../engine/money.ts'
import type { Question } from '../data/schema.ts'
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
import { readFeatures, saveFeatures, type Features } from './features.ts'
import { linkPlanRooms, withoutBedVariants, type ReadPlan } from '../engine/floor-plan.ts'
import { FloorPlanUpload } from './FloorPlanUpload.tsx'
import { readSavedPlan, savePlan, type SavedPlan } from './floor-plan-store.ts'
import { saveHouse, type SavedHouse } from './house3d-store.ts'
import { Footer } from './Footer.tsx'
import { LabsPanel } from './LabsPanel.tsx'
import { fetchHealth, type Health } from './local-api.ts'
import { canShorten } from './shortener.ts'
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
  /** Respostas do assistente que montaram a lista (painel "Suas respostas"). */
  answers?: Answers
}

const listState = ({ house, budget, plan, choices, answers }: Session): ListState | undefined =>
  Object.keys(house).length && budget !== undefined
    ? { house, budget, plan, choices, ...(answers && { answers }) }
    : undefined

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
  /** Backend local (2ª wave) rodando; ausente = recursos em teste escondidos. */
  const [health, setHealth] = useState<Health>()
  const [features, setFeatures] = useState<Features>(readFeatures)
  useEffect(() => void fetchHealth().then(setHealth), [])
  /** Recurso em teste ligado e disponível no backend local. */
  const enabled = (feature: keyof Features) => Boolean(health?.[feature] && features[feature])
  /** Planta lida (desenho na lista) e chave para recriar a escolha de cômodos com ela. */
  const [floorPlan, setFloorPlan] = useState<SavedPlan | undefined>(readSavedPlan)
  const [pickerKey, setPickerKey] = useState(0)
  const changeFeatures = (next: Features) => {
    setFeatures(next)
    saveFeatures(next)
  }

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
      <main class="container">
        {health && <LabsPanel health={health} features={features} onChange={changeFeatures} />}
        {renderStep()}
      </main>
      <Footer />
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
          setSession({ ...newSession(), choices, preset: result.preset, answers })
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
          answers,
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
          initial={session.answers ?? readAnswers()}
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
      const readPlan = (plan: ReadPlan, fileName: string, house?: SavedHouse) => {
        // A casa da planta vai para a escolha de cômodos; a pessoa confere e continua.
        setSession({
          ...session,
          house: plan.house,
          picking: true,
          choices: {
            ...session.choices,
            // Camas de uma leitura anterior saem: com outro tipo de cômodo, os quartos mudam de número.
            variants: { ...withoutBedVariants(session.choices.variants), ...plan.variants },
          },
        })
        setPickerKey((key) => key + 1)
        const saved = { fileName, aspect: plan.aspect, rooms: plan.rooms }
        setFloorPlan(saved)
        savePlan(saved)
        // Leitura com fotos já é a casa em metros; leitura rápida apaga a casa de outra leitura.
        saveHouse(house)
      }
      return (
        <>
          {enabled('floorPlan') && <FloorPlanUpload rooms={rooms} onRead={readPlan} />}
          <RoomPicker
            key={pickerKey}
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
        </>
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
    // Saldo que o "Recalcular" consegue usar (o reload muda alguma coisa na lista).
    const fullView = describeList(
      room,
      products,
      budget,
      planList(room, products, budget, choices),
      choices,
    )
    const spare =
      view.remaining >= 1 &&
      Object.keys(diffPlans(displayedTiers(view), displayedTiers(fullView))).length
        ? view.remaining
        : undefined

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

    /**
     * Saldo que a pessoa liberou (recusou itens, marcou "já tenho") fica guardado: filtros e
     * respostas replanejam sem passar do total atual. Só o "Recalcular" usa o orçamento todo.
     */
    const keepSpare = Math.min(budget, view.total)

    /** Recalcula o plano (reload) e destaca o que mudou na lista exibida. */
    const replan = (nextChoices: Choices, limit = budget) => {
      const nextPlan = planList(room, products, limit, nextChoices)
      const nextView = describeList(room, products, budget, nextPlan, nextChoices)
      const diff = diffPlans(displayedTiers(view), displayedTiers(nextView))
      setSession({ ...session, choices: nextChoices, plan: nextPlan })
      setChanges(diff)
      setDirty(false)
      return nextView
    }

    /** Volta a lista ao que era antes de um recálculo (aviso com "Desfazer"). */
    const undoTo = () => {
      const previous = { choices, plan }
      const wasDirty = dirty
      return {
        label: 'Desfazer',
        run: () => {
          setSession((current) => ({ ...current, ...previous }))
          setChanges({})
          setDirty(wasDirty)
        },
      }
    }

    const reload = () => {
      const action = undoTo()
      const summary = summarizeChanges(view, replan(choices))
      setToast({ message: `Lista recalculada: ${reloadText(summary)}.`, action })
    }

    /** Painel "Suas respostas": troca uma resposta e refaz a lista mantendo os ajustes à mão. */
    const changeAnswer = (question: Question, ids: string[]) => {
      const answers = { ...session.answers }
      if (ids.length) answers[question.id] = ids
      else delete answers[question.id]
      const result = reapplyAnswers(assistant, rooms, session.answers ?? {}, answers, {
        house: session.house,
        choices,
      })
      const nextHouse = expandHouse(rooms, load.catalog.products, result.house)
      const nextChoices = keepManualIn(
        result.choices,
        nextHouse.instances.map((instance) => instance.id),
      )
      const custom = applyPreferences(nextHouse.room, nextHouse.products, nextChoices)
      const nextBudget = result.preset
        ? budgetPresets(custom.room, custom.products, nextChoices).find(
            (p) => p.id === result.preset,
          )!.value
        : budget
      // Casa ou orçamento novos: usa o orçamento todo. Senão, guarda o saldo (ver keepSpare).
      const sameHouse = JSON.stringify(result.house) === JSON.stringify(session.house)
      const limit = result.preset || !sameHouse ? nextBudget : keepSpare
      const nextPlan = planList(custom.room, custom.products, limit, nextChoices)
      const nextView = describeList(custom.room, custom.products, nextBudget, nextPlan, nextChoices)
      const diff = diffPlans(displayedTiers(view), displayedTiers(nextView))
      const previous = session
      saveAnswers(answers)
      setSession({
        ...session,
        house: result.house,
        budget: nextBudget,
        plan: nextPlan,
        choices: nextChoices,
        answers,
        preset: result.preset ?? session.preset,
      })
      setChanges(diff)
      setDirty(false)
      const picked = question.answers.filter((a) => ids.includes(a.id)).map((a) => a.label)
      const count = Object.keys(diff).length
      setToast({
        message: `${question.short}: ${picked.length ? picked.join(', ') : 'sem resposta'}. ${
          count ? `${count} ${count === 1 ? 'item mudou' : 'itens mudaram'}` : 'Nada mudou'
        }.`,
        action: {
          label: 'Desfazer',
          run: () => {
            saveAnswers(previous.answers ?? {})
            setSession(previous)
            setChanges({})
          },
        },
      })
    }

    const applyFilters = (filters: FilterValues) => {
      const action = undoTo()
      const nextView = replan({ ...choices, ...filters }, keepSpare)
      const summary = summarizeChanges(view, nextView)
      setToast({
        message: `Filtros aplicados: ${filterChangeText(summary)}${
          nextView.remaining >= 100
            ? `. Saldo de ${formatBRLWhole(nextView.remaining)} guardado`
            : ''
        }.`,
        action,
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
          spare={spare}
          onChoices={updateChoices}
          onReload={reload}
          onFilters={applyFilters}
          onEditBudget={() => setSession({ ...session, editingBudget: true })}
          onAssistant={() => setSession({ ...session, assisting: true })}
          onChangeRoom={changeRooms}
          answers={{
            assistant,
            house: session.house,
            answers: session.answers ?? {},
            onChange: changeAnswer,
          }}
          cheaperPrices={enabled('cheaperPrices')}
          house3d={health?.house3d ? { rooms } : undefined}
          chat={health?.chat === true}
          floorPlan={
            // Religada aos cômodos de agora (mudou a quantidade ou o tipo depois de ler a planta).
            enabled('floorPlan') && floorPlan
              ? (() => {
                  const linked = {
                    ...floorPlan,
                    rooms: linkPlanRooms(
                      floorPlan.rooms,
                      house.instances.map((i) => i.id),
                    ),
                  }
                  return linked.rooms.some((r) => r.instanceId) ? linked : undefined
                })()
              : undefined
          }
          share={{
            url,
            text: shareText,
            onCopied: (ok, short) =>
              setToast({
                message: ok
                  ? short
                    ? 'Link curto copiado!'
                    : canShorten(url)
                      ? 'Link copiado!'
                      : 'Link copiado! (lista grande demais para o link curto)'
                  : 'Não foi possível copiar. Copie o endereço da barra.',
              }),
            onMessage: (message) => setToast({ message }),
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

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`

/**
 * Ex.: "11 itens melhoraram; +2 itens (R$ 640); usou R$ 7.900 do saldo". Mesmo detalhe do
 * aviso dos filtros, contado do ponto de vista do recálculo (que usa o saldo).
 */
function reloadText(s: ChangeSummary): string {
  const parts: string[] = []
  if (s.pricier) parts.push(`${items(s.pricier)} ${s.pricier === 1 ? 'melhorou' : 'melhoraram'}`)
  if (s.added) parts.push(`+${items(s.added)} (${formatBRLWhole(s.addedCost)})`)
  if (s.cheaper)
    parts.push(
      `${items(s.cheaper)} ${s.cheaper === 1 ? 'ficou mais barato' : 'ficaram mais baratos'}`,
    )
  if (s.removed) parts.push(`saíram ${items(s.removed)} (${formatBRLWhole(s.removedCost)})`)
  if (!parts.length) return 'nada mudou'
  if (s.totalDelta >= 1) parts.push(`usou ${formatBRLWhole(s.totalDelta)} do saldo`)
  else if (s.totalDelta <= -1) parts.push(`liberou ${formatBRLWhole(-s.totalDelta)}`)
  return parts.join('; ')
}

/**
 * Ex.: "+40 itens (R$ 3.110); para caber no orçamento, saíram 4 itens (R$ 3.007) e 2 itens
 * ficaram mais baratos". Explica por que o total quase não muda: o orçamento é o mesmo.
 */
function filterChangeText(s: ChangeSummary): string {
  const parts: string[] = []
  if (s.added) parts.push(`+${items(s.added)} (${formatBRLWhole(s.addedCost)})`)
  const out = s.removed ? `saíram ${items(s.removed)} (${formatBRLWhole(s.removedCost)})` : ''
  const cheaper = s.cheaper ? `${items(s.cheaper)} ficaram mais baratos` : ''
  const fit = [out, cheaper].filter(Boolean).join(' e ')
  if (fit) parts.push(s.added ? `para caber no orçamento, ${fit}` : fit)
  if (s.pricier) {
    parts.push(
      s.removed
        ? `com o que sobrou, ${items(s.pricier)} melhoraram`
        : `${items(s.pricier)} melhoraram`,
    )
  }
  return parts.length ? parts.join('; ') : 'nada mudou'
}
