# Drop 25 — Histórico para todos e variação da lista

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-30 12:33 | 2026-10-30 12:39 | 6min    |

**Meta:** todo produto de marca com link do Mercado Livre guarda histórico de preço (não só os com link de afiliado), e a lista mostra quanto ficou mais barata ou mais cara de ontem para hoje, numa semana e em 30 dias.

## Tarefas

- [x] `sync:ml`: produto com link direto do produto de catálogo (`/p/MLB…`) e sem afiliado ganha uma oferta do Mercado Livre com esse link; o preço de referência vira o primeiro ponto do histórico. Dali em diante é sincronizado como as outras ofertas.
- [x] `ml:links export`: a coluna `link_afiliado` só recebe link de afiliado (o link direto da oferta não conta), para o `/ml-links` continuar achando esses produtos como "sem link". O `ml:links import` troca só o `url` da oferta e mantém o histórico.
- [x] Histórico recuperado pelo git para os 97 produtos com link direto (73 com variação, ex.: Philips Walita RI7301 R$ 404 → R$ 252) e o ponto anterior do Emma King.
- [x] `src/engine/list-history.ts`: `listChange(view, hoje, dias)` = total da mesma lista na data (itens de hoje com os preços do histórico), itens que mudaram e pontos do gráfico.
- [x] `ListPriceChange` abaixo do resumo: "Lista R$ X mais barata/cara que há 7 dias" (ou ontem, ou 30 dias, o primeiro que mudou); abre com os períodos (Ontem / 7 dias / 30 dias), o texto "Em DD/MM, esta mesma lista custava…", o gráfico do total (reaproveita o `PriceChart`, com legenda própria) e os itens que mudaram, do maior para o menor. Some quando nenhum preço mudou.
- [x] Testes: unitários (`priceOn`, `listChange`, oferta criada pelo sync, export) e E2E com data fixa (`page.clock`).

**Pronto quando:** o card do RI7301 mostra "↓ R$ 152 desde 23/10" com o gráfico, e a lista mostra a variação de ontem, de 7 e de 30 dias.

## Registro

- O total compara a **mesma lista** (itens de hoje) com os preços de antes, não a lista que o motor montaria naquele dia: é o que responde "minha lista ficou mais barata?".
- Item sem histórico (genérico, link `/up` sem catálogo) e item adicionado à mão entram com o preço de hoje nas duas pontas, então não mexem na variação. Antes do primeiro ponto conhecido, vale o primeiro preço.
- O painel fica fora do `role="status"` do resumo, para abrir e fechar sem ser relido pelo leitor de tela.
- 30/10, casa completa com R$ 70 mil: ontem −R$ 97,76; 7 dias +R$ 113,01 (25 itens; maior alta a Smart TV TCL C6K, +R$ 869,95; maior queda o colchão Castor D45, −R$ 600,58).
