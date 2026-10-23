// Links de afiliado do Mercado Livre em lote, via planilha.
//   npm run ml:links export   → data/affiliate/mercadolivre.csv (abre no Excel / Google Planilhas)
//   npm run ml:links import   → aplica as linhas com link_afiliado nos JSONs do catálogo
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { validateCatalog } from '../src/data/validate.ts'
import { dataDir, readJson, readProducts, today, writeCategories } from './lib/catalog-files.ts'
import { parseCsv, toCsv } from './lib/csv.ts'
import { exportRows, importRows, LINK_COLUMNS } from './lib/ml-links.ts'

const csvUrl = new URL('affiliate/mercadolivre.csv', dataDir)
const [command, flag] = process.argv.slice(2)

if (command === 'export') {
  if (existsSync(csvUrl) && flag !== '--force') {
    console.error(
      `✖ ${csvUrl.pathname} já existe (pode ter links seus). Use "npm run ml:links export -- --force" para sobrescrever.`,
    )
    process.exit(1)
  }
  mkdirSync(new URL('affiliate/', dataDir), { recursive: true })
  const rows = exportRows(readProducts())
  writeFileSync(csvUrl, toCsv([...LINK_COLUMNS], rows))
  console.log(`✔ ${rows.length} produtos em data/affiliate/mercadolivre.csv`)
  console.log('  Preencha link_produto, link_afiliado e preco e rode: npm run ml:links import')
} else if (command === 'import') {
  if (!existsSync(csvUrl)) {
    console.error(
      '✖ Não achei data/affiliate/mercadolivre.csv. Rode antes: npm run ml:links export',
    )
    process.exit(1)
  }
  const { products, report } = importRows(
    readProducts(),
    parseCsv(readFileSync(csvUrl, 'utf8')),
    today(),
  )
  const result = validateCatalog(readJson(new URL('rooms.json', dataDir)), products)
  if (!result.ok) {
    console.error('✖ Nada foi gravado: o catálogo ficaria inválido.')
    for (const error of result.errors) console.error(`  - ${error}`)
    process.exit(1)
  }
  await writeCategories(products, report.changedCategories)
  console.log(`✔ ${report.applied.length} link(s) aplicado(s).`)
  if (report.direct.length) console.log(`✔ ${report.direct.length} link(s) direto(s) sem afiliado.`)
  const warn = (label: string, ids: string[]) =>
    ids.length && console.warn(`⚠ ${label} (${ids.length}): ${ids.join(', ')}`)
  warn('Sem id do produto (o sync de preço vai pular)', report.withoutId)
  warn('Link que não parece de afiliado (não gera comissão)', report.notAffiliate)
  warn('Id não existe no catálogo', report.unknownIds)
} else {
  console.log('Uso: npm run ml:links export [-- --force] | npm run ml:links import')
  process.exit(1)
}
