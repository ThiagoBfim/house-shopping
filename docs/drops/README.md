# Drops

Cada drop é um arquivo neste diretório; os da 2ª wave ficam em [`wave-2/`](wave-2/). Visão geral do plano em [../project/Plan.md](../project/Plan.md).

## Como registrar o tempo

No topo de cada drop há uma tabela:

| Status | Iniciado em | Terminado em | Duração |
| ------ | ----------- | ------------ | ------- |

- **Status:** `⏳ A fazer` → `🚧 Em andamento` → `✅ Concluído` (ou `⛔ Bloqueado`)
- **Iniciado em / Terminado em:** `AAAA-MM-DD HH:MM` (horário local)
- **Duração:** tempo corrido entre início e fim, ex. `1h 25min` ou `2d 3h`
- Pausas longas, decisões e problemas vão na seção **Registro** do drop.

## Status

### 1ª wave — produto completo rodando localmente

Tudo funcionando na máquina: catálogo real de todos os cômodos, links de afiliado do Mercado Livre e qualidade/avisos legais.

| Drop                                                       | Tema                                  | Status                          | Iniciado em      | Terminado em     | Duração |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------- | ---------------- | ---------------- | ------- |
| [0](drop-00-fundacao-do-repositorio.md)                    | Fundação do repositório               | ✅ Concluído                    | 2026-10-22 09:16 | 2026-10-22 09:19 | 3min    |
| [1](drop-01-modelo-de-dados-e-validacao.md)                | Modelo de dados e validação           | ✅ Concluído                    | 2026-10-22 09:21 | 2026-10-22 09:23 | 2min    |
| [2](drop-02-motor-de-orcamento.md)                         | Motor de orçamento                    | ✅ Concluído                    | 2026-10-22 09:35 | 2026-10-22 09:37 | 2min    |
| [3](drop-03-interface-basica.md)                           | Interface básica                      | ✅ Concluído                    | 2026-10-22 09:38 | 2026-10-22 09:40 | 2min    |
| [4](drop-04-interacoes-recusar-mais-barato-caro-reload.md) | Interações                            | ✅ Concluído                    | 2026-10-22 09:41 | 2026-10-22 09:44 | 3min    |
| [5](drop-05-persistencia-e-compartilhamento.md)            | Persistência e compartilhamento       | ✅ Concluído                    | 2026-10-22 09:44 | 2026-10-22 09:47 | 3min    |
| [5.1](drop-05-1-necessidade-e-utensilios.md)               | Necessidade e utensílios              | ✅ Concluído                    | 2026-10-22 09:58 | 2026-10-22 10:04 | 6min    |
| [7](drop-07-catalogo-real-cozinha.md)                      | Catálogo real: Cozinha                | ✅ Concluído                    | 2026-10-22 10:19 | 2026-10-22 10:24 | 5min    |
| [8](drop-08-catalogo-real-demais-comodos.md)               | Catálogo real: demais cômodos         | ✅ Concluído                    | 2026-10-22 10:25 | 2026-10-22 10:30 | 5min    |
| [10](drop-10-integracao-mercado-livre.md)                  | Integração Mercado Livre              | 🚧 Em andamento — 140/484 links | 2026-10-22 10:48 | —                | —       |
| [10.1](drop-10-1-historico-de-preco-e-imagem.md)           | Histórico de preço e imagem           | ✅ Concluído                    | 2026-10-22 11:54 | 2026-10-22 11:58 | 4min    |
| [11](drop-11-qualidade-legal-e-metricas.md)                | Qualidade, legal e métricas           | ⏳ A fazer                      | —                | —                | —       |
| [13](drop-13-casa-inteira-e-banheiro.md)                   | Casa inteira e banheiro               | ✅ Concluído                    | 2026-10-22 16:26 | 2026-10-22 16:33 | 7min    |
| [13.1](drop-13-1-faixas-de-orcamento.md)                   | Três faixas de orçamento              | ✅ Concluído                    | 2026-10-22 16:38 | 2026-10-22 16:40 | 2min    |
| [14](drop-14-layout-busca-e-utilidades.md)                 | Layout, busca e utilidades            | ✅ Concluído                    | 2026-10-22 17:30 | 2026-10-22 17:51 | 21min   |
| [15](drop-15-escritorio-e-gamer.md)                        | Escritório (com opção gamer)          | ✅ Concluído                    | 2026-10-22 17:52 | 2026-10-22 18:07 | 15min   |
| [16](drop-16-tema-claro-escuro.md)                         | Tema claro / escuro                   | ✅ Concluído                    | 2026-10-22 18:08 | 2026-10-22 18:10 | 2min    |
| [17](drop-17-economia-dos-recusados.md)                    | Economia com já tenho e recusados     | ✅ Concluído                    | 2026-10-22 18:27 | 2026-10-22 18:30 | 3min    |
| [18](drop-18-assistente-monte-pra-mim.md)                  | Assistente "Monte pra mim"            | ✅ Concluído                    | 2026-10-22 19:14 | 2026-10-22 19:34 | 20min   |
| [19](drop-19-exportar-excel.md)                            | Exportar a lista em Excel             | ✅ Concluído                    | 2026-10-22 20:12 | 2026-10-22 20:16 | 4min    |
| [20](drop-20-itens-manuais.md)                             | Adicionar itens manualmente           | ✅ Concluído                    | 2026-10-23 13:55 | 2026-10-23 14:01 | 6min    |
| [21](drop-21-limpeza-reparos-e-itens-faltando.md)          | Limpeza, reparos e itens que faltavam | ✅ Concluído                    | 2026-10-23 17:44 | 2026-10-23 17:52 | 8min    |
| [22](drop-22-suas-respostas-na-lista.md)                   | Suas respostas na lista               | ✅ Concluído                    | 2026-10-23 18:02 | 2026-10-23 18:20 | 18min   |
| [23](drop-23-grafico-de-preco.md)                          | Gráfico de preço                      | ✅ Concluído                    | 2026-10-25 06:10 | 2026-10-25 06:27 | 17min   |

### 2ª wave — publicação e automação

Site no ar no GitHub Pages e preços da Amazon atualizados sozinhos (o agendamento do sync do Mercado Livre vem junto).

| Drop                                               | Tema                   | Status     | Iniciado em | Terminado em | Duração |
| -------------------------------------------------- | ---------------------- | ---------- | ----------- | ------------ | ------- |
| [6](wave-2/drop-06-deploy-no-github-pages.md)      | Deploy no GitHub Pages | ⏳ A fazer | —           | —            | —       |
| [9](wave-2/drop-09-integracao-amazon-afiliados.md) | Integração Amazon      | ⏳ A fazer | —           | —            | —       |

### Backlog

| Drop                               | Tema                | Status     | Iniciado em | Terminado em | Duração |
| ---------------------------------- | ------------------- | ---------- | ----------- | ------------ | ------- |
| [12](drop-12-evolucoes-backlog.md) | Evoluções (backlog) | ⏳ A fazer | —           | —            | —       |
