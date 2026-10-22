const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function formatBRL(value: number): string {
  return brl.format(value)
}

/** Sem centavos, para orçamentos e resumos ("R$ 30.000"). */
export function formatBRLWhole(value: number): string {
  return brlWhole.format(value)
}

/** Número com separador de milhar, para o campo de orçamento ("30.000"). */
export function formatInteger(value: number): string {
  return integer.format(value)
}

/** Lê só os dígitos de um texto digitado ("R$ 30.000" → 30000). */
export function parseDigits(text: string, max = 99_999_999): number {
  const digits = text.replace(/\D/g, '')
  return digits ? Math.min(Number(digits), max) : 0
}
