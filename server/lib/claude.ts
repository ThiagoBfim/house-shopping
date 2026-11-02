/** Uma execução do Claude Code em modo não interativo (`claude -p`). */
export interface ClaudeRun {
  /** Normalmente a skill e os argumentos: "/floor-plan /tmp/planta.png". */
  prompt: string
  /** Ferramentas liberadas; o resto é negado sem perguntar (`--permission-mode dontAsk`). */
  allowedTools: string[]
  /** Resposta estruturada (`structured_output`) validada pelo próprio Claude Code. */
  jsonSchema?: object
  /** Pastas fora do projeto que a execução pode ler/escrever (a pasta do job). */
  addDirs?: string[]
  /** Teto de gasto por execução, em dólares. */
  maxBudgetUsd: number
  appendSystemPrompt?: string
  model?: string
}

export function claudeArgs(run: ClaudeRun): string[] {
  const args = [
    '-p',
    run.prompt,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    run.allowedTools.join(','),
    '--max-budget-usd',
    String(run.maxBudgetUsd),
  ]
  if (run.jsonSchema) args.push('--json-schema', JSON.stringify(run.jsonSchema))
  for (const dir of run.addDirs ?? []) args.push('--add-dir', dir)
  if (run.appendSystemPrompt) args.push('--append-system-prompt', run.appendSystemPrompt)
  if (run.model) args.push('--model', run.model)
  return args
}

export type ClaudeResult =
  { ok: true; output: unknown; costUsd: number } | { ok: false; error: string; costUsd: number }

/**
 * Lê a saída de `claude -p --output-format json`. A resposta estruturada vem em
 * `structured_output`; sem schema, o texto vem em `result`.
 */
export function parseClaudeOutput(stdout: string): ClaudeResult {
  let data: unknown
  try {
    data = JSON.parse(stdout)
  } catch {
    return { ok: false, error: 'Resposta do Claude Code ilegível.', costUsd: 0 }
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'Resposta do Claude Code ilegível.', costUsd: 0 }
  }
  const result = data as Record<string, unknown>
  const costUsd = typeof result.total_cost_usd === 'number' ? result.total_cost_usd : 0
  if (result.is_error === true || result.subtype !== 'success') {
    const detail =
      typeof result.result === 'string' && result.result ? result.result : result.subtype
    return { ok: false, error: `O Claude Code não terminou (${String(detail)}).`, costUsd }
  }
  return { ok: true, output: result.structured_output ?? result.result, costUsd }
}
