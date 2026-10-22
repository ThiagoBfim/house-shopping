# Drop 13 — Casa inteira e banheiro

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 16:26 | 2026-10-22 16:33 | 7min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** montar a lista da casa toda com um orçamento só, escolhendo quantos cômodos de cada tipo; e adicionar o banheiro. (Pedido do usuário; veio do backlog, Drop 12.)

- [x] Cômodo **Banheiro** com categorias reais (necessidade, utensílios, 4 tiers nos caros)
- [x] Motor: expandir a casa em instâncias de cômodo (`quarto-1`, `quarto-2`…) e planejar tudo com um orçamento só
- [x] Tela "Casa inteira": quantidade por cômodo (0–5), orçamento total, filtros e faixa de orçamento
- [x] Lista agrupada por cômodo, com subtotal de cada um
- [x] Link compartilhado com a composição da casa (links antigos continuam funcionando)
- [x] Testes (unitários + E2E) e documentação

**Pronto quando:** "1 cozinha, 2 quartos, 1 quarto do bebê, 1 banheiro" com R$ 60.000 gera uma lista completa, agrupada por cômodo, e o link compartilhado reproduz a mesma lista. ✅ E2E `casa inteira: um orçamento só e lista agrupada por cômodo` e `link compartilhado da casa abre a mesma lista em outro aparelho`.

## Registro

- **Uma tela só para um cômodo ou a casa toda** (pedido do usuário durante o drop). Cada cômodo é uma linha com contador (0–5): tocar na linha liga/desliga e o "+" adiciona mais um. Atalhos: "Casa completa" (um de cada, menos o quarto do bebê) e "Limpar". O botão do rodapé diz quantos cômodos ("Continuar com 5 cômodos").
- **A "planta":** no topo, uma planta baixa se monta com os cômodos escolhidos: parede externa grossa, paredes internas finas, cozinha/sala/área externa ocupando duas colunas e o espaço livre hachurado. Este é o elemento marcante (skill `frontend-design`); o resto segue a identidade atual, e troquei a grade de cards por linhas para não cair no "kit SaaS".
- **Motor** (`src/engine/house.ts`): `expandHouse` transforma `{ quarto: 2, … }` em instâncias (`quarto-1`, `quarto-2`) e itens com chave `instância:categoria`, apelidando o catálogo. O motor de orçamento não mudou: só recebe um "cômodo" com todos os itens da casa e planeja com **um orçamento só** (necessários de todos os cômodos primeiro, upgrades pela necessidade).
- **Sessão** = `house` (cômodos + quantidades) em vez de `roomId`. Um cômodo só é `{ cozinha: 1 }`; não há modo separado.
- **Link compartilhado:** grava `h` (casa). Links antigos (`r`, um cômodo, chaves sem instância) são convertidos ao abrir, mantendo `STATE_VERSION = 1`. Há teste para isso.
- **Lista:** com mais de um cômodo, fica agrupada (título + quantidade de itens + subtotal), com uma fileira de atalhos que rola até o cômodo (não usa âncora `#`, porque o hash guarda a lista). Avisos e listas laterais dizem o cômodo: "Colchão (Quarto 1) recusado.".
- **"← Cômodos"** (antes "← Trocar cômodo") volta para a escolha **mantendo** a seleção e a lista, para ajustar a casa. Antes apagava tudo; o E2E foi atualizado.
- **Orçamento:** as sugestões saem da faixa real da seleção (`suggestBudgets`: tudo no mais barato, ¼, ½ e topo, arredondados em R$ 1/5/10 mil). Os valores fixos de R$ 10–50 mil não serviam para a casa.
- **Banheiro:** 9 itens, 30 opções com preços de referência e links de busca:
  - chuveiro (5);
  - toalhas (4, utensílio);
  - box (3);
  - gabinete com cuba e espelheira (3);
  - kit de acessórios (3, utensílio);
  - ducha higiênica (2);
  - tapete e lixeira (2, utensílios);
  - secador (1).

  Criado só com os arquivos novos, **sem rodar o gerador antigo**, que apagaria links e fotos já importados. Fontes: guias de 2026 (Buscapé, mybest, Amo Produtinhos) e listagens de gabinetes.

- **Ordem dos cômodos:** a ordem do `rooms.json` define a ordem da planta e da lista; o banheiro fica antes da área externa, como na tela.
- **Planilha de afiliados:** recebeu as 30 linhas do banheiro sem ser regenerada (o `export --force` apagaria os 13 links ainda não importados). Total: 222 linhas, 16 com link.
- **Correções visuais por screenshot:** o texto da planta vazia ficava na primeira coluna, e o espaço livre aparecia como bloco preto (as paredes eram o fundo aparecendo nos espaços); as paredes viraram contorno de cada cômodo. Ao pular para um cômodo, o título ficava atrás do resumo fixo (`scroll-margin-top`).
- **`Project.md`:** removido um fragmento duplicado da tabela de cômodos que tinha sobrado do Drop 8.
- **Testes:** 152 unitários (+13: casa, link novo/antigo, sugestões) e 24 E2E (+5: planta, casa agrupada, recusa por cômodo, link da casa, banheiro).
