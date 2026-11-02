# Drop 27 — Link curto e sem símbolos para o WhatsApp

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-11-02 10:10 | 2026-11-02 10:13 | 3min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** o link compartilhado chega inteiro pelo WhatsApp. Problema relatado pelo usuário: o link da casa inteira (~1.750 caracteres, com "-" e "+") ficava quebrado e a lista não abria no celular.

**Pronto quando:** "Copiar link", "WhatsApp" e "Compartilhar…" mandam um link curto (is.gd); com o encurtador fora do ar, mandam o link completo, que agora só tem letras e números; links antigos continuam abrindo.

## Tarefas

- [x] `src/engine/base62.ts`: bytes ↔ texto só com `0-9A-Za-z` (5 bytes → 7 caracteres)
- [x] `share.ts`: `pack`/`unpack` — formato novo `0` + base62 do `compressToUint8Array`; formato antigo (começa com `N`) continua sendo lido, sem mudar `STATE_VERSION`
- [x] `src/ui/shortener.ts`: is.gd com limite de 3 s; qualquer falha devolve o link completo; resultado guardado por link
- [x] `ShareBar`: os três botões usam o link curto, respeitando o gesto do clique (aba aberta no clique, `ClipboardItem` com promessa, aviso para tocar de novo no "Compartilhar…")
- [x] Toast "Link curto copiado!" × "Link copiado!"
- [x] Testes: base62, pack/unpack, links antigos, encurtador (ok, erro, lento, resposta estranha) e E2E com o encurtador simulado (`VITE_SHORTENER` no `playwright.config.ts`; nada sai para a internet)

## Decisões

- **Abordagem escolhida pelo usuário:** encurtador externo com fallback para o link completo, e o link completo sem "-" (o WhatsApp quebrava ali).
- **is.gd:** grátis, sem chave nem cadastro, aceita links longos e responde JSON. A lista vai para o is.gd só quando a pessoa clica para compartilhar (não a cada mudança).
- **Sem símbolos nenhum:** em vez de trocar só o "-", o link completo usa só letras e números ("+", "_", "~" e "." também têm problemas no WhatsApp: negrito/itálico/tachado e pontuação no fim). Custa ~5% a mais de tamanho (1.755 → 1.844 caracteres na casa inteira).
- **Falha nunca bloqueia:** fora do ar, lento (> 3 s), sem CORS, erro do is.gd ou resposta que não é um https menor → link completo. A falha também fica guardada para aquele link, para não esperar 3 s de novo a cada clique.

## Registro

- Não foi possível testar o is.gd daqui (o ambiente bloqueia mandar dados para serviços externos). Se o is.gd não aceitar chamadas do navegador (CORS), tudo continua funcionando com o link completo sem símbolos; nesse caso, trocar o `SHORTENER_ENDPOINT` em `src/ui/shortener.ts`.
