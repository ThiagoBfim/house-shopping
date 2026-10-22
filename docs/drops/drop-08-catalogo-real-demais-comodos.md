# Drop 8 — Catálogo real: demais cômodos

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 10:25 | 2026-10-22 10:30 | 5min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** cobrir os cômodos do escopo inicial.

- [x] Quarto (casal)
- [x] Sala
- [x] Quarto do bebê
- [x] Área externa
- [x] Reaproveitar categorias compartilhadas (ex.: TV e ar-condicionado em Sala e Quarto)
- [x] Criar skill de projeto `/add-product` para padronizar a pesquisa (ver Skills.md)

**Pronto quando:** 5 cômodos publicados e validados. ✅ 5 cômodos, 51 categorias e 192 opções, validados; E2E monta a lista de cada cômodo.

## Registro

- **Cômodos novos:**
  - Quarto: 11 itens.
  - Sala: 10 itens.
  - Quarto do bebê: 10 itens.
  - Área externa: 7 itens.

  Todos já aparecem habilitados na tela inicial (os ids batem com `ROOM_CARDS`). A tabela completa, com necessidade de cada item, está no `Project.md` §2.

- **Categorias compartilhadas:** `tv`, `ar-condicionado` e `cortina` são um arquivo só, usado em vários cômodos com necessidade própria (ex.: TV 4 na Sala, 2 no Quarto).
- **Quantidade:** criado-mudo ×2, travesseiro ×2 e espreguiçadeira ×2. O preço é por unidade e o motor multiplica.
- **Enxoval = utensílio:** jogo de cama, travesseiro, edredom, kit berço e kit churrasco têm `utensil: true`, então "sem utensílios" deixa só móveis e eletros.
- **Mesa de jantar** é um conjunto (mesa + cadeiras), para não contar as cadeiras duas vezes; ficou na Sala.
- **Pesquisa:** guias de 2026 (mybest, Buscapé, Zoom, Canaltech, Casa dos Eletrodomésticos, TecMundo) e comparadores de preço. Preços de referência de 2026-10-22, links de busca no Mercado Livre (mesmas regras do Drop 7).
- **Conferência:**

  | Cômodo         | Só o necessário | Tudo no mais barato | Tudo no topo |
  | -------------- | --------------- | ------------------- | ------------ |
  | Quarto         | R$ 2.814        | R$ 7.837            | R$ 46.087    |
  | Sala           | R$ 3.896        | R$ 7.530            | R$ 55.090    |
  | Quarto do bebê | R$ 1.446        | R$ 5.230            | R$ 30.740    |
  | Área externa   | R$ 648          | R$ 2.102            | R$ 31.192    |

- **Skill `/add-product`** em `.claude/skills/add-product/SKILL.md`: passo a passo para pesquisar 4 tiers, o formato do JSON, as regras do validador e como colocar no cômodo. Lê só um arquivo de exemplo, para gastar menos tokens.
- **E2E:** um teste por cômodo ("monta a lista com R$ 15.000"), 18 no total.
- **Bundle:** o catálogo cresceu para ~15 kB gzip, num chunk separado carregado depois da tela inicial.
