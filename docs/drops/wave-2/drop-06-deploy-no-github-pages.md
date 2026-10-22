# Drop 6 — Deploy no GitHub Pages

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 2ª — publicação e automação (deploy + Amazon)

**Meta:** site público, com deploy automático.

- [ ] Criar repositório público `house-shopping` no GitHub e fazer o push (veio do Drop 0)
- [x] Configurar `base` do Vite para `/house-shopping/` (feito no Drop 0)
- [ ] Workflow `.github/workflows/deploy.yml` (build + validate + test → `actions/deploy-pages`)
- [ ] Ativar GitHub Pages (source: GitHub Actions)
- [ ] Página `404.html` e favicon
- [ ] Meta tags Open Graph (preview bonito no WhatsApp)
- [ ] Analytics leve e sem cookies (ex.: Plausible, GoatCounter) — cliques em "Comprar" e compartilhamentos (veio do Drop 11)
- [ ] Agendar `npm run check:links` semanalmente no CI (veio do Drop 11)
- [ ] (Opcional) domínio próprio

**Pronto quando:** push na `main` publica o site em `https://<user>.github.io/house-shopping/`, e um link compartilhado abre a mesma lista num celular de verdade.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
