# Drop 24 — Sync semanal de preços e links

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-10-27 20:06 | —            | —       |

**Wave:** 1ª — produto completo (movido da 2ª wave em 2026-11-02)

**Meta:** uma vez por semana, um comando só (`/sync-semanal`, rodado à mão) atualiza os preços do Mercado Livre, confere os links de afiliado, refaz os quebrados, gera links novos e deixa tudo numa branch com relatório para revisar.

**Por que na máquina, com o Claude, e não no GitHub Actions:** link de afiliado só sai do "Gerador de links" com o usuário logado (não há API), e conferir os links também precisa do Chrome logado. Na máquina, o token do Mercado Livre continua num app só (o Mercado Livre aceita apenas o último refresh token gerado, então CI e máquina no mesmo app se derrubariam).

## Tarefas

- [x] Skill `/sync-semanal [links novos, padrão 10]` que orquestra as outras: `sync:ml` → `/ml-check-links todos` → refaz os quebrados com `/ml-links` → `/ml-links N` para produtos sem link → `npm run check` → commit numa branch `sync/AAAA-MM-DD` com o relatório `docs/sync/AAAA-MM-DD.md` (com remoto, abre o PR).
- [x] ~~`scripts/agendar-sync-semanal.sh` (agendamento no `launchd`)~~: removido, o usuário prefere rodar à mão.
- [x] Ajustar os Drops 6 e 9: a conferência semanal dos links e o sync do Mercado Livre ficam aqui.
- [x] Primeira rodada de verdade e ajustes na skill com o que aparecer.
- [ ] Com o repositório no GitHub (Drop 6): conferir o push e o `gh pr create` no fim da skill.

**Pronto quando:** `/sync-semanal` roda do começo ao fim com o usuário só resolvendo captcha (se aparecer), e fica uma branch `sync/…` com preços novos, links conferidos e o relatório.

## Como funciona

1. **Uma vez por semana:** com o Chrome aberto e logado no Mercado Livre, o usuário roda `/sync-semanal` no Claude Code.
2. **A sessão é interativa:** pedidos de permissão e captcha aparecem no Terminal/Chrome para o usuário, que está no computador. "Stop"/"Pause" param a navegação na hora.
3. **Nada vai direto para a `main`:** tudo fica na branch `sync/AAAA-MM-DD`; o usuário revisa o relatório e faz o merge.

## Plano B (opcional, não agendado)

Só preços no GitHub Actions, com um **segundo app** do Mercado Livre (Client ID próprio, token próprio nos secrets, regravado a cada uso). Faz sentido se a máquina ficar muitas semanas desligada. Links continuam só na máquina.

## Riscos

- **Esquecer de rodar:** sem agendamento, depende do usuário lembrar; preço velho por uma semana a mais não quebra nada.
- **Token do Mercado Livre expira** (6 meses sem uso ou erro `invalid_grant`): a skill segue com os links e avisa para rodar `npm run ml:auth`.
- **Uso do plano do Claude:** gerar links é a parte mais pesada; o argumento limita quantos links novos por semana.

## Registro

- 2026-10-27: primeira versão era um workflow do GitHub Actions no sábado 00:00 abrindo PR. Trocado, a pedido do usuário, por uma rotina local com o Claude (segunda 18h, quando o PC está ligado), porque só na máquina dá para gerar e conferir links de afiliado. O agendamento abre uma sessão interativa em vez de `claude -p`, para não depender do Chrome no modo sem janela e para o usuário ver permissões e captcha.
- 2026-10-30: primeira rodada, à mão (11:43–12:01, 18min): 39 preços, 2 categorias com tiers trocados, 139 links conferidos (6 refeitos), 7 links novos de 10, check ok. Relatório em [`docs/sync/2026-10-30.md`](../sync/2026-10-30.md). Aprendizados: anúncio de catálogo sem vendedor ativo é a causa comum de "sem afiliado"; promoção forte pode inverter tiers (Emma King ficou pendente); descartar vendedor pessoa física sem vendas em item caro (Sonos, Herman Miller).
- 2026-10-30: agendamento removido (`scripts/agendar-sync-semanal.sh`) a pedido do usuário, que prefere não deixar nada instalado na máquina e rodar `/sync-semanal` à mão.
