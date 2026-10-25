# Drop 23 — Gráfico de preço

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-25 06:10 | 2026-10-25 06:27 | 17min   |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** quando o preço de um produto subiu ou caiu, um toque mostra o gráfico do preço, só com os dias em que ele mudou, nos últimos 6 meses. (Pedido do usuário.)

**Pronto quando:** no card com "↑ R$ 3 (+5%) desde 22/10", tocar em "Ver gráfico" abre, dentro do card, um gráfico em degraus com um ponto por mudança (data e preço) que vai até hoje, com menor e maior preço do período; tocar de novo fecha.

## Tarefas

- [x] `chartPoints` e `subtractMonths` (`src/data/price-history.ts`): mudanças de preço dos últimos `CHART_MONTHS` (6) meses; o preço que já valia antes da janela entra no início dela
- [x] `PriceChart.tsx`: SVG feito à mão (sem biblioteca), linha em degraus na cor da variação (verde caiu, laranja subiu), pontos com preço e data, "hoje" no fim do eixo, rótulos que não se sobrepõem, lista escondida para leitor de tela e "Menor · Maior"
- [x] `ProductCard.tsx`: a variação de preço vira botão ("Ver gráfico" / "Esconder gráfico", `aria-expanded`); o gráfico abre numa linha nova do card (embaixo do preço no celular, na coluna do texto no desktop)
- [x] Testes: `chartPoints`/`subtractMonths` e E2E abrindo e fechando o gráfico

## Decisões

- **Só aparece quando há variação** (o mesmo critério do "↑/↓ desde"): sem mudança de preço não há o que desenhar.
- **Degraus, não linha reta:** o preço vale do dia em que mudou até a próxima mudança; uma reta entre os pontos inventaria preços intermediários.
- **Eixo do tempo proporcional** do primeiro ponto até hoje; com muitos pontos, só primeiro, último, menor e maior ganham rótulo de preço, e datas próximas demais não se sobrepõem.
- **Sem biblioteca de gráfico:** um SVG pequeno resolve e não pesa no bundle.

## Registro
