---
name: ml-check-links
description: Abre cada link de afiliado do Mercado Livre (meli.la) do catálogo do House Shopping no Chrome logado do usuário e confere se ainda leva ao anúncio certo, com a etiqueta de afiliado. Gera um relatório (ok / produto diferente / quebrado / sem afiliado) e não altera o catálogo sem pedir. Use quando o usuário pedir para validar, conferir ou checar os links de afiliado. Uso: /ml-check-links [todos | categoria | quantidade]
---

# /ml-check-links

Confere os links `meli.la` das ofertas do Mercado Livre em `data/products/*.json` abrindo um por um no **navegador logado do usuário** (Claude in Chrome). O link certo abre o perfil social do afiliado (`/social/master_sold?...matt_tool=16097421`) com o anúncio em destaque. Os primeiros ids `MLB…` de 8 a 11 dígitos do HTML dessa página são os do anúncio em destaque (item e produto de catálogo), e é com eles que a skill compara. Ids de 12+ dígitos são de imagens e ficam de fora.

Argumento: vazio ou `todos` (todos os links), uma categoria (`/ml-check-links geladeira`) ou um número (`/ml-check-links 20` = os 20 com `updatedAt` mais antigo).

Só lê. Não muda `data/` nem a planilha: no fim, mostra o relatório e pergunta o que corrigir (a correção é com a skill `/ml-links`).

## 0. Preparar

- Carregue as ferramentas do Chrome numa chamada só: `ToolSearch select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch` e `tabs_context_mcp {createIfEmpty: true}`.
- Monte a lista no scratchpad (`$SP` = pasta de scratchpad da sessão). Ajuste o filtro conforme o argumento:

```bash
python3 -I - "$SP/check.json" <<'EOF'
import json, pathlib, sys
out = []
for f in sorted(pathlib.Path('data/products').glob('*.json')):
    for o in json.loads(f.read_text())['options']:
        for of in o.get('offers', []):
            if of['store'] == 'mercadolivre' and 'meli.la/' in of['url']:
                out.append({'id': o['id'], 'categoria': f.stem, 'link': of['url'], 'updatedAt': of['updatedAt'],
                            'ids': [x for x in (of.get('externalId'), of.get('catalogId')) if x]})
# filtro: categoria → [x for x in out if x['categoria'] == 'geladeira']; N → sorted(out, key=lambda x: x['updatedAt'])[:N]
pathlib.Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False))
print(len(out), 'links')
EOF
```

## 1. Abrir os links (5 por `browser_batch`)

Para cada link: `navigate` para o `meli.la` e rode:

```js
await new Promise(r => setTimeout(r, 2500));
JSON.stringify({
  social: location.pathname.startsWith('/social/master_sold'),
  tag: location.search.includes('matt_tool=16097421'),
  captcha: /captcha|complete esta etapa/i.test(location.href + document.title),
  ids: [...new Set(document.documentElement.innerHTML.match(/MLBU?\d{8,11}(?!\d)/g) || [])].slice(0, 4),
  title: ((document.body.innerText.split('Seguir')[1] || '').trim().split('\n').filter(Boolean)
           .find(l => !/^MAIS VENDIDO$|^OFERTA|cupom|Compra m/i.test(l)) || '').slice(0, 120),
})
```

- Não devolva `location.href` inteiro: a ferramenta bloqueia a saída com query string. Por isso o snippet devolve só os booleanos.
- Grave cada resultado (`id` + TAB + JSON, uma linha por link) em `$SP/check-results.tsv` a cada lote. Não guarde só na conversa.
- **Captcha:** pare, peça ao usuário para resolver no Chrome e retome de onde parou.
- Lotes maiores que 5 derrubam a extensão. Se ela cair, rode `tabs_context_mcp` e repita o lote.
- Se o usuário disser "Pause"/"Stop", pare e diga quantos já foram conferidos.

## 2. Classificar

```bash
python3 -I - "$SP/check.json" "$SP/check-results.tsv" <<'EOF'
import json, sys, pathlib, collections
items = {i['id']: i for i in json.loads(pathlib.Path(sys.argv[1]).read_text())}
count = collections.Counter()
for line in pathlib.Path(sys.argv[2]).read_text().splitlines():
    id_, raw = line.split('\t', 1); r = json.loads(raw); it = items[id_]
    if r['captcha']: status = 'captcha (refazer)'
    elif not (r['social'] and r['tag']): status = 'sem afiliado'
    elif not r['ids'] or not r['title']: status = 'quebrado'
    elif not set(it['ids']) & set(r['ids'][:3]): status = 'produto diferente'
    else: status = 'ok'
    count[status] += 1
    if status != 'ok': print(status, it['categoria'], id_, r['title'][:70], sep='\t')
print(dict(count))
EOF
```

- **ok**: abre o perfil do afiliado e o anúncio em destaque é o do catálogo (`externalId` ou `catalogId`).
- **produto diferente**: abre outro anúncio. Pode ser letra lida errada no zoom quando o link foi gerado, ou o link foi refeito para outro produto.
- **quebrado**: não aparece anúncio em destaque (anúncio encerrado ou link inválido).
- **sem afiliado**: não caiu no perfil `master_sold` com `matt_tool=16097421`, então não gera comissão.

Antes de reportar "produto diferente", confira o título: se for o mesmo produto em outro anúncio (o vendedor mudou), o link ainda funciona, mas o `sync:ml` pode não achar o preço. Nesse caso, sugira regenerar.

## 3. Relatar

Mostre ao usuário:
- totais por status;
- uma tabela só com os que não estão `ok` (categoria, id, status e título que apareceu);
- a correção sugerida: regenerar o link com `/ml-links <categoria>` e, se o anúncio acabou, trocar de anúncio ou de modelo.

Não edite o catálogo nem a planilha sem o usuário pedir.

## Armadilhas

- A página social às vezes mostra "MAIS VENDIDO" ou uma linha de cupom ("Compra mínima R$ 400") antes do título: o snippet pula essas linhas.
- Link que cai em `/social/master_sold/lists` ("Minhas listas") sem `matt_tool` perdeu o produto: regenere.
- "Produto diferente" com um `MLBU…` do link original entre os ids é o mesmo produto em outra variante ou anúncio (ex.: 110 V × 220 V). O link funciona, mas regenerar para o anúncio do catálogo mantém o `sync:ml` certo.
- Leva ~1 min por lote de 5 (140 links ≈ 30 min).
- O preço na página social pode ser o preço cheio, diferente do catálogo: não use para validar. Preço se confere com `npm run sync:ml`.
- Anúncios `/up/MLBU…` sem produto de catálogo têm só `externalId`: a comparação usa esse id.
