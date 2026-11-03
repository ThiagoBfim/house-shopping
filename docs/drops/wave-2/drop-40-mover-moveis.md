# Drop 40 — Posição dos móveis igual ao 3D, arrastar e lista atual

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 18:20 | 2026-11-03 18:58 | 38min   |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** a "Posição dos móveis" mostra o mesmo que a casa em 3D; dá para mudar os móveis de lugar e o 3D usa as novas posições; o 3D sempre reflete a lista de agora (o que sai da lista some).

**Pronto quando:** depois de gerar a casa em 3D, a vista de cima de cada cômodo usa as medidas, os armários das fotos e as posições do 3D; arrastar (ou setas/R) move e gira com conferência; "🔄 Atualizar o 3D" abre com as posições e a lista de agora; recusar um item tira ele da vista de cima e do 3D.

## Tarefas

- [x] Uma conta só: com casa gerada, a vista de cima usa `furnishHouse` (o mesmo do 3D); sem casa, a planta lida + as posições escolhidas
- [x] Posições escolhidas (`ManualPositions`, por cômodo, salvas no navegador): `setPosition`, `clearPositions`, `tryMove` (dentro do cômodo, sem bater em móvel, armário ou porta), `hintOf`; aplicadas por cima da regra e das sugestões da skill
- [x] Arrastar com mouse/dedo (encaixe de 5 cm, prévia vermelha onde não cabe), setas (10 cm), "↻ Girar"/R, aviso quando não cabe, "↩ Voltar às posições sugeridas"
- [x] Armários das fotos desenhados na vista de cima (não se movem)
- [x] "🔄 Atualizar o 3D" (no lugar de "Abrir casa em 3D"): a casa com a lista e as posições de agora, sem gerar de novo
- [x] Correção: itens da vista de cima não recebiam foco do teclado (`tabIndex` em SVG precisa ser `tabindex`)
- [x] Testes: unitários (posições, tryMove, 3D com posição escolhida, item recusado some) e E2E (vista = 3D, armário, setas, aviso, girar, arrastar inválido e válido, salvar no navegador, voltar às sugeridas, recusar → some do 3D)

## Registro

- **Por que estava diferente:** a vista de cima calculava pela primeira leitura da planta (medida aproximada, só regras) e o 3D pela casa gerada (metros, armários, sugestões da skill). Agora, havendo casa gerada, as duas usam a mesma função.
- **Gerar de novo:** "✨/🌟 Gerar" chama a skill outra vez com os móveis da lista de agora; as posições escolhidas continuam valendo (por cômodo e item) enquanto couberem.
- **Nem todos os móveis apareciam (2026-11-03, pedido do usuário):** só 33 das ~140 categorias tinham medida e lugar (`layout`); o resto sumia sem aviso. Agora: `layout` para o que ocupa lugar no cômodo — lixeiras, cesto de roupa, varal, box do banheiro, cooler, ombrelone (chão), coifa (em cima do fogão, a 1,65 m) e purificador (parede, 1,20 m), com forma no 3D — e o resto do cômodo (bancada e guardados: micro-ondas, air fryer, panelas…) listado em "Também neste cômodo, sem lugar fixo no desenho". Teste: cada item do cômodo está no desenho ou nessa lista.
