# Drop 21 — Limpeza, reparos e itens que faltavam

| Status          | Iniciado em      | Terminado em | Duração |
| --------------- | ---------------- | ------------ | ------- |
| 🚧 Em andamento | 2026-10-23 17:44 | —            | —       |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** revisar o catálogo e completar o que faltava (ex.: multiprocessador), dar mais opções de aspirador vertical, separar o robô aspirador e perguntar no "Monte pra mim" sobre limpeza e sobre reparos (nem todo mundo quer furadeira, kit de ferramentas e alicates). (Pedido do usuário.)

**Pronto quando:** a cozinha traz multiprocessador, panela de pressão, sanduicheira e panela de arroz; o aspirador tem as variantes vertical (4 modelos) e tradicional; o robô aspirador é uma categoria própria; responder "Chamo alguém" na pergunta de reparos tira furadeira, kit de ferramentas e alicates da lista, e "Robô aspirador" na de limpeza põe o robô com necessidade alta.

## Tarefas

### 21.1 — Catálogo

- [x] Revisar os cômodos e listar o que falta
- [x] Novas categorias com modelos reais e link direto do produto: `multiprocessador`, `panela-de-pressao`, `sanduicheira`, `panela-de-arroz`, `alicates`
- [x] `aspirador` com variantes `vertical` (padrão, 4 tiers) e `tradicional`
- [x] `robo-aspirador` como categoria própria (o Roborock sai do aspirador)
- [x] Cômodos (`rooms.json`), ícones (`src/ui/catalog.ts`) e planilha do Mercado Livre

### 21.2 — Assistente

- [x] Pergunta "limpeza" (aparece com Utilidades): vassoura e rodo / aspirador vertical / tradicional / robô
- [x] Pergunta "reparos" (aparece com Utilidades): faço de tudo / só o básico / chamo alguém
- [x] `docs/project/Assistente.md` atualizado

## Decisões

- **Revisão dos cômodos:** faltavam itens comuns de cozinha (multiprocessador, panela de pressão, sanduicheira, panela elétrica de arroz) e alicates nas utilidades. O resto dos cômodos já cobre o básico de uma casa nova (mesa de jantar já vem com cadeiras; ventilador é variante do ar-condicionado; mop, vassoura e balde estão no kit de limpeza; furadeira já inclui parafusadeira).
- **Aspirador com variantes:** `vertical` (padrão) com 4 tiers — Mondial Turbo Cycle (com fio), Electrolux Ergorapido (sem fio), Xiaomi G20 Lite e Dyson V8 Absolute — e `tradicional` ("Pó e água": WAP GTW 10 e Electrolux 12 L). Cada variante aceita no máximo 4 modelos (um por tier).
- **Robô aspirador é categoria própria** (Mondial RB-07, WAP W1000, Roborock Q7 Max e Roborock S8), em Utilidades com necessidade 1: só sobe quando a pessoa escolhe o robô no assistente. Não é facilitador, para não sumir quando os facilitadores estão desligados.
- **Perguntas novas aparecem com Utilidades** (que o assistente sempre inclui). "Vassoura e rodo" recusa aspirador e robô; aspirador vertical ou de pó e água recusa o robô; robô sobe o robô para 4 e mantém o aspirador com necessidade 2 (para sofá e cantos).
- **Reparos:** "Faço de tudo" sobe kit de ferramentas (5), furadeira (4) e alicates (3); "Só o básico" fica só com o kit; "Chamo alguém" recusa os três. Escada continua, porque serve para trocar lâmpada.
- **"Com que frequência você cozinha?"** também mexe nos itens novos: todo dia sobe multiprocessador e panela de pressão; quase nunca sobe a sanduicheira e desce o resto.
- Limite de perguntas do assistente passou de 13 para 15.
- Todos os modelos novos têm link direto do produto no Mercado Livre e foto (ainda sem link de afiliado).

## Registro

- 2026-10-23 17:50 — itens novos em `rooms.json` sem `qty` deram total `NaN` (a lista lê o JSON sem os padrões do Zod). Adicionado `qty: 1`.
