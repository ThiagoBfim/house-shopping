# Drop 5 — Persistência e compartilhamento

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:44 | 2026-10-22 09:47 | 3min    |

**Meta:** a lista sobrevive a refresh e pode ser compartilhada.

- [x] Serializar estado (cômodo, orçamento, travados, recusados) na URL (`#` + compressão, ex. `lz-string`)
- [x] Ler estado da URL ao abrir; fallback para `localStorage`
- [x] Botões **Copiar link** e **Compartilhar no WhatsApp** (Web Share API no mobile)
- [x] Modo "lista compartilhada" (banner: "Lista de fulano — personalize a sua")
- [x] Versão do schema no estado, para não quebrar links antigos quando o catálogo mudar
- [x] Teste: abrir link compartilhado reproduz exatamente a mesma lista

**Pronto quando:** link enviado no WhatsApp abre a mesma lista em outro celular. ✅ Simulado no E2E `link compartilhado abre a mesma lista em outro aparelho`: o link é copiado pelo botão e aberto num contexto de navegador novo, sem storage; itens, tiers, saldo, recusados e "já tenho" ficam idênticos. Num celular de verdade, só dá para testar depois do deploy (Drop 6).

## Registro

- **Formato** (`src/engine/share.ts`): `{v, r: cômodo, b: orçamento, p: plano, l: travados, x: excluídos}` em JSON, comprimido com `lz-string`. O link fica com ~100–300 caracteres, no formato `…/house-shopping/#l=<estado>`.
- **O plano vai no link**, não só as escolhas. Assim quem recebe vê exatamente a mesma lista, mesmo que quem enviou não tenha recalculado depois da última mudança.
- **Versão** (`STATE_VERSION = 1`): se o formato mudar, links antigos podem ser tratados em `decodeState`.
- **Links antigos ou quebrados nunca derrubam o site:** categorias que saíram do catálogo são descartadas, e um link inválido abre a tela inicial. Há testes para os dois casos.
- **Onde fica salvo:** a URL é atualizada a cada mudança com `history.replaceState`, sem poluir o botão "voltar", e o mesmo estado vai para o `localStorage`. Ao abrir o site sem link, a última lista volta. "Trocar cômodo" limpa os dois.
- **Lista compartilhada:** o botão adiciona `&s=1` ao link. Quem abre vê o aviso "Lista compartilhada", e a marca sai da URL depois de lida, para não reaparecer.
- **Botões:** WhatsApp (`wa.me` com texto + link), Copiar link e, quando o aparelho suporta (celular), "Compartilhar…" pelo menu nativo (Web Share API).
- **Link colado na mesma aba** (`hashchange`) também carrega a lista.
- Corrigido: o `tsconfig.node.json` ganhou a lib `DOM`, porque o E2E roda código no navegador (`navigator.clipboard`).
- **Testes:** 63 unitários (13 novos de `share.ts`) e 9 E2E (5 novos: abrir em outro aparelho, recarregar a página e abrir sem link, WhatsApp, link inválido, trocar cômodo).
- **Bundle:** JS ~13,7 kB e CSS ~2,8 kB (gzip), com o catálogo em chunks separados.
