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

1. Abra o link da coluna **`busca`** e escolha o anúncio certo. Prefira **Loja oficial** ou "MercadoLíder" (reputação verde) e produto **novo**.
2. Copie o endereço da página do produto para **`link_produto`**. Ele tem um id `MLB…`, que o sync de preço usa.
3. No painel de afiliados: **Ferramentas → Gerador de links**. Cole a URL do produto e copie o link gerado (`https://mercadolivre.com/sec/…`) para **`link_afiliado`**.
4. Em **`preco`**, coloque o preço que aparece (ex.: `2.649,90`).

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
    "externalId": "MLB19615251"
  }
]
```
