# House Shopping — Plano de Implementação

O plano é dividido em **drops** (entregas pequenas e independentes). Cada drop tem 3–8 tarefas e termina com algo **funcionando e verificável**. Veja o contexto em [Project.md](Project.md) e as ferramentas em [Skills.md](Skills.md).

As tarefas, o status e os tempos de cada drop ficam em [`docs/drops/`](../drops/README.md).

### 1ª wave — produto completo, rodando e publicado

| Drop                                                                | Tema                            | Meta                                                   |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ |
| [0](../drops/drop-00-fundacao-do-repositorio.md)                    | Fundação do repositório         | Build, lint e testes rodando                           |
| [1](../drops/drop-01-modelo-de-dados-e-validacao.md)                | Modelo de dados e validação     | JSONs com schema validado automaticamente              |
| [2](../drops/drop-02-motor-de-orcamento.md)                         | Motor de orçamento              | Função pura (cômodo, orçamento, escolhas) → lista      |
| [3](../drops/drop-03-interface-basica.md)                           | Interface básica                | Escolher cômodo + orçamento e ver a lista              |
| [4](../drops/drop-04-interacoes-recusar-mais-barato-caro-reload.md) | Interações                      | Recusar, mais barato/caro, travar, reload              |
| [5](../drops/drop-05-persistencia-e-compartilhamento.md)            | Persistência e compartilhamento | Estado na URL, link no WhatsApp                        |
| [5.1](../drops/drop-05-1-necessidade-e-utensilios.md)               | Necessidade e utensílios        | Necessidade 1–5, utensílios e filtros                  |
| [6](../drops/drop-06-deploy-no-github-pages.md)                     | Deploy no GitHub Pages          | Site no ar com deploy automático, checks e releases    |
| [7](../drops/drop-07-catalogo-real-cozinha.md)                      | Catálogo real: Cozinha          | 4 tiers reais por produto caro                         |
| [8](../drops/drop-08-catalogo-real-demais-comodos.md)               | Catálogo real: demais cômodos   | Quarto, Sala, Quarto do bebê, Área externa             |
| [10](../drops/drop-10-integracao-mercado-livre.md)                  | Integração Mercado Livre        | Links de afiliado + preço atualizado                   |
| [10.1](../drops/drop-10-1-historico-de-preco-e-imagem.md)           | Histórico de preço e imagem     | Preço subiu/caiu, promoções e foto                     |
| [11](../drops/drop-11-qualidade-legal-e-metricas.md)                | Qualidade, legal e métricas     | Lighthouse ≥ 90, acessibilidade, avisos legais         |
| [13](../drops/drop-13-casa-inteira-e-banheiro.md)                   | Casa inteira e banheiro         | Vários cômodos com um orçamento só + banheiro          |
| [24](../drops/drop-24-sync-semanal-com-pr.md)                       | Sync semanal de preços e links  | `/sync-semanal`: preços, links e relatório numa branch |

### Backlog

| Drop                                        | Tema                | Meta                          |
| ------------------------------------------- | ------------------- | ----------------------------- |
| [12](../drops/drop-12-evolucoes-backlog.md) | Evoluções (backlog) | Ideias para depois da 1ª wave |

## Ordem sugerida

```
1ª wave:  0 → 1 → 2 → 3 → 4 → 5 → 5.1  (feitos)
          → 7 (Cozinha real) → 8 (demais cômodos) → 10 (Mercado Livre) → 11 (qualidade)
          → 6 (deploy no GitHub Pages, feito) → 24 (sync semanal)
Backlog:  12
```

A **1ª wave** termina com o produto completo e publicado no GitHub Pages (Drop 6): todos os cômodos com produtos reais, links de afiliado do Mercado Livre, recusar / mais barato / mais caro / reload / filtros / compartilhar. A 2ª wave está sendo planejada em [`docs/drops/wave-2/PLAN.md`](../drops/wave-2/PLAN.md).
