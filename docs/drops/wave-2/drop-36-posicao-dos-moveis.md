# Drop 36 — Posição dos móveis na planta

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** com a planta e as medidas, cada cômodo ganha uma imagem em escala com os móveis da lista posicionados no melhor lugar que as regras conseguem.

**Pronto quando:** na planta lida, tocar num cômodo abre a vista de cima em escala com os móveis (cama encostada na parede com circulação dos lados, guarda-roupa na parede livre, sofá de frente para a TV…) e avisa o que não coube.

## Tarefas

- [ ] Medidas reais do cômodo: largura × comprimento em metros (área + proporção do retângulo na planta)
- [ ] Skill `/floor-plan` lê também **portas e janelas** (posição na parede) para não bloquear passagem
- [ ] `src/engine/layout.ts`: posicionamento por regras (móveis grandes primeiro, encostados na parede, 60–80 cm de circulação, sem sobrepor portas, pares como sofá ↔ TV e cama ↔ criados), lógica pura e testada
- [ ] SVG em escala por cômodo (vista de cima, com régua) e lista do que não coube

## Registro
