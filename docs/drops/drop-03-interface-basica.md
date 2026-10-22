# Drop 3 — Interface básica

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 09:38 | 2026-10-22 09:40 | 2min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** usuário escolhe cômodo + orçamento e vê a lista.

- [x] Tela inicial: cards de cômodos
- [x] Campo de orçamento com máscara em R$ e sugestões (10k, 30k, 50k)
- [x] Lista de itens: imagem, nome, tier (badge), preço, bullets, botão "Comprar"
- [x] Resumo fixo: total, saldo, barra de progresso do orçamento
- [x] Layout responsivo (mobile first — a maioria vai abrir pelo WhatsApp)
- [x] Estado vazio / erro de carregamento do JSON

**Pronto quando:** Cozinha + R$ 30.000 gera uma lista navegável no celular. ✅ Verificado com Playwright em 390×844 (claro) e 1280×900 (escuro), sem erros no console.

## Registro

- **Fluxo em 3 telas:** cômodos → orçamento → lista. "Trocar cômodo" e "Alterar orçamento" voltam às telas anteriores.
- **Cômodos "em breve":** Quarto, Sala, Quarto do bebê e Área externa aparecem desabilitados até existirem em `rooms.json` (`ROOM_CARDS` em `src/ui/catalog.ts`).
- **Faixa de orçamento:** a tela de orçamento mostra o mínimo para os essenciais, o total com tudo no mais barato e o total com tudo no topo (`budgetRange` no motor). Isso ajuda a escolher um valor que faça sentido.
- **Máscara do orçamento:** o campo aceita só dígitos e formata como `30.000` (`parseDigits`, `formatInteger`); `inputMode="numeric"` abre o teclado numérico no celular.
- **Catálogo** carregado com `import()` dinâmico, num chunk separado do código. Isso permite mostrar "Carregando…" e "Tentar de novo" se falhar, e mantém o JS inicial leve.
- **Passou do orçamento:** quando os essenciais não cabem, a barra fica vermelha, aparece "Faltam R$ X" e um aviso; os itens que não couberam aparecem em "Não coube no orçamento", com o preço "a partir de".
- **Link "Comprar"** com `rel="sponsored noopener noreferrer"`, que é o recomendado para links de afiliado.
- **Visual:** tokens CSS com tema claro/escuro automático, uma cor por tier no badge e o resumo fixo no topo ao rolar.
- **Sem imagem:** como os produtos mock não têm imagem, o card mostra a inicial da categoria.
- **Texto:** a pergunta virou "Cozinha: quanto você quer gastar?", porque "na Cozinha" ficaria errado para "Quarto" e "Sala".
- **Playwright** (`@playwright/test` + Chromium) instalado já neste drop para as screenshots; o Drop 4 usa para os testes E2E.
