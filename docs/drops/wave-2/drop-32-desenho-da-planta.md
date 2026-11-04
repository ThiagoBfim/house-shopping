# Drop 32 — Desenho do imóvel com os móveis

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 17:59 | 2026-11-02 18:01 | 2min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** na lista, um desenho esquemático do imóvel: cada cômodo na posição da planta, com os móveis da lista dentro.

**Pronto quando:** depois de montar a lista pela planta, o painel "Sua planta" mostra os cômodos com nome, área e os ícones dos itens da lista; tocar num cômodo leva aos itens dele.

## Tarefas

- [x] Planta lida guardada no navegador (não vai no link compartilhado)
- [x] `src/engine/floor-plan.ts`: o que desenhar em cada cômodo (itens da lista, trocas e adicionados)
- [x] Componente SVG `FloorPlanDrawing` na lista, com a chave "Planta da casa" ligada
- [x] Testes unitários e E2E

## Registro

- **Desenho:** SVG com os retângulos da planta na proporção dela (`aspect`); cômodos da lista em verde e clicáveis (levam ao cômodo na lista), os de fora em branco. Ícones = itens da lista na ordem de importância, cada ícone uma vez (cama, colchão e roupa de cama dividem o 🛏); o que não cabe vira "+N".
- **Guardado no navegador** (`house-shopping:floor-plan`), não no link compartilhado. O desenho só aparece com a chave ligada e se a planta tem cômodos da casa atual.
