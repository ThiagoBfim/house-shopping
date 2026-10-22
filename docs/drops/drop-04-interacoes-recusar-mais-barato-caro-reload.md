# Drop 4 — Interações (recusar, mais barato/caro, reload)

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:41 | 2026-10-22 09:44 | 3min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** usuário molda a própria lista.

- [x] Botão **Recusar** e **Já tenho** (com desfazer)
- [x] Botões **Mais barato** / **Mais caro** (desabilitados nos extremos; mostram a diferença de preço)
- [x] Ícone de **travar** item
- [x] Botão **Reload** que redistribui o saldo respeitando travados/recusados
- [x] Mostrar o que mudou após o reload (destaque visual)
- [x] Seção "Itens recusados" para reativar
- [x] Testes E2E (Playwright) do fluxo recusar → reload

**Pronto quando:** recusar a geladeira e dar reload melhora outros itens com o dinheiro liberado. ✅ Teste E2E `recusar a geladeira e recalcular…`: com R$ 30.000, o freezer vai de Médio para Muito caro e aparece com "↑ Melhorou".

## Registro

- **Reload explícito:** recusar, trocar o tier ou travar muda só o item tocado e libera (ou consome) saldo. A redistribuição só acontece em **↻ Recalcular lista**, que fica destacado e mostra "com o saldo de R$ X" quando há mudanças pendentes. Implementado com `plan` (resultado do último reload) + `choices` (escolhas atuais) → `describeList`.
- **Mais barato / Mais caro** travam o item no tier vizinho, para que o reload não desfaça a escolha. Ficam desabilitados nos extremos e mostram a diferença em R$.
- **Recusar** e **Já tenho** removem a trava do item. Toda ação mostra um aviso com **Desfazer**, que restaura escolhas e plano.
- **Destaque do reload:** os cards que mudaram ganham borda e o selo "↑ Melhorou", "↓ Mais barato" ou "+ Novo" (`diffPlans`). Se algum item sair por falta de saldo, aparece um aviso.
- **Extras:** botão **+ Adicionar** em "Não coube no orçamento" (adiciona o item travado no mais barato) e seção **Recusados e "já tenho"** com **Reativar**.
- **Bug encontrado pelo E2E:** reativar um item depois de um reload o mandava para "Não coube", porque o plano já não o tinha. Agora o item volta para a lista, no tier que tinha ou, se não tinha, no mais barato.
- **Layout:** no celular, as ações quebravam em várias linhas; passaram para uma faixa com a largura toda do card (a altura caiu ~40%).
- **Funções puras** em `src/engine/choices.ts`: `exclude`, `restore`, `lockAt`, `unlock`, `diffPlans`, `displayedTiers`.
- **E2E:** Playwright em perfil de celular (Pixel 7), `npm run test:e2e`, 4 cenários: recusar → recalcular → reativar; desfazer; mais barato + trava; adicionar item que não coube. O `npm run check` agora também roda o E2E.
- Ao todo: 50 testes unitários + 4 E2E.
