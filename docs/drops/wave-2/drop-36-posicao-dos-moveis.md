# Drop 36 — Posição dos móveis na planta

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 13:37 | 2026-11-03 13:48 | 11min   |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** com a planta e as medidas, cada cômodo ganha uma imagem em escala com os móveis da lista posicionados no melhor lugar que as regras conseguem.

**Pronto quando:** na planta lida, tocar num cômodo abre a vista de cima em escala com os móveis (cama encostada na parede com circulação dos lados, guarda-roupa na parede livre, sofá de frente para a TV…) e avisa o que não coube.

## Tarefas

- [x] Medidas reais do cômodo: largura × comprimento em metros (área + proporção do retângulo na planta)
- [x] Skill `/floor-plan` lê também **portas e janelas** (posição na parede) para não bloquear passagem
- [x] `src/engine/layout.ts`: posicionamento por regras (móveis grandes primeiro, encostados na parede, 60–80 cm de circulação, sem sobrepor portas, pares como sofá ↔ TV e cama ↔ criados), lógica pura e testada
- [x] SVG em escala por cômodo (vista de cima, com régua) e lista do que não coube

## Registro

- **Portas e janelas:** a skill `/floor-plan` devolve `openings` por cômodo (porta/janela, parede do retângulo, posição 0–1 e largura). Teste real com uma planta com 3 portas e 4 janelas: acertou as 7 (a porta suíte ↔ dorm. 2 dos dois lados), 25 s, US$ 0,30 (era US$ 0,27 sem portas). Resposta em `tests/fixtures/floor-plan-apto-portas.json`.
- **Medida do cômodo** (`roomSizeCm`): área + proporção do retângulo na planta; sem área, a escala dos outros cômodos; sem nenhuma, 3 × 3 m.
- **Regras (`arrangeRoom`, lógica pura):** cama/berço na parede mais longa, centralizada, com 50 cm de cada lado e criados-mudos na cabeceira; sofá na parede mais longa e rack de frente; mesa de centro a 40 cm do sofá; mesa de jantar no meio com 60 cm para as cadeiras (nas duas orientações); o resto encostado na parede, maiores primeiro, guarda-roupa/geladeira/freezer nos cantos; 60 cm livres na frente de cada móvel; nada no giro das portas; móvel acima de 110 cm fora da janela; tapete sob a área de estar; TV acima do rack (ou de frente para a cama); ar-condicionado e espelho num trecho de parede livre. O que não cabe vai para "Não coube".
- **Correções pelo primeiro desenho:** o ar-condicionado tinha ido para cima do guarda-roupa e o espelho para trás da cama (itens de parede agora procuram trecho livre, sem móvel encostado que chegue à altura deles); a mesa de jantar não cabia na sala de 20 m² (sala de estar e jantar agora é dividida: metade do estar longe da porta, com sofá e rack nas paredes laterais um de frente para o outro, e metade do jantar).
- **Tela:** "🛋️ Posição dos móveis" na lista (chave "Planta da casa"): abas por cômodo, vista de cima em escala com régua de 1 m, portas com o arco, janelas em azul, itens de parede como faixa fina; tocar num móvel mostra nome, medida (real ou típica), preço e link.
- **Limites:** é por regras, não otimização; cômodo tratado como retângulo (em L vira o retângulo que o envolve); cadeiras da mesa de jantar não são desenhadas (só o espaço delas).
