---
name: sync-semanal
description: Rotina semanal do catálogo do House Shopping, tudo numa execução - atualiza os preços do Mercado Livre (sync:ml), confere os links de afiliado no Chrome logado, refaz os quebrados, gera links novos para produtos sem link, roda o check e deixa tudo numa branch com relatório. Use quando o usuário pedir o sync semanal, a rotina da semana ou "atualizar preços e links". Uso: /sync-semanal [quantidade de links novos, padrão 10]
---

# /sync-semanal

Roda as outras skills em sequência, com o Chrome logado do usuário. O usuário está no computador (roda toda segunda às 18h, ver `scripts/agendar-sync-semanal.sh`), então captcha e dúvidas vão para ele, mas o resto segue sem perguntar.

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

Anote no relatório: preços que mudaram (de → para), indisponíveis, sem comissão, não encontrados e avisos do validador. Se o sync inverter tiers de uma categoria (preço do tier 2 passou o do tier 3), troque os tiers como manda a skill `/add-product` e registre.

Erro de token (`invalid_grant`): pare essa etapa, anote e siga para os links; o usuário roda `npm run ml:auth`.

## 2. Conferir os links

Siga a skill `/ml-check-links` com o argumento `todos`, no modo rápido (iframes numa página do Mercado Livre). Leve para o relatório a tabela dos que não estão `ok`.

## 3. Refazer os quebrados

Para cada link `sem afiliado`, `quebrado` ou `produto diferente` que **não** for falso alarme (ver as armadilhas do `/ml-check-links`):

1. Siga a skill `/ml-links` para esse produto (busca, anúncio novo e nacional com a barra de afiliado, gera o link).
2. Antes de importar, apague a oferta antiga do Mercado Livre em `offers` da opção (o `ml:links import` mantém os ids de uma oferta existente) e atualize a linha na planilha (`link_produto`, `link_afiliado`, `preco`, `data`, `imagem`).
3. `npm run ml:links import`.

Sem anúncio bom para o modelo: troque pelo sucessor (regras do `/ml-links`) ou deixe como está e anote no relatório como pendente.

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
Conferidos: N ok, N com problema (tabela). Refeitos: N. Pendentes: N (por quê).

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
