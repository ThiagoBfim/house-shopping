# Drop 6 — Deploy no GitHub Pages

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-11-02 09:29 | —            | —       |

**Wave:** 2ª — publicação e automação (deploy + Amazon)

**Meta:** site público, com deploy automático.

- [x] Criar repositório público `house-shopping` no GitHub e fazer o push (veio do Drop 0)
- [x] Configurar `base` do Vite para `/house-shopping/` (feito no Drop 0)
- [x] Workflow `.github/workflows/deploy.yml` (build + validate + test → `actions/deploy-pages`)
- [x] Workflow `.github/workflows/checks.yml` (`npm run check`) em todo PR e antes de deploy com mudança de código
- [x] Tag e release a cada deploy (semver: código = minor, só produtos = patch)
- [x] Ativar GitHub Pages (source: GitHub Actions)
- [x] Proteger a `main`: PR obrigatório com o check `npm run check` (vale também para admin)
- [ ] Página `404.html` e favicon
- [ ] Meta tags Open Graph (preview bonito no WhatsApp)
- [ ] Analytics leve e sem cookies (ex.: Plausible, GoatCounter) — cliques em "Comprar" e compartilhamentos (veio do Drop 11)
- [ ] ~~Agendar `npm run check:links` semanalmente no CI~~ → virou a rotina `/sync-semanal` do [Drop 24](drop-24-sync-semanal-com-pr.md)
- [ ] (Opcional) domínio próprio

**Pronto quando:** push na `main` publica o site em `https://<user>.github.io/house-shopping/`, e um link compartilhado abre a mesma lista num celular de verdade.

## Registro

- **Dois caminhos no deploy (pedido do usuário):** o job `changes` compara o push com o commit anterior. Se só mudaram `data/products/` e `data/affiliate/` (ex.: `/sync-semanal`), vai direto para validate + build + deploy. Qualquer outra mudança (código, `rooms.json`, `assistant.json`, config) roda antes o `checks.yml` completo (lint, formatação, catálogo, testes com cobertura, build e E2E); se falhar, não publica. Deploy manual (`workflow_dispatch`) e primeiro push contam como código.
- **Só documentação** (`*.md`, `docs/`, `.claude/`) não dispara deploy (`paths-ignore`).
- **`npm run validate` também no caminho de produtos:** leva segundos e impede publicar um catálogo quebrado.
- **Versões:** a primeira release é `v1.0.0`; depois, deploy com código sobe o minor (`v1.4.2 → v1.5.0`) e só produtos sobe o patch (`v1.4.2 → v1.4.3`). A release do GitHub tem as notas geradas dos commits e diz se foi código ou produtos. A versão vive nas tags (o `package.json` continua `0.0.0`).
- **Um deploy por vez:** `concurrency: pages` sem cancelar o que está em andamento.
- **2026-11-02:** repositório público criado (`ThiagoBfim/house-shopping`), Pages ativo em https://thiagobfim.github.io/house-shopping/. Primeiro deploy rodou o Checks completo e criou a `v1.0.0`.
- **Push por HTTPS:** a chave SSH da máquina não está no GitHub; o remoto usa HTTPS com `gh auth git-credential` (configurado só neste repositório).
- **`main` protegida (pedido do usuário):** PR obrigatório, check `npm run check` obrigatório, sem force push, vale para admin. Para PR de produtos não pagar a suíte inteira, o `checks.yml` classifica o diff do PR como o deploy: só produtos/docs → só `validate`.
- **Actions atualizadas** para as versões em Node 24 (checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5, upload-artifact v7): as anteriores davam aviso de Node 20 deprecado.
