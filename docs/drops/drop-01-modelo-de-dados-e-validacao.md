# Drop 1 — Modelo de dados e validação

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:21 | 2026-10-22 09:23 | 2min    |

**Meta:** formato dos JSONs definido e validado automaticamente.

- [x] Definir tipos TS: `Room`, `RoomItem`, `ProductCategory`, `ProductOption`, `Tier`, `Priority`
- [x] Escrever JSON Schema (ou Zod) para `rooms.json` e `products.json`
- [x] Script `scripts/validate-data.ts` (schema + regras: ≥4 tiers para produtos caros, preços crescentes por tier, URLs válidas, bullets 3–5)
- [x] Criar dados _mock_ mínimos (Cozinha com 5 categorias)
- [x] Teste unitário do validador
- [x] Rodar o validador no `npm test`

**Pronto quando:** um JSON inválido faz o teste falhar com mensagem clara. ✅ Verificado quebrando `data/products.json` de propósito (tier faltando, URL `http`, preço fora de ordem): `npm run validate` listou os 3 erros e o teste do catálogo real falhou.

## Registro

- **Zod 4** em vez de JSON Schema: um só lugar define o formato e os tipos TS (`z.infer`). Fica em `src/data/schema.ts`; a UI importa só os tipos, então o Zod não vai para o bundle.
- **Valores em inglês nos dados:** `priority` = `essential` | `important` | `optional`; `store` = `amazon` | `mercadolivre` | `other`. `Project.md` atualizado.
- **"Produto caro"** é calculado, não marcado à mão: se a opção mais cara custa ≥ R$ 1.000 (`EXPENSIVE_THRESHOLD`), a categoria precisa dos 4 tiers.
- Regras extras além do plano: `id` único no catálogo inteiro, tier sem repetição, campos desconhecidos rejeitados (pega erro de digitação), categoria do cômodo precisa existir, `qty` padrão 1.
- Cada categoria é validada separadamente, então erros de formato e de regra aparecem juntos numa execução só.
- `npm run validate` foi adicionado ao `npm run check`. O teste `aceita o catálogo real em data/` faz o `npm test` falhar se o catálogo quebrar.
- **Mock:** Cozinha com geladeira, fogão (essenciais), micro-ondas, liquidificador (importantes) e freezer (desejável). 18 opções com nomes "Exemplo" e URLs `example.com`, que o Drop 7 vai trocar por dados reais.
- 17 testes passando (15 do validador + 2 de `formatBRL`).
