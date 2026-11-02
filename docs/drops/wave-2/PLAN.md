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

> **A definir.** Uma frase: o que muda para quem usa o site quando a 2ª wave terminar.

**Pronto quando:** _a definir._

## Candidatos

Ideias levantadas do que ficou aberto. Nada aqui está decidido: escolher, cortar ou juntar ao criar os drops.

| Tema                           | O que é                                                                                                       | De onde veio            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Amazon                         | Preço e link de afiliado da Amazon (Creators API; a PA-API 5.0 acabou em 30/04/2026), "Também na Amazon"      | Drop 9 apagado          |
| Outras lojas afiliadas         | Magalu, Shopee                                                                                                | Backlog (Drop 12)       |
| Indisponível cai de tier       | Produto sem estoque some e o motor usa o próximo tier                                                         | Drop 9 apagado          |
| Analytics sem cookies          | Plausible ou GoatCounter: cliques em "Comprar" e compartilhamentos                                            | Drop 6 → backlog        |
| Domínio próprio                | Site fora do `github.io`                                                                                      | Drop 6 → backlog        |
| Link menor para listas grandes | Não mandar o plano inteiro no link, só o que difere do recalculado (listas grandes passam do limite do is.gd) | Drop 29 (próximo passo) |
| Filtros de produto             | Marca, cor, voltagem (110/220 V), tamanho                                                                     | Backlog (Drop 12)       |
| Comparar opções                | Duas opções lado a lado                                                                                       | Backlog (Drop 12)       |
| Checklist "comprado" / PDF     | Marcar o que já comprou; exportar em PDF                                                                      | Backlog (Drop 12)       |
| Listas prontas                 | "Cozinha de apartamento pequeno — R$ 15k"                                                                     | Backlog (Drop 12)       |

## Decisões em aberto

- [ ] Objetivo e critério de "pronto" da wave
- [ ] Fechar os Drops 10, 11 e 24 antes, ou levar junto com a 2ª wave?
- [ ] Quais candidatos entram (e em que ordem)
- [ ] Integrações que precisam de conta/credencial (Amazon, analytics, domínio): quem cria e onde ficam os segredos (GitHub Secrets ou só na máquina, como o token do Mercado Livre)

## Drops

| Drop | Tema | Meta |
| ---- | ---- | ---- |
| —    | —    | —    |

Numeração continua de onde parou: o próximo drop é o **30** (`drop-30-<tema>.md`), com a tabela de status no topo e a linha em [`docs/drops/README.md`](../README.md), como os da 1ª wave.

## Ordem sugerida

```
a definir
```
