# Drop 18 — Assistente "Monte pra mim" (perguntas rápidas)

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** caminho opcional de perguntas de tocar (múltipla escolha / sim ou não), com "Pular", que monta casa, orçamento e preferências e entrega a lista de sempre. Especificação completa: [Assistente.md](../project/Assistente.md).

**Pronto quando:** pela tela inicial, responder "Família com filhos", "PlayStation", "Cooktop de indução" e "Equilibrado" monta uma lista com 2 quartos, escritório gamer, PlayStation, cooktop de indução + forno de embutir e panelas de indução; "Pular tudo" na primeira pergunta deixa o fluxo atual intacto; o link compartilhado reproduz a mesma lista.

## Fases

### 18.1 — Motor e perguntas com o que já existe

- [ ] `data/assistant.json` + schema Zod + validação cruzada (cômodos, categorias, etiquetas)
- [ ] `src/engine/assistant.ts`: `visibleQuestions` e `applyAnswers` (efeitos `rooms`, `variant`, `preset`, `owned`, `filters`), com testes
- [ ] Perguntas 1–5 e 11–13 (só efeitos que já existem)
- [ ] Tela do assistente: uma pergunta por vez, resposta grande, avança sozinho, voltar, progresso, "Pular" e "Pular tudo"
- [ ] Tela final com resumo (tocar volta à pergunta) → "Ver minha lista" / "Ajustar orçamento"
- [ ] Entrada na tela inicial e "Refazer com perguntas" na lista; respostas no `localStorage`
- [ ] E2E: responder tudo, pular tudo, pular uma, voltar, refazer

### 18.2 — Trocas, etiquetas e importância

- [ ] Motor: `choices.swaps`, `choices.prefer`, `choices.needs` (+ link: campos opcionais `s`, `t`, `e`), com testes
- [ ] Dados: `alternatives` no item do cômodo e `tags` nas opções; validador
- [ ] Card: "Trocar por …" quando o item tem alternativas; selo "Escolha sua" quando veio do assistente
- [ ] Perguntas 6–10

### 18.3 — Catálogo para as perguntas novas

- [ ] Cooktop a gás, cooktop de indução, forno de embutir; panelas com etiqueta `inducao`
- [ ] Console por marca (PlayStation, Xbox, Nintendo) com tiers próprios
- [ ] Cafeteira por tipo (coado, cápsula, espresso)
- [ ] Ventilador
- [ ] Tamanhos de cama (solteiro, casal, queen, king) em cama, colchão e enxoval
- [ ] Etiquetas da geladeira

## Decisões em aberto (perguntar ao usuário antes de começar)

1. **Nome:** "✨ Monte pra mim" (recomendado, porque não há LLM) ou "Monte com AI"?
2. **Escopo do primeiro corte:** só a 18.1 (rápido, sem mudar o catálogo) ou 18.1 + 18.2 + 18.3 juntas?
3. **Catálogo:** ok separar `videogame` e `cafeteira` em categorias por tipo e criar opções de cama por tamanho? É o maior trabalho do drop (pesquisa de ~10 categorias).
4. **LLM de verdade** (texto livre, seção 11 da especificação): fica para depois?

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
