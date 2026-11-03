import { describe, expect, it } from 'vitest'
import { claudeArgs, parseClaudeOutput } from '../server/lib/claude.ts'
import { isLocalOrigin, JobStore } from '../server/lib/jobs.ts'
import {
  FLOOR_PLAN_SCHEMA,
  MAX_PRICE_ITEMS,
  parsePriceFinds,
  parsePriceItems,
} from '../server/lib/skills.ts'

describe('claudeArgs', () => {
  it('modo não interativo, só as ferramentas liberadas, teto de gasto e schema', () => {
    const args = claudeArgs({
      prompt: '/floor-plan /tmp/x/planta.png',
      allowedTools: ['Read', 'Skill'],
      addDirs: ['/tmp/x'],
      jsonSchema: FLOOR_PLAN_SCHEMA,
      maxBudgetUsd: 2,
    })
    expect(args.slice(0, 2)).toEqual(['-p', '/floor-plan /tmp/x/planta.png'])
    const flag = (name: string) => args[args.indexOf(name) + 1]
    expect(flag('--output-format')).toBe('json')
    expect(flag('--permission-mode')).toBe('dontAsk')
    expect(flag('--allowedTools')).toBe('Read,Skill')
    expect(flag('--max-budget-usd')).toBe('2')
    expect(flag('--add-dir')).toBe('/tmp/x')
    expect(JSON.parse(flag('--json-schema'))).toEqual(FLOOR_PLAN_SCHEMA)
    expect(args).toContain('--no-session-persistence')
    expect(args).not.toContain('--model')
    expect(args).not.toContain('--append-system-prompt')
  })

  it('modelo e instruções extras quando informados', () => {
    const args = claudeArgs({
      prompt: 'x',
      allowedTools: ['Read'],
      maxBudgetUsd: 1,
      model: 'sonnet',
      appendSystemPrompt: 'sem perguntas',
    })
    expect(args[args.indexOf('--model') + 1]).toBe('sonnet')
    expect(args[args.indexOf('--append-system-prompt') + 1]).toBe('sem perguntas')
    expect(args).not.toContain('--json-schema')
  })
})

describe('parseClaudeOutput', () => {
  const output = (data: object) => JSON.stringify({ type: 'result', ...data })

  it('resposta estruturada e custo', () => {
    expect(
      parseClaudeOutput(
        output({
          subtype: 'success',
          is_error: false,
          result: '{"quartos":2}',
          structured_output: { quartos: 2 },
          total_cost_usd: 0.12,
        }),
      ),
    ).toEqual({ ok: true, output: { quartos: 2 }, costUsd: 0.12 })
    expect(parseClaudeOutput(output({ subtype: 'success', result: 'texto' }))).toEqual({
      ok: true,
      output: 'texto',
      costUsd: 0,
    })
  })

  it('erro, orçamento estourado ou saída ilegível', () => {
    expect(
      parseClaudeOutput(output({ subtype: 'error_max_budget_usd', total_cost_usd: 2 })),
    ).toEqual({
      ok: false,
      error: 'O Claude Code não terminou (error_max_budget_usd).',
      costUsd: 2,
    })
    expect(
      parseClaudeOutput(output({ subtype: 'success', is_error: true, result: 'falhou' })),
    ).toMatchObject({ ok: false, error: 'O Claude Code não terminou (falhou).' })
    expect(parseClaudeOutput('não é json')).toMatchObject({ ok: false })
    expect(parseClaudeOutput('null')).toMatchObject({ ok: false })
  })
})

describe('JobStore', () => {
  const tick = () => new Promise((done) => setTimeout(done, 0))
  const store = () => {
    let n = 0
    return new JobStore({ now: () => new Date('2026-11-02T18:00:00Z'), newId: () => `j${++n}` })
  }

  it('acompanha progresso e resultado', async () => {
    const jobs = store()
    let finish!: (value: { result: unknown; costUsd: number }) => void
    const job = jobs.start('cheaper-prices', (progress) => {
      progress(1, 5, [{ row: 2 }])
      return new Promise((done) => (finish = done))
    })
    expect(jobs.get('j1')).toMatchObject({
      status: 'running',
      progress: { done: 1, total: 5 },
      partial: [{ row: 2 }],
    })
    expect(jobs.isRunning('cheaper-prices')).toBe(true)
    expect(jobs.isRunning('floor-plan')).toBe(false)
    finish({ result: [1], costUsd: 0.5 })
    await tick()
    expect(job).toMatchObject({
      status: 'done',
      result: [1],
      costUsd: 0.5,
      finishedAt: expect.any(String),
    })
    expect(jobs.isRunning('cheaper-prices')).toBe(false)
  })

  it('erro devolvido ou exceção viram status "error"', async () => {
    const jobs = store()
    const a = jobs.start('floor-plan', async () => ({ error: 'sem planta' }))
    const b = jobs.start('floor-plan', async () => {
      throw new Error('quebrou')
    })
    const c = jobs.start('floor-plan', () => Promise.reject('texto'))
    await tick()
    expect(a).toMatchObject({ status: 'error', error: 'sem planta' })
    expect(b).toMatchObject({ status: 'error', error: 'quebrou' })
    expect(c).toMatchObject({ status: 'error', error: 'texto' })
    expect(jobs.get('nada')).toBeUndefined()
  })

  it('guarda no máximo 50 jobs (os mais antigos saem)', () => {
    const jobs = store()
    for (let i = 0; i < 55; i++) jobs.start('floor-plan', () => new Promise(() => {}))
    expect(jobs.get('j1')).toBeUndefined()
    expect(jobs.get('j6')).toBeDefined()
    expect(new JobStore().start('floor-plan', () => new Promise(() => {})).id).toBe('job1')
  })
})

describe('isLocalOrigin', () => {
  it('só http em localhost/127.0.0.1', () => {
    expect(isLocalOrigin('http://localhost:5174')).toBe(true)
    expect(isLocalOrigin('http://127.0.0.1:4321')).toBe(true)
    expect(isLocalOrigin('https://thiagobfim.github.io')).toBe(false)
    expect(isLocalOrigin('http://localhost.evil.com')).toBe(false)
    expect(isLocalOrigin(undefined)).toBe(false)
    expect(isLocalOrigin('lixo')).toBe(false)
  })
})

describe('parsePriceFinds', () => {
  it('uma linha por item; a última de cada item vale; linha inválida é ignorada', () => {
    const text = [
      '{"row": 3, "status": "melhor", "preco": 3499, "loja": "Magalu", "link": "https://a.com/x", "obs": "Pix"}',
      '{"row": 2, "status": "sem preço melhor"}',
      '{"row": 5, "status": "melhor", "preco": 10',
      '{"row": 4, "status": "talvez"}',
      '{"row": 1, "status": "melhor"}',
      '{"row": 2.5, "status": "melhor"}',
      '"texto"',
      '',
      '{"row": 2, "status": "não encontrado", "preco": -1}',
    ].join('\n')
    expect(parsePriceFinds(text)).toEqual([
      { row: 2, status: 'não encontrado' },
      {
        row: 3,
        status: 'melhor',
        preco: 3499,
        loja: 'Magalu',
        link: 'https://a.com/x',
        obs: 'Pix',
      },
    ])
  })
})

describe('parsePriceItems', () => {
  const ok = {
    row: 2,
    produto: ' Geladeira X ',
    qtd: 1,
    preco: 2249,
    loja: 'ML',
    link: 'https://a.com',
  }

  it('itens válidos no formato do itens.json; os ruins são descartados', () => {
    expect(
      parsePriceItems({
        items: [
          ok,
          { ...ok, row: 1 },
          { ...ok, produto: '' },
          { ...ok, preco: 0 },
          { row: 3, produto: 'Sem extras', preco: 10 },
          'lixo',
        ],
      }),
    ).toEqual([
      { ...ok, produto: 'Geladeira X' },
      { row: 3, produto: 'Sem extras', qtd: 1, preco: 10, loja: '', link: '' },
    ])
  })

  it('nada válido = undefined; no máximo MAX_PRICE_ITEMS', () => {
    expect(parsePriceItems({ items: [{ ...ok, row: 0 }] })).toBeUndefined()
    expect(parsePriceItems({ items: 'x' })).toBeUndefined()
    expect(parsePriceItems(null)).toBeUndefined()
    const many = Array.from({ length: 300 }, (_, i) => ({ ...ok, row: i + 2 }))
    expect(parsePriceItems({ items: many })).toHaveLength(MAX_PRICE_ITEMS)
  })
})
