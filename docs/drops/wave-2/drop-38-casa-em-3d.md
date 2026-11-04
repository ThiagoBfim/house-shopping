# Drop 38 — Casa inteira em 3D (planta + fotos), primeira pessoa e tour em vídeo

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 16:29 | 2026-11-03 16:52 | 23min   |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** com a planta e fotos dos cômodos, "✨ Gerar casa em 3D" chama a skill `/house-3d` no backend local e monta a casa inteira em 3D com todos os móveis da lista, na medida, para ver de cima, andar em primeira pessoa e assistir (e gravar) um tour.

**Pronto quando:** a casa abre em tela cheia com os cômodos na posição da planta, portas (batente e folha aberta para o lado certo) e janelas (peitoril, caixilho e vidro), piso e parede pelo acabamento das fotos; dá para andar sem atravessar parede nem móvel (teclado ou joystick no celular); o tour passa por todos os cômodos pelas portas e pode virar vídeo para baixar.

## Tarefas

- [x] Skill `/house-3d` (`.claude/skills/house-3d/SKILL.md`): planta em metros, portas com dobradiça/abertura, janelas com peitoril, acabamentos pelas fotos, posição dos móveis só quando a planta/foto mostra; casa sempre navegável
- [x] Backend: `POST /api/house-3d` (multipart: planta, até 8 fotos, móveis com medida) → `claude -p /house-3d` com `--json-schema` (`HOUSE_3D_SCHEMA`), US$ 4 no máximo; `house3d` no `/api/health`
- [x] Motor (`engine/house3d.ts`): confere a resposta, liga cada cômodo ao da lista (mesmo nome da planta lida = mesmo cômodo e tipo), móveis pela regra + sugestões da skill conferidas (`applySuggestions`: dentro do cômodo, sem bater, fora do giro da porta)
- [x] Geometria (`engine/house-world.ts`): paredes com meia espessura por cômodo, vãos de porta dos dois lados, folhas, ligações entre cômodos, entrada, passagem automática para cômodo sem porta, colisão (`move`, em passos de 10 cm), ponto livre e roteiro do tour
- [x] Cena (`ui/house-scene.ts` + `ui/furniture-models.ts`, import dinâmico): texturas de piso desenhadas (madeira, porcelanato, cerâmica, cimento, carpete, deck), rodapé, sombras, luz por cômodo, móveis com forma reconhecível; maquete com paredes cortadas, primeira pessoa, tour, gravação (`MediaRecorder`) e foto
- [x] Interface: "🏠 Casa em 3D" dentro de "📐 Sua planta" (planta + fotos reduzidas no navegador), tela cheia com De cima / Andar / Tour / Gravar tour em vídeo / Foto, cômodo atual, cartão do móvel tocado; casa salva no navegador
- [x] Testes: unitários (resposta, ligação, sugestões, paredes/portas/janelas, colisão, tour, resposta real da skill) e E2E (gerar, multipart, andar, tour gravado, baixar vídeo, reabrir)

## Registro

- **Um drop só (2026-11-03):** o plano era 4 drops (skill + gerar, casa 3D, primeira pessoa, tour/vídeo); como cada parte depende da anterior e o teste de ponta a ponta cobre tudo junto, ficou num drop só.
- **Qualidade realista, não foto:** o 3D é montado no navegador com geometria (three.js); não há geração de imagem fotorrealista. As fotos servem para piso e cor de parede.
- **Teste real da skill:** planta do apartamento de teste → 11 cômodos em metros, portas com dobradiça e abertura, ~2 min, US$ 0,41 (`tests/fixtures/house-3d-apto.json`). A planta só desenha 3 portas: daí a regra "casa navegável" na skill e a passagem automática de 80 cm no motor (`passages`).
- **Tempo real no tour:** o passo de tempo por quadro vai até 0,25 s — com o limite de 0,05 s o tour (e o vídeo) ficava em câmera lenta em aparelho fraco.
- **Maquete:** paredes, portas e vidros cortados a 1,35 m; o que fica acima do corte (ar-condicionado) some nessa vista, senão parece flutuar fora da casa. O teto só aparece em primeira pessoa.
- **Cadeiras:** desenhadas em volta da mesa de jantar/externa e contam como obstáculo (35 cm em volta da mesa).
- **Vídeo:** MP4 quando o navegador grava (Safari), senão WebM; fica só no navegador até a pessoa baixar.
