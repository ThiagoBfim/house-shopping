# Drop 9 — Integração Amazon (afiliados)

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Meta:** preços e links da Amazon atualizados automaticamente.

- [ ] Cadastro no Associados Amazon BR e obtenção do `partner tag`
- [ ] Credenciais da **Creators API** (PA-API 5.0 foi descontinuada em 30/04/2026)
- [ ] Script `scripts/sync-amazon.ts`: busca por ASIN → atualiza preço, imagem, disponibilidade e link
- [ ] Guardar credenciais em **GitHub Secrets**
- [ ] Workflow agendado (cron diário) que roda o sync, valida e faz commit → dispara deploy
- [ ] Marcar produtos indisponíveis e cair para o próximo tier no motor

**Pronto quando:** preços Amazon atualizam sozinhos todo dia.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
