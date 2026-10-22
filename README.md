# House Shopping

Escolha um cômodo, defina um orçamento e receba a lista do que comprar — com opções mais baratas ou mais caras para cada item e links para comprar online.

- Visão do projeto: [docs/project/Project.md](docs/project/Project.md)
- Plano e andamento: [docs/drops/](docs/drops/README.md)

## Rodando localmente

Requer **Node 24** (veja `.node-version`).

```bash
npm install
npm run dev      # http://localhost:5173/house-shopping/
```

## Scripts

| Comando          | O que faz                               |
| ---------------- | --------------------------------------- |
| `npm run dev`    | Servidor de desenvolvimento             |
| `npm test`       | Testes (Vitest)                         |
| `npm run lint`   | ESLint                                  |
| `npm run format` | Formata com Prettier                    |
| `npm run build`  | Type-check + build de produção (`dist`) |
| `npm run check`  | Lint + formatação + testes + build      |
