// Atualiza preço e disponibilidade das ofertas do Mercado Livre. Uso: npm run sync:ml
import { formatBRL } from '../src/engine/money.ts'
import { validateCatalog } from '../src/data/validate.ts'
import {
  dataDir,
  loadEnvLocal,
  readJson,
  readProducts,
  today,
  writeCategories,
} from './lib/catalog-files.ts'
import { createLookup, getAccessToken } from './lib/ml-api.ts'
import { syncOffers } from './lib/ml-sync.ts'

loadEnvLocal()

try {
  const lookup = createLookup(await getAccessToken())
  const { products, report } = await syncOffers(readProducts(), lookup, today())

  const result = validateCatalog(readJson(new URL('rooms.json', dataDir)), products)
  if (!result.ok) {
    // Ex.: o preço do tier 2 passou o do tier 3. Grava mesmo assim, mas avisa para revisar.
    console.warn('⚠ Depois do sync, o catálogo tem problemas para revisar:')
    for (const error of result.errors) console.warn(`  - ${error}`)
  }
  await writeCategories(products, report.changedCategories)

  console.log(`✔ ${report.changedCategories.size} categoria(s) sincronizada(s).`)
  for (const { id, from, to } of report.updated) {
    console.log(`  ${id}: ${formatBRL(from)} → ${formatBRL(to)}`)
  }
  const warn = (label: string, ids: string[]) =>
    ids.length && console.warn(`⚠ ${label} (${ids.length}): ${ids.join(', ')}`)
  warn('Indisponível no Mercado Livre', report.unavailable)
  warn('Não gera comissão (usado ou vendedor sem reputação verde)', report.noCommission)
  warn('Não encontrado na API', report.notFound)
} catch (error) {
  console.error(`✖ ${(error as Error).message}`)
  process.exit(1)
}
