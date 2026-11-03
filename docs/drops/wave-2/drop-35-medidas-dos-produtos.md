# Drop 35 — Medidas dos produtos

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** cada móvel e eletro de chão do catálogo tem largura × profundidade × altura (cm), a base do posicionamento e do 3D.

**Pronto quando:** as opções que ocupam chão têm `dimensions` (reais ou estimadas), o card mostra "70,5 × 74 × 194 cm" e o validador exige medidas nas categorias de chão.

## Tarefas

- [ ] Schema: `dimensions: { width, depth, height, estimated? }` (cm) na opção; na categoria, `placement` (`floor` | `wall` | `counter` | `none`) e medida típica por variante (ex.: cama casal 138 × 188)
- [ ] `npm run sync:dims`: medidas pela API do Mercado Livre (`/products/{id}`: WIDTH, DEPTH/LENGTH, HEIGHT), normalizando unidade (cm/m) e largura × profundidade
- [ ] Opção sem catálogo do ML (genéricos, `/up/`): medida típica da categoria/variante, marcada como estimada
- [ ] Card do produto mostra a medida; validador e testes

## Registro

- Teste da API (03/11): geladeira BRE66AE 70,5 × 74 × 194,3 cm; cooktop Gourmand 86 × 51 × 3,8 cm; colchões casal 138 × 188 cm (às vezes com WIDTH e LENGTH trocados). Cobertura estimada: 87 de 221 opções de chão (39%) têm catálogo do ML; o resto usa medida típica.
