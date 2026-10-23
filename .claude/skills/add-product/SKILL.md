---
name: add-product
description: Adiciona ou atualiza uma categoria de produto no catálogo do House Shopping (data/products/<categoria>.json) com 4 tiers pesquisados e a coloca em cômodos (data/rooms.json). Use quando o usuário pedir para adicionar um produto, categoria ou item a um cômodo, ou atualizar modelos/preços de uma categoria. Uso: /add-product <categoria> [cômodo:necessidade ...]
---

# /add-product

Adiciona uma categoria ao catálogo sem precisar ler o resto do código. Argumentos: `<categoria> [cômodo:necessidade[:qtd] ...]`, ex.: `/add-product lava-roupas lavanderia:5`.

## 1. Antes de pesquisar

- `ls data/products/` — a categoria já existe? Se sim, edite o arquivo dela (não crie outra).
- Leia só `data/rooms.json` e **um** arquivo de exemplo (ex.: `data/products/geladeira.json`). Não leia o catálogo inteiro.

## 2. Pesquisa (WebSearch, modo standard, 1–2 buscas)

Busque `melhores <produto> 2026 preço <marcas comuns no Brasil>`. Escolha modelos **reais e vendidos no Brasil**:

| tier | nome       | critério                                 |
| ---- | ---------- | ---------------------------------------- |
| 1    | Barato     | resolve o básico, menor preço confiável  |
| 2    | Médio      | melhor custo-benefício                   |
| 3    | Caro       | recurso premium perceptível              |
| 4    | Muito caro | topo de linha                            |

- Se a opção mais cara custa **≥ R$ 1.000**, os **4 tiers são obrigatórios**. Abaixo disso, 1–3 tiers bastam.
- Preço = referência arredondada (ex.: 2799). Preço **sobe** a cada tier.

## 3. Arquivo `data/products/<categoria>.json`

O nome do arquivo (kebab-case, sem acento) é o id da categoria.

```json
{
  "label": "Lava-roupas",
  "utensil": false,
  "options": [
    {
      "id": "lava-roupas-electrolux-les11",
      "tier": 1,
      "name": "Lava-roupas Electrolux 11 kg LES11",
      "price": 1899,
      "priceUpdatedAt": "AAAA-MM-DD",
      "store": "mercadolivre",
      "url": "https://www.mercadolivre.com.br/p/MLB…?pdp_filters=item_id%3AMLB…",
      "bullets": ["11 kg", "Diferença em relação aos outros tiers", "..."]
    }
  ]
}
```

- `utensil`: `true` para pratos, talheres, panelas, copos, toalhas, enxoval (cama, berço), kits. Móveis e eletros = `false`.
- `helper` (opcional): `true` para **facilitadores** — itens que facilitam o dia a dia mas ninguém precisa para morar (organizadores, potes de silicone para congelar, sacos a vácuo, fechadura digital, Alexa). Só entram na lista quando o usuário liga "Incluir facilitadores". Facilitador usa `utensil: false`.
- `variants` (opcional): quando a categoria tem **tipos diferentes de produto** (fogão de piso × cooktop, PlayStation × Xbox, casal × queen), declare `"variants": [{ "id": "piso", "label": "Fogão de piso" }, …]` (a primeira é a padrão) e diga em cada opção em quais entra (`"variants": ["piso"]`). Cada variante tem a sua escada: tiers sem repetir, preço subindo e 4 tiers se passar de R$ 1.000 — **dentro da variante**. Ao mexer em categoria com variantes, confira se o assistente (`data/assistant.json`) usa alguma delas.
- `id`: kebab-case único no catálogo inteiro (use marca + modelo).
- `url`: modelo específico (marca + modelo) precisa do **link direto do produto** no Mercado Livre (`…/p/MLB…` ou `…/up/MLBU…`, com `?pdp_filters=item_id%3AMLB…` quando escolher o anúncio), mesmo sem afiliado. O validador recusa link de busca em modelo específico. Ache o produto **novo e nacional** na busca do ML. Se a marca não tiver o modelo, use o sucessor da mesma marca (e renomeie) ou torne a opção genérica.
- `generic` (opcional): `true` para produto **sem marca/modelo** (ex.: "Tapete Sala 2,00 x 1,50 m", "Varal de Chão Sanfonado"). Só nesse caso o `url` pode ser a busca: `https://lista.mercadolivre.com.br/<termos-com-hifen>`. Nome genérico não leva marca. Vai depois de `bullets`.
- `bullets`: **3–5**, curtos, em pt-BR, explicando **o que muda em relação aos outros tiers** (ex.: "Frost free (o barato não é)"), não a ficha técnica inteira.
- `priceUpdatedAt`: data de hoje.
- `image` (opcional): URL https da foto (no Mercado Livre, `og:image` da página do produto).
- Não crie `offers` à mão: links de afiliado, preço real e histórico entram pela planilha (`npm run ml:links import`, ver `docs/project/MercadoLivre.md`).

## 4. Colocar no cômodo (`data/rooms.json`)

Adicione `{ "category": "<categoria>", "need": N, "qty": Q }` no cômodo:

- `need`: 5 essencial · 4 necessário (entra sempre) · 3 importante · 2 útil · 1 supérfluo. Depende do cômodo.
- `qty`: unidades (preço é por unidade). Padrão 1.
- Cômodo novo também precisa estar em `ROOM_CARDS` (`src/ui/catalog.ts`) para aparecer na tela inicial.

## 5. Validar

```bash
npm run validate   # lista erros com arquivo e campo
npm test
```

Corrija até passar. Reporte ao usuário: modelos escolhidos por tier (nome + preço) e em quais cômodos entrou.
