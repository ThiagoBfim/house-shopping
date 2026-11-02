# Drop 28 — Rodapé com copyright e versão

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 10:39 | 2026-11-02 10:40 | 1min    |

**Wave:** 2ª — publicação e automação

**Meta:** no fim de toda página, "© {ano} Thiago Bomfim · House Shopping" e a versão da aplicação (pedido do usuário).

## Tarefas

- [x] `src/ui/Footer.tsx` no `App.tsx`, depois do `<main>`
- [x] Versão no build: `__APP_VERSION__` (`define` do `vite.config.ts`) = `APP_VERSION` do CI, ou `git describe --tags --always` fora dele, ou "dev"
- [x] `deploy.yml`: a próxima versão é calculada no job `changes` (antes do build), vai para o build como `APP_VERSION` e o job `release` cria a tag com ela
- [x] E2E `e2e/footer.spec.ts`

## Decisões

- **Versão = tag da release.** Antes a tag era calculada só depois do deploy; agora é calculada antes, para o site publicado mostrar a mesma versão da release que ele gera.
- **Versão de release vira link** para a página da release no GitHub; build local ("v1.2.0-1-gabc1234") aparece só como texto.
- **Ano** do copyright é o ano atual do navegador.
