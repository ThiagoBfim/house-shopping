# Drop 17 — Economia com "já tenho" e recusados

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 18:27 | 2026-10-22 18:30 | 3min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** mostrar quanto o usuário economiza com os itens recusados e os que ele já tem. (Pedido do usuário.)

- [x] Motor: `saved` em cada item excluído e `view.saved` (já tenho / recusados)
- [x] Resumo: "💰 Você economiza R$ X com “já tenho” e recusados" (só aparece quando há algum)
- [x] Seção "Recusados e “já tenho”": total, divisão por motivo e valor de cada item
- [x] Testes (unitários + E2E)

## Registro

- **Valor de cada item = opção mais barata × quantidade**: é o mínimo que o item custaria. Usar o tier em que estava faria o número mudar a cada "Recalcular" (o plano deixa de ter o item depois do reload), então a tela diz "contando o modelo mais barato de cada item".
- A economia não entra no saldo nem no orçamento: é só informativa.
