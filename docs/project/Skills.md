# House Shopping — Skills, Plugins e MCPs

Ferramentas para usar com o **Claude Code** que ajudam a **implementar**, **fazer deploy** e **gastar menos tokens** neste projeto. Pesquisa feita em 22/10/2026.

> ⚠️ **Skills e MCPs da comunidade não são produtos oficiais da Anthropic.** Antes de instalar, abra o repositório e leia o `SKILL.md` / código. Skills rodam com as suas permissões.

---

## 1. Implementação (front-end e testes)

| Skill                            | Fonte                                                              | Para quê neste projeto                                                                                                 | Drop  |
| -------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| **frontend-design**              | Oficial Anthropic (`anthropics/skills` / plugin `frontend-design`) | UI com identidade visual definida, sem cara de "template genérico". Ideal para a tela de cômodos e os cards de produto | 3, 4  |
| **webapp-testing**               | Oficial Anthropic (`anthropics/skills`)                            | Claude abre o site num navegador real (Playwright) e testa os fluxos recusar / reload / compartilhar                   | 4, 5  |
| **/code-review** e **/simplify** | Embutidos no Claude Code                                           | Revisão do motor de orçamento (bugs) e limpeza de código antes de cada drop                                            | todos |
| **/init**                        | Embutido                                                           | Gera o `CLAUDE.md` inicial do projeto                                                                                  | 0     |
| **claude-in-chrome**             | Já disponível nesta instalação                                     | Navegar em lojas/reviews para validar modelos e preços na curadoria                                                    | 7, 8  |

Instalação das oficiais:

```bash
/plugin marketplace add anthropics/skills
/plugin            # escolher frontend-design e webapp-testing
```

---

## 2. Deploy (GitHub Pages)

| Skill                | Fonte                                       | Observação                                                                                  |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **gh-pages-deploy**  | Comunidade — `aviz85/claude-skills-library` | Faz deploy de front-end estático no GitHub Pages via `gh` CLI. Pré-requisitos: `gh` e `git` |
| **publish-to-pages** | Comunidade — `github/awesome-copilot`       | Alternativa; pouca documentação encontrada — verificar antes                                |

```bash
npx skills add aviz85/claude-skills-library --skill gh-pages-deploy --agent claude-code
```

**Recomendação:** use a skill só para o primeiro setup. Depois, o deploy fica no workflow `.github/workflows/deploy.yml` (Drop 6), que é gratuito e **não gasta tokens**.

---

## 3. Afiliados e dados de produtos (MCP servers)

| MCP                                               | Loja                               | O que faz                                                                  | Observação                                                            |
| ------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **@houtini/amazon-creators-mcp**                  | Amazon                             | Busca produtos pela **Creators API** e gera embeds de afiliado             | A PA-API 5.0 foi descontinuada em 30/04/2026 — use Creators API       |
| **Luno MCP Affiliate** (`Scientia07`)             | Amazon + Awin, AliExpress, Impact… | Multi-rede de afiliados via Creators API                                   | Foco em Amazon.de — confirmar suporte a amazon.com.br                 |
| **Rally MCP Server** (`@rally-vendas/mcp-server`) | Mercado Livre + Shopee             | Busca produtos, gera link de afiliado, estima comissão (`ML_AFFILIATE_ID`) | Os próprios autores afirmam que o ML não tem API oficial de afiliados |
| **mcp-mercado-livre** (`newerton`)                | Mercado Livre                      | Raspa preço e disponibilidade (`get-produtos`)                             | Não gera link de afiliado; scraping pode quebrar                      |
| **mercadolibre-mcp**                              | Mercado Livre                      | Busca de produtos, categorias e tendências na LatAm                        | Útil para a curadoria dos tiers                                       |

**Como usar:**

- **Curadoria (Drops 7–8):** com um MCP de busca, o Claude encontra os 4 modelos por produto, preços reais e gera os bullets.
- **Produção (Drops 9–10):** **não** dependa de MCP no site. Use as mesmas APIs em scripts Node rodando no **GitHub Actions** (sem custo de tokens, com _secrets_ seguros).

---

## 4. Economizar tokens

Em ordem de impacto (do maior para o menor):

### 4.1 Criar skills próprias do projeto (maior ganho)

A tarefa que mais vai se repetir é "pesquisar 4 tiers de um produto e escrever bullets". Transformar isso em skill evita re-explicar o formato toda vez.

| Skill a criar                       | O que faz                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/add-product <categoria> <cômodo>` | Pesquisa 4 modelos (barato → muito caro), escreve 3–5 bullets, gera o JSON no schema certo e roda o validador |
| `/add-room <nome>`                  | Cria a entrada em `rooms.json` com itens, prioridades e pesos                                                 |
| `/refresh-prices`                   | Roda os scripts de sync e resume o que mudou                                                                  |

Use a skill **skill-creator** (já disponível: `anthropic-skills:skill-creator`) para criá-las e testá-las.

### 4.2 `CLAUDE.md` curto e objetivo

Stack, comandos (`npm test`, `npm run validate`), estrutura de pastas e regras do schema em poucas linhas. O Claude não precisa redescobrir o projeto a cada sessão.

### 4.3 graphify (já instalado)

Gera um grafo de conhecimento do código. Depois que o projeto crescer, perguntas como "onde o tier é calculado?" são respondidas pelo grafo sem ler vários arquivos.

### 4.4 Dados fora do contexto

- Não peça para o Claude ler o `products.json` inteiro — peça para editar uma categoria por vez ou usar `jq`.
- Considere dividir em `data/products/<categoria>.json` (arquivos pequenos = leituras baratas).

### 4.5 Subagentes e modelo certo para cada tarefa

- Pesquisa de produtos em paralelo com subagentes usando um modelo mais barato (ex.: Haiku/Sonnet) — o contexto principal só recebe o resumo.
- Use `/compact` ou `/clear` entre drops.

### 4.6 fewer-permission-prompts (embutido)

Cria uma allowlist de comandos de leitura comuns → menos idas e vindas.

### 4.7 caveman (comunidade — benefício limitado)

Skill que faz o Claude responder em estilo "telegráfico". Os autores dizem cortar 65–75% dos tokens de **saída**, mas análises independentes mostram efeito real de **~1–15% no custo total**, porque a maior parte dos tokens vai para raciocínio e código. Opcional; teste antes de adotar.

---

## 5. Kit recomendado

| Momento    | Instalar / usar                                                               |
| ---------- | ----------------------------------------------------------------------------- |
| Drop 0     | `/init`, `fewer-permission-prompts`, graphify                                 |
| Drops 3–5  | `frontend-design`, `webapp-testing`, `/code-review`                           |
| Drop 6     | `gh-pages-deploy` (setup) → depois só GitHub Actions                          |
| Drops 7–8  | Skill própria `/add-product` + MCP de Mercado Livre/Amazon + claude-in-chrome |
| Drops 9–10 | Scripts no GitHub Actions (MCPs só para prototipar)                           |

---

## Fontes

- [gh-pages-deploy — claudemarketplaces.com](https://claudemarketplaces.com/skills/aviz85/claude-skills-library/gh-pages-deploy)
- [publish-to-pages — claudemarketplaces.com](https://claudemarketplaces.com/skills/github/awesome-copilot/publish-to-pages)
- [Frontend skills — claudemarketplaces.com](https://claudemarketplaces.com/skills/category/frontend)
- [Anthropic skills — playbooks.com](https://playbooks.com/skills/anthropics)
- [20 Claude Code Skills Every Developer Should Install First — ssojet](https://ssojet.com/blog/best-claude-code-skills)
- [Best Claude Code skills — superdesign.dev](https://superdesign.dev/blog/best-claude-code-skills)
- [Caveman — GitHub topic](https://github.com/topics/caveman)
- [Caveman cuts output 20%, your bill barely notices — implicator.ai](https://www.implicator.ai/caveman-claude-code-skill-cuts-output-20-your-bill-barely-notices-2/)
- [Does Caveman really cut Claude tokens — growwstacks](https://growwstacks.com/blog/does-caveman-ai-really-cut-claude-tokens)
- [Luno MCP Affiliate — glama.ai](https://glama.ai/mcp/servers/Scientia07/Luno-MCP-Affiliate)
- [@houtini/amazon-creators-mcp — socket.dev](https://socket.dev/npm/package/@houtini/amazon-creators-mcp)
- [Rally MCP Server — glama.ai](https://glama.ai/mcp/servers/ks1cmnxr01)
- [mcp-mercado-livre — mcp.so](https://mcp.so/zh/servers/mcp-mercado-livre)
- [MercadoLibre tools — ai.g2.com](https://ai.g2.com/marketplace/tools/mercadolibre)
- [Programa de afiliados e criadores — Mercado Livre](https://mercadolivre.com.br/l/afiliados-home)
- [CLI para gerar links de afiliados — TabNews](https://www.tabnews.com.br/marcuth/criei-uma-cli-para-gerar-links-de-afiliados-de-marketplaces)
- [Afiliado Mercado Livre 2026 — divulganinja](https://www.divulganinja.com.br/blog/afiliado-mercado-livre-como-funciona-vale-a-pena-2026)
