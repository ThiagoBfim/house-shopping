# Drop 10 — Integração Mercado Livre

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-10-22 10:48 | —            | —       |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** produtos do Mercado Livre com link de afiliado e preço atualizado.

- [x] Cadastro no programa **Afiliados e Criadores** (o usuário já era afiliado; etiqueta `master_sold`)
- [ ] Preencher `data/affiliate/mercadolivre.csv` e rodar `npm run ml:links import` — **3/192 feitos** (piloto via Claude in Chrome)
- [ ] **(você)** Criar app de desenvolvedor e colocar o token em `.env.local` — passo 3
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
