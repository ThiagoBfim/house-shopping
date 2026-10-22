# Drop 16 — Tema claro / escuro

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 18:08 | 2026-10-22 18:10 | 2min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** escolher o tema de forma simples (pedido do usuário: gosta do escuro, mas nem todo mundo gosta).

- [x] Botão no cabeçalho: Automático → Claro → Escuro
- [x] Escolha salva no navegador e aplicada antes de pintar (sem piscar)
- [x] Teste E2E (`e2e/theme.spec.ts`)

## Registro

- **Automático** segue o sistema (padrão, como antes). Claro/escuro gravam `house-shopping:theme` no `localStorage` e põem `data-theme` no `<html>`; o script inline em `index.html` lê a mesma chave antes do app carregar.
- **CSS:** as cores escuras valem em `@media (prefers-color-scheme: dark)` com `:root:not([data-theme='light'])` e em `:root[data-theme='dark']` (bloco repetido de propósito: não dá para juntar media query e seletor). `color-scheme` acompanha o tema, então campos e barras de rolagem do navegador também mudam.
- É preferência de quem está olhando: não vai no link compartilhado.
