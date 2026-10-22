# Assistente "Monte pra mim"

> Implementado no [Drop 18](../drops/drop-18-assistente-monte-pra-mim.md). Este documento descreve como funciona e como mexer.

## 1. A ideia

Um caminho opcional, com **perguntas rápidas de tocar** (múltipla escolha ou sim/não), que monta a casa, o orçamento e as preferências e entrega **a mesma lista de sempre**, que continua ajustável à mão. Quem não quiser responder **pula** uma pergunta ou tudo e cai no fluxo normal.

**Sem LLM** (decisão do usuário): o assistente é baseado em regras escritas em `data/assistant.json`. Funciona offline, de graça e sem coletar nada, e por isso o nome é "✨ Monte pra mim", não "AI".

## 2. Princípios

1. **Não é formulário.** Uma pergunta por tela, respostas grandes com emoji, um toque responde e avança.
2. **Sempre dá para pular.** "Pular esta pergunta" e "Pular tudo". Pular nunca muda nada.
3. **Poucas e relevantes.** 13 perguntas no máximo; as que dependem de um cômodo só aparecem se a casa tiver esse cômodo.
4. **Cada resposta muda algo.** Se uma pergunta não muda a lista, ela não existe.
5. **Não substitui nada.** O resultado é o estado normal da lista (cômodos + orçamento + escolhas): travar, recusar, trocar e recalcular continuam valendo.
6. **Compartilhável.** O link da lista leva tudo o que o assistente decidiu.

## 3. Experiência

- **Entrada:** cartão "✨ Monte pra mim" no topo da tela inicial (abaixo, "ou escolha os cômodos você mesmo"). Na lista, "✨ Refazer com perguntas".
- **Pergunta:** ícone, texto, uma linha de "por que perguntamos" quando ajuda; respostas em cartões (2 colunas). Escolha única avança no toque; múltipla escolha marca e confirma ("Continuar" / "Não tenho nada disso"). Voltar (←), progresso em pontos, foco no título a cada tela, animação curta (desligada com `prefers-reduced-motion`).
- **Resumo:** uma linha por pergunta respondida ("Fogão: Cooktop de indução"); tocar volta àquela pergunta. "Ver minha lista →" monta a lista com o orçamento escolhido; "Ajustar orçamento antes" abre a tela de orçamento com tudo preenchido.
- **Pular tudo:** sem nenhuma resposta, volta à tela de onde veio sem mudar nada. Com respostas, aplica o que tem e segue para o próximo passo que faltar (cômodos → orçamento).
- **Refazer:** recomeça com as respostas anteriores marcadas (salvas no navegador). O resultado substitui a lista, com "Desfazer" no aviso.

## 4. Perguntas

| Pergunta                                   | Respostas → efeito                                                                                                                                                                    | Aparece se                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Quem vai morar na casa?                    | Só eu / Casal → 1 quarto · Casal com filhos → 2 · Família grande → 3 quartos e 2 banheiros · Com bebê → + Quarto do bebê. Sempre com cozinha, sala, banheiro, lavanderia e utilidades | sempre                         |
| Você trabalha ou estuda em casa?           | Sim → + Escritório                                                                                                                                                                    | sempre                         |
| Você joga videogame?                       | PlayStation / Xbox / Nintendo → escritório gamer + console da marca · Só no PC → escritório gamer sem console                                                                         | sempre                         |
| Tem quintal, varanda ou área de churrasco? | Sim → + Área externa                                                                                                                                                                  | sempre                         |
| Na hora de gastar, você é…                 | Econômico / Equilibrado / Quero o melhor → orçamento sugerido                                                                                                                         | sempre                         |
| Na cozinha, você prefere…                  | Cooktop a gás ou de indução → cooktop + forno de embutir (necessidade 4); indução → panelas de indução                                                                                | Cozinha                        |
| Com que frequência você cozinha?           | Todo dia → sobe air fryer, lava-louças, batedeira, forno, assadeiras · Quase nunca → micro-ondas e air fryer sobem, o resto desce                                                     | Cozinha                        |
| Café em casa é…                            | Não tomo → sem cafeteira · Coado / Cápsula / Espresso → tipo de cafeteira                                                                                                             | Cozinha                        |
| Faz calor aí?                              | Quero ar → ar sobe para necessidade 4 · Ventilador resolve → ventilador · Não precisa → sem ar                                                                                        | Quarto, Sala ou Quarto do bebê |
| Qual o tamanho da cama?                    | Solteiro / Casal / Queen / King → cama, colchão, jogo de cama, edredom e protetor no tamanho                                                                                          | Quarto                         |
| O que você já tem? (múltipla)              | Geladeira, fogão, micro-ondas, máquina de lavar, cama e colchão, sofá, TV, mesa → "já tenho"                                                                                          | sempre                         |
| Já tem pratos, panelas, toalhas e afins?   | Já tenho → sem utensílios                                                                                                                                                             | sempre                         |
| Quer itens que facilitam o dia a dia?      | Quero → com facilitadores                                                                                                                                                             | sempre                         |

Enquanto a pergunta da casa não foi respondida, as perguntas de cômodo aparecem todas (a casa ainda é desconhecida).

## 5. Como funciona

### 5.1 Variantes de categoria

Escolhas que são **produtos diferentes** (fogão de piso × cooktop, PlayStation × Xbox, casal × queen) são **variantes** da categoria, cada uma com a sua escada de tiers:

```json
{
  "label": "Fogão ou cooktop",
  "variants": [
    { "id": "piso", "label": "Fogão de piso" },
    { "id": "cooktop-inducao", "label": "Cooktop de indução" }
  ],
  "options": [
    { "id": "fogao-brastemp-bfs5ncr", "tier": 3, "variants": ["piso"], "…": "…" },
    {
      "id": "cooktop-de-inducao-electrolux-4-bocas-ie60p",
      "tier": 2,
      "variants": ["cooktop-inducao"],
      "…": "…"
    }
  ]
}
```

- A primeira variante é a padrão. Uma opção pode entrar em várias (panelas de inox servem para "qualquer fogão" e "indução").
- O validador confere tiers, preços crescentes e a regra dos 4 tiers **dentro de cada variante**.
- O card mostra as variantes como botões ("Fogão de piso · Cooktop a gás · Cooktop de indução"): dá para trocar sem o assistente.
- Categorias com variantes: fogão, forno, panelas, ar-condicionado/ventilador, cafeteira, videogame, cama, colchão, jogo de cama, edredom e protetor de colchão.

### 5.2 Escolhas novas

- `choices.variants[item] = variante` e `choices.needs[item] = necessidade`.
- `applyPreferences` (`src/engine/preferences.ts`) aplica as duas antes do motor: cada item fica só com a escada da variante escolhida e com a necessidade ajustada. **O algoritmo de planejamento não mudou.** Sem `applyPreferences`, `sortedOptions` usa a variante padrão (o motor nunca vê dois produtos no mesmo tier).
- No link: `t` (variantes) e `e` (necessidades), opcionais. Links antigos continuam valendo.

### 5.3 Motor do assistente (`src/engine/assistant.ts`)

- `visibleQuestions(assistant, answers)`: perguntas que aparecem, percorrendo em ordem e montando a casa com as respostas.
- `applyAnswers(assistant, answers, rooms)` → `{ house, preset, choices, summary }`. Respostas de perguntas escondidas não valem. Efeitos de categoria (`owned`, `skip`, `variant`, `need`) valem para o item em todos os cômodos da casa.
- As respostas ficam em `localStorage` (`house-shopping:assistant`); o link leva só o resultado.

## 6. Como mexer nas perguntas

Edite `data/assistant.json`. Efeitos possíveis de uma resposta (um objeto com uma chave):

| Efeito           | Exemplo                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `rooms`          | `{ "rooms": { "quarto": 2 } }` (fica o maior número pedido)             |
| `roomVariant`    | `{ "roomVariant": { "from": "escritorio", "to": "escritorio-gamer" } }` |
| `preset`         | `{ "preset": "premium" }`                                               |
| `owned` / `skip` | `{ "owned": ["geladeira"] }` / `{ "skip": ["cafeteira"] }`              |
| `filters`        | `{ "filters": { "utensils": false, "helpers": true } }`                 |
| `variant`        | `{ "variant": { "category": "fogao", "variant": "cooktop-gas" } }`      |
| `need`           | `{ "need": { "category": "forno", "need": 4 } }`                        |

`npm run validate` confere formato e referências: cômodo, categoria (precisa estar em algum cômodo) e variante citados existem; ids de pergunta e resposta não se repetem.

## 7. Como medir (quando o Drop 11 existir)

Quantos começam, em que pergunta mais pulam, quantos chegam à lista e quantos mexem na lista depois (sinal de recomendação errada).
