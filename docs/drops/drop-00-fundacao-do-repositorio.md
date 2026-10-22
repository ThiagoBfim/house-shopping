# Drop 0 — Fundação do repositório

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:16 | 2026-10-22 09:19 | 3min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** repositório pronto, com build e lint rodando.

- [x] `git init` e `.gitignore`
- [ ] ~~Criar repositório no GitHub~~ → movido para o Drop 6 (usuário vai criar depois)
- [x] Criar projeto Vite + TypeScript (`npm create vite@latest`) — Preact
- [x] Configurar ESLint + Prettier + Vitest
- [x] Criar `CLAUDE.md` curto com stack, comandos e convenções (economiza tokens em toda sessão)
- [x] Estrutura de pastas: `src/`, `src/engine/`, `src/ui/`, `data/`, `scripts/`, `tests/`
- [x] README com como rodar localmente

**Pronto quando:** `npm run dev`, `npm test` e `npm run build` funcionam. ✅ (verificado em 2026-10-22 09:19)

## Registro

- **Node:** o `node` do Homebrew (21.5) está quebrado (falta `libicui18n.73.dylib`). Usando Node 24 via `fnm`; versão fixada em `.node-version`.
- **Framework:** Preact + TypeScript (template `preact-ts` do Vite 8). Leve (~5 kB gzip) e com componentes para a lista.
- **Config:** TypeScript `strict`; `base: '/house-shopping/'` já configurado no Vite para o GitHub Pages; Vitest configurado dentro do `vite.config.ts`.
- **Scripts:** `npm run check` roda lint + format + testes + build — usar antes de fechar cada drop.
- Primeiro teste: `formatBRL` (formatação de moeda em pt-BR).
- Repositório só local por enquanto (commit inicial `b80be40`). A criação no GitHub foi para o Drop 6.
