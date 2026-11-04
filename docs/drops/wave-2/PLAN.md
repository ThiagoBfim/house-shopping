# 2ª wave — Plano

Rascunho da 2ª wave, replanejada do zero em 2026-11-02 (a anterior, só com a Integração Amazon, foi apagada). Os drops desta wave ficam nesta pasta; o plano geral está em [`docs/project/Plan.md`](../../project/Plan.md) e o status de todos os drops em [`docs/drops/README.md`](../README.md).

## Onde a 1ª wave parou

- **No ar:** https://thiagobfim.github.io/house-shopping/ (deploy pela pipeline, release a cada deploy, `main` protegida).
- **Produto:** todos os cômodos com catálogo real, motor de orçamento, trocar/adicionar itens, assistente "Monte pra mim", Excel, histórico de preço, link curto para o WhatsApp.
- **Ainda abertos na 1ª wave:**
  - [Drop 10](../drop-10-integracao-mercado-livre.md) — links de afiliado do Mercado Livre: **140/484**.
  - [Drop 11](../drop-11-qualidade-legal-e-metricas.md) — avisos legais, Lighthouse ≥ 90, acessibilidade, página "Sobre".
  - [Drop 24](../drop-24-sync-semanal-com-pr.md) — rotina `/sync-semanal` (falta conferir o push + PR no fim, agora que o repositório existe).

## Objetivo da wave

Três funcionalidades novas, nesta ordem:

1. **Planta → móveis → desenho:** a pessoa envia a planta da casa (imagem ou PDF), o site identifica os cômodos e o tamanho de cada um, sugere os móveis e desenha o imóvel com os móveis em cada cômodo.
2. **Preços mais baratos:** um botão procura os produtos da lista mais baratos em outras lojas e troca links e preços, com como voltar ao que era antes.
3. **Cobrança:** as duas funcionalidades acima passam a ser pagas.

**Primeiro localmente, com o Claude Code.** As funcionalidades 1 e 2 rodam na máquina: um backend local (`server/`) chama o `claude -p` com uma skill (`/floor-plan` e a `/search-better-prices` que já existe). No site, elas ficam atrás de chaves ("Recursos em teste") que só aparecem quando o backend local está rodando; o site publicado não muda. A cobrança é a última: depende de levar o backend para a nuvem.

**Pronto quando:** rodando localmente, enviar uma planta monta a casa com os cômodos e os móveis certos e mostra o desenho; o botão de preços troca os itens por ofertas mais baratas e "Voltar ao que era antes" desfaz tudo.

## Drops

| Drop                                      | Tema                               | Meta                                                                               |
| ----------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| [30](drop-30-backend-local-e-recursos.md) | Backend local e recursos em teste  | `npm run server` chama o Claude Code; chaves no site                               |
| [31](drop-31-planta-para-comodos.md)      | Planta → cômodos e móveis          | Enviar a planta preenche os cômodos, com a cama pelo tamanho do quarto             |
| [32](drop-32-desenho-da-planta.md)        | Desenho do imóvel com os móveis    | Planta esquemática com os móveis da lista em cada cômodo                           |
| [33](drop-33-precos-mais-baratos.md)      | Preços mais baratos (com desfazer) | Botão que troca links e preços pelos mais baratos; voltar ao anterior              |
| [35](drop-35-medidas-dos-produtos.md)     | Medidas dos produtos               | Largura × profundidade × altura de cada móvel (API do ML + medida típica)          |
| [36](drop-36-posicao-dos-moveis.md)       | Posição dos móveis na planta       | Vista de cima em escala com os móveis no melhor lugar                              |
| [37](drop-37-visualizacao-3d.md)          | Visualização 3D                    | Cena 3D com os móveis; tocar mostra nome, medida, preço                            |
| [38](drop-38-casa-em-3d.md)               | Casa inteira em 3D                 | Planta + fotos → casa em 3D com os móveis; primeira pessoa e tour em vídeo         |
| [39](drop-39-casa-3d-realista.md)         | Casa em 3D realista                | Botão realista (texturas, céu, render) e armários das fotos                        |
| [40](drop-40-mover-moveis.md)             | Mover os móveis                    | Vista de cima igual ao 3D; arrastar e girar; 3D com a lista e as posições de agora |
| [41](drop-41-fluxo-da-planta-e-chat.md)   | Fluxo da planta e chat             | Passos planta → móveis → posições em 3D (chat com IA) → projeto em 3D              |
| [34](drop-34-cobranca.md)                 | Cobrança                           | Cobrar pelas funcionalidades 1 e 2 (por último)                                    |

## Ordem sugerida

```
30 (backend local) → 31 (planta → cômodos) → 32 (desenho) → 33 (preços mais baratos)
→ 35 (medidas) → 36 (posição dos móveis) → 37 (3D) → 38 (casa em 3D) → 39 (realista) → 40 (mover móveis) → 41 (fluxo e chat) → 34 (cobrança)
```

## Decisões

- **Claude Code local antes da nuvem:** valida as funcionalidades sem conta, chave de API nem custo de infraestrutura. O custo de cada uso aparece no `total_cost_usd` da resposta do `claude -p` e serve para precificar a cobrança.
- **Sem crawler:** a busca de preços usa a skill `/search-better-prices` (pesquisa no Google e confere a página da loja), não um robô que varre as lojas.
- **Desenho esquemático:** cômodos como retângulos na posição da planta e os móveis como ícones; disposição realista dos móveis fica fora desta wave.

## Em aberto

- [ ] Para a cobrança (Drop 34): backend na nuvem (sugestão: Supabase), meio de pagamento (Mercado Pago ou Stripe), CNPJ/MEI, preço por uso.
- [ ] Fechar os Drops 10, 11 e 24 da 1ª wave antes ou junto com esta.

## Outras ideias (fora desta wave)

Amazon (Creators API), outras lojas afiliadas (Magalu, Shopee), produto indisponível cair de tier, analytics sem cookies, domínio próprio, link menor para listas grandes, filtros de produto, comparar opções, checklist "comprado"/PDF e listas prontas. Ficam no [backlog (Drop 12)](../drop-12-evolucoes-backlog.md) ou para a próxima wave.
