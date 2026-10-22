# Drop 1 — Modelo de dados e validação

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Meta:** formato dos JSONs definido e validado automaticamente.

- [ ] Definir tipos TS: `Room`, `RoomItem`, `ProductCategory`, `ProductOption`, `Tier`, `Priority`
- [ ] Escrever JSON Schema (ou Zod) para `rooms.json` e `products.json`
- [ ] Script `scripts/validate-data.ts` (schema + regras: ≥4 tiers para produtos caros, preços crescentes por tier, URLs válidas, bullets 3–5)
- [ ] Criar dados _mock_ mínimos (Cozinha com 5 categorias)
- [ ] Teste unitário do validador
- [ ] Rodar o validador no `npm test`

**Pronto quando:** um JSON inválido faz o teste falhar com mensagem clara.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
