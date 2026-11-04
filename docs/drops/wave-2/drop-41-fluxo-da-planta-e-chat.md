# Drop 41 — Fluxo da planta em passos e chat do projeto com IA

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-04 05:42 | 2026-11-04 06:13 | 31min   |

**Wave:** 2ª — planta, preços mais baratos e cobrança ([plano](PLAN.md))

**Meta:** com "Planta da casa" ligada e uma planta lida, a montagem vira um fluxo: 1 planta e cômodos → 2 móveis → 3 posições em 3D (com um chat de IA para sugerir mudanças) → 4 projeto em 3D. Sem a planta, o site continua igual.

**Pronto quando:** dá para ir e voltar entre os passos (o passo fica salvo); o passo 3 mostra cada cômodo em 3D com a vista de cima e o chat; o chat vê o projeto como está na tela, responde e sugere mudanças que só valem ao clicar "Aplicar"; o passo 4 gera e mostra a casa inteira em 3D.

## Tarefas

- [x] Passos (`PlanFlow.tsx`): barra com os 4 passos (clicáveis), "Próximo"/"Voltar"; passo 2 é a lista; passos 3 e 4 trocam a lista pelo conteúdo do passo; passo salvo no navegador
- [x] Passo 3 (`FloorPlanPanel section="positions"`): desenho do imóvel, cômodos em 3D já abertos com a vista de cima (arrastar), chat do projeto
- [x] Passo 4 (`section="project"`): gerar a casa inteira (rápida ou realista), andar, tour e vídeo
- [x] Chat: skill `/house-chat` (`.claude/skills/house-chat/`), `POST /api/chat` (`--json-schema`, US$ 1 no máximo), motor `engine/chat.ts` (o que a IA recebe, conferência da resposta), `ProjectChat.tsx` (conversa salva no navegador, "Aplicar" por sugestão e "Aplicar todas")
- [x] Uma conta só para a tela e o chat: `ui/room-layouts.ts` (abas e desenho de cada cômodo), usado pela posição dos móveis e pelo chat
- [x] Sugestões conferidas juntas, no estado final: `applySuggestions` não depende da ordem (trocar o sofá e o rack de parede); itens de parede (TV, ar) podem ser movidos; TV segue o rack e coifa segue o fogão
- [x] Testes: motor do chat, pedido do backend, resposta real da skill aplicada fora de ordem, TV seguindo o rack, E2E do fluxo (passos, voltar, recarregar, sem a planta = sem fluxo) e do chat (pedido com o projeto, aplicar, recusar, tirar da lista, salvo ao recarregar)

## Registro

- **Nada muda sozinho:** a IA só sugere; cada ação passa pela mesma conferência de arrastar. A que não cabe fica marcada "não coube nesse lugar".
- **Teste real da skill (sala do apartamento de teste, "a tomada e a antena da TV ficam na parede da direita"):** ~40 s, US$ 0,37; respondeu com as medidas reais e 6 mudanças (rack e TV para a direita, sofá para a esquerda, mesa de centro, tapete e poltrona). Aplicando uma por uma, o rack e o sofá travavam um no outro (cada um só cabe depois que o outro sai) — daí a conferência conjunta no estado final, que também vale para as posições salvas.
- **TV não andava:** só móveis de chão aceitavam posição; agora item de parede também (encostado na parede de trás) e a TV acompanha o rack quando só o rack muda.
- **Passo 1** volta para a planta e a escolha de cômodos (a tela de sempre).
- **Planta + fotos no passo 1 (2026-11-04, pedido do usuário):** planta de imobiliária nem sempre é fiel. Com fotos, "📐 Enviar a planta" faz a leitura caprichada pela skill `/house-3d` (medidas da planta; das fotos, porta de correr × de abrir, janelas e armários embutidos) e `readHouse` transforma em cômodos sugeridos + a casa em metros já ligada à lista (salva junto): a posição dos móveis e o projeto em 3D usam desde o começo, sem gerar de novo. Sem fotos, a leitura rápida de sempre (e a casa de uma leitura anterior sai). Teste real com a planta e as 8 fotos do usuário: ~2,5 min, US$ 0,72; sala em L em três partes (`partOf`), 2 portas de correr, armários dos quartos, gabinete, bancada e aéreo da cozinha; avisou que as fotos parecem espelhadas em relação à planta (posicionou pela planta). A leitura real não foi salva como fixture (repositório público).
- **Unir cômodos e o L como um espaço só (2026-11-04, pedido do usuário):** "a sala e a sala de estar são o mesmo cômodo, não tem divisão nem porta". Na posição dos móveis, "🔗 Unir <cômodo> com:" lista os vizinhos que dividem parede (`neighbours`, `sharedWall`); unir (`mergeRooms`) torna o outro parte do cômodo (`partOf`) e troca as aberturas do trecho em comum por uma passagem `open` (sem parede nem verga no 3D). "↩ Desfazer uniões" volta à casa guardada antes (`unmerged`). O cômodo em L agora é posicionado como um espaço só (`groupGeometry`: retângulo que envolve as partes, o que fica de fora vira "fora do cômodo" hachurado, portas de paredes de dentro do L viram passagem livre; `RoomLayout.origin`), numa aba só. Partes reconhecidas automaticamente também ficam sem parede entre elas (`openPartWalls`). No caso real do usuário: sala em uma aba (3,4 × 5,4 m) e a mesa de jantar passou a caber (ficou na parte junto à varanda); só a poltrona não.
- **TV em cima do rack (2026-11-04, erro visto no chat):** "Smart TV em Sala: centro a 258 × 95 cm, frente para a esquerda ✗ não coube" — item de parede só aceitava ficar encostado numa parede. Agora o rack (e a cômoda/cômoda-trocador) aguenta a TV em cima onde estiver (`STANDS`): TV com o centro dentro dele fica em pé na altura dele (`standing`, com pé no 3D); mover só o rack leva a TV para a parede de trás (rack encostado) ou para cima dele (rack no meio, como divisória); TV que volta para a parede volta à altura de parede. A skill `/house-chat` sabe disso.
