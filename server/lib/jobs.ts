/** Tarefas demoradas (planta ~1 min, preços vários minutos): o site inicia e acompanha. */
export type JobKind = 'floor-plan' | 'cheaper-prices'

export interface Job {
  id: string
  kind: JobKind
  status: 'running' | 'done' | 'error'
  startedAt: string
  finishedAt?: string
  /** Itens já processados (preços mais baratos). */
  progress?: { done: number; total: number }
  result?: unknown
  error?: string
  /** Gasto da execução no Claude Code, em dólares (para precificar a cobrança). */
  costUsd?: number
}

export interface JobOutcome {
  result?: unknown
  error?: string
  costUsd?: number
}

/** Jobs guardados na memória do servidor; os mais antigos saem acima do limite. */
const MAX_JOBS = 50

export class JobStore {
  private jobs = new Map<string, Job>()
  private next = 0
  private now: () => Date
  private newId: () => string

  constructor(options: { now?: () => Date; newId?: () => string } = {}) {
    this.now = options.now ?? (() => new Date())
    this.newId = options.newId ?? (() => `job${++this.next}`)
  }

  /** Começa um job; `run` recebe uma função para informar o progresso. */
  start(
    kind: JobKind,
    run: (progress: (done: number, total: number) => void) => Promise<JobOutcome>,
  ): Job {
    const job: Job = { id: this.newId(), kind, status: 'running', startedAt: this.stamp() }
    this.jobs.set(job.id, job)
    for (const id of [...this.jobs.keys()].slice(0, Math.max(0, this.jobs.size - MAX_JOBS))) {
      this.jobs.delete(id)
    }
    const finish = (outcome: JobOutcome) => {
      Object.assign(job, outcome, {
        status: outcome.error ? 'error' : 'done',
        finishedAt: this.stamp(),
      })
    }
    run((done, total) => (job.progress = { done, total })).then(finish, (error: unknown) =>
      finish({ error: error instanceof Error ? error.message : String(error) }),
    )
    return job
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id)
  }

  /** Já há um job deste tipo rodando (só um por vez: cada um ocupa o Claude Code). */
  isRunning(kind: JobKind): boolean {
    return [...this.jobs.values()].some((job) => job.kind === kind && job.status === 'running')
  }

  private stamp(): string {
    return this.now().toISOString()
  }
}

/** Só o site rodando na própria máquina chama o backend. */
export function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1')
  } catch {
    return false
  }
}
