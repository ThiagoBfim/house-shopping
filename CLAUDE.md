# House Shopping

Site estático (GitHub Pages) que monta lista de compras de móveis/eletrodomésticos por cômodo dentro de um orçamento. Contexto: `docs/project/Project.md`. Plano: `docs/drops/`.

## Stack

Vite 8 + Preact + TypeScript (strict) · Vitest · ESLint + Prettier · Node 24 (`fnm use`; o node do Homebrew está quebrado nesta máquina).

## Comandos

- `./scripts/dev.sh` — sobe o site em http://localhost:5174/house-shopping/ **e o backend local** (`npm run server`; se já houver um na 8787, usa esse), ativa o Node 24, instala dependências se preciso e abre o navegador; Ctrl+C para os dois. `--no-backend`: só o site, sem os recursos em teste. `npm run dev` = o mesmo na porta 5173, sem o resto
- `npm test` — Vitest (inclui validação do catálogo real em `data/`)
- `npm run ml:links export|import` — planilha `data/affiliate/mercadolivre.csv` ↔ links de afiliado nos JSONs
- `npm run sync:ml` — preço/disponibilidade do Mercado Livre (precisa de token em `.env.local`; ver `docs/project/MercadoLivre.md`)
- `npm run sync:dims` — medidas reais dos móveis/eletros pela API do Mercado Livre (largura × profundidade × altura); sem medida, vale a típica do `layout` da categoria
- `npm run validate` — valida `data/rooms.json` + `data/products/*.json` e lista os erros
- `npm run test:e2e` — Playwright (perfil celular), sobe o Vite sozinho na porta 4321
- `npm run server` — backend local da 2ª wave em http://127.0.0.1:8787 (roda as funcionalidades novas com o `claude -p`); com ele rodando, o site em dev mostra "Recursos em teste"
- `npm run check` — lint + format + validate + testes com cobertura (≥ 90% em engine/data) + build + E2E (rodar antes de fechar um drop)

## Deploy (GitHub Actions)

- Push na `main` → `.github/workflows/deploy.yml` publica no GitHub Pages e cria tag/release.
- Só `data/products/` e `data/affiliate/` mudaram → validate + build + deploy, release **patch**. Qualquer outra mudança → `checks.yml` (`npm run check`) antes, release **minor**. Só docs → sem deploy.
- A versão da release é calculada antes do build e vai no rodapé (`APP_VERSION` → `__APP_VERSION__`; local: `git describe`).
- `main` protegida: só entra por PR com o check `npm run check` verde (o `checks.yml`; em PR só de produtos/docs ele roda apenas o `validate`). Push direto na `main` é recusado.

## Estrutura

- `src/engine/` — lógica pura, sem DOM, sempre testada: `budget.ts` (planList = reload, describeList = lista exibida), `choices.ts` (recusar/travar/diff), `share.ts` (estado ↔ URL, versionado; link só com letras e números via `base62.ts`, lê também o formato antigo), `house.ts` (cômodos + quantidades → itens com chave `instância:categoria`, um orçamento só), `preferences.ts` (variante escolhida e necessidade ajustada; rodar antes do motor), `assistant.ts` (respostas do "Monte pra mim" → casa, orçamento e escolhas), `manual.ts` (itens adicionados pelo usuário em `choices.manual`: validação, loja pelo link), `money.ts`.
- `src/data/` — schema Zod (`schema.ts`, tipos derivados com `z.infer`) e regras do catálogo (`validate.ts`). Na UI, importar só tipos (`import type`) para não levar o Zod no bundle.
- `src/ui/` — componentes Preact. `App.tsx` guarda a sessão (`house` + `plan` + `choices`); `persistence.ts` sincroniza URL (`#l=`) e localStorage. `shortener.ts` encurta o link de compartilhar (is.gd; falhou = link completo).
- `data/rooms.json` (cômodos → itens com `need` 1–5 e `qty`) e `data/products/<categoria>.json` (um arquivo por categoria; o nome é o id; `variants` = tipos de produto, cada um com sua escada de tiers). `data/assistant.json`: perguntas do "Monte pra mim" (ver `docs/project/Assistente.md`). Não ler o catálogo inteiro; para adicionar/atualizar categoria use a skill `/add-product`; para links de afiliado do Mercado Livre, a skill `/ml-links` (Chrome logado; só produtos novos e nacionais); para conferir se os links ainda abrem o anúncio certo, `/ml-check-links`; a rotina da semana (preços + links), `/sync-semanal` (o usuário roda à mão, uma vez por semana).
- `scripts/` — scripts Node (validação, links de afiliado, sync). Lógica pura em `scripts/lib/` (testada); IO e HTTP nos scripts.
- `server/` — backend local da 2ª wave (só na máquina, nunca no site publicado): jobs que chamam `claude -p` com uma skill — `/floor-plan` (planta → cômodos, `--json-schema`) e `/search-better-prices` (local, fora do git; recebe o `itens.json` pronto e grava `resultados.jsonl`). Lógica pura em `server/lib/` (testada). No site: `local-api.ts` (endereço só em dev: `VITE_LOCAL_API` ou `localhost:8787`), `features.ts` + `LabsPanel.tsx` (chaves), `engine/floor-plan.ts` (planta → casa, cama pela área, portas e janelas, desenho), `engine/layout.ts` (`arrangeRoom`: posição dos móveis por regras, em cm), `FurnitureLayout.tsx` (vista de cima em escala) e `Room3DView.tsx` + `room3d.ts` (3D com three.js, import dinâmico) e `engine/cheaper.ts` (preço melhor vira troca; "voltar ao que era antes"). Plano em `docs/drops/wave-2/PLAN.md`.
- Medidas: `dimensions` (cm) na opção e `layout` na categoria (onde fica: `floor`/`wall`/`rug`/`none`, tamanho típico, por variante). `sizeOf` (`src/data/layout.ts`) = real ou típica estimada.
- Ofertas: `offers` por loja em cada opção; `price/url/store/priceUpdatedAt` = melhor oferta (`applyBestOffer`, `src/data/offers.ts`). O validador exige isso.
- Histórico: `offers[].history` (ponto só quando o preço muda) → variação e selo de promoção (`src/data/price-history.ts`). Sempre registrar preço com `recordPrice`.
- `tests/` — testes unitários `*.test.ts` (Vitest). `e2e/` — testes `*.spec.ts` (Playwright).

## Convenções

- Textos da UI e docs em pt-BR; código (nomes) em inglês.
- Preços em BRL como `number` (reais, não centavos); formatar com `formatBRL`.
- Imports com extensão `.ts`/`.tsx`. Sem `;`, aspas simples (Prettier).
- Sem chaves de API no front-end: integrações rodam em GitHub Actions.

## Drops

Ao iniciar/terminar um drop, atualizar a tabela no topo do arquivo do drop **e** em `docs/drops/README.md` (início, fim `AAAA-MM-DD HH:MM`, duração). Marcar tarefas `[x]` e anotar decisões em **Registro**.
