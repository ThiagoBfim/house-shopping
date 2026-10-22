# Drop 18 — Assistente "Monte pra mim" (perguntas rápidas)

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 19:14 | 2026-10-22 19:34 | 20min   |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** caminho opcional de perguntas de tocar (múltipla escolha / sim ou não), com "Pular", que monta casa, orçamento e preferências e entrega a lista de sempre. Especificação completa: [Assistente.md](../project/Assistente.md).

**Pronto quando:** pela tela inicial, responder "Família com filhos", "PlayStation", "Cooktop de indução" e "Equilibrado" monta uma lista com 2 quartos, escritório gamer, PlayStation, cooktop de indução + forno de embutir e panelas de indução; "Pular tudo" na primeira pergunta deixa o fluxo atual intacto; o link compartilhado reproduz a mesma lista.

## Fases

### 18.1 — Assistente

- [x] `data/assistant.json` + schema Zod + validação cruzada (cômodos, categorias, variantes)
- [x] `src/engine/assistant.ts`: `visibleQuestions` e `applyAnswers`, com testes
- [x] Tela do assistente: uma pergunta por vez, resposta grande, avança sozinho, voltar, progresso, "Pular" e "Pular tudo"
- [x] Resumo (tocar volta à pergunta) → "Ver minha lista" / "Ajustar orçamento antes"
- [x] Entrada na tela inicial e "Refazer com perguntas" na lista; respostas no `localStorage`

### 18.2 — Variantes e importância

- [x] Schema: `variants` na categoria e nas opções; validador por variante
- [x] Motor: `choices.variants` e `choices.needs` + `applyPreferences`; link com `t` e `e`
- [x] Card: botões para trocar a variante
- [x] 13 perguntas (casa, home office, videogame, área externa, orçamento, fogão, cozinhar, café, calor, cama, já tenho, utensílios, facilitadores)

### 18.3 — Catálogo

- [x] Fogão: piso, cooktop a gás, cooktop de indução · Forno: bancada, embutir · Panelas: qualquer fogão, indução
- [x] Videogame: PlayStation, Xbox, Nintendo (4 tiers cada)
- [x] Cafeteira: coado, cápsula, espresso
- [x] Ar-condicionado ou ventilador
- [x] Tamanhos de cama (solteiro, casal, queen, king) em cama, colchão, jogo de cama, edredom e protetor
- [x] Testes: unitários (`assistant`, `preferences`, validação, link) e E2E (`e2e/assistant.spec.ts`)

## Decisões do usuário (2026-10-22)

1. Nome: **"✨ Monte pra mim"**.
2. Escopo: **tudo** (18.1 + 18.2 + 18.3).
3. Catálogo: **ok** para separar por tipo e criar tamanhos de cama.
4. **Sem LLM.**

## Registro

- **Variantes no lugar de "trocar categoria" + "etiquetas":** a especificação inicial tinha dois mecanismos (categoria alternativa e etiqueta nas opções). Na implementação virou um só: **variantes dentro da categoria**, cada uma com a sua escada de tiers. Vantagens: os ids (e os links de afiliado já feitos) não mudam, o card ganha "trocar tipo" de graça, e cama/console/café/fogão usam a mesma regra. A especificação foi atualizada.
- **Motor intacto:** `applyPreferences` filtra a escada da variante e aplica a necessidade ajustada antes de `planList`/`describeList`. Para não travar se alguém esquecer, `sortedOptions` usa a variante padrão quando vê tiers repetidos. (Antes dessa proteção, os testes que usam o catálogo real entraram em loop infinito no laço de upgrades.)
- **Ofertas preservadas:** opções existentes só ganharam `variants` e, em alguns casos, outro tier dentro da variante (o import da planilha casa por id, não por tier). Ex.: Nespresso Essenza Mini continua tier 2 em "Cápsula"; Emma Queen virou tier 2 em "Queen".
- **Rótulos:** "Fogão" virou "Fogão ou cooktop" e "Ar-condicionado" virou "Ar-condicionado ou ventilador" (E2E ajustados). Sem preferência, a lista mostra a variante padrão: fogão de piso, forno de bancada, PlayStation, café coado, ar-condicionado, cama casal.
- **"Pular tudo"** sem respostas não mexe em nada; com respostas, segue para a tela de orçamento (ou para os cômodos, se a pergunta da casa foi pulada). O orçamento escolhido no assistente vem marcado (`initialPreset` no `BudgetForm`).
- **Refazer** recomeça com as respostas anteriores marcadas e substitui a lista; o aviso tem "Desfazer".
- **Hover** dos cartões de resposta só em aparelhos com mouse (`@media (hover: hover)`): no celular, o destaque ficava preso na pergunta seguinte.
- **Preços** das ~70 opções novas são de referência (modelos reais, links de busca do Mercado Livre); passar pelo `/ml-links`.
