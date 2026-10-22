# Assistente "Monte pra mim" — especificação

> Status: **proposta, aguardando aprovação** (ver [Drop 18](../drops/drop-18-assistente-monte-pra-mim.md)). Nada disto está implementado.

## 1. A ideia em uma frase

Um caminho opcional, em forma de **perguntas rápidas de tocar** (múltipla escolha ou sim/não), que monta a casa, o orçamento e as preferências do usuário e entrega a **mesma lista de hoje** — que ele continua podendo ajustar à mão. Quem não quiser responder **pula** (uma pergunta ou tudo) e cai no fluxo atual.

## 2. Princípios

1. **Não é formulário.** Uma pergunta por tela, respostas grandes com emoji, um toque responde e avança sozinho. Nada de digitar.
2. **Sempre dá para pular.** "Pular" em cada pergunta e "Pular tudo" no topo. Pular nunca é erro: a pergunta simplesmente não muda nada.
3. **Poucas e relevantes.** No máximo ~10 perguntas, e só as que fazem sentido para o que já foi respondido (quem não tem escritório não ouve falar de videogame).
4. **Cada resposta muda algo visível.** Se uma pergunta não muda a lista, ela não existe. O resumo final mostra o que cada resposta decidiu.
5. **Não substitui nada.** O resultado é o estado normal da lista (cômodos + orçamento + escolhas). Travar, recusar, trocar e recalcular continuam funcionando. O fluxo atual continua igual para quem prefere.
6. **Explicável.** O card do produto mostra quando algo veio do assistente ("Você prefere cooktop de indução").
7. **Compartilhável.** O link da lista leva tudo o que o assistente decidiu, como já acontece com filtros e travas.

## 3. Nome: "AI" ou não?

O site é estático (GitHub Pages) e a regra do projeto é **sem chaves de API no front-end**. Um assistente com LLM de verdade em tempo real precisaria de um servidor intermediário (custo por uso, privacidade, abuso).

O que esta proposta descreve é um assistente **baseado em regras**: perguntas e efeitos escritos por nós num arquivo de dados. Ele funciona offline, de graça e sem coletar nada. Chamá-lo de "AI" seria vender algo que ele não é.

**Recomendação:** `✨ Monte pra mim` (subtítulo: "1 minuto, só tocando nas respostas"). Se no futuro houver uma etapa com LLM de verdade (seção 11), o nome pode evoluir.

## 4. Experiência

### 4.1 Entrada

Na tela inicial (escolha de cômodos), acima de tudo:

```
┌──────────────────────────────────────────┐
│ ✨ Monte pra mim                          │
│ Responda umas perguntas rápidas e a gente │
│ monta a lista. Leva 1 minuto.             │
│                       [ Começar → ]       │
└──────────────────────────────────────────┘
        ou escolha os cômodos você mesmo ↓
```

Também na lista: link "✨ Refazer com perguntas" (abre o assistente com as respostas anteriores marcadas).

### 4.2 Uma pergunta

```
 ←                     ●●●○○○○○        Pular tudo

 🍳  Na cozinha, você prefere…

 ┌─────────────┐  ┌─────────────┐
 │     🔥      │  │     ⚡      │
 │ Fogão a gás │  │  Cooktop de │
 │  de piso    │  │   indução   │
 └─────────────┘  └─────────────┘
 ┌─────────────┐  ┌─────────────┐
 │     🔥      │  │     🤷      │
 │ Cooktop a   │  │  Tanto faz  │
 │    gás      │  │             │
 └─────────────┘  └─────────────┘

                Pular esta pergunta
```

- **Escolha única:** tocar responde e avança (com uma animação curta; sem animação com `prefers-reduced-motion`).
- **Múltipla escolha** (ex.: "o que você já tem?"): chips marcáveis + botão "Continuar".
- **Sim/não:** dois cartões grandes.
- **Voltar (←)** volta uma pergunta mantendo as respostas.
- **Progresso** em pontos; como as perguntas são adaptativas, o total pode diminuir no caminho (nunca aumentar de surpresa).
- Uma linha pequena de "por que perguntamos" quando não for óbvio (ex.: "Indução precisa de panela própria — a gente já ajusta isso").
- Acessível: cada resposta é um botão de rádio; navegação por teclado; foco na pergunta a cada tela.

### 4.3 Fim

```
 ✅ Pronto! Sua lista foi montada assim:

 🏠 Cozinha, 2 Quartos, Sala, Banheiro, Escritório gamer
 💰 Equilibrado — R$ 65.000
 ⚡ Cooktop de indução + forno de embutir
 🎮 PlayStation
 ☕ Café em cápsula
 📦 Você já tem: geladeira, cama
 ✨ Com facilitadores

        [ Ver minha lista → ]
        Ajustar orçamento
```

Tocar numa linha volta àquela pergunta. "Ver minha lista" monta a lista com o orçamento sugerido; "Ajustar orçamento" abre a tela de orçamento de hoje com tudo já preenchido.

### 4.4 Pular tudo

Aplica o que já foi respondido e segue para o próximo passo do fluxo atual que faltar (cômodos → orçamento → lista). Pular na primeira pergunta = fluxo atual intacto.

## 5. Perguntas (rascunho)

As perguntas são **dados** (`data/assistant.json`), não código. Ordem sugerida; `quando` = só aparece se a condição valer.

| #   | Pergunta                                                                  | Tipo     | Respostas → efeito                                                                                                  | Quando             |
| --- | ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | Quem vai morar na casa?                                                   | única    | Só eu → 1 quarto · Casal → 1 quarto · Família com filhos → 2–3 quartos · Bebê a caminho → + Quarto do bebê          | sempre             |
| 2   | Trabalha ou estuda em casa?                                               | sim/não  | Sim → + Escritório                                                                                                  | sempre             |
| 3   | Você joga videogame?                                                      | única    | Não · PlayStation · Xbox · Nintendo · PC → Escritório gamer + preferência de console (PC = sem console)             | sempre             |
| 4   | Tem quintal, varanda ou área de churrasco?                                | sim/não  | Sim → + Área externa                                                                                                | sempre             |
| 5   | Na hora de gastar, você é…                                                | única    | Econômico · Equilibrado · Quero o melhor → orçamento sugerido                                                       | sempre             |
| 6   | Na cozinha, você prefere…                                                 | única    | Fogão a gás · Cooktop a gás · Cooktop de indução · Tanto faz → troca fogão por cooktop + forno de embutir           | tem Cozinha        |
| 7   | Com que frequência você cozinha?                                          | única    | Todo dia · Fim de semana · Quase nunca → sobe/baixa a importância de air fryer, batedeira, lava-louças, assadeiras… | tem Cozinha        |
| 8   | Café em casa é…                                                           | única    | Não tomo · Coado · Cápsula · Espresso de verdade → tipo de cafeteira (ou tira)                                      | tem Cozinha        |
| 9   | Faz calor aí?                                                             | única    | Muito, quero ar · Ventilador resolve · Não precisa → ar-condicionado / ventilador / nada                            | tem Quarto ou Sala |
| 10  | Qual o tamanho da cama?                                                   | única    | Solteiro · Casal · Queen · King → tamanho em cama, colchão e jogo de cama                                           | tem Quarto         |
| 11  | O que você já tem?                                                        | múltipla | Geladeira, fogão, máquina de lavar, cama, sofá, TV, micro-ondas… → "já tenho"                                       | sempre             |
| 12  | Já tem pratos, panelas e toalhas?                                         | sim/não  | Sim → sem utensílios                                                                                                | sempre             |
| 13  | Quer itens que facilitam o dia a dia? (organizadores, potes de congelar…) | sim/não  | Sim → com facilitadores                                                                                             | sempre             |

Na prática a pessoa vê de 8 a 11 perguntas. As perguntas 1–4 só aparecem quando o assistente começa pela tela inicial; "Refazer com perguntas" a partir da lista começa na 5.

## 6. Como as respostas viram lista (motor)

Tudo vira **o estado que já existe** (`house`, `budget`, `choices`) mais três extensões pequenas nas escolhas. Os efeitos possíveis de uma resposta:

| Efeito    | Exemplo                | Como funciona                                                   | Existe hoje? |
| --------- | ---------------------- | --------------------------------------------------------------- | ------------ |
| `rooms`   | "Família com filhos"   | soma cômodos ao `HouseSpec` (`{ quarto: 2 }`)                   | ✅           |
| `variant` | "PlayStation"          | usa a versão alternativa do cômodo (`escritorio-gamer`)         | ✅           |
| `preset`  | "Quero o melhor"       | escolhe Econômico / Equilibrado / Premium                       | ✅           |
| `owned`   | "Já tenho geladeira"   | `excluded[item] = 'owned'`                                      | ✅           |
| `filters` | "Já tenho pratos"      | `utensils: false` / `helpers: true`                             | ✅           |
| `swap`    | "Cooktop de indução"   | troca a categoria do item por uma alternativa (fogão → cooktop) | 🆕           |
| `prefer`  | "PlayStation", "Queen" | só considera opções com a etiqueta pedida                       | 🆕           |
| `need`    | "Cozinho quase nunca"  | muda a importância do item (air fryer 3 → 1)                    | 🆕           |

### 6.1 Novo: trocas de categoria (`swap`)

Para escolhas que são **produtos diferentes**, não faixas de preço (fogão × cooktop, cafeteira de cápsula × espresso, ar × ventilador, console de cada marca).

- **Dados:** o item do cômodo ganha alternativas, cada uma uma categoria completa com seus tiers:
  ```json
  { "category": "fogao", "need": 5, "qty": 1, "alternatives": ["cooktop-gas", "cooktop-inducao"] }
  ```
  Uma alternativa pode puxar itens junto (`cooktop-inducao` traz `forno-embutido`).
- **Escolhas:** `choices.swaps["cozinha:fogao"] = "cooktop-inducao"`.
- **Bônus fora do assistente:** o card ganha "Trocar por cooktop ⇄", então quem não usa o assistente também aproveita.

### 6.2 Novo: preferência por etiqueta (`prefer`)

Para variações **dentro** de uma categoria (tamanho da cama, geladeira inverse).

- **Dados:** opções ganham `tags` (`"tags": ["queen"]`).
- **Escolhas:** `choices.prefer["quarto-1:colchao"] = "queen"`. O motor só considera as opções com a etiqueta; se nenhuma tiver, ignora a preferência (nunca deixa o item sem opção).

### 6.3 Novo: importância ajustada (`need`)

- **Escolhas:** `choices.needs["cozinha:air-fryer"] = 1`. O motor usa esse valor no lugar do `need` do catálogo (ordem de prioridade, filtro de necessidade mínima, "necessário entra sempre").

### 6.4 Função pura

`src/engine/assistant.ts`, sem DOM, 100% testada:

- `visibleQuestions(questions, answers)` → perguntas que valem (aplica os `quando`).
- `applyAnswers(questions, answers, catalog)` → `{ house, preset, choices, summary }`.

Respostas puladas não geram efeito. Responder de novo substitui o efeito anterior (as respostas são a fonte; os efeitos são recalculados do zero).

### 6.5 Link e persistência

- `swaps`, `prefer` e `needs` entram no formato do link como campos **opcionais** (`s`, `t`, `e`), como foram `n`, `u` e `f`: links antigos continuam válidos, sem mudar `STATE_VERSION`.
- As respostas ficam no `localStorage` (para "Refazer com perguntas" vir marcado). Elas **não** vão no link: o link leva o resultado.

## 7. Catálogo necessário

| Pergunta  | O que falta no catálogo                                                                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cooktop   | categorias `cooktop-gas`, `cooktop-inducao`, `forno-embutido`; panelas de indução (etiqueta `inducao` nas panelas)                                                                            |
| Console   | separar `videogame` em `videogame-playstation`, `videogame-xbox`, `videogame-nintendo` (cada uma com seus tiers: ex. PS5 Digital → PS5 com leitor → PS5 Pro)                                  |
| Café      | separar `cafeteira` em `cafeteira-coado`, `cafeteira-capsula`, `cafeteira-espresso`                                                                                                           |
| Calor     | categoria `ventilador`; ar-condicionado vira alternativa                                                                                                                                      |
| Cama      | etiquetas de tamanho (`solteiro`, `casal`, `queen`, `king`) em cama, colchão, jogo de cama, edredom, protetor — **e opções de cada tamanho**, que hoje não existem (cada tier tem um tamanho) |
| Geladeira | etiquetas (`inverse`, `duplex`, `side-by-side`)                                                                                                                                               |

Cada categoria nova passa pela skill `/add-product`; links de afiliado depois pelo `/ml-links`.

O validador ganha regras para: alternativa que não existe, etiqueta usada no assistente sem nenhuma opção com ela, pergunta que aponta para cômodo/categoria inexistente.

## 8. Estrutura de `data/assistant.json`

```json
{
  "questions": [
    {
      "id": "fogao",
      "icon": "🍳",
      "text": "Na cozinha, você prefere…",
      "why": "Indução precisa de panela própria — a gente já ajusta isso.",
      "kind": "single",
      "when": { "hasRoom": "cozinha" },
      "answers": [
        { "id": "gas", "icon": "🔥", "label": "Fogão a gás de piso", "effects": [] },
        {
          "id": "inducao",
          "icon": "⚡",
          "label": "Cooktop de indução",
          "effects": [
            { "swap": { "room": "cozinha", "category": "fogao", "to": "cooktop-inducao" } },
            { "prefer": { "room": "cozinha", "category": "panelas", "tag": "inducao" } }
          ]
        },
        { "id": "tanto-faz", "icon": "🤷", "label": "Tanto faz", "effects": [] }
      ]
    }
  ]
}
```

Validado por Zod (`src/data/schema.ts`), como o resto do catálogo, e coberto pelo `npm run validate`.

## 9. Fora do escopo (por enquanto)

- Texto livre ("descreva sua casa").
- Perguntas sobre marca, cor ou voltagem (estão no backlog do Drop 12 como filtros).
- Personalizar por região/clima automaticamente.

## 10. Como medir

Quando o Drop 11 (métricas) existir: quantos começam o assistente, em que pergunta mais pulam, quantos chegam à lista, e quantos mexem na lista depois (sinal de que a recomendação errou).

## 11. Futuro: LLM de verdade (opcional)

Se quiser um "Monte com AI" real depois: um campo de texto livre ("moro com minha esposa, temos um gato, trabalho em casa…") enviado a um servidor pequeno (ex.: Cloudflare Worker) que chama um LLM e devolve **as mesmas respostas do questionário** (ids). O motor continua o mesmo. Custos, limites de uso e aviso de privacidade precisam ser decididos antes.
