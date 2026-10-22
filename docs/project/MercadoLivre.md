# Mercado Livre — afiliados e preços

O que já está pronto no código (Drop 10) e o que depende de você.

| Parte                               | Comando                              | Depende de                                  |
| ----------------------------------- | ------------------------------------ | ------------------------------------------- |
| Links de afiliado em lote           | `npm run ml:links export` / `import` | Cadastro no programa de afiliados (passo 1) |
| Preço e disponibilidade atualizados | `npm run sync:ml`                    | App de desenvolvedor + token (passo 3)      |

> A API do Mercado Livre **não funciona mais sem login**: desde 2025, busca, produto e item devolvem `403 PolicyAgent` sem token (testado em 2026-10-22). E **não existe API para gerar link de afiliado**: o link sai do "Gerador de links" do painel. Por isso os links são feitos em lote numa planilha.

## 1. Cadastro de afiliado

1. Acesse o programa [Afiliados e Criadores](https://mercadolivre.com.br/l/afiliados-home) e preencha o formulário.
2. Confirme o e-mail e ative a conta.
3. Regras de comissão: só **produtos novos** de **vendedores com reputação verde**. O `sync:ml` avisa quando um produto não atende.

## 2. Links de afiliado em lote

A planilha `data/affiliate/mercadolivre.csv` já tem os 192 produtos do catálogo, um por linha. Abra no Google Planilhas ou no Excel (separador `;`).

Para cada linha (dá para fazer aos poucos; linhas vazias são ignoradas):

1. Abra o link da coluna **`busca`** e escolha o anúncio certo. Prefira **Loja oficial** ou "MercadoLíder" (reputação verde) e produto **novo**. Se o modelo saiu de linha (só usados ou "indisponível"), troque pelo sucessor no catálogo antes.
2. Copie o endereço da página do produto para **`link_produto`**. Ele tem um id `MLB…` (inclusive dentro de `pdp_filters=item_id:MLB…`), que o sync de preço usa.
3. Logado como afiliado, a página do produto mostra no topo a barra **Afiliados → "GANHOS x%" → Compartilhar**. Clique em **Compartilhar** e copie o **Link do produto** (`https://meli.la/…`) para **`link_afiliado`**. Isso também adiciona o produto à sua lista "Minhas recomendações". O Gerador de links do painel (Ferramentas) faz o mesmo.
4. Em **`preco`**, coloque o preço em destaque (à vista/Pix quando houver; ex.: `4.104,78`).
5. Em **`data`**, a data em que viu o preço (`AAAA-MM-DD`; vazia = hoje). Em **`imagem`**, a URL da foto (botão direito na foto → copiar endereço; a página tem em `og:image`). A imagem só é trocada se a coluna vier preenchida.

> O link `meli.la` abre o seu perfil social de afiliado (`/social/<etiqueta>?matt_word=…&matt_tool=…`) com o produto em destaque e o botão "Ir para produto". É assim que a comissão é rastreada.

**Com a extensão Claude in Chrome conectada**, rode a skill **`/ml-links`** (ex.: `/ml-links 20`, `/ml-links banheiro`): o Claude faz os passos 1–5 no seu navegador logado, só com produtos **novos e nacionais**, confere cada link abrindo-o e roda o import.

Salve como CSV (UTF-8, separador `;`) no mesmo lugar e rode:

```bash
npm run ml:links import
```

O comando cria a oferta do Mercado Livre em cada produto, passa a exibir o link de afiliado e o preço informado, valida o catálogo e só grava se estiver tudo certo. Ele também avisa sobre links sem id e links que não parecem de afiliado.

> Dica: comece pelos itens caros (geladeira, TV, sofá, colchão): mais comissão por clique.

Se o catálogo ganhar produtos novos, gere a planilha de novo com `npm run ml:links export -- --force`. Essa planilha já vem preenchida com os links que estão nos JSONs.

## 3. Token para o sync de preço

1. Crie um app em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br/devcenter):
   - Redirect URI: qualquer URL `https` sua (ex.: a do repositório no GitHub).
   - Marque o escopo **offline_access**, que é o que gera o refresh token.
2. Anote o **Client ID** e o **Client Secret**.
3. Autorize o app abrindo no navegador (troque `CLIENT_ID` e `REDIRECT_URI`):

   ```
   https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=CLIENT_ID&redirect_uri=REDIRECT_URI
   ```

   Depois de aceitar, você volta para a Redirect URI com `?code=TG-…` no endereço. Copie esse código; ele vale por poucos minutos.

4. Troque o código pelos tokens:

   ```bash
   curl -X POST https://api.mercadolibre.com/oauth/token \
     -H 'content-type: application/x-www-form-urlencoded' \
     -d 'grant_type=authorization_code&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&code=TG-…&redirect_uri=REDIRECT_URI'
   ```

5. Copie `.env.example` para `.env.local` (fica fora do git) e preencha `ML_CLIENT_ID`, `ML_CLIENT_SECRET` e `ML_REFRESH_TOKEN` (o `refresh_token` da resposta).
6. Rode:

   ```bash
   npm run sync:ml
   ```

O refresh token muda a cada uso; o script guarda o novo em `.ml-token.json` (também fora do git). Ele atualiza o preço e a disponibilidade de cada produto que tem `link_produto` e mostra o que mudou, o que ficou indisponível e o que não gera comissão.

> Os campos lidos da API (`buy_box_winner`, `price`, `status`, `condition`, `seller_reputation.level_id`) seguem a documentação pública, mas ainda não foram testados com um token real. Se o primeiro `sync:ml` der erro, a mensagem mostra a resposta da API.

## Histórico de preço e promoções

Cada oferta guarda `history` (data + preço), que ganha um ponto **só quando o preço muda**; no mesmo dia, vale o último. O import (coluna `data`) e o `sync:ml` (data de hoje) alimentam o histórico. Pontos com mais de 365 dias saem, exceto o que estava em vigor na data de corte.

No card:

- **"↓ R$ 604 (−13%) desde 01/10"** (verde) ou **"↑ … desde …"** (laranja): comparação com o preço anterior.
- **"🔥 Menor preço em 90 dias"**: o preço atual é o menor da janela e está pelo menos 5% abaixo do maior preço dela.

As constantes ficam em `src/data/price-history.ts`: `PROMO_WINDOW_DAYS`, `PROMO_MIN_DROP` e `HISTORY_MAX_DAYS`. O histórico começa vazio, então seta e selo só aparecem depois da segunda coleta com preço diferente. Com a atualização diária da 2ª wave, isso fica automático.

## Como os dados ficam

Cada opção ganha `offers`, com uma oferta por loja. Os campos exibidos (`price`, `url`, `store`, `priceUpdatedAt`) são sempre os da **oferta mais barata disponível**; o validador garante isso. Quando a Amazon entrar (Drop 9), o mesmo modelo nas duas lojas mostra a mais barata, e o card exibe "Também na Amazon: R$ X".

```json
"offers": [
  {
    "store": "mercadolivre",
    "url": "https://mercadolivre.com/sec/…",
    "price": 2649.9,
    "updatedAt": "2026-10-22",
    "available": true,
    "externalId": "MLB19615251",
    "history": [
      { "date": "2026-10-01", "price": 2799 },
      { "date": "2026-10-22", "price": 2649.9 }
    ]
  }
]
```
