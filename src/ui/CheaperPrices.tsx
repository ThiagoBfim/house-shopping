import { useRef, useState } from 'preact/hooks'
import type { Choices, ListView } from '../engine/budget.ts'
import type { AppliedFind, PriceFind } from '../engine/cheaper.ts'
import type { RoomInstance } from '../engine/house.ts'
import { formatBRL } from '../engine/money.ts'
import { startJob, waitForJob, type Job } from './local-api.ts'

interface Props {
  view: ListView
  instances: RoomInstance[]
  choices: Choices
  onChoices: (next: Choices, message: string) => void
}

/** Lista antes da última busca aplicada (para "Voltar ao que era antes"), só neste navegador. */
interface Before {
  choices: Choices
  applied: AppliedFind[]
}

const BEFORE_KEY = 'house-shopping:before-cheaper'

function readBefore(): Before | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(BEFORE_KEY) ?? 'null') as Before | null
    return value?.choices && Array.isArray(value.applied) ? value : undefined
  } catch {
    return undefined
  }
}

function saveBefore(before: Before | undefined) {
  try {
    if (before) localStorage.setItem(BEFORE_KEY, JSON.stringify(before))
    else localStorage.removeItem(BEFORE_KEY)
  } catch {
    // sem localStorage: o "voltar" vale até recarregar a página
  }
}

type State =
  | { step: 'idle' }
  | { step: 'searching'; done: number; total: number }
  | { step: 'error'; message: string }

const COUNTS = [5, 10, 20]

/**
 * "Preços mais baratos": manda os itens mais caros da lista (as linhas do "Baixar Excel") para
 * a skill /search-better-prices no backend local e troca links e preços pelas ofertas menores.
 */
export function CheaperPrices({ view, instances, choices, onChoices }: Props) {
  const total = view.entries.length + view.manual.length
  const [chosen, setCount] = useState(5)
  const count = Math.min(chosen, total)
  const [state, setState] = useState<State>({ step: 'idle' })
  const [before, setBefore] = useState<Before | undefined>(readBefore)
  const [last, setLast] = useState<{ applied: AppliedFind[]; skipped: number; searched: number }>()
  // A busca leva minutos: ao terminar, aplica sobre a lista de agora, não a do início.
  const latest = useRef({ view, choices })
  latest.current = { view, choices }

  const search = async () => {
    // Carregado só aqui (como o "Baixar Excel"): não pesa no site de quem não usa.
    const [{ applyPriceFinds, priceItems }, { listRowRefs }] = await Promise.all([
      import('../engine/cheaper.ts'),
      import('../engine/export.ts'),
    ])
    const refs = listRowRefs(view, instances)
    // Os itens mais caros, já lidos (como o passo 0 da skill, que lê a planilha do Excel).
    const items = priceItems(view, instances, count)
    const body = new Blob([JSON.stringify({ items })], { type: 'application/json' })
    setState({ step: 'searching', done: 0, total: count })
    setLast(undefined)
    try {
      const id = await startJob('/api/cheaper-prices', body, {})
      const job = await waitForJob<PriceFind[]>(id, (update: Job<PriceFind[]>) => {
        if (update.progress) setState({ step: 'searching', ...update.progress })
      })
      if (job.status === 'error') throw new Error(job.error ?? 'A busca de preços falhou.')
      const now = latest.current
      const result = applyPriceFinds(now.choices, now.view, refs, job.result ?? [])
      const searched = job.result?.length ?? 0
      setState({ step: 'idle' })
      setLast({ applied: result.applied, skipped: result.skipped, searched })
      if (!result.applied.length) return
      const saved = { choices: now.choices, applied: result.applied }
      setBefore(saved)
      saveBefore(saved)
      const saving = result.applied.reduce((sum, a) => sum + a.saving, 0)
      onChoices(
        result.choices,
        `${result.applied.length} ${result.applied.length === 1 ? 'item ficou mais barato' : 'itens ficaram mais baratos'}: economia de ${formatBRL(saving)}.`,
      )
    } catch (error) {
      setState({ step: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const revert = () => {
    if (!before) return
    onChoices(before.choices, 'A lista voltou ao que era antes da busca de preços.')
    setBefore(undefined)
    saveBefore(undefined)
    setLast(undefined)
  }

  const searching = state.step === 'searching'
  const saving = last?.applied.reduce((sum, a) => sum + a.saving, 0) ?? 0

  return (
    <section class="cheaper-prices side-section" aria-labelledby="cheaper-title">
      <h3 id="cheaper-title">🔎 Preços mais baratos</h3>
      <p class="muted">
        Procura os itens mais caros da lista em outras lojas (Google + página da loja) e troca link
        e preço quando acha o mesmo produto mais barato. Leva cerca de 1 minuto por item.
      </p>
      <div class="cheaper-controls">
        <label>
          Buscar{' '}
          <select
            value={count}
            disabled={searching}
            onChange={(e) => setCount(Number(e.currentTarget.value))}
          >
            {[...COUNTS.filter((n) => n < total), total].map((n) => (
              <option key={n} value={n}>
                {n === total ? `todos os ${n}` : `os ${n} mais caros`}
              </option>
            ))}
          </select>
        </label>
        <button type="button" class="small-button" disabled={searching || !total} onClick={search}>
          {searching ? 'Procurando…' : 'Buscar preços mais baratos'}
        </button>
      </div>
      {searching && (
        <p role="status">
          <progress value={state.done} max={state.total} aria-label="Itens pesquisados" />{' '}
          {state.done} de {state.total} itens pesquisados
        </p>
      )}
      {state.step === 'error' && (
        <p class="notice notice-warn" role="alert">
          {state.message}
        </p>
      )}
      {last && (
        <div class="notice" role="status">
          {last.applied.length ? (
            <>
              <p>
                <strong>
                  {last.applied.length} de {last.searched}{' '}
                  {last.searched === 1 ? 'item ficou' : 'itens ficaram'} mais baratos
                </strong>{' '}
                · economia de {formatBRL(saving)}
              </p>
              <ul class="compact-list">
                {last.applied.map((a) => (
                  <li key={a.name}>
                    <span>
                      {a.name}
                      <span class="muted">
                        {' '}
                        · {a.store}: {formatBRL(a.now)} (era {formatBRL(a.was)})
                      </span>
                    </span>
                    <span class="saved-value">−{formatBRL(a.saving)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              Nenhum preço melhor nos {last.searched} {last.searched === 1 ? 'item' : 'itens'}{' '}
              pesquisados.
            </p>
          )}
          {last.skipped > 0 && (
            <p class="muted">
              {last.skipped} oferta(s) não entraram: limite de itens adicionados na lista.
            </p>
          )}
        </div>
      )}
      {before && !searching && (
        <button type="button" class="link-button" onClick={revert}>
          ↺ Voltar ao que era antes ({before.applied.length}{' '}
          {before.applied.length === 1 ? 'item' : 'itens'})
        </button>
      )}
    </section>
  )
}
