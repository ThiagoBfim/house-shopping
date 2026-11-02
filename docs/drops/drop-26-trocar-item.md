# Drop 26 — Trocar um item por um produto achado pelo usuário

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-31 12:43 | 2026-10-31 12:46 | 3min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** em cada card do catálogo, um botão **⇄ Trocar** para substituir o produto sugerido por um que o usuário achou (ex.: "achei um box ótimo"), informando link e preço. O item do catálogo sai da lista e o produto do usuário entra no lugar, contando no orçamento. (Pedido do usuário.)

**Pronto quando:** na Cozinha, "Trocar" na Geladeira, preço R$ 2.999,90 e um link faz o card "Trocado por você" aparecer no lugar da geladeira; o total muda pela diferença; recalcular, recarregar e o link compartilhado mantêm a troca; "Desfazer troca" traz a geladeira do catálogo de volta.

## Tarefas

- [x] `ManualItem.replaces` (chave `instância:categoria` do item trocado); `replaceWith` e `replacedKeys` em `src/engine/manual.ts`
- [x] `planList`/`describeList`: item trocado sai do plano e da lista; `ManualEntry.replaced` com o item, o rótulo e a opção mais barata
- [x] `share.ts`: 6º campo opcional em `m` (`[cômodo, nome, preço, link, qtd, troca]`), sem mudar `STATE_VERSION`
- [x] `export.ts`: coluna Item = "Geladeira (trocado por você)"
- [x] UI: botão "⇄ Trocar" no card; formulário inline no lugar do card (nome já preenchido com o item, foco no preço); card "Trocado por você" na posição do item original; "Desfazer troca"
- [x] Testes unitários (manual, budget, share, export) e E2E (`e2e/manual.spec.ts`)

## Decisões

- **Troca = item adicionado com `replaces`.** Reaproveita tudo do Drop 20 (validação, loja pelo link, Desfazer, localStorage, link, Excel, limite de 30). Editar a troca usa o mesmo formulário.
- **O item do catálogo some da lista** (não vai para "Recusados"/"Já tenho" nem conta como economia). Trocar de novo o mesmo item substitui a troca anterior; trava e exclusão do item são limpas.
- **Posição:** o card da troca fica onde o item original estaria (ordem de necessidade); itens só adicionados continuam no fim do cômodo.
- **Desfazer troca** devolve o item no tier que ele tinha no plano (ou no mais barato, se o plano mudou), como o "Reativar".
- **Link antigo / item que saiu do catálogo:** troca de item que não existe mais na casa (ou de outro cômodo, ou repetida) vira item adicionado comum.
- **Botão desabilitado** quando a lista já tem 30 itens adicionados.

## Registro

- Nome vem preenchido com o rótulo do item (ex.: "Geladeira") para o caso comum ser só colar o preço e o link; dá para editar.
