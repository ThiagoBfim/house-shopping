# Drop 5.1 — Necessidade (1–5) e utensílios

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:58 | 2026-10-22 10:04 | 6min    |

**Meta:** escolher os itens também pela necessidade e poder incluir ou não os utensílios. (Pedido do usuário depois do Drop 5.)

- [x] Trocar `priority` + `weight` por `need` (1–5) nos itens de `rooms.json`
- [x] Adicionar `utensil` (boolean) nas categorias de `products.json`
- [x] Motor: ordenar e fazer upgrades pela necessidade; necessidade ≥ 4 entra sempre; aplicar os filtros
- [x] Filtros na tela: necessidade mínima (1–5) e chave "incluir utensílios" (também no link compartilhado)
- [x] Mostrar a necessidade e o selo "Utensílio" no card
- [x] Catálogo mock: forno, pratos, talheres, panelas, toalha de mesa e jogo americano
- [x] Atualizar testes (unitários + E2E) e documentação

**Pronto quando:** dá para gerar a lista só com necessidade ≥ 3 e sem utensílios, e o link compartilhado mantém esses filtros. ✅ E2E `necessidade mínima 3+ e sem utensílios` e `link compartilhado mantém os filtros`.

## Registro

- **`need` (1–5) substitui `priority` + `weight`** nos itens de `rooms.json`. Fica no cômodo porque a necessidade depende dele. Rótulos: 5 Essencial · 4 Necessário · 3 Importante · 2 Útil · 1 Supérfluo. O nível 5 era "Indispensável", mas o nome não cabia no botão do celular.
- **Necessário = necessidade ≥ 4** (`REQUIRED_NEED` em `src/engine/budget.ts`): entra sempre, mesmo passando do orçamento, como os antigos "essenciais".
- **Upgrades** pelo maior `necessidade ÷ tier atual`. Itens com a mesma necessidade desempatam pelo nome (antes o `weight` diferenciava geladeira de fogão; agora os dois são 5).
- **`utensil` obrigatório** em cada categoria de `products.json` (sem valor padrão), para o validador acusar quando uma categoria nova esquecer o campo.
- **Filtros** (`minNeed`, `utensils`) fazem parte de `Choices`. Mudar um filtro recalcula a lista na hora, com destaque e **Desfazer**. Itens escondidos aparecem em "Escondidos pelos filtros", com o motivo. Um filtro vence a trava; um item recusado continua em "Recusados".
- **Link compartilhado:** os campos `n` e `u` são opcionais e só são gravados quando diferentes do padrão. Links criados antes continuam abrindo sem mudar `STATE_VERSION`.
- **Faixa de orçamento** (`budgetRange`) respeita os filtros: "Só o necessário, no mais barato" muda quando você tira os utensílios.
- **Catálogo mock:** 11 categorias (40 opções). Entraram forno (3), pratos (4), talheres (4), panelas (4), jogo americano (2) e toalha de mesa (1); os 5 últimos são utensílios.
- **Bug encontrado por teste:** `exclude` (recusar) montava as escolhas do zero e perdia os filtros; recusar um item reativaria os utensílios escondidos. Corrigido, com teste.
- **Chave de utensílios:** o input invisível agora cobre a chave inteira (antes tinha `pointer-events: none`, que travava o clique do Playwright).
- **E2E ajustados:** 2 testes dependiam de valores do catálogo antigo e passaram a usar os novos.
- **Testes:** 75 unitários e 13 E2E (4 novos de filtros).
- **Limitação conhecida:** como os upgrades são gulosos (um tier por vez), recusar um item caro às vezes faz um item barato descer um tier no recálculo. Exemplo: com R$ 30.000, recusar a geladeira melhora forno, micro-ondas e freezer, mas a toalha de mesa cai de Caro para Médio. O total fica melhor, mas o selo "↓" pode surpreender.
