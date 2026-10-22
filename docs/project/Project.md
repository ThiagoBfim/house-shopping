# House Shopping — Projeto

## 1. Visão geral

**House Shopping** é um site estático, hospedado no **GitHub Pages**, que monta automaticamente uma **lista de compras de móveis e eletrodomésticos por cômodo** dentro de um **orçamento** definido pelo usuário.

Fluxo principal:

1. Escolho um cômodo — ex.: **Cozinha**.
2. Defino um orçamento — ex.: **R$ 30.000**.
3. O site me devolve **o que devo comprar**, com um modelo sugerido para cada item, preço e link (afiliado).
4. Ajusto a lista: **recusar** um item, pedir uma opção **mais barata** ou **mais cara**, e pedir um **reload** — o orçamento liberado (ou consumido) é redistribuído entre os demais itens.
5. **Compartilho** a lista final com outras pessoas por um link, para elas fazerem o mesmo (ou comprarem pelos mesmos links).

Objetivo final: comprar móveis e eletrodomésticos online de forma **fácil e rápida**, e permitir que outras pessoas reaproveitem as listas. Os links são **links de afiliado** (Amazon e Mercado Livre), que geram receita ao projeto.

---

## 2. Cômodos (escopo inicial)

| Cômodo         | Exemplos de itens                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cozinha        | Geladeira, freezer, fogão/cooktop, forno, micro-ondas, lava-louças, coifa/depurador, air fryer, liquidificador, cafeteira, panelas, mesa de jantar |
| Quarto (casal) | Cama, colchão, guarda-roupa, criados-mudos, cômoda, ar-condicionado, TV                                                                            |
| Sala           | Sofá, rack/painel, TV, soundbar, mesa de centro, poltrona, tapete, ar-condicionado                                                                 |
| Quarto do bebê | Berço, colchão de berço, cômoda/trocador, poltrona de amamentação, guarda-roupa, babá eletrônica, umidificador                                     |
| Área externa   | Churrasqueira, mesa e cadeiras externas, espreguiçadeiras, ombrelone, lavadora de alta pressão                                                     |
| (futuro)       | Banheiro, Lavanderia, Home office, Escritório                                                                                                      |

---

## 3. Faixas de preço (tiers)

Para cada **produto caro** (ex.: freezer, geladeira, sofá, TV, colchão) o catálogo tem **pelo menos 4 opções**:

| Tier | Nome           | Ideia                         |
| ---- | -------------- | ----------------------------- |
| 1    | **Barato**     | Atende o básico, melhor custo |
| 2    | **Médio**      | Melhor custo-benefício        |
| 3    | **Caro**       | Recursos premium, marca forte |
| 4    | **Muito caro** | Topo de linha                 |

Exemplo: `freezer barato`, `freezer médio`, `freezer caro`, `freezer muito caro`.

Cada opção traz **3–5 bullets curtos** explicando a diferença em relação aos outros tiers, ex.:

> **Freezer médio — Modelo X 300 L**
>
> - Frost free (o barato não é)
> - Conversível freezer/refrigerador
> - Classe A de consumo
> - Sem controle digital (o caro tem)

Produtos **baratos** (ex.: tábua de corte, escorredor) podem ter só 1–2 opções.

---

## 4. Regras de negócio

### 4.1 Prioridade dos itens

Cada item de um cômodo tem uma prioridade:

- **Essencial** (`essential`) — sempre entra na lista (ex.: geladeira, fogão, cama).
- **Importante** (`important`) — entra se o orçamento permitir (ex.: micro-ondas, lava-louças).
- **Desejável** (`optional`) — entra se sobrar dinheiro (ex.: adega, máquina de espresso).

### 4.2 Motor de orçamento (resumo)

1. Coloca todos os **essenciais no tier mais barato**. Se nem isso cabe → avisa quanto falta.
2. Adiciona **importantes** e depois **desejáveis** no tier mais barato, enquanto couber.
3. Com o que sobra, faz **upgrades de tier** priorizando os itens com maior "peso" (impacto no dia a dia), até não caber mais nenhum upgrade.
4. Resultado: lista + total + saldo restante.

### 4.3 Interações do usuário

| Ação                        | Efeito                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| **Recusar**                 | Remove o item da lista (fica marcado como recusado, não volta no reload) |
| **Mais barato / Mais caro** | Troca para o tier vizinho e **trava** a escolha                          |
| **Travar**                  | Mantém o modelo atual mesmo no reload                                    |
| **Já tenho**                | Igual a recusar, mas com outro rótulo (útil para mudança de casa)        |
| **Reload**                  | Re-roda o motor respeitando travados e recusados, redistribuindo o saldo |

### 4.4 Compartilhamento

- O estado inteiro (cômodo, orçamento, travados, recusados) vai **codificado na URL** → basta copiar o link.
- Também é salvo no `localStorage` para o usuário não perder a lista.
- Botões para **WhatsApp** e **copiar link**.

---

## 5. Arquitetura

```
┌──────────────────────────┐        ┌───────────────────────────┐
│  GitHub Actions (cron)   │──────▶│ data/products.json         │
│  - Amazon Creators API   │ commit │ data/rooms.json            │
│  - Mercado Livre (links) │        └─────────────┬─────────────┘
│  - valida schema         │                      │ fetch
└──────────────────────────┘                      ▼
                                    ┌───────────────────────────┐
                                    │  Site estático (GH Pages) │
                                    │  - motor de orçamento     │
                                    │  - UI da lista            │
                                    │  - estado na URL          │
                                    └───────────────────────────┘
```

- **Sem backend**: GitHub Pages só serve arquivos estáticos. Toda a lógica roda no navegador.
- **Chaves de API nunca no front-end**: integrações com Amazon/Mercado Livre rodam em **GitHub Actions** (com _secrets_), que atualizam os JSONs e fazem commit/deploy.
- **Stack sugerida**: Vite + TypeScript + (Preact ou vanilla) + CSS simples. Testes com Vitest; E2E com Playwright.

### 5.1 Modelo de dados

Definido em `src/data/schema.ts` (Zod) e validado por `npm run validate`.

`data/rooms.json`

```json
{
  "cozinha": {
    "name": "Cozinha",
    "items": [
      { "category": "geladeira", "priority": "essential", "weight": 10, "qty": 1 },
      { "category": "freezer", "priority": "optional", "weight": 4 }
    ]
  }
}
```

`data/products.json`

```json
{
  "freezer": {
    "label": "Freezer",
    "options": [
      {
        "id": "freezer-consul-cvu20-barato",
        "tier": 1,
        "name": "Freezer Vertical Consul 142 L",
        "price": 2299.0,
        "priceUpdatedAt": "2026-10-22",
        "store": "amazon",
        "url": "https://amzn.to/xxxx",
        "image": "https://...",
        "bullets": ["Degelo manual", "142 L", "Classe A"]
      }
    ]
  }
}
```

Campos:

- `priority`: `essential` | `important` | `optional` · `weight`: 1–10 (ordem dos upgrades) · `qty`: padrão 1
- `tier`: 1 (barato) a 4 (muito caro) · `store`: `amazon` | `mercadolivre` | `other` · `image` é opcional

Regras checadas pelo validador (`npm test` e `npm run check` falham se alguma quebrar; o CI do Drop 6 também vai rodar):

- Produto cuja opção mais cara custa **≥ R$ 1.000** precisa dos **4 tiers**
- Preço sobe a cada tier; tiers e `id`s não se repetem
- URLs `https`; 3–5 bullets; data `AAAA-MM-DD`; campos desconhecidos são rejeitados (pega erro de digitação)
- Toda categoria usada num cômodo existe em `products.json`

---

## 6. Afiliados

| Loja              | Como integrar                                                                      | Observações                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Amazon**        | **Creators API** (a PA-API 5.0 foi descontinuada em 30/04/2026) via GitHub Actions | Precisa de conta no Associados Amazon e de vendas qualificadas para liberar a API                                               |
| **Mercado Livre** | Programa **Afiliados e Criadores** — gerador de links no painel                    | Não há API pública oficial para gerar links de afiliado; preços podem vir da API pública de itens. Começa manual/semiautomático |

Requisitos legais: aviso claro de "links de afiliado" no site e de que **preços podem mudar** (mostrar a data da última atualização).

---

## 7. Fora de escopo (por enquanto)

- Login/contas de usuário.
- Checkout dentro do site (o usuário sempre compra na loja).
- Comparação de preço em tempo real no navegador.

## 8. Métricas de sucesso

- Lista gerada em **< 1 s** após escolher cômodo + orçamento.
- Catálogo com **≥ 4 tiers** para todo produto caro de cada cômodo.
- Preços com **no máximo 7 dias** de defasagem (após a integração com afiliados).
- Cliques em links de afiliado / listas compartilhadas.
