# Drop 35 — Medidas dos produtos

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 13:30 | 2026-11-03 13:35 | 5min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** cada móvel e eletro de chão do catálogo tem largura × profundidade × altura (cm), a base do posicionamento e do 3D.

**Pronto quando:** as opções que ocupam chão têm `dimensions` (reais ou estimadas), o card mostra "70,5 × 74 × 194 cm" e o validador exige medidas nas categorias de chão.

## Tarefas

- [x] Schema: `dimensions: { width, depth, height, estimated? }` (cm) na opção; na categoria, `placement` (`floor` | `wall` | `counter` | `none`) e medida típica por variante (ex.: cama casal 138 × 188)
- [x] `npm run sync:dims`: medidas pela API do Mercado Livre (`/products/{id}`: WIDTH, DEPTH/LENGTH, HEIGHT), normalizando unidade (cm/m) e largura × profundidade
- [x] Opção sem catálogo do ML (genéricos, `/up/`): medida típica da categoria/variante, marcada como estimada
- [x] Card do produto mostra a medida; validador e testes

## Registro

- Teste da API (03/11): geladeira BRE66AE 70,5 × 74 × 194,3 cm; cooktop Gourmand 86 × 51 × 3,8 cm; colchões casal 138 × 188 cm (às vezes com WIDTH e LENGTH trocados). Cobertura estimada: 87 de 221 opções de chão (39%) têm catálogo do ML; o resto usa medida típica.
- **Modelo:** `dimensions` (cm) na opção = medida real; `layout` na categoria = onde fica (`floor`, `wall`, `rug`, `none`) e tamanho típico, com o que cada variante muda (cama casal/queen/king; cooktop `none` porque fica na bancada). `sizeOf` (`src/data/layout.ts`) devolve a real ou a típica marcada como estimada; o motor põe a medida em cada item da lista (`ListEntry.size`), já na variante escolhida.
- **35 categorias com layout** (móveis e eletros de chão, TV e ar-condicionado na parede, tapete). Bancada (micro-ondas, air fryer…) e itens pequenos ficam de fora do desenho.
- **`npm run sync:dims`:** 34 medidas reais em 13 categorias; 93 opções sem catálogo do ML e 9 sem medida na API (ou implausível) ficam com a típica.
- **Orientação:** a API às vezes troca largura e comprimento (colchão). A frente segue a da típica só em item alongado (≥ 1,2: cama, berço, espreguiçadeira); no primeiro rascunho um freezer horizontal virou 78 × 160 (é 160 × 78) e um ventilador também girou — a regra passou a respeitar a API em itens quase quadrados.
- **Plausibilidade:** cada medida até 3,5× a típica (para cima ou para baixo); fora disso é embalagem ou erro, e vale a típica.
