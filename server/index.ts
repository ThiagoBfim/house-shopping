/**
 * Backend local da 2ª wave: roda as funcionalidades novas com o Claude Code da máquina.
 * Uso: npm run server (http://127.0.0.1:8787). Só aceita chamadas do site em localhost.
 *
 * - POST /api/floor-plan?name=planta.pdf   corpo = arquivo  → { id } (skill /floor-plan)
 * - POST /api/cheaper-prices   corpo = { items } (itens.json) → { id } (skill /search-better-prices)
 * - GET  /api/jobs/:id                                       → Job
 * - GET  /api/health                                         → o que está disponível
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { claudeArgs, parseClaudeOutput, type ClaudeRun } from './lib/claude.ts'
import { isLocalOrigin, JobStore, type JobOutcome } from './lib/jobs.ts'
import { FLOOR_PLAN_SCHEMA, parsePriceFinds, parsePriceItems } from './lib/skills.ts'

const ROOT = resolve(import.meta.dirname, '..')
const PORT = Number(process.env.HOUSE_API_PORT ?? 8787)
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude'
const MODEL = process.env.CLAUDE_MODEL
const PRICES_SKILL = join(ROOT, '.claude/skills/search-better-prices/SKILL.md')
const MAX_UPLOAD = 15 * 1024 * 1024
const PLAN_TYPES: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.webp': 'webp',
  '.gif': 'gif',
  '.pdf': 'pdf',
}

const jobs = new JobStore({ newId: () => crypto.randomUUID().slice(0, 8) })

/** Pasta temporária de cada job (arquivo enviado e o que a skill grava). */
async function jobDir(kind: string): Promise<string> {
  const base = join(tmpdir(), 'house-shopping-jobs')
  await mkdir(base, { recursive: true })
  return mkdtemp(join(base, `${kind}-`))
}

/** Roda `claude -p` na raiz do projeto (as skills de .claude/skills ficam disponíveis). */
function runClaude(run: ClaudeRun, timeoutMs: number): Promise<JobOutcome> {
  return new Promise((done) => {
    const child = spawn(CLAUDE, claudeArgs({ ...run, model: MODEL }), {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk))
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk))
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      done({ error: `Não foi possível rodar o Claude Code (${error.message}).` })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (signal) return done({ error: 'O Claude Code demorou demais e foi interrompido.' })
      const parsed = parseClaudeOutput(stdout)
      if (parsed.ok) return done({ result: parsed.output, costUsd: parsed.costUsd })
      if (code !== 0 && stderr.trim()) console.error(stderr.trim())
      done({ error: parsed.error, costUsd: parsed.costUsd })
    })
  })
}

async function startFloorPlan(body: Buffer, name: string) {
  const type = PLAN_TYPES[extname(name).toLowerCase()]
  if (!type) throw new HttpError(400, 'Envie a planta em PNG, JPG, WEBP, GIF ou PDF.')
  const dir = await jobDir('planta')
  const file = join(dir, `planta.${type}`)
  await writeFile(file, body)
  return jobs.start('floor-plan', () =>
    runClaude(
      {
        prompt: `/floor-plan ${file}`,
        allowedTools: ['Read', 'Skill'],
        addDirs: [dir],
        jsonSchema: FLOOR_PLAN_SCHEMA,
        maxBudgetUsd: 2,
      },
      5 * 60_000,
    ),
  )
}

async function startCheaperPrices(body: Buffer) {
  if (!existsSync(PRICES_SKILL)) {
    throw new HttpError(409, 'A skill /search-better-prices não está instalada nesta máquina.')
  }
  if (jobs.isRunning('cheaper-prices')) {
    throw new HttpError(409, 'Já há uma busca de preços em andamento.')
  }
  let data: unknown
  try {
    data = JSON.parse(body.toString('utf8'))
  } catch {
    throw new HttpError(400, 'Itens ilegíveis.')
  }
  const items = parsePriceItems(data)
  if (!items) throw new HttpError(400, 'Nenhum item válido para pesquisar.')
  const count = items.length
  const dir = await jobDir('precos')
  const list = join(dir, 'itens.json')
  const results = join(dir, 'resultados.jsonl')
  await writeFile(list, JSON.stringify(items, null, 1))
  return jobs.start('cheaper-prices', async (progress) => {
    progress(0, count)
    // A skill grava um resultado por item: acompanhar o arquivo dá o progresso.
    const watch = setInterval(async () => {
      const finds = parsePriceFinds(await readFile(results, 'utf8').catch(() => ''))
      progress(Math.min(count, finds.length), count, finds)
    }, 2000)
    try {
      const outcome = await runClaude(
        {
          prompt: `/search-better-prices ${list} ${count}`,
          // Sem Bash: a leitura da planilha (passo 0) já foi feita pelo backend.
          allowedTools: ['Skill', 'Read', 'Write', 'Edit', 'WebSearch', 'WebFetch'],
          addDirs: [dir],
          maxBudgetUsd: Number(process.env.PRICES_BUDGET_USD ?? 5),
          appendSystemPrompt: [
            'Execução automática pelo backend local do House Shopping, sem ninguém para responder.',
            `A planilha já foi lida: ${list} é o itens.json do passo 0 (pule o passo 0, sem Bash).`,
            `Use ${dir} como $SP: grave ${results} a cada item, como a skill manda.`,
            'Não pergunte nada: captcha, página que não abre ou dúvida → registre "não encontrado" e siga.',
            'Pare depois do passo 1 (não grave a planilha nova nem faça o resumo).',
          ].join(' '),
        },
        60 * 60_000,
      )
      clearInterval(watch)
      const finds = parsePriceFinds(await readFile(results, 'utf8').catch(() => ''))
      progress(Math.min(count, finds.length), count)
      // Mesmo se o Claude Code parar no meio (orçamento, tempo), o que já foi achado vale.
      if (finds.length) return { result: finds, costUsd: outcome.costUsd }
      return outcome.error ? outcome : { ...outcome, result: [] }
    } finally {
      clearInterval(watch)
    }
  })
}

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((done, fail) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_UPLOAD) {
        fail(new HttpError(413, 'Arquivo grande demais (máximo 15 MB).'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => done(Buffer.concat(chunks)))
    req.on('error', fail)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  if (origin && !isLocalOrigin(origin)) return send(res, 403, { error: 'Origem não permitida.' })
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
    })
    return res.end()
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { floorPlan: true, cheaperPrices: existsSync(PRICES_SKILL) })
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
      const job = jobs.get(url.pathname.slice('/api/jobs/'.length))
      return job ? send(res, 200, job) : send(res, 404, { error: 'Job não encontrado.' })
    }
    if (req.method === 'POST' && url.pathname === '/api/floor-plan') {
      const job = await startFloorPlan(await readBody(req), url.searchParams.get('name') ?? '')
      return send(res, 202, { id: job.id })
    }
    if (req.method === 'POST' && url.pathname === '/api/cheaper-prices') {
      const job = await startCheaperPrices(await readBody(req))
      return send(res, 202, { id: job.id })
    }
    send(res, 404, { error: 'Rota não encontrada.' })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    send(res, status, { error: error instanceof Error ? error.message : 'Erro inesperado.' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`House Shopping — backend local em http://127.0.0.1:${PORT}`)
  console.log(`Skill de preços: ${existsSync(PRICES_SKILL) ? 'instalada' : 'não encontrada'}`)
})
