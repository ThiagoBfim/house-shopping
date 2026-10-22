# Drop 14 — Layout: recolher cômodo, busca rápida, utilidades e card novo

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 17:30 | 2026-10-22 17:51 | 21min   |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** melhorar a tela da lista (pedido do usuário): esconder um cômodo inteiro, buscar produto pelo nome, catálogo de utilidades mais completo e card com imagem maior.

- [x] Recolher/abrir cada cômodo (e "Recolher todos / Abrir todos") na lista agrupada
- [x] Busca rápida pelo nome (categoria, modelo ou cômodo), sem diferenciar acento
- [x] Catálogo: cômodos **Lavanderia** e **Utilidades**, + itens que faltavam na Cozinha e no Quarto
- [x] Card novo: foto grande (topo no celular, coluna de 200 px no desktop) e ícone da categoria quando não há foto
- [x] Revisão do catálogo: 16 produtos que faltavam (escova sanitária, acessórios com descascador de alho, tábua, assadeiras, roteador…)
- [x] Opção **Incluir facilitadores** (organizadores, potes de silicone para congelar…), desligada por padrão
- [x] Testes (unitários + E2E)

**Pronto quando:** recolher o Quarto 2 some com os cards dele (e continua recolhido ao recarregar); buscar "colchao" mostra só colchões, abrindo os cômodos recolhidos. ✅ E2E `recolher um cômodo…` e `busca rápida…`.

## Registro

- **Recolher cômodo:** só na lista agrupada (com um cômodo não faz sentido). O cabeçalho vira botão (`aria-expanded`) e continua mostrando quantidade e subtotal. Os cômodos recolhidos ficam no `localStorage` (`house-shopping:collapsed`), não no link compartilhado: é preferência de quem está olhando. Tocar no atalho do cômodo abre ele.
- **Busca:** `matchesSearch` em `src/engine/search.ts` (todas as palavras, em qualquer ordem, sem acento). Durante a busca, os cômodos sem resultado somem e os recolhidos abrem. Só filtra a tela: o orçamento e o subtotal do cômodo não mudam.
- **Utilidades** (régua de tomada ×3, extensão, escada, lanterna, kit de ferramentas, kit de limpeza, lâmpadas LED, primeiros socorros, aspirador, furadeira) e **Lavanderia** (máquina de lavar, varal, ferro, tábua, cesto). Na Cozinha entraram utensílios de cozinha, escorredor, lixeira e potes; no Quarto, cabides. Itens pequenos marcados como `utensil` (saem com "sem utensílios"). Entram no "Casa completa".
- **Preços dos 20 produtos novos são de referência** (modelos reais, `url` = busca no Mercado Livre); precisam de link de afiliado/preço real via `/ml-links`.
- **Card:** foto com `object-fit: contain` posicionada em absoluto (foto alta, como geladeira, não estica o card). Sem foto, fundo na cor do tier com o emoji da categoria (`categoryIcon` em `src/ui/catalog.ts`; categoria nova sem ícone usa o do cômodo).
- **Revisão do catálogo (2ª rodada):** Cozinha + acessórios (abridor, ralador, descascador e espremedor de alho), tábua de corte, formas/assadeiras, panos de prato, chaleira, batedeira, garrafa térmica; Banheiro + escova sanitária (5) e desentupidor; Quarto + protetor de colchão, luminária de cabeceira, espelho; Sala + luminária de chão; Quarto do bebê + banheira; Lavanderia + prendedores; Utilidades + roteador Wi-Fi. Mesmo aviso: preços de referência.
- **Facilitadores:** campo opcional `helper` na categoria (`schema.ts`); `Choices.helpers` (padrão `false`, então listas e links antigos não mudam); no link vai `f: 1` só quando ligado. Na lista, em vez de cada facilitador aparecer em "Escondidos pelos filtros", um quadro convida a incluir todos de uma vez; no card, selo "✨ Facilitador". 13 categorias: potes de silicone para congelar, organizadores de geladeira e de armário, porta-temperos, organizador de talheres, seladora a vácuo, dispenser de detergente, colmeia, sacos a vácuo, sapateira, prateleira de box, fechadura digital, Alexa.
- **Kit Vicalina ferro fundido 20 peças:** não entrou. A busca não achou preço e o kit cairia entre o tier 2 (R$ 549) e o 3 (R$ 1.499) das panelas, sem vaga de tier. Fica como sugestão para trocar o tier 3, se o usuário quiser uma opção de ferro fundido.
- **Ajuste (2026-10-22, pedido do usuário):** mop e aspirador têm funções diferentes e cabem os dois. O aspirador subiu de necessidade 2 para **3** (antes saía primeiro quando o orçamento apertava). Tier 2 virou o **WAP GTW 10 (pó e água, com sopro)** no lugar do WAP Power Speed; bullets dos outros tiers destacam as funções (2 em 1, de mão, robô que passa pano). O kit de limpeza virou "Kit de limpeza (vassoura, rodo e mop)". Com os três orçamentos sugeridos, os dois entram na lista.
