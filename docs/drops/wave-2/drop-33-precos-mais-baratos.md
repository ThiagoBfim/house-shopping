# Drop 33 — Preços mais baratos (com desfazer)

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 18:01 | 2026-11-02 18:08 | 7min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** um botão na lista procura os itens mais baratos em outras lojas (skill `/search-better-prices`) e troca links e preços; dá para voltar ao que era antes.

**Pronto quando:** com a chave "Preços mais baratos" ligada, buscar os 5 itens mais caros troca os que têm oferta menor (selo "Mais barato em {loja} · era R$ X"), o total cai, e "Voltar ao que era antes" devolve a lista anterior.

## Tarefas

- [x] `POST /api/cheaper-prices`: recebe a planilha da lista (a mesma do "Baixar Excel"), roda a skill com a pasta do job como `$SP` e acompanha o `resultados.jsonl` (progresso item a item)
- [x] `src/engine/cheaper.ts`: aplica os resultados — item do catálogo vira troca, item adicionado tem preço e link atualizados — respeitando o limite de itens
- [x] Painel na lista: quantos itens buscar, progresso, resumo da economia e "Voltar ao que era antes" (guardado no navegador)
- [x] Testes unitários e E2E (backend simulado)

## Registro

- **Sem Bash:** no primeiro teste real, o passo 0 da skill (ler o `.xlsx` com Python) foi negado (o comando começava com `SP=…; uv run`, fora do `Bash(uv run:*)`) e nada foi pesquisado. Agora o site manda os itens já lidos (`{ items }`, mesmo formato do `itens.json` do passo 0) e o backend grava o arquivo; a skill pula a leitura e a busca roda só com WebSearch/WebFetch/Read/Write.
- **Teste real (1 item, geladeira Consul CRM40MB a R$ 2.249):** 60 s, **US$ 0,34**; conferiu Fast Shop (R$ 2.765) e MadeiraMadeira (R$ 2.429,10) e respondeu "sem preço melhor" — descartou o R$ 2.005 do Buscapé porque não deu para confirmar na loja, como a skill manda.
- **Aplicar:** preço menor de item do catálogo vira **troca** (mesmo produto, loja e link novos, no lugar do item); item do usuário tem preço e link atualizados. Selo "💰 Mais barato em {loja} · era R$ X" (local: não vai no link compartilhado). Aplicado sobre a lista do fim da busca (pode ter mudado). Respeita o limite de 30 itens do usuário.
- **Voltar ao que era antes:** as escolhas de antes ficam no navegador (`house-shopping:before-cheaper`) até voltar ou a próxima busca; continua depois de recarregar. Cada troca também sai sozinha com "Desfazer troca".
- **Skill local:** `/search-better-prices` não está no git; sem ela, a chave aparece desabilitada com o aviso.
