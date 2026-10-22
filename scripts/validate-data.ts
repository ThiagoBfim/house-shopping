// Valida data/rooms.json e data/products.json. Uso: npm run validate
import { readFileSync } from 'node:fs'
import { validateCatalog } from '../src/data/validate.ts'

const read = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8'))

const result = validateCatalog(read('rooms.json'), read('products.json'))

if (result.ok) {
  const categories = Object.keys(result.products).length
  const options = Object.values(result.products).reduce((n, c) => n + c.options.length, 0)
  console.log(
    `✔ Catálogo válido: ${Object.keys(result.rooms).length} cômodo(s), ${categories} categoria(s), ${options} opção(ões).`,
  )
} else {
  console.error(`✖ Catálogo inválido (${result.errors.length} erro(s)):`)
  for (const error of result.errors) console.error(`  - ${error}`)
  process.exit(1)
}
