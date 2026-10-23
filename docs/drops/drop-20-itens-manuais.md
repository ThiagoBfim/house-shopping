# Drop 20 — Adicionar itens manualmente

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-23 13:55 | 2026-10-23 14:01 | 6min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** em cada cômodo, o usuário adiciona um item que não está no catálogo informando **link do produto, nome, preço e quantidade**. O item entra na lista, conta no orçamento, vai no link compartilhado e no Excel. (Pedido do usuário.)

**Pronto quando:** na Cozinha, "+ Adicionar item" com nome "Cadeira Tok&Stok", preço R$ 399,90, quantidade 4 e um link da Amazon faz o item aparecer na seção da Cozinha com o selo "Adicionado por você" e "4 × R$ 399,90"; o total sobe R$ 1.599,60 e o motor redistribui o resto do orçamento; o link compartilhado e o Excel trazem o item; remover o item devolve a lista ao que era.

## Tarefas

### 20.1 — Motor e estado

- [x] `src/engine/manual.ts`: tipo `ManualItem` (`id`, `instanceId`, `name`, `price`, `qty`, `url`), `addManual` / `updateManual` / `removeManual` (puras, como em `choices.ts`) e `parseManualInput` (valida e normaliza o que veio do formulário)
- [x] Loja deduzida do link (`storeFromUrl`: mercadolivre / amazon / other)
- [x] `describeList`/`planList`: itens manuais entram sempre (como os necessários), somam `preço × qtd` no `total` e o motor planeja o catálogo com `orçamento − total manual`
- [x] `ListView.manual` com os itens manuais por cômodo; `export.ts` inclui as linhas (Item = "Adicionado por você", Qtd, Preço unitário e Total)
- [x] `share.ts`: campo opcional `m` no `Wire` — `[instanceId, nome, preço, url, qtd?][]` (qtd ausente = 1); sem mudar `STATE_VERSION` (links antigos continuam válidos). No `decodeState`, descartar itens de cômodos que não estão mais na casa e entradas inválidas
- [x] Testes unitários: validação (inclusive quantidade), loja pelo link, orçamento com quantidade (manual consome o orçamento e passa dele se precisar), share ida e volta + entradas inválidas, export

### 20.2 — Interface

- [x] Botão "+ Adicionar item" no fim de cada seção de cômodo (`ListScreen.tsx`)
- [x] Formulário (inline no cômodo, não modal): Nome · Preço unitário (R$, aceita vírgula) · Quantidade (começa em 1, com − / +) · Link do produto; mensagens de erro em pt-BR; Enter salva, Esc cancela
- [x] Card do item manual: nome, preço ("4 × R$ 399,90 = R$ 1.599,60" quando qtd > 1), loja, link "Ver anúncio", selo "Adicionado por você", botões Editar e Remover (sem mais barato/mais caro/travar/variante/recusar)
- [x] A busca da lista também encontra itens manuais
- [x] Toast ao adicionar/remover (com "Desfazer" no remover)
- [x] E2E: adicionar com quantidade, ver o total mudar, editar a quantidade, remover, recarregar a página (persistência) e abrir o link compartilhado

## Decisões

- **Nome, preço e link são obrigatórios; quantidade é opcional (padrão 1).** Nome: 1–80 caracteres (aparado). Preço: > 0 e ≤ R$ 1.000.000, arredondado a centavos (é o preço de uma unidade). Quantidade: inteiro de 1 a 99. Link: `http://` ou `https://` válido (`new URL`); outro protocolo é recusado (evita `javascript:`).
- **Prioridade no orçamento:** o item manual foi escolhido pelo usuário, então é tratado como travado e necessário — nunca sai por falta de orçamento. Se a soma passar do orçamento, a tela mostra "faltam R$ X" como já acontece hoje.
- **Link não é afiliado:** é o link que o usuário colou, sem etiqueta. Abrir com `rel="noopener noreferrer nofollow"`.
- **Sem foto nem histórico de preço:** não buscamos nada do link (o site é estático e não tem backend). O card mostra um ícone genérico.
- **Limite de 30 itens manuais por lista**, para o link `#l=` não ficar grande demais (o `lz-string` comprime, mas nomes e URLs longos pesam). Ao atingir, o botão fica desabilitado com aviso.
- **Remover um cômodo da casa** remove os itens manuais dele (o `decodeState` também descarta os de cômodos que não existem). Em vez de perguntar antes, um aviso com "Desfazer" (ver Registro).
- **Id:** curto e local (`crypto.randomUUID().slice(0, 8)`); não vai no link — no `decodeState` o id é regerado pela posição.

## Fora do escopo

- Ler nome/preço/foto automaticamente a partir do link.
- Variantes ou tiers em itens manuais.
- Sugerir o item manual para outras pessoas ou incluí-lo no catálogo.

## Registro

- **Estado:** os itens ficam em `choices.manual` (`Choices`), então "Desfazer", `localStorage` e link funcionam sem código novo na sessão. `planList` começa com `spent` = total manual; `describeList` soma e devolve `view.manual` com a loja deduzida do link.
- **Recalcular:** adicionar, editar ou remover marca a lista como pendente (igual a travar/recusar). O motor só redistribui o orçamento no "↻ Recalcular lista"; até lá a tela pode mostrar "Faltam R$ X".
- **Cômodo removido:** em vez de um `confirm`, os itens manuais saem com o cômodo e um aviso "N itens adicionados por você saíram junto com o cômodo" oferece "Desfazer" (mesmo padrão do resto do app). "Refazer com perguntas" mantém os itens dos cômodos que continuam na casa.
- **Card:** preço total em destaque e "4 × R$ 399,90" embaixo, como nos cards do catálogo. Ícone 🛍️, borda tracejada e botão "Ver anúncio {na loja} ↗" (`rel="noopener noreferrer nofollow"`, sem `sponsored`).
- **Preço digitado:** aceita "399,90", "1.599,90", "R$ 1.599" e "399.90" (`parsePrice`); ponto só é decimal quando é o único e tem 1–2 casas depois.
- **Link compartilhado:** `m: [cômodo, nome, preço, link, qtd?]`; ids são regerados (`m1`, `m2`…) ao abrir. Entradas inválidas são descartadas uma a uma, sem invalidar o link.
- **Pendente:** os orçamentos sugeridos (Econômico/Equilibrado/Premium) e a faixa "só o necessário" ainda não contam os itens manuais.
