# Drop 10.1 — Histórico de preço, promoções e imagem

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 11:54 | 2026-10-22 11:58 | 4min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** saber quando o preço caiu ou subiu, destacar promoções e mostrar a foto do produto. (Pedido do usuário durante o Drop 10.)

- [x] Colunas `data` e `imagem` na planilha de afiliados (`ml:links export|import`)
- [x] `history` (data + preço) em cada oferta, gravado só quando o preço muda
- [x] Import e sync registram o preço com a data certa; o sync também traz a imagem
- [x] Card: variação "↓ R$ X (−Y%) desde DD/MM" e selo "Menor preço em 90 dias" (≥ 5% abaixo do maior preço do período)
- [x] Card com a foto do produto
- [x] Validador: histórico em ordem, sem datas repetidas e terminando no preço atual
- [x] Imagens dos 3 produtos do piloto

**Pronto quando:** um produto com histórico mostra a seta e o selo de promoção, e os produtos com link real aparecem com foto. ✅ Seta e selo conferidos por screenshot com histórico de teste (celular e desktop); foto verificada no E2E `produto com link real mostra a foto e o botão da loja`.

## Registro

- **Modelo:** `offers[].history: [{ date, price }]`. O histórico ganha ponto **só quando o preço muda**; no mesmo dia, vale o último preço (e, se voltar ao anterior, o ponto some). Observações mais antigas que a última são ignoradas. Pontos com mais de 365 dias saem, exceto o que estava em vigor na data de corte. `updatedAt` = "visto em" (pode ser mais novo que o último ponto).
- **Funções puras** em `src/data/price-history.ts`: `recordPrice` (único jeito de registrar preço), `priceTrend`, `isPromo`, `addDays` e `shownOffer`.
- **Variação:** compara com o preço anterior do histórico: "↓ R$ 118 (−5%) desde 01/08" em verde, "↑" em laranja.
- **Promoção:** menor preço dos últimos 90 dias e ≥ 5% abaixo do maior preço da janela, contando o preço que já estava em vigor no início dela. Os 5% evitam selo por oscilação de centavos. Constantes: `PROMO_WINDOW_DAYS`, `PROMO_MIN_DROP`, `HISTORY_MAX_DAYS`.
- **Planilha:** colunas novas `data` (AAAA-MM-DD; vazia ou inválida = hoje, com aviso) e `imagem` (só https; inválida é ignorada, com aviso). O export já sai com as duas preenchidas pelo que está no catálogo.
- **Sync:** registra o preço com `recordPrice` e traz a foto (`pictures[0].secure_url` / `thumbnail`) **só se o produto ainda não tiver imagem**, para não sobrescrever uma escolhida à mão.
- **Validador:** histórico em ordem crescente, sem datas repetidas, terminando no preço atual com data até `updatedAt`.
- **Card:** a foto fica num fundo branco (fotos de loja têm fundo branco), com `alt` = nome do produto e `referrerpolicy="no-referrer"`.
- **Fotos dos 3 produtos do piloto** obtidas pelo Chrome (`og:image`, CDN `http2.mlstatic.com`). Os preços conferidos na mesma visita não tinham mudado.
- **Limitação:** o histórico começa com 1 ponto por produto; seta e selo aparecem a partir da segunda coleta com preço diferente.
- **Testes:** 139 unitários (+24) e 19 E2E (+1, foto + link de afiliado).
