# Drop 15 — Escritório (com opção gamer)

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 17:52 | 2026-10-22 18:07 | 15min   |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** cômodo Escritório com a opção gamer (cadeira gamer ou mesh, mesa que levanta, copo legal para o café, videogame, monitor, régua de tomada…). (Pedido do usuário.)

- [x] Cômodo **Escritório** (12 itens) e versão **Escritório gamer** (12 itens)
- [x] Chave "🎮 Gamer" na linha do Escritório, na escolha de cômodos
- [x] Testes E2E (opção gamer + Escritório no teste por cômodo)

**Pronto quando:** ligar "Gamer" escolhe o escritório gamer e a lista traz cadeira gamer/mesh, mesa com regulagem de altura, videogame e 2 réguas de tomada. ✅ E2E `escritório com a opção gamer troca os itens`.

## Registro

- **Modelo:** a versão gamer é outro cômodo em `rooms.json` (`escritorio-gamer`), ligado ao Escritório por `variant` em `ROOM_CARDS` (`src/ui/catalog.ts`). Sem mudança no motor nem no formato do link. A chave move a quantidade entre os dois ids; ligar com o escritório desmarcado já marca 1. "Casa completa" não inclui escritório (nem toda casa tem).
- **Escritório:** mesa (até regulável manual), cadeira (secretária → mesh → Cavaletti → Herman Miller), monitor, régua de tomada, teclado e mouse, fone com microfone, luminária de mesa, suporte de notebook, gaveteiro, copo térmico, suporte de monitor; organizador de cabos como facilitador.
- **Escritório gamer:** mesa com regulagem de altura (manual → elétrica → FlexiSpot), cadeira gamer ou mesh (tier 2 é mesh), monitor gamer (144 Hz → OLED 240 Hz), 2 réguas de tomada, teclado e mouse gamer, headset gamer, videogame (Xbox Series S → PS5 Slim → Switch 2 → PS5 Pro), copo térmico (Stanley Camp Mug → Quencher → Ember), mousepad, suporte articulado, fita LED; organizador de cabos como facilitador.
- 19 categorias novas, preços de referência (sem pesquisa web), links de busca do Mercado Livre — passar pelo `/ml-links`.
