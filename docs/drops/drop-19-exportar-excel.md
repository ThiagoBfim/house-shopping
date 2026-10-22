# Drop 19 — Exportar a lista em Excel

| Status       | Iniciado em      | Terminado em     | Duração |
| ------------ | ---------------- | ---------------- | ------- |
| ✅ Concluído | 2026-10-22 20:12 | 2026-10-22 20:16 | 4min    |

**Wave:** 1ª — produto completo rodando localmente

**Meta:** baixar a lista em Excel com nome, cômodo, preço e link do anúncio. (Pedido do usuário.)

- [x] Botão "Baixar Excel" na barra de compartilhar (lista)
- [x] Planilha `.xlsx` de verdade: Cômodo · Item · Produto · Qtd · Preço unitário · Total · Loja · Link do anúncio; no fim, total (fórmula), orçamento e saldo/faltam
- [x] Testes: unitários (`xlsx`, `export`) e E2E (baixa o arquivo e confere o conteúdo)

## Registro

- **Sem dependência nova:** `.xlsx` é um zip de XML. `src/engine/xlsx.ts` escreve o zip sem compressão (com CRC-32) e os XML mínimos (planilha, estilos, links). Bibliotecas como SheetJS/ExcelJS pesariam centenas de KB; o gerador tem 6 KB e só é baixado quando a pessoa clica (`import()` em `src/ui/download.ts`).
- **Formato:** preços são números com formato `"R$" #,##0.00` (dá para somar e filtrar), quantidade inteira, cabeçalho em negrito e congelado, links clicáveis (texto = a própria URL, para dar para copiar), larguras de coluna definidas. Itens agrupados por cômodo na ordem da casa. Só entra o que está na lista (não os recusados, "já tenho", escondidos pelos filtros ou que não couberam); a busca da tela não afeta a planilha.
- **Conferido num leitor real:** o arquivo gerado pelo E2E abriu no `openpyxl` com avisos tratados como erro. Ele pegou a falta do estilo padrão "Normal" em `styles.xml` (corrigido e coberto por teste). Zip e XML também validados com `zipfile`/`minidom` do Python.
- Nome do arquivo: `lista-house-shopping-AAAA-MM-DD.xlsx`.
