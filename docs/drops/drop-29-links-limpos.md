# Drop 29 — Links de produto sem rastreamento (lista grande no link curto)

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 10:53 | 2026-11-02 10:54 | 1min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** a lista do usuário (casa com 8 cômodos e 8 produtos trocados) gerava um link de 5.979 caracteres e o is.gd não encurtava. Fazer caber.

**Diagnóstico:** o is.gd aceita até ~5.000 caracteres (testado com URL fictícia: 4.948 passa, 5.148 não). Mais da metade do link eram os links dos produtos trocados/adicionados (3.639 caracteres em 8 itens), quase tudo rastreamento do Mercado Livre (`#polycard_client=…&tracking_id=…&ad_click_id=…`, `?matt_*`).

## Tarefas

- [x] `cleanProductUrl` (`manual.ts`): Mercado Livre e Amazon perdem o que vem depois do `#`; Amazon vira `/dp/<código>`; em qualquer loja saem `utm_*`, `gclid`, `fbclid`, `matt_*`, `tracking_id` e afins
- [x] Aplicado ao salvar o formulário (adicionar/trocar/editar) e ao gerar o link (itens antigos também saem limpos)
- [x] `shortener.ts`: acima de 5.000 caracteres nem chama o is.gd; toast "Link copiado! (lista grande demais para o link curto)"
- [x] Testes com os links reais da lista do usuário

## Resultado

- Lista do usuário: **5.979 → 4.129 caracteres** (cabe no is.gd), com os 8 produtos.

## Decisões

- **`pdp_filters` do Mercado Livre fica:** escolhe o anúncio/vendedor específico que o usuário viu.
- **Fora de ML/Amazon o `#` fica:** em outras lojas pode ser parte da página.
- **Próximo passo, se listas maiores passarem de 5.000:** não mandar o plano inteiro (1.654 caracteres nesta lista), só o que difere do recalculado (opção 1 do Drop 27).
