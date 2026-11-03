# Drop 39 — Casa em 3D realista e armários das fotos

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 17:30 | 2026-11-03 18:12 | 42min   |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** dois botões — "✨ Gerar casa em 3D" (como no Drop 38) e "🌟 Gerar casa em 3D realista" (demora mais, bem mais realista) — e, nos dois, os armários que aparecem nas fotos (embutido, bancada, aéreo, gabinete) desenhados na medida, com os móveis da lista desviando deles.

**Pronto quando:** a casa realista abre com texturas reais (piso, madeira, tecido, relevo da parede) na cor das fotos, céu iluminando e aparecendo nas janelas, móveis com quinas arredondadas e oclusão de ambiente; "📸 Render realista" baixa a vista em alta qualidade; os armários das fotos aparecem e ocupam lugar.

## Tarefas

- [x] Skill `/house-3d`: `builtIns` por cômodo (tipo, parede, início/comprimento, profundidade, altura, elevação, acabamento, cor, tampo, pia, cooktop, portas), `tileCm` e modo `realista` (argumento depois da pasta: olha cada foto com cuidado)
- [x] Backend: `POST /api/house-3d?quality=realista` (orçamento US$ 8 e até 20 min; rápida US$ 4 e 10 min); schema com `builtIns`
- [x] Motor: `BuiltIn` (conferido e recortado na parede), `builtInPlaced` (peça fixa), `arrangeRoom(..., fixed)` e `applySuggestions(..., fixed)`: móveis da lista e sugestões não ficam em cima dos armários
- [x] Texturas CC0 do Poly Haven em `public/textures` (512 px, 2,7 MB, só no modo realista), tingidas para a cor das fotos e na escala real; céu HDRI
- [x] Cena realista: céu como ambiente e fundo, sombra 4096, oclusão de ambiente (GTAO), quinas arredondadas, madeira/tecido com textura, vidro com transmissão; armários das fotos (bancada com tampo de pedra, cuba e cooktop; aéreo; embutido; gabinete com cuba)
- [x] Corte da maquete por geometria (achata as peças) no lugar do plano de corte
- [x] Interface: dois botões de gerar, "✨ Realista" liga/desliga no visualizador, "📸 Render realista" (2× a resolução, 8 amostras por pixel, oclusão completa) com download
- [x] Testes: armários (conferência, peça fixa, móveis desviando, sugestão recusada) e E2E do realista (query `quality`, modo realista, render, contagem de armários)

## Registro

- **Realismo local (escolha do usuário, 2026-11-03):** sem IA de imagem externa; texturas reais + render no navegador.
- **Traçado de raios testado e descartado:** `three-gpu-pathtracer` (WebGL, marcado como obsoleto pela própria biblioteca) levou 90–145 s por imagem num M1 Pro e, em cômodo fechado iluminado por janela, saiu granulado mesmo com 128 amostras e o filtro de ruído. Trocado pelo render de alta qualidade (supersampling 2× + 8 amostras + GTAO): ~1 s e imagem limpa.
- **Cor das fotos com textura real:** o material é tingido para a média da textura virar a cor lida pela skill (assim o porcelanato bege da foto continua bege com o veio da textura).
- **Armários das fotos ocupam lugar:** no teste, o embutido da suíte fez o guarda-roupa da lista não caber — coerente (já existe armário ali).
- **Sem fotos reais do apartamento:** a skill realista não foi rodada com fotos; os armários foram testados com uma resposta montada (`tests/fixtures/house-3d-armarios.json`).
