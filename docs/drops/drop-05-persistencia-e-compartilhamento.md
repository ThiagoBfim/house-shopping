# Drop 5 — Persistência e compartilhamento

| Status     | Iniciado em | Terminado em | Duração |
| ---------- | ----------- | ------------ | ------- |
| ⏳ A fazer | —           | —            | —       |

**Meta:** a lista sobrevive a refresh e pode ser compartilhada.

- [ ] Serializar estado (cômodo, orçamento, travados, recusados) na URL (`#` + compressão, ex. `lz-string`)
- [ ] Ler estado da URL ao abrir; fallback para `localStorage`
- [ ] Botões **Copiar link** e **Compartilhar no WhatsApp** (Web Share API no mobile)
- [ ] Modo "lista compartilhada" (banner: "Lista de fulano — personalize a sua")
- [ ] Versão do schema no estado, para não quebrar links antigos quando o catálogo mudar
- [ ] Teste: abrir link compartilhado reproduz exatamente a mesma lista

**Pronto quando:** link enviado no WhatsApp abre a mesma lista em outro celular.

## Registro

<!-- Anotações, decisões e problemas encontrados durante o drop. -->
