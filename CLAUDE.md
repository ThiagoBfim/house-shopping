# House Shopping

Site estático (GitHub Pages) que monta lista de compras de móveis/eletrodomésticos por cômodo dentro de um orçamento. Contexto: `docs/project/Project.md`. Plano: `docs/drops/`.

## Stack

Vite 8 + Preact + TypeScript (strict) · Vitest · ESLint + Prettier · Node 24 (`fnm use`; o node do Homebrew está quebrado nesta máquina).

## Comandos

- `npm run dev` — servidor local (http://localhost:5173/house-shopping/)
- `npm test` — Vitest
- `npm run check` — lint + format + testes + build (rodar antes de fechar um drop)

## Estrutura

- `src/engine/` — lógica pura (motor de orçamento, dinheiro). Sem DOM, sempre testada.
- `src/ui/` — componentes Preact.
- `data/` — `rooms.json`, `products.json` (catálogo). Não ler o catálogo inteiro; editar por categoria.
- `scripts/` — scripts Node (validação, sync de afiliados).
- `tests/` — testes `*.test.ts`.

## Convenções

- Textos da UI e docs em pt-BR; código (nomes) em inglês.
- Preços em BRL como `number` (reais, não centavos); formatar com `formatBRL`.
- Imports com extensão `.ts`/`.tsx`. Sem `;`, aspas simples (Prettier).
- Sem chaves de API no front-end: integrações rodam em GitHub Actions.

## Drops

Ao iniciar/terminar um drop, atualizar a tabela no topo do arquivo do drop **e** em `docs/drops/README.md` (início, fim `AAAA-MM-DD HH:MM`, duração). Marcar tarefas `[x]` e anotar decisões em **Registro**.
