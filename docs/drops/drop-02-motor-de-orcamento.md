# Drop 2 — Motor de orçamento

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:35 | 2026-10-22 09:37 | 2min    |

**Meta:** função pura que transforma (cômodo, orçamento, escolhas) em lista.

- [x] `buildList(room, budget, state)` — essenciais no tier 1 → importantes → desejáveis
- [x] Fase de upgrades: sobe tiers por `weight` enquanto houver saldo
- [x] Respeitar itens **travados** (tier fixo) e **recusados** (excluídos)
- [x] Retornar total, saldo e aviso "faltam R$ X" quando os essenciais não cabem
- [x] Suporte a `qty` (ex.: 4 cadeiras)
- [x] Testes: orçamento baixo, alto, exato, tudo travado, tudo recusado
- [x] Garantir determinismo (mesma entrada → mesma saída, essencial para links compartilhados)

**Pronto quando:** cobertura de testes do motor ≥ 90%. ✅ `src/engine/budget.ts` com 100% de linhas, branches e funções. O `npm run check` exige ≥ 90% em `src/engine` e `src/data`.

## Registro

- **API** (`src/engine/budget.ts`):
  - `planList` decide o tier de cada item (é o "reload").
  - `describeList` monta a lista exibida a partir do plano e das escolhas atuais, sem redistribuir o dinheiro.
  - `buildList` faz os dois de uma vez.
  - Essa separação permite, no Drop 4, recusar um item sem que a lista mude sozinha: ela só muda quando o usuário pede o reload.
- **Escolhas:** `locked` (categoria → tier) e `excluded` (categoria → `refused` | `owned`). "Mais barato/mais caro" vai ser só um `locked` com o tier vizinho.
- **Upgrades:** um tier por vez, no item com maior `weight ÷ tier atual`. Assim a geladeira sobe primeiro, mas o dinheiro não fica todo num item só. Se o upgrade do melhor item não cabe, o motor tenta o próximo.
- **Essenciais entram sempre**, mesmo passando do orçamento; nesse caso `remaining` fica negativo, e a UI mostra "faltam R$ X". Itens travados também entram sempre.
- **Contas em centavos**, para evitar erro de ponto flutuante (ex.: 0,1 + 0,2).
- **Determinismo:** os itens são ordenados por prioridade → peso → nome, então a ordem dentro do JSON não muda o resultado (há teste para isso).
- **Tier que sumiu do catálogo** (ex.: link antigo) cai para o tier mais próximo abaixo (`optionForTier`).
- Cobertura com `@vitest/coverage-v8` e o comando `npm run test:coverage`. Ao todo, 38 testes.
