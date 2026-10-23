# Drop 22 — Suas respostas na lista

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-23 18:02 | 2026-10-23 18:20 | 18min   |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** ver as respostas do "Monte pra mim" na lista e conseguir mudar cada uma sem refazer tudo. Fica recolhido, perto dos filtros. (Pedido do usuário.)

**Pronto quando:** na lista montada pelo assistente, "✨ Suas respostas" abre com as perguntas e respostas; trocar "Quem faz os reparos?" de "Chamo alguém" para "Faço de tudo" põe a furadeira na lista, mantém um sofá recusado à mão e continua assim depois de recarregar a página.

## Tarefas

- [x] `reapplyAnswers` (`src/engine/assistant.ts`): aplica só a diferença entre respostas antigas e novas sobre a lista atual; `applyAnswers` ganha `target` (casa onde os efeitos valem)
- [x] Respostas no estado da lista e no link (`ListState.answers`, campo `a` do `Wire`, validado no `decodeState`)
- [x] `AnswersPanel.tsx`: painel recolhido abaixo de "Filtros", uma linha por pergunta (ícone, pergunta, resposta atual), abre as respostas em pílulas ali mesmo; "Aplicar" na múltipla escolha, "Tirar resposta", "Refazer todas as perguntas"
- [x] `App.tsx`: troca de resposta replaneja, destaca o que mudou e mostra aviso com "Desfazer"; "Refazer com perguntas" começa com as respostas da lista
- [x] Testes: `reapplyAnswers` (mantém ajustes à mão, tirar resposta, cômodo novo, casa escolhida à mão, estilo e trava), link com respostas, E2E do painel
- [x] `docs/project/Assistente.md`

## Decisões

- **Recolhido, abaixo dos filtros:** mesmo visual do painel de filtros; o resumo mostra quantas foram respondidas ("11 de 15" ou "nenhuma ainda"), então dá para saber sem abrir.
- **Editar no lugar, uma pergunta aberta por vez** (acordeão): em vez de abrir o assistente inteiro, a troca é um toque. Resposta única aplica no toque; múltipla escolha precisa de "Aplicar".
- **Aplicar só a diferença**, não refazer a lista do zero: quem ajustou itens à mão não perde nada. Um efeito antigo só sai se o valor atual ainda for o que a resposta pôs (se a pessoa mudou depois, vale o dela).
- **Perguntas que valem para a casa atual**, não para a casa das respostas: numa lista montada à mão, dá para responder "Limpeza" ou "Reparos" e o efeito cai nos cômodos que existem.
- **Respostas no link:** a lista compartilhada leva as respostas junto, para o painel mostrar as respostas daquela lista (e não as que ficaram no navegador de quem abre).

## Registro
