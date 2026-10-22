# Drop 10 — Integração Mercado Livre

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** produtos do Mercado Livre com link de afiliado e preço atualizado.

- [ ] Cadastro no programa **Afiliados e Criadores** do Mercado Livre
- [ ] Gerar links pelo gerador do painel e salvar no JSON (não há API pública de links de afiliado)
- [ ] Script `scripts/sync-mercadolivre.ts`: atualizar preço/disponibilidade pela API pública de itens (ou MCP)
- [ ] Respeitar regras do programa (produtos novos, vendedor com reputação verde)
- [ ] Rodar o sync localmente com `npm run sync:ml` (o agendamento automático foi para o Drop 9, na 2ª wave)
- [ ] Quando houver o mesmo modelo nas duas lojas, mostrar a mais barata

**Pronto quando:** itens do Mercado Livre exibem preço atual e link de afiliado.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
