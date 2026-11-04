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
- **Lavanderia na cozinha (2026-11-03, regra pedida pelo usuário):** planta com cozinha e sem área de serviço → a lavanderia entra na lista mesmo assim (antes ela sumia, e com ela a máquina de lavar) e os itens dela ficam na cozinha: desenho do imóvel ("Cozinha + Lavanderia"), posição dos móveis (aviso 🧺 na aba da cozinha, sem aba própria), casa em 3D e o que a skill recebe. Regra genérica em `HOST_ROOM` (`engine/floor-plan.ts`: cômodo sem lugar → cômodo que recebe) e `guestsByHost`.
- **Todos os cômodos e a medida da troca (2026-11-03, pedido do usuário):** a ligação planta → cômodo era feita só na leitura; mudar a quantidade ou o tipo depois tirava o cômodo da posição dos móveis. Agora `linkPlanRooms` religa ao cômodo de agora do mesmo tipo (maior primeiro), também na casa em 3D; cômodos da lista fora da planta aparecem com medida típica (`TYPICAL_ROOM_CM`). Item trocado ganhou medidas opcionais (largura × profundidade × altura, `dimensions`, vão no link como 7ª posição): trocou o sofá → o desenho e o 3D usam o tamanho do novo e o espaço que sobra vale para os outros móveis. Sem medida, o card mostra a típica com o aviso para informar em Editar.
- **Sala em L sem caber nada (2026-11-04, planta real do usuário):** a geração realista dividiu a sala de 17,23 m² em dois retângulos e marcou o pedaço junto à varanda como "outro" (perdia 5,4 m²); o retângulo da sala tinha um vão de 2,5 m entre as partes tratado como porta de abrir, reservando um quadrado de 2,5 × 2,5 m. Correções: vão > 1,10 m (ou porta de correr) reserva só 60 cm de passagem (`MAX_SWING_DOOR_CM`) e não tem folha no 3D; cômodo em L com `partOf` (skill) e reconhecimento em casas já geradas (`resolveParts`: "outro" com nome começando pelo do cômodo, encostado e com vão largo); o que não cabe no principal vai para a parte; aba por parte na posição dos móveis; `relinkHouse` respeita as partes. Mesa de jantar sem lugar com cadeiras em volta encosta na parede (cadeiras em três lados, `againstWall`). No caso real: sofá, rack, mesa de centro, poltrona, TV, ar e luminária cabem; a mesa de 160 × 90 com cadeiras não (precisa de 2,10 m; o canto junto à varanda tem 2,04 m e é passagem).
