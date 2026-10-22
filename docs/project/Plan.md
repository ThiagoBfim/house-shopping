# House Shopping — Plano de Implementação

O plano é dividido em **drops** (entregas pequenas e independentes). Cada drop tem 3–8 tarefas e termina com algo **funcionando e verificável**. Veja o contexto em [Project.md](Project.md) e as ferramentas em [Skills.md](Skills.md).

As tarefas, o status e os tempos de cada drop ficam em [`docs/drops/`](../drops/README.md).

| Drop                                                                | Tema                            | Meta                                              |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| [0](../drops/drop-00-fundacao-do-repositorio.md)                    | Fundação do repositório         | Build, lint e testes rodando                      |
| [1](../drops/drop-01-modelo-de-dados-e-validacao.md)                | Modelo de dados e validação     | JSONs com schema validado automaticamente         |
| [2](../drops/drop-02-motor-de-orcamento.md)                         | Motor de orçamento              | Função pura (cômodo, orçamento, escolhas) → lista |
| [3](../drops/drop-03-interface-basica.md)                           | Interface básica                | Escolher cômodo + orçamento e ver a lista         |
| [4](../drops/drop-04-interacoes-recusar-mais-barato-caro-reload.md) | Interações                      | Recusar, mais barato/caro, travar, reload         |
| [5](../drops/drop-05-persistencia-e-compartilhamento.md)            | Persistência e compartilhamento | Estado na URL, link no WhatsApp                   |
| [6](../drops/drop-06-deploy-no-github-pages.md)                     | Deploy no GitHub Pages          | Deploy automático a cada push                     |
| [7](../drops/drop-07-catalogo-real-cozinha.md)                      | Catálogo real: Cozinha          | 4 tiers reais por produto caro                    |
| [8](../drops/drop-08-catalogo-real-demais-comodos.md)               | Catálogo real: demais cômodos   | Quarto, Sala, Quarto do bebê, Área externa        |
| [9](../drops/drop-09-integracao-amazon-afiliados.md)                | Integração Amazon               | Preços e links via Creators API (cron)            |
| [10](../drops/drop-10-integracao-mercado-livre.md)                  | Integração Mercado Livre        | Links de afiliado + preço atualizado              |
| [11](../drops/drop-11-qualidade-legal-e-metricas.md)                | Qualidade, legal e métricas     | Lighthouse ≥ 90, avisos, analytics                |
| [12](../drops/drop-12-evolucoes-backlog.md)                         | Evoluções (backlog)             | Ideias pós-MVP                                    |

## Ordem sugerida

```
Drop 0 → 1 → 2 → 3 → 4 → 5 → 6   (MVP com dados mock, já publicado)
          └→ 7 (pode começar em paralelo a partir do Drop 1)
Drop 8 → 9 → 10 → 11 → 12
```

O **MVP** é o fim do Drop 7: Cozinha com dados reais, publicada no GitHub Pages, com recusar / mais barato / mais caro / reload / compartilhar.
