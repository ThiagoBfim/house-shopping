---
name: sync-semanal
description: Rotina semanal do catálogo do House Shopping, tudo numa execução - atualiza os preços do Mercado Livre (sync:ml), confere os links de afiliado no Chrome logado, refaz os quebrados, gera links novos para produtos sem link, roda o check e deixa tudo numa branch com relatório. Use quando o usuário pedir o sync semanal, a rotina da semana ou "atualizar preços e links". Uso: /sync-semanal [quantidade de links novos, padrão 10]
---

# /sync-semanal

Roda as outras skills em sequência, com o Chrome logado do usuário. O usuário roda à mão, uma vez por semana, e está no computador, então captcha e dúvidas vão para ele, mas o resto segue sem perguntar.

Argumento: quantos produtos **sem link** ganham link novo nesta rodada (padrão `10`; `0` pula essa etapa).

Durante tudo: "Stop"/"Pause" do usuário para a navegação na hora; o que já foi feito fica no relatório.

## 0. Preparar

- Data de hoje (`AAAA-MM-DD`) e horário de início: anote para o relatório.
- `git status --short data/`: se `data/` já tiver mudança antes de começar, **pare e pergunte** (pode ser de outra sessão ou link ainda não importado).
- Crie a branch a partir da `main` atualizada: `git switch main && git switch -c sync/<data>` (se a branch existir, use `sync/<data>-2`). Se a `main` tiver mudanças fora de `data/` (outra sessão), não mexa nelas: só não as inclua no commit.
- Node 24: `eval "$(fnm env)"; fnm use 24 >/dev/null`.
- Relatório em `docs/sync/<data>.md`, preenchido a cada etapa (não guarde só na conversa).

## 1. Preços

```bash
npm run sync:ml
```

Anote no relatório: preços que mudaram (de → para), indisponíveis, sem comissão, não encontrados, **"💰 Mais barato no mesmo produto"** (vai para a etapa 3b) e avisos do validador. Se o sync inverter tiers de uma categoria (preço do tier 2 passou o do tier 3), troque os tiers como manda a skill `/add-product` e registre.

**Subiu mais de 20% na semana** (ex.: lava e seca Samsung de R$ 4.179 para R$ 5.262) e não está no 💰: nenhum vendedor do Mercado Livre tem o mesmo produto mais barato. Liste no relatório em "Para revisar fora do Mercado Livre" com uma busca no Google Shopping pelo modelo (mesmo modelo ou o sucessor, em Magalu, Casas Bahia, Amazon…), para o usuário decidir se troca de modelo ou de loja (outra loja não gera comissão de afiliado do Mercado Livre).

Erro de token (`invalid_grant`): pare essa etapa, anote e siga para os links; o usuário roda `npm run ml:auth`.

## 2. Conferir os links

Siga a skill `/ml-check-links` com o argumento `todos`, no modo rápido (iframes numa página do Mercado Livre). Leve para o relatório a tabela dos que não estão `ok`.

## 3. Refazer os quebrados

Para cada link `sem afiliado`, `quebrado` ou `produto diferente` que **não** for falso alarme (ver as armadilhas do `/ml-check-links`):

1. Siga a skill `/ml-links` para esse produto (busca, anúncio novo e nacional com a barra de afiliado, gera o link).
2. Antes de importar, apague a oferta antiga do Mercado Livre em `offers` da opção (o `ml:links import` mantém os ids de uma oferta existente) e atualize a linha na planilha (`link_produto`, `link_afiliado`, `preco`, `data`, `imagem`).
3. `npm run ml:links import`.

Sem anúncio bom para o modelo: troque pelo sucessor (regras do `/ml-links`) ou deixe como está e anote no relatório como pendente.

## 3b. Trocar para o vendedor mais barato

O link de afiliado segue um anúncio só: se o vendedor dele sobe o preço, o site mostra o preço alto mesmo com outro vendedor do mesmo produto mais barato. O `sync:ml` lista esses casos em **"💰 Mais barato no mesmo produto"** (≥ 5% de economia, vendedor confiável, novo), já com o endereço do anúncio mais barato.

Da maior economia em reais para a menor (até 15 por rodada; o resto fica para a próxima, anotado):

1. Abra o endereço do 💰 e siga a etapa 2 do `/ml-links` (novo, nacional, barra de afiliado, vendedor; o preço que vale é o da página). Vendedor pessoa física em item caro ou sem histórico: pule e anote.
2. Gere o link e atualize a linha na planilha (`link_produto` = o endereço do 💰, `link_afiliado`, `preco`, `data`, `imagem`). Mesmo produto de catálogo: **não** apague a oferta (o histórico de preço continua).
3. Se o preço novo inverter tiers, troque os tiers (regras do `/add-product`).

Depois do `npm run ml:links import`, confira que o `externalId` da oferta virou o anúncio novo e que o produto saiu do 💰 num novo `npm run sync:ml`.

## 4. Links novos

Se o argumento for maior que 0: siga a skill `/ml-links <quantidade>` (os mais caros sem link). Anote quantas linhas da planilha têm link no fim.

## 5. Conferir e guardar

```bash
npm run check
```

Corrija o que for do catálogo (tiers, campos faltando) e rode de novo. Se um erro não for do catálogo (teste quebrado por outro motivo), não force: anote no relatório.

Feche o relatório `docs/sync/<data>.md`:

```markdown
# Sync semanal — DD/MM/AAAA

| Início | Fim | Duração |
| ------ | --- | ------- |

## Preços
N mudaram (tabela produto · de · para), indisponíveis, sem comissão.

## Links
Conferidos: N ok, N com problema (tabela). Refeitos: N. Trocados para vendedor mais barato: N (tabela produto · de · para · vendedor). Pendentes: N (por quê).

## Para revisar fora do Mercado Livre
Produtos que subiram mais de 20% sem alternativa no Mercado Livre (produto · de · para · achado em outra loja).

## Links novos
N gerados (tabela produto · preço · vendedor). Planilha: X de Y com link.

## Check
✅ passou / ❌ o que falhou.
```

Commit só do que a rotina mexeu (`data/products/`, `data/affiliate/mercadolivre.csv`, `data/rooms.json` se trocou modelo, `docs/sync/<data>.md`), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`:

```bash
git add data/products data/affiliate/mercadolivre.csv docs/sync/<data>.md
git commit -m "Sync semanal (DD/MM): N preços, N links refeitos, N links novos"
```

Se houver remoto (`git remote` não vazio): `git push -u origin sync/<data>` e `gh pr create --title "Sync semanal DD/MM" --body-file docs/sync/<data>.md`. Sem remoto, a branch fica local.

Não faça merge na `main`: o usuário revisa.

## 6. Resumo para o usuário

Uma tela só: totais de cada etapa, o que ficou pendente e o que ele precisa fazer (revisar a branch/PR, rodar `npm run ml:auth`, resolver captcha que interrompeu algo).

## Armadilhas

- Captcha no Chrome: pare, peça ao usuário para resolver e retome a etapa de onde parou.
- A extensão do Chrome cai em lotes grandes: siga os limites de lote de cada skill.
- Rodar `sync:ml` depois de importar links novos não é preciso: o `ml:links import` já grava preço e histórico.
- Nunca rode `npm run ml:links export -- --force` no meio da rotina (apaga links ainda não importados).
- Não leia nem grave `.env.local`, `.ml-token.json` ou o client secret.
