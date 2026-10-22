// CSV com ";" (abre direto no Excel/Google Planilhas em pt-BR).
const SEPARATOR = ';'

const quote = (value: string) => (/[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(quote).join(SEPARATOR)).join('\n') + '\n'
}

/** Lê o CSV e devolve um objeto por linha, com as chaves do cabeçalho. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === SEPARATOR) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      rows.push([...row, field])
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) rows.push([...row, field])

  const [header, ...body] = rows.filter((r) => r.some((cell) => cell.trim()))
  if (!header) return []
  return body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), (cells[i] ?? '').trim()])),
  )
}

/** "2.799,90", "2799.90", "R$ 2.799" → número (ou undefined). */
export function parsePrice(text: string): number | undefined {
  const clean = text.replace(/[^\d,.]/g, '')
  if (!clean) return undefined
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : /\.\d{3}$/.test(clean)
      ? clean.replace(/\./g, '')
      : clean
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : undefined
}
