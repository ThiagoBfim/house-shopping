# Drop 24 — Sync semanal de preços e links com PR

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 2ª — publicação e automação

**Meta:** todo sábado à 00:00 (horário de Brasília) um GitHub Actions atualiza os preços do Mercado Livre, confere os links de afiliado e abre um PR com as mudanças e um relatório. Nada entra na `main` sem revisão.

**Depende de:** repositório no GitHub (Drop 6, primeiro item). Hoje o repositório não tem remoto.

## Tarefas

### Agendamento

- [ ] Workflow `.github/workflows/sync-semanal.yml` com `schedule: cron: '0 3 * * 6'`. O cron do GitHub é em UTC: 03:00 UTC de sábado = 00:00 de sábado em Brasília (UTC−3, sem horário de verão).
- [ ] `workflow_dispatch` para rodar à mão (com opção `dry-run`, que não abre PR).
- [ ] `concurrency: sync-semanal` para nunca rodar dois ao mesmo tempo (o refresh token muda a cada uso).
- [ ] Node 24 com `actions/setup-node` (`node-version-file: .nvmrc` ou `24`) e `npm ci`.

### Preços (`sync:ml` no CI)

- [ ] Secrets do repositório: `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_REFRESH_TOKEN`. Sem `.env.local`, o `loadEnvLocal()` não faz nada e o `getAccessToken()` lê `ML_REFRESH_TOKEN` do ambiente (conferido).
- [ ] **Refresh token rotativo:** o Mercado Livre troca o refresh token a cada uso e invalida o anterior. Depois do sync, o workflow grava o novo token de volta no secret (`gh secret set ML_REFRESH_TOKEN`) com um token do GitHub de escopo mínimo (fine-grained, só este repositório, permissão _Secrets: write_), guardado no secret `GH_SECRETS_TOKEN`. O `.ml-token.json` nunca vai para o commit nem para o log.
- [ ] Um app do Mercado Livre só para o CI (`house-shopping-ci`, Client ID próprio). O Mercado Livre só aceita o último refresh token gerado para o mesmo app e usuário, então o CI e a máquina local não podem dividir o mesmo app: um invalidaria o token do outro. Com dois apps, cada um tem a sua cadeia de tokens. O app local continua no `.env.local`.
- [ ] `npm run sync:ml -- --report <arquivo>`: além do log, grava o resumo em Markdown (preços que mudaram, de → para; indisponíveis; sem comissão; não encontrados; avisos do validador).

### Links de afiliado (`check:links` sem navegador)

O `/ml-check-links` usa o Chrome logado e não roda no CI. No CI a conferência é por HTTP:

- [ ] Script `npm run check:links` (veio do Drop 11): segue o redirecionamento de cada `meli.la` com `fetch(url, { redirect: 'manual' })`, passo a passo, e classifica pelo destino: `ok` (perfil `/social/master_sold` com `matt_tool=16097421`), `sem afiliado` (cai em "Minhas listas" ou perde o `matt_tool`) ou `quebrado` (erro ou 404). Lógica pura em `scripts/lib/`, com testes.
- [ ] Conferir o anúncio em si pela API (já vem do `sync:ml`: `status` do item, `buy_box_winner`), para pegar o caso "link abre, mas o anúncio acabou".
- [ ] Testar na primeira execução se o Mercado Livre bloqueia o IP do GitHub (captcha ou 403). Se bloquear, o relatório marca os links como `não conferido` em vez de `quebrado`, e a conferência continua manual com `/ml-check-links`.
- [ ] O CI **não gera links novos**: não existe API de link de afiliado (o link sai do "Gerador de links" do painel, logado). O PR lista os links com problema e a correção sugerida (`/ml-links <categoria>`).

### Pull request

- [ ] Branch `sync/AAAA-MM-DD`, commit `ML: sync semanal de preços (DD/MM)` só com `data/products/*.json` e `data/affiliate/mercadolivre.csv`.
- [ ] Antes do PR: `npm run validate` e `npm test`. Se falhar, o PR abre mesmo assim, como rascunho, com o erro no corpo (o catálogo pode precisar de ajuste de tier, como o purificador no sync de 25/10).
- [ ] Abrir o PR com `gh pr create` (ou `peter-evans/create-pull-request`), título `Sync semanal: N preços, M links com problema`, corpo = relatório do `sync:ml` + relatório do `check:links`. Rótulo `sync`.
- [ ] Sem mudança nenhuma: não abre PR, só deixa o resumo no `$GITHUB_STEP_SUMMARY`.
- [ ] Se o PR da semana anterior ainda estiver aberto, atualizar a mesma branch em vez de abrir outro (evita conflito no histórico de preços).
- [ ] Permissões do workflow: `contents: write` e `pull-requests: write`; ativar em _Settings → Actions → General_ a opção "Allow GitHub Actions to create and approve pull requests".
- [ ] Observação: PR aberto com o `GITHUB_TOKEN` não dispara outros workflows (ex.: o check do PR). Se quiser o check rodando no PR, abrir com o token do GitHub App ou do `GH_SECRETS_TOKEN`.

### Documentação

- [ ] `docs/project/MercadoLivre.md`: seção "Sync semanal no GitHub Actions" (secrets, como renovar o token se expirar, como rodar à mão).
- [ ] Ajustar os Drops 6 e 9: o agendamento do `check:links` e do `sync:ml` passa a ser este drop.

**Pronto quando:** num sábado, sem ninguém mexer, aparece um PR com os preços novos do Mercado Livre e a lista de links com problema; o merge publica o site (Drop 6); e o sábado seguinte roda de novo com o token renovado.

## Riscos

- **Token expira:** o refresh token do Mercado Livre vale 6 meses sem uso e é de uso único. Se um sync falhar no meio, depois de trocar o token e antes de gravar o secret, o token se perde. O workflow grava o secret logo depois da troca, antes do sync.
- **Bloqueio de robô:** o Mercado Livre pode bloquear requisições vindas de IPs de datacenter. Para os preços, a API com token não sofre isso; para os links `meli.la`, ver a tarefa de teste acima.
- **Conflito com sync local:** um `sync:ml` local entre dois sábados mexe nos mesmos arquivos. O PR semanal parte sempre da `main` atual.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
