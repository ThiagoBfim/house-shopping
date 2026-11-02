# Drop 31 — Planta → cômodos e móveis

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 17:55 | 2026-11-02 17:59 | 4min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** enviar a planta (imagem ou PDF) preenche a escolha de cômodos e ajusta os móveis ao tamanho de cada cômodo.

**Pronto quando:** com a chave "Planta da casa" ligada, enviar a planta de um apartamento de 2 quartos mostra a escolha de cômodos já marcada (2 quartos, sala, cozinha, banheiro…), com a cama de cada quarto no tamanho certo para a área.

## Tarefas

- [x] Skill `.claude/skills/floor-plan/`: lê a planta e devolve cômodos (tipo do catálogo, nome na planta, área, posição na planta)
- [x] `POST /api/floor-plan`: salva o arquivo, roda `claude -p "/floor-plan …"` com `--json-schema` e só a ferramenta `Read`
- [x] `src/engine/floor-plan.ts`: valida a resposta, monta a casa (cômodos e quantidades, um id por cômodo) e escolhe o tamanho da cama pela área do quarto
- [x] Tela de cômodos: "📐 Enviar a planta" (com a chave ligada), progresso e aviso do que foi lido; a pessoa confere e continua
- [x] Testes unitários e E2E (backend simulado)

## Registro

- **Teste real (planta fictícia de apto de 2 quartos, PNG):** 15 s, **US$ 0,27**, 11 ambientes com tipo, área e posição certos; avisou sozinha que Circulação e Closet não têm área escrita. A resposta virou `tests/fixtures/floor-plan-apto.json`, usada nos testes unitários e no E2E.
- **`--json-schema`:** o Claude Code valida a resposta contra o schema (`server/lib/skills.ts`) e entrega em `structured_output`; o site confere de novo (`parseFloorPlan`), porque vem de fora.
- **Casa:** cômodos contados por tipo (até 5); "outro" (hall, closet, garagem) fica de fora e aparece em "Fora da lista"; **Utilidades entra sempre** (itens da casa toda). O maior quarto vira o Quarto 1 (a suíte).
- **Cama pela área do quarto** (cama, colchão, edredom, jogo de cama e protetor): < 9 m² solteiro, < 12 casal, < 16 queen, acima king. Área desconhecida → variante padrão. A skill não estima área pelo desenho (área errada escolhe a cama errada).
- **Fluxo:** a planta preenche a escolha de cômodos (que é recriada com a casa nova) e a pessoa confere antes de seguir; nada é montado sem ela ver.
