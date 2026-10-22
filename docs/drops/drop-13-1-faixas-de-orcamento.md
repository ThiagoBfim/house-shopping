# Drop 13.1 — Três faixas de orçamento sugeridas

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 16:38 | 2026-10-22 16:40 | 2min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** ao escolher os cômodos, sugerir três orçamentos prontos (econômico, equilibrado, premium) com o valor de cada um. (Pedido do usuário.)

- [x] Motor: total da seleção com tudo em cada tier (respeitando filtros)
- [x] Tela de orçamento: três opções com valor e descrição; "Equilibrado" já selecionado; campo para outro valor
- [x] Testes (unitários + E2E)

**Pronto quando:** escolher "Premium" monta a lista com esse orçamento, deixando os itens mais importantes em modelos caros, e o valor das três opções muda com os filtros. ✅ E2E `escolher Premium…` e `necessidade mínima 3+ e sem utensílios` (o valor do Econômico muda com os filtros).

## Registro

- **Nomes:** Econômico, Equilibrado e Premium (no lugar de "Barato / Intermediário / Caro", como o usuário deixou livre). Cada um tem uma frase dizendo o que o valor compra.
- **Valores** (`budgetPresets` em `src/engine/budget.ts`): soma da seleção com todos os itens no tier 1, 2 e 3 (`tierTotal`, respeitando os filtros), arredondada para cima em R$ 1/5/10 mil. Exemplo, Cozinha + 2 Quartos + Quarto do bebê + Banheiro: R$ 35 mil, R$ 60 mil e R$ 110 mil.
- **Frases conferidas com o catálogo real:**
  - **Econômico:** quase tudo no tier 1.
  - **Equilibrado:** a maior parte no tier 2 (33 de 59 itens na casa de exemplo).
  - **Premium:** _não_ deixa a maior parte no tier 3, porque o motor sobe primeiro os itens mais necessários (14 itens no tier 3 e 9 no 4; o resto no 2).

  Por isso a frase do Premium virou "os itens mais importantes em modelos caros e topo de linha", e o teste unitário cobre isso.

- **UX:** as três opções são um grupo de rádio com cards (empilhados no celular, três colunas no desktop). O **Equilibrado vem marcado**, com o valor já no campo, então é possível montar a lista com um toque. A opção marcada acompanha os filtros (o valor muda junto); digitar outro valor desmarca as opções e o valor digitado fica fixo.
- **Saíram** as 4 sugestões de valor do Drop 13 e as três linhas de faixa. Ficou uma frase sob o campo: "Só o necessário sai por R$ X; tudo topo de linha, por R$ Y".
- **Testes:** 153 unitários (`tierTotal` e `budgetPresets`, no lugar de `suggestBudgets`) e 27 E2E (+3: opções, Premium, valor digitado).
