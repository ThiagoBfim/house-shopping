# Drop 2 — Motor de orçamento

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Meta:** função pura que transforma (cômodo, orçamento, escolhas) em lista.

- [ ] `buildList(room, budget, state)` — essenciais no tier 1 → importantes → desejáveis
- [ ] Fase de upgrades: sobe tiers por `weight` enquanto houver saldo
- [ ] Respeitar itens **travados** (tier fixo) e **recusados** (excluídos)
- [ ] Retornar total, saldo e aviso "faltam R$ X" quando os essenciais não cabem
- [ ] Suporte a `qty` (ex.: 4 cadeiras)
- [ ] Testes: orçamento baixo, alto, exato, tudo travado, tudo recusado
- [ ] Garantir determinismo (mesma entrada → mesma saída, essencial para links compartilhados)

**Pronto quando:** cobertura de testes do motor ≥ 90%.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
