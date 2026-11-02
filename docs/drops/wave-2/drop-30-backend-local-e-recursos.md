# Drop 30 — Backend local e recursos em teste

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 17:49 | 2026-11-02 17:55 | 6min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** um backend local que roda as funcionalidades novas com o Claude Code, e chaves no site para ligá-las.

**Pronto quando:** com `npm run server` rodando, o site em dev mostra o painel "Recursos em teste" com as chaves "Planta da casa" e "Preços mais baratos"; sem o backend (ou no site publicado), o painel não aparece.

## Tarefas

- [x] `server/index.ts` (Node, sem dependências novas): HTTP em `127.0.0.1:8787`, CORS só para `localhost`
- [x] `GET /api/health` (inclui se a skill de preços está instalada) e jobs: `POST` inicia, `GET /api/jobs/:id` acompanha
- [x] `server/lib/`: argumentos do `claude -p` (ferramentas liberadas, orçamento máximo, schema de saída), leitura da resposta, fila de jobs — lógica pura, testada
- [x] Site: `src/ui/local-api.ts` (endereço do backend só em dev: `VITE_LOCAL_API` ou `localhost:8787`) e painel "Recursos em teste" com as duas chaves (salvas no navegador)
- [x] `npm run server` e documentação no CLAUDE.md

## Registro

- **`claude -p` não interativo:** `--output-format json`, `--permission-mode dontAsk` (o que não está em `--allowedTools` é negado sem perguntar), `--max-budget-usd` por execução e `--no-session-persistence`. Roda na raiz do projeto para as skills de `.claude/skills` valerem. O custo vem em `total_cost_usd` e vai no job (base para a cobrança, Drop 34).
- **Jobs:** planta leva ~15 s–1 min e preços ~1 min por item, então `POST` devolve um id e o site consulta `GET /api/jobs/:id` a cada 2 s. Jobs ficam na memória do servidor (reiniciar perde os em andamento). Só uma busca de preços por vez.
- **Segurança:** escuta só em `127.0.0.1`; CORS só para origens `http://localhost`/`127.0.0.1` (outra origem → 403); upload até 15 MB.
- **Recursos em teste só em dev:** `LOCAL_API` = `VITE_LOCAL_API` ou, em `npm run dev`, `http://localhost:8787`; no build publicado não existe, então o site nem tenta o backend. Sem resposta em 2 s, o painel não aparece. As chaves começam desligadas e ficam no `localStorage`.
- **E2E:** `VITE_LOCAL_API=http://api.test` no `playwright.config.ts`; `e2e/labs.spec.ts` simula o backend com `page.route` (nada chama o Claude Code nos testes).
