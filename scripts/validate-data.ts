// Valida data/rooms.json e data/products/*.json. Uso: npm run validate
import { readdirSync, readFileSync } from 'node:fs'
import { validateCatalog } from '../src/data/validate.ts'

const dataDir = new URL('../data/', import.meta.url)
const read = (file: string): unknown => JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'))

const products = Object.fromEntries(
  readdirSync(new URL('products/', dataDir))
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.slice(0, -5), read(`products/${file}`)]),
)

const result = validateCatalog(read('rooms.json'), products, read('assistant.json'))

if (result.ok) {
  const categories = Object.keys(result.products).length
  const options = Object.values(result.products).reduce((n, c) => n + c.options.length, 0)
  console.log(
    `✔ Catálogo válido: ${Object.keys(result.rooms).length} cômodo(s), ${categories} categoria(s), ${options} opção(ões), ${result.assistant?.questions.length ?? 0} pergunta(s) do assistente.`,
  )
} else {
  console.error(`✖ Catálogo inválido (${result.errors.length} erro(s)):`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
