# Drop 6 — Deploy no GitHub Pages

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-11-02 09:29 | —            | —       |

**Wave:** 2ª — publicação e automação (deploy + Amazon)

**Meta:** site público, com deploy automático.

- [ ] Criar repositório público `house-shopping` no GitHub e fazer o push (veio do Drop 0)
- [x] Configurar `base` do Vite para `/house-shopping/` (feito no Drop 0)
- [x] Workflow `.github/workflows/deploy.yml` (build + validate + test → `actions/deploy-pages`)
- [x] Workflow `.github/workflows/checks.yml` (`npm run check`) em todo PR e antes de deploy com mudança de código
- [x] Tag e release a cada deploy (semver: código = minor, só produtos = patch)
- [ ] Ativar GitHub Pages (source: GitHub Actions)
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
