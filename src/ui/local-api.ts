/**
 * Backend local da 2ª wave (`npm run server`), que roda as funcionalidades novas com o Claude
 * Code. Só existe em dev: o site publicado não tem esse endereço e não mostra os recursos.
 */
export const LOCAL_API: string | undefined =
  import.meta.env.VITE_LOCAL_API ?? (import.meta.env.DEV ? 'http://localhost:8787' : undefined)

export interface Health {
  floorPlan: boolean
  cheaperPrices: boolean
}

export interface Job<T> {
  id: string
  status: 'running' | 'done' | 'error'
  progress?: { done: number; total: number }
  result?: T
  error?: string
  costUsd?: number
}

/** O backend está rodando? Sem resposta em 2 s, trata como desligado. */
export async function fetchHealth(): Promise<Health | undefined> {
  if (!LOCAL_API) return undefined
  try {
    const response = await fetch(`${LOCAL_API}/api/health`, { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return undefined
    const body = (await response.json()) as Partial<Health>
    return { floorPlan: body.floorPlan === true, cheaperPrices: body.cheaperPrices === true }
  } catch {
    return undefined
  }
}

/** Envia o arquivo e devolve o id do job. Erro do backend vira Error com a mensagem dele. */
export async function startJob(path: string, body: Blob, query: Record<string, string>) {
  if (!LOCAL_API) throw new Error('Backend local desligado.')
  const response = await fetch(`${LOCAL_API}${path}?${new URLSearchParams(query)}`, {
    method: 'POST',
    body,
  }).catch(() => {
    throw new Error('Backend local desligado. Rode npm run server.')
  })
  const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string }
  if (!response.ok || !data.id) throw new Error(data.error ?? 'O backend local recusou o pedido.')
  return data.id
}

const POLL_MS = 2000

/** Acompanha o job até terminar, avisando o progresso. Cancelável pelo `signal`. */
export async function waitForJob<T>(
  id: string,
  onUpdate: (job: Job<T>) => void,
  signal?: AbortSignal,
): Promise<Job<T>> {
  for (;;) {
    const response = await fetch(`${LOCAL_API}/api/jobs/${id}`, { signal }).catch(() => {
      throw new Error('O backend local parou de responder.')
    })
    if (!response.ok) throw new Error('O backend local perdeu a tarefa (foi reiniciado?).')
    const job = (await response.json()) as Job<T>
    onUpdate(job)
    if (job.status !== 'running') return job
    await new Promise((done) => setTimeout(done, POLL_MS))
    if (signal?.aborted) throw new Error('Cancelado.')
  }
}
