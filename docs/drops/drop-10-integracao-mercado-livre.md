# Drop 10 — Integração Mercado Livre

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-10-22 10:48 | —            | —       |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** produtos do Mercado Livre com link de afiliado e preço atualizado.

- [x] Cadastro no programa **Afiliados e Criadores** (o usuário já era afiliado; etiqueta `master_sold`)
- [ ] Preencher `data/affiliate/mercadolivre.csv` e rodar `npm run ml:links import` — **140/484 feitos** (lotes de 10) (via Claude in Chrome; agora com a skill `/ml-links`)
- [x] App de desenvolvedor criado (o usuário preencheu; Claude marcou Refresh Token + unidade Mercado Livre) e autorizado com `npm run ml:auth`
- [x] Links de afiliado em lote: `npm run ml:links export|import` (planilha ↔ JSON, com validação antes de gravar)
- [x] Script `scripts/sync-mercadolivre.ts` (`npm run sync:ml`): preço e disponibilidade pela API com OAuth (a API pública exige token desde 2025)
- [x] Respeitar regras do programa: o sync avisa produto usado ou vendedor sem reputação verde
- [x] Quando houver o mesmo modelo em duas lojas, mostrar a mais barata (`offers` + `applyBestOffer`; o card mostra "Também na Amazon: R$ X")
- [x] Card com a loja no botão ("Comprar no Mercado Livre ↗")

**Pronto quando:** itens do Mercado Livre exibem preço atual e link de afiliado.

## Registro

- **Código pronto às 10:54** (6 min). O drop fecha quando os links reais forem importados; anotar o fim aqui nesse dia.
- **API sem login não funciona mais:** testado em 2026-10-22, `/sites/MLB/search`, `/products/search`, `/sites/MLB` e `/items/…` devolvem `403 PolicyAgent` sem token. O sync usa OAuth: `ML_ACCESS_TOKEN`, ou client id/secret + refresh token, que muda a cada uso e é salvo em `.ml-token.json` (fora do git).
- **Não há API de link de afiliado** (o link vem do "Gerador de links" do painel, no formato `mercadolivre.com/sec/…`). Por isso existe a planilha `data/affiliate/mercadolivre.csv`, com 192 linhas, separador `;` para abrir direto no Excel/Planilhas em pt-BR, e uma coluna `busca` com o link para achar o produto.
- **Modelo de dados:** `offers[]` por opção, com loja, link, preço, data, `externalId` (MLB…) e `available`. Os campos exibidos são sempre os da oferta mais barata disponível (`applyBestOffer` em `src/data/offers.ts`), e o validador acusa quando não batem. Opções sem `offers` continuam como estavam (preço de referência + link de busca).
- **Sync:** para produto de catálogo (`/p/MLB…`), usa o anúncio que ganha a "buy box"; para anúncio (`MLB-123…`), o próprio item. A reputação do vendedor vem de `/users/{id}`, com cache por vendedor. Comissão = produto novo + reputação `5_green` ou `4_light_green` ("verde claro" incluído por suposição; ajustar `GREEN_LEVELS` se o programa for mais restrito). **Os campos da API não foram testados com token real.**
- **Segurança:** `.env.local` e `.ml-token.json` estão no `.gitignore`, e há um `.env.example` como modelo.
- **Testado sem rede:** CSV (BOM/CRLF do Excel, `;` e aspas), importação (oferta nova, outras lojas preservadas, avisos), sync com respostas simuladas e regras de comissão. Com a API real, só o caminho de erro (token inválido → `401`, nada é gravado).
- **Layout:** no celular, "Comprar no Mercado Livre ↗" não cabia ao lado do preço; o rodapé do card virou coluna (preço, "Também na…" e botão de largura total).
- **Testes:** 115 unitários (+40) e 18 E2E.
- **Piloto (2026-10-22, Claude in Chrome no navegador do usuário, logado):**
  - **Fluxo:** na página do produto, a barra de afiliado ("GANHOS 5%") tem o botão **Compartilhar**, que gera o link `https://meli.la/…`. O link abre o perfil social do afiliado (`/social/master_sold?matt_word=master_sold&matt_tool=16097421`) com o produto em destaque.
  - **Links conferidos abrindo cada um:**

    | Produto            | Link              | Preço             | Vendedor             |
    | ------------------ | ----------------- | ----------------- | -------------------- |
    | Electrolux IT70S   | `meli.la/1kohmr4` | R$ 4.104,78 (Pix) | Mercado Livre        |
    | Samsung U8000H 50" | `meli.la/1khtRfy` | R$ 2.674          | loja oficial Samsung |
    | Consul CRM40MB     | `meli.la/1pSxEZp` | R$ 2.249 (Pix)    | Magalu, 110 V        |

  - **Modelos fora de linha:** a Consul CRM39AB só aparece usada (sem comissão) e a TV Samsung DU8000 (2024) está "indisponível". Foram trocadas pelos sucessores no catálogo: **CRM40MB 333 L** e **U8000H** (linha 2026/27). Os preços de referência estavam longe do real (TV: R$ 1.899 → R$ 2.674).
  - **Código ajustado:** `isAffiliateUrl` aceita `meli.la`; `parseMercadoLivreId` lê o `item_id` de `pdp_filters` (anúncios `/up/MLBU…`). Os testes cobrem os dois casos.
  - **Sem navegador**, o site do Mercado Livre bloqueia leitura automática (`403`); dá para achar as páginas pelo índice do buscador, mas os preços ficam desatualizados. Com o Chrome logado, o preço é o da hora.
  - **Ritmo:** cerca de 1 min por produto, contando busca, troca de modelo quando preciso e conferência.
- **Lote 1 (2026-10-22):** 13 produtos caros, com links conferidos abrindo cada um. Modelos trocados por fora de linha ou sem oferta nacional nova: TV S90F → **S95H**, LG C5 → **C6**, BRE57FK → **BRE66AE**, BRO85AK → **BRO88AB**, Simmons → **King Koil Attraction**, Le Creuset 3 peças → **kit 2 panelas**, FE5AD → **Fogão Electrolux Airfry**, BVR28HR → **BVR28PB**. Os freezers trocaram de tier (HI550 → 3, BVR28PB → 4) para os preços subirem com o tier. Descartados: Stokke e Sonos (só internacionais ou de pessoa física) e BRE57FK (vendedores com atendimento ruim). **Regra do usuário: só novos e nacionais.**
- **Skill `/ml-links`** (`.claude/skills/ml-links/`): o fluxo inteiro (busca, conferência de novo/nacional/barra de afiliado, link pelo zoom, id do anúncio, conferência abrindo o link, planilha, import), com os snippets e as armadilhas.
- **Sync com a API real (2026-10-22):**
  - **Restrições da API:** `/items/{id}`, a busca e `/user-products` dão 403 para anúncios de terceiros. O que funciona é `/products/{catálogo}/items` (as ofertas do produto) e `/users/{id}`.
  - **Nova lógica do sync:** guarda `catalogId` + anúncio e acha o anúncio escolhido entre as ofertas do catálogo. Link só de catálogo usa a oferta nova mais barata de **vendedor confiável** (loja oficial, ou verde com ≥ 50 vendas). Na primeira tentativa o sync pegou um vendedor sem reputação e com 0 vendas a R$ 2.999,99, e a regra foi criada por causa disso.
  - **Preço:** passa a ser o **preço normal**, não o do Pix. A primeira sincronização usou `--rebase`, para não registrar uma falsa subida de ~5%.
  - **Resultado:** 11 produtos com preço da API (ex.: IT70S R$ 3.899 na loja oficial Electrolux, Daikin R$ 4.105,16, S95H R$ 13.372,47). Os 5 sem catálogo (Weber, King Koil, Consul CRM40MB, Le Creuset, sofá Cannes) mantêm o preço da planilha.
  - **Planilha:** regenerada a partir do catálogo depois do sync, para o import não trazer de volta os preços no Pix.
  - **Novos comandos:** `npm run ml:auth` (autoriza e guarda o token sem imprimir segredos) e `sync:ml -- --rebase`.
  - **Pendência:** o `!` do Claude Code não carrega o `~/.zshrc`. Use `eval "$(fnm env)" && fnm use 24 && …` ou conserte o node do Homebrew.
