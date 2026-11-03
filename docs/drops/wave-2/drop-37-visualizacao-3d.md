# Drop 37 — Visualização 3D dos móveis

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-03 13:49 | 2026-11-03 13:55 | 6min    |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** ver o imóvel em 3D com os móveis nas posições do Drop 36, girar/aproximar e tocar num móvel para ver nome, medida, preço e link.

**Pronto quando:** o botão "Ver em 3D" abre a cena (paredes na altura padrão, móveis como volumes na medida e na cor do tier), funciona no celular (arrastar e pinçar) e o toque num móvel mostra o cartão com nome, medida, preço e "Comprar".

## Tarefas

- [x] three.js carregado só ao abrir o 3D (não pesa no site de quem não usa)
- [x] Cena a partir do layout: chão e paredes de cada cômodo, móveis como caixas na medida (modelos detalhados ficam para depois)
- [x] Toque/clique num móvel (raycast) → cartão com nome, medidas, preço e link de compra
- [x] Teste E2E (cena carrega, toque abre o cartão) e desempenho no celular

## Registro

- **three.js 0.187** (`three` + `@types/three`), em chunk separado (`room3d`, 139 KB gzip) carregado só no "🧊 Ver em 3D"; o bundle principal continua com ~43 KB gzip. Os 12 avisos do `npm audit` já existiam (ferramentas de lint), nada do three.
- **Cena** (`src/ui/room3d.ts`): o mesmo `RoomLayout` da vista de cima; paredes de 2,6 m com vão de porta (verga a 2,1 m) e janela (peitoril 1 m, vidro até 2,1 m); móveis como volumes na medida, com arestas e cor por tipo; TV e ar na altura da parede. Arrastar gira, pinçar aproxima (OrbitControls). **Corte:** a parede entre a câmera e o cômodo fica quase transparente e acompanha o giro.
- **Toque:** toque sem arrastar (até 6 px) faz o raycast e mostra o cartão (nome, medida real ou típica, preço, link); "Móveis na cena" lista os mesmos itens (acessível e usado no E2E). Em dev, `window.__room3d.screenPosition(id)` dá a posição na tela de um móvel para o teste tocar no canvas — o E2E toca na cama de verdade (WebGL funciona no Chromium headless).
- **O 3D mostrou erro do layout que o 2D escondia:** a TV "de frente para a cama" ia na porta do guarda-roupa. TV sem rack agora procura trecho livre (como ar e espelho), preferindo a parede de frente para a cama.
- **Fora desta entrega:** modelos 3D detalhados (os móveis são volumes), a casa inteira numa cena só (é por cômodo) e arrastar móveis para mudar a posição.
