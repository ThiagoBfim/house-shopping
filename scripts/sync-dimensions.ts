/**
 * Medidas reais dos móveis e eletros (os que entram no desenho em escala e no 3D) pela API do
 * Mercado Livre: /products/{catálogo} → WIDTH, DEPTH/LENGTH e HEIGHT. Só grava medida
 * plausível; o resto continua com a medida típica da categoria (estimada).
 * Uso: npm run sync:dims
 */
import { layoutFor } from '../src/data/layout.ts'
import { readProducts, writeCategories, loadEnvLocal } from './lib/catalog-files.ts'
import { dimensionsFromAttributes, type Attribute } from './lib/dimensions.ts'
import { API, getAccessToken } from './lib/ml-api.ts'

loadEnvLocal()

try {
  const token = await getAccessToken()
  const products = readProducts()
  const changed = new Set<string>()
  const report = { found: 0, rejected: [] as string[], noCatalog: 0, kept: 0 }

  for (const [category, data] of Object.entries(products)) {
    for (const option of data.options) {
      const layout = layoutFor(data, option.variants?.[0])
      if (!layout || layout.placement === 'none') continue
      const catalogId = option.offers?.find((o) => o.store === 'mercadolivre')?.catalogId
      if (!catalogId) {
        report.noCatalog++
        continue
      }
      const response = await fetch(`${API}/products/${catalogId}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        report.rejected.push(`${option.id} (HTTP ${response.status})`)
        continue
      }
      const { attributes = [] } = (await response.json()) as { attributes?: Attribute[] }
      const dimensions = dimensionsFromAttributes(attributes, layout.size)
      if (!dimensions) {
        report.rejected.push(option.id)
        continue
      }
      const same =
        option.dimensions &&
        (['width', 'depth', 'height'] as const).every(
          (k) => option.dimensions![k] === dimensions[k],
        )
      if (same) {
        report.kept++
        continue
      }
      option.dimensions = dimensions
      changed.add(category)
      report.found++
    }
  }

  await writeCategories(products, changed)
  console.log(
    `✔ ${report.found} medida(s) gravada(s) em ${changed.size} categoria(s); ${report.kept} sem mudança.`,
  )
  console.log(
    `  ${report.noCatalog} opção(ões) sem catálogo do Mercado Livre: ficam com a medida típica.`,
  )
  if (report.rejected.length) {
    console.warn(
      `⚠ Sem medida na API ou medida implausível (${report.rejected.length}, fica a típica): ${report.rejected.join(', ')}`,
    )
  }
} catch (error) {
  console.error(`✖ ${(error as Error).message}`)
  process.exit(1)
}
