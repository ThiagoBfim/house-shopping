# Drop 7 — Catálogo real: Cozinha

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 10:19 | 2026-10-22 10:24 | 5min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** dados reais e curados para o primeiro cômodo.

- [x] Listar categorias da cozinha com necessidade (1–5)
- [x] Para cada produto caro, pesquisar **4 modelos** (barato, médio, caro, muito caro) em reviews e lojas BR
- [x] Escrever 3–5 bullets de diferença para cada opção
- [x] Links para a busca do modelo no Mercado Livre (os links de afiliado ficam para o Drop 10)
- [x] Registrar `priceUpdatedAt` e fonte
- [x] Rodar validador e revisar manualmente os preços

**Pronto quando:** Cozinha tem ≥ 12 categorias e todos os produtos caros com 4 tiers. ✅ 18 categorias e 68 opções; todo produto com opção ≥ R$ 1.000 tem 4 tiers (garantido pelo validador).

## Registro

- **Categorias e necessidade:**
  - 5 — geladeira, fogão.
  - 4 — panelas, pratos, talheres, copos.
  - 3 — micro-ondas, forno, facas, purificador.
  - 2 — liquidificador, air fryer, cafeteira, lava-louças, coifa.
  - 1 — freezer, jogo americano, toalha de mesa.

  Utensílios: panelas, pratos, talheres, copos, facas, jogo americano e toalha de mesa. A mesa de jantar ficou para a Sala (Drop 8).

- **Modelos reais** escolhidos a partir de guias de compra de 2026 (Buscapé, Zoom, GDM, Casa dos Eletrodomésticos, mybest, AnalisaMelhor) e de listagens de lojas. Os bullets explicam a diferença em relação às outras faixas (ex.: "Freezer embaixo (inverse)", "Coifa de verdade: exaure a fumaça para fora").
- **Preços de referência** (`priceUpdatedAt: 2026-10-22`): cruzados entre guias e listagens e arredondados. Os guias quase não publicam preço atual, então os valores são aproximados; o Drop 10 traz preço vivo do Mercado Livre (a Amazon ficou para a próxima wave).
- **Links:** `https://lista.mercadolivre.com.br/<modelo>`, a busca do modelo no Mercado Livre, que sempre funciona. `store: mercadolivre`. O Drop 10 troca por links de afiliado do produto.
- **Catálogo dividido** em `data/products/<categoria>.json` (o nome do arquivo é o id). O site junta tudo com `import.meta.glob` num chunk só (~6 kB gzip), e o validador lê a pasta. As mensagens de erro apontam o arquivo (`products/geladeira.json › options.0.url`).
- **Fonte dos dados:** gerados por um script temporário (fora do repo) a partir de uma tabela compacta. Daqui para frente o JSON é a fonte; a skill `/add-product` (Drop 8) padroniza as próximas categorias.
- **E2E sem valores fixos:** os testes não dependem mais de preços nem de tiers específicos. Exemplo: "recusar libera exatamente o preço da geladeira" e "depois do recálculo algum item melhora". Trocar o catálogo não quebra mais os testes.
- **Conferência dos resultados (Cozinha):**
  - só o necessário, no mais barato: R$ 4.264;
  - tudo no mais barato: R$ 11.132;
  - tudo no topo: R$ 60.282;
  - com R$ 30.000: fogão Muito caro, geladeira Caro, utensílios necessários no topo, saldo R$ 8.
- **`.claude/`** (skill `gh-pages-deploy` instalada pelo usuário) e `skills-lock.json` foram para o `.prettierignore`, e `.claude/settings.local.json` para o `.gitignore`. A skill instalada não foi commitada.
