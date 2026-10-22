---
name: ml-links
description: Gera links de afiliado do Mercado Livre (meli.la) para produtos do catálogo do House Shopping usando o Chrome logado do usuário (Claude in Chrome), com preço, foto e id do anúncio, confere cada link e importa na planilha/catálogo. Use quando o usuário pedir para gerar/buscar links de afiliado, fazer um lote de produtos do Mercado Livre ou atualizar links. Uso: /ml-links [quantidade | cômodo | categoria]
---

# /ml-links

Gera links de afiliado em lote pelo **navegador logado do usuário** (não é crawler: o ML bloqueia robôs e não há API de link de afiliado). Argumento: número (`/ml-links 20` = os 20 mais caros sem link), um cômodo (`/ml-links banheiro`) ou uma categoria (`/ml-links geladeira`).

## Regras (decisão do usuário)

- **Só produto novo e nacional.** Nada usado, nada de "Compra Internacional" (títulos em espanhol, "Ver produtos Internacional", nocnoc USA…).
- Prefira **loja oficial** ou grande varejista (Magalu, Mercado Livre, Casas Bahia, Colombo, MadeiraMadeira…). Descarte vendedor com "Não oferece um bom atendimento", 0 vendas, ou pessoa física vendendo item caro.
- Sem **barra de afiliado** na página = o produto não gera comissão → escolha outro anúncio.
- Modelo fora de linha (só usado / "indisponível") → use o **sucessor** e atualize nome, bullets e id no catálogo.
- O **preço tem que subir a cada tier** da categoria; se o preço real inverter a ordem, troque os tiers (ou o modelo) antes de importar.

## 0. Preparar

- Carregue as ferramentas do Chrome numa chamada só: `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__find,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_close_mcp` e `tabs_context_mcp {createIfEmpty: true}`.
- Alvos (linhas sem link, mais caras primeiro):

```bash
python3 -I - <<'EOF'
import csv, io, pathlib
rows = list(csv.DictReader(io.StringIO(pathlib.Path('data/affiliate/mercadolivre.csv').read_text()), delimiter=';'))
todo = sorted((r for r in rows if not r['link_afiliado']), key=lambda r: -float(r['preco_referencia']))
for r in todo[:20]: print(r['id'], r['categoria'], r['tier'], r['preco_referencia'], r['nome'], sep=';')
EOF
```

- Anote os resultados num TSV de trabalho no scratchpad (id, nome novo, link_produto, link_afiliado, preço, imagem, vendedor), nunca só na memória da conversa.

## 1. Buscar (várias buscas num `browser_batch`)

Navegue para `https://lista.mercadolivre.com.br/<termos-com-hifen>` e rode:

```js
await new Promise(r => setTimeout(r, 1500));
[...document.querySelectorAll('.poly-card, li.ui-search-layout__item')]
  .filter((c, i, all) => !all.some(o => o !== c && o.contains(c)))
  .map(c => [c.querySelector('.poly-component__title, h3, h2')?.textContent.trim().slice(0, 55),
             c.querySelector('.poly-price__current .andes-money-amount__fraction, .andes-money-amount__fraction')?.textContent,
             c.querySelector('.poly-component__seller')?.textContent.trim(),
             [...c.querySelectorAll('a')].map(a => a.href.split('#')[0]).find(h => /\/p\/MLB|\/up\/MLBU|MLB-\d/.test(h)),
             /internacional|usado/i.test(c.textContent)])
  .filter(x => x[3] && !x[4]).slice(0, 5).map(x => x.slice(0, 4))
```

Filtre **antes** de cortar: os primeiros cards costumam ser patrocinados (sem link de produto) e, cortando antes, a busca volta vazia mesmo com o produto à venda.

Escolha pelo modelo certo + vendedor confiável. **Prefira a página de catálogo** (`/p/MLB…`, de preferência com `pdp_filters=item_id:MLB…`): sem catálogo (`/up/MLBU…`), a API não informa o preço e o `sync:ml` não atualiza o produto.

## 2. Abrir, conferir e gerar o link (1 produto = 1 `browser_batch`)

1. `navigate` para a página do produto.
2. `javascript_tool` (lê os dados e clica em Compartilhar **só** se for novo, nacional e tiver a barra):

```js
await new Promise(r => setTimeout(r, 2500));
const intl = [...document.querySelectorAll('a')].some(a => /Ver produtos\s+Internacional/i.test(a.textContent));
const sub = document.querySelector('.ui-pdp-header__subtitle')?.textContent.trim() || '';
const ok = !intl && /^Novo/.test(sub);
const bar = [...document.querySelectorAll('nav')].find(n => /Afiliados/.test(n.textContent));
const btn = bar && [...bar.querySelectorAll('button')].find(b => b.textContent.trim() === 'Compartilhar');
if (ok) btn?.click();
({ t: document.querySelector('h1')?.textContent.trim().slice(0, 80), sub, ok, bar: !!bar,
   price: document.querySelector('meta[itemprop=price]')?.content,
   img: document.querySelector('meta[property="og:image"]')?.content,
   item: (document.documentElement.innerHTML.match(/"item_id":"(MLB\d+)"/) || [])[1] })
```

3. `computer wait 4`, depois `computer zoom` em `[540, 160, 1090, 330]` (scale 0.6) e leia o **Link do produto** `https://meli.la/…`.

- `price` = preço normal do anúncio (`meta[itemprop=price]`). Se a página mostrar só o preço no Pix, use o "ou R$ X em N vezes"/preço cheio: a API trabalha com o preço normal. `img` = foto. `item` = id do anúncio: use quando a URL for `/up/MLBU…` sem `item_id` (senão o sync de preço não acha o produto).
- O painel é um iframe de outro domínio: **não dá para ler o link por JS**, só pelo zoom. Por isso o passo 3 (conferência) é obrigatório.

## 3. Conferir os links (todos de uma vez)

Para cada `meli.la`: `navigate` e

```js
await new Promise(r => setTimeout(r, 2000));
(document.body.innerText.split('Seguir')[1] || '').trim().split('\n').filter(Boolean).slice(0, 8).join(' | ')
```

O link abre o perfil social do afiliado com o produto em destaque. O título tem que ser o do produto escolhido (pode vir depois de uma linha de cupom). Link que não bate = letra lida errada no zoom (`o`/`0`, `l`/`I`): volte ao produto e leia de novo.

## 4. Gravar e importar

1. Atualize `data/affiliate/mercadolivre.csv` (separador `;`, via `csv` do Python): `link_produto` (URL com o id), `link_afiliado`, `preco` (`4323,08`), `data` (hoje, `AAAA-MM-DD`), `imagem`.
2. Modelo trocado: no **mesmo script**, mude no `data/products/<categoria>.json` e na planilha o `id` (marca + modelo, kebab-case), `name`, `bullets` (o que muda em relação aos outros tiers) e o `url` de busca; se o preço inverter tiers, troque o `tier` e reordene as opções.
3. Rode e corrija até passar:

```bash
npm run ml:links import   # aplica ofertas, preço, histórico e foto; não grava se o catálogo ficar inválido
npm run sync:ml           # confere o preço pela API (precisa de npm run ml:auth uma vez)
npm run validate && npm test
```

4. Reporte ao usuário: tabela com produto, link, preço, vendedor; modelos trocados; o que foi descartado e por quê; quantas linhas da planilha têm link.

## Armadilhas já vistas

- **Busca "internacional" no texto da página inteira dá falso positivo** (carrosséis de relacionados). Use o link "Ver produtos Internacional" do próprio produto, como no snippet.
- **"Compartilhar" fora da barra** abre o compartilhamento comum (WhatsApp, Facebook…), sem link de afiliado. O snippet só clica no botão de dentro da barra de afiliado; se aparecer esse diálogo, feche com Esc.
- O painel do link fica em `[390, 180, 830, 320]` com a janela em ~1080 px de largura; se o zoom falhar por "region exceeds viewport", tire um screenshot e ajuste.
- **Vendedor:** o `sync:ml` avisa "vendedor pouco confiável" quando a reputação não é verde/≥50 vendas nem loja oficial. Troque de anúncio ou volte a opção ao estado anterior (sem `offers`), senão o link pode não gerar comissão.
- **Preço ≥ R$ 1.000 numa categoria de 3 tiers** quebra a regra dos 4 tiers: escolha um modelo abaixo de R$ 1.000.
- Lotes longos derrubam a extensão: no máximo 2 produtos (ou 3 buscas) por `browser_batch`.
- A página demora para montar a área de compra: espere ~2,5 s antes de ler. A barra de afiliado só existe em produto elegível.
- **Preço da busca ≠ preço da página** (desconto Pix, outro anúncio vencedor). Vale o da página.
- Gerar o link adiciona o produto à lista "Minhas recomendações" do usuário (sem problema).
- Captcha ou tela de login: pare e peça ao usuário.
- Se o usuário disser "Stop"/"Pare": pare de navegar na hora e mostre o que já foi coletado (o TSV).
- **Não** rode `npm run ml:links export -- --force` com links ainda não importados na planilha: ele recria a planilha a partir dos JSONs e apaga o que não foi importado.
