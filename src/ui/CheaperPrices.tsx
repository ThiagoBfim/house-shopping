import { useRef, useState } from 'preact/hooks'
import type { Choices, ListView } from '../engine/budget.ts'
import type { AppliedFind, PriceFind, PriceItem } from '../engine/cheaper.ts'
import type { RoomInstance } from '../engine/house.ts'
import { formatBRL } from '../engine/money.ts'
import { searchRows, type SearchRow, type SearchStatus } from '../engine/price-search.ts'
import { startJob, waitForJob } from './local-api.ts'

interface Props {
  view: ListView
  instances: RoomInstance[]
  choices: Choices
  onChoices: (next: Choices, message: string) => void
}

/** Última busca: itens pesquisados e o que saiu de cada um. */
interface Search {
  items: PriceItem[]
  finds: PriceFind[]
  applied: AppliedFind[]
  /** Ofertas melhores que não entraram (limite de itens adicionados). */
  skipped: number
}

/** Guardado no navegador: a última busca e a lista de antes (para "Voltar ao que era antes"). */
interface Saved {
  search: Search
  /** Escolhas antes de aplicar (só quando algo ficou mais barato). */
  before?: Choices
}

const KEY = 'house-shopping:cheaper-search'

function readSaved(): Saved | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    const search = value?.search
    return search && Array.isArray(search.items) && Array.isArray(search.finds) ? value : undefined
  } catch {
    return undefined
  }
}

function save(saved: Saved | undefined) {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved))
    else localStorage.removeItem(KEY)
  } catch {
    // sem localStorage: o resultado e o "voltar" valem até recarregar a página
  }
}

type State =
  | { step: 'idle' }
  | { step: 'searching'; items: PriceItem[]; finds: PriceFind[] }
  | { step: 'error'; message: string }

const COUNTS = [5, 10, 20]

/**
 * "Preços mais baratos": manda os itens mais caros da lista (as linhas do "Baixar Excel") para
 * a skill /search-better-prices no backend local e troca links e preços pelas ofertas menores.
 * A lista dos itens aparece no clique e cada um mostra o andamento e o resultado.
 */
export function CheaperPrices({ view, instances, choices, onChoices }: Props) {
  const total = view.entries.length + view.manual.length
  const [chosen, setCount] = useState(5)
  const count = Math.min(chosen, total)
  const [state, setState] = useState<State>({ step: 'idle' })
  const [saved, setSaved] = useState<Saved | undefined>(readSaved)
  // A busca leva minutos: ao terminar, aplica sobre a lista de agora, não a do início.
  const latest = useRef({ view, choices })
  latest.current = { view, choices }

  const search = async () => {
    // Carregado no clique (como o "Baixar Excel"): não pesa no site de quem não usa.
    const [cheaper, { listRowRefs }] = await Promise.all([
      import('../engine/cheaper.ts'),
      import('../engine/export.ts'),
    ])
    const refs = listRowRefs(view, instances)
    // Os itens mais caros, já lidos (como o passo 0 da skill, que lê a planilha do Excel).
    const items = cheaper.priceItems(view, instances, count)
    setState({ step: 'searching', items, finds: [] })
    try {
      const body = new Blob([JSON.stringify({ items })], { type: 'application/json' })
      const id = await startJob('/api/cheaper-prices', body, {})
      const job = await waitForJob<PriceFind[]>(id, (update) => {
        if (update.partial) setState({ step: 'searching', items, finds: update.partial })
      })
      if (job.status === 'error') throw new Error(job.error ?? 'A busca de preços falhou.')
      const finds = job.result ?? []
      const now = latest.current
      const result = cheaper.applyPriceFinds(now.choices, now.view, refs, finds)
      const next: Saved = {
        search: { items, finds, applied: result.applied, skipped: result.skipped },
        // Uma busca sem nada mais barato mantém o "voltar" da anterior.
        before: result.applied.length ? now.choices : saved?.before,
      }
      setSaved(next)
      save(next)
      setState({ step: 'idle' })
      if (!result.applied.length) return
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
    if (!saved?.before) return
    onChoices(saved.before, 'A lista voltou ao que era antes da busca de preços.')
    setSaved(undefined)
    save(undefined)
  }

  const searching = state.step === 'searching'
  const shown: Search | undefined = searching
    ? { items: state.items, finds: state.finds, applied: [], skipped: 0 }
    : saved?.search
  const rows =
    shown && searchRows(shown.items, shown.finds, { running: searching, applied: shown.applied })
  const saving = shown?.applied.reduce((sum, a) => sum + a.saving, 0) ?? 0
  const done = searching ? state.finds.length : 0

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

      {state.step === 'error' && (
        <p class="notice notice-warn" role="alert">
          {state.message}
        </p>
      )}

      {shown && rows && (
        <div class="price-search">
          <p class="price-search-summary" role="status">
            {searching ? (
              <>
                <progress value={done} max={state.items.length} aria-label="Itens pesquisados" />{' '}
                {done} de {state.items.length} itens pesquisados
              </>
            ) : shown.applied.length ? (
              <>
                <strong>
                  Mais barato em {shown.applied.length} de {shown.items.length}{' '}
                  {shown.items.length === 1 ? 'item' : 'itens'}
                </strong>{' '}
                · economia de <span class="saved-value">{formatBRL(saving)}</span>
              </>
            ) : (
              <>
                Nenhum preço melhor nos {shown.items.length}{' '}
                {shown.items.length === 1 ? 'item pesquisado' : 'itens pesquisados'}.
              </>
            )}
          </p>
          <ol class="price-search-list">
            {rows.map((row) => (
              <PriceRow key={row.item.row} row={row} />
            ))}
          </ol>
          {!searching && shown.skipped > 0 && (
            <p class="muted">
              {shown.skipped} oferta(s) não entraram: limite de itens adicionados na lista.
            </p>
          )}
        </div>
      )}

      {saved?.before && !searching && (
        <button type="button" class="link-button" onClick={revert}>
          ↺ Voltar ao que era antes
        </button>
      )}
    </section>
  )
}

const STATUS_LABELS: Record<SearchStatus, string> = {
  queued: 'Na fila',
  searching: 'Procurando…',
  cheaper: 'Mais barato',
  'no-better': 'Sem preço melhor',
  'not-found': 'Não encontrado',
  'not-applied': 'Não aplicado',
  skipped: 'Não pesquisado',
}

/** Um item pesquisado: nome, preço de agora e o resultado (com os dois anúncios no desconto). */
function PriceRow({ row }: { row: SearchRow }) {
  const { item, status, find, applied } = row
  const newPrice = applied?.now ?? find?.preco
  const newUrl = applied?.url ?? find?.link
  const store = applied?.store ?? find?.loja ?? 'outra loja'
  return (
    <li class={`price-row is-${status}`} aria-busy={status === 'searching' || undefined}>
      <div class="price-row-head">
        <span class="price-row-name">{item.produto}</span>
        <span class={`price-status status-${status}`}>
          {status === 'searching' && <span class="spinner" aria-hidden="true" />}
          {STATUS_LABELS[status]}
        </span>
      </div>
      {status === 'cheaper' && newPrice !== undefined ? (
        <div class="price-compare">
          <span class="price-old">
            Antes: {formatBRL(item.preco)}
            {item.qtd > 1 && <span class="muted"> × {item.qtd}</span>}{' '}
            {item.link && (
              <a href={applied?.wasUrl ?? item.link} target="_blank" rel="noopener noreferrer">
                anúncio anterior ↗
              </a>
            )}
          </span>
          <span class="price-new">
            Agora: <strong>{formatBRL(newPrice)}</strong> em {store}{' '}
            {newUrl && (
              <a href={newUrl} target="_blank" rel="noopener noreferrer nofollow">
                nova oferta ↗
              </a>
            )}
          </span>
          {applied && <span class="saved-value">−{formatBRL(applied.saving)}</span>}
        </div>
      ) : (
        <div class="price-current muted">
          {formatBRL(item.preco)}
          {item.qtd > 1 && <> × {item.qtd}</>}
          {item.link && (
            <>
              {' '}
              ·{' '}
              <a href={item.link} target="_blank" rel="noopener noreferrer">
                anúncio ↗
              </a>
            </>
          )}
          {find?.obs && status !== 'queued' && <span class="price-obs"> · {find.obs}</span>}
        </div>
      )}
    </li>
  )
}
