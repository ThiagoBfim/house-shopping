---
name: floor-plan
description: Lê a planta de um imóvel (imagem ou PDF) e devolve os cômodos no formato do House Shopping — tipo do catálogo, nome na planta, área em m² e posição no desenho. Usada pelo backend local (`npm run server`) para a funcionalidade "Planta da casa"; também serve para conferir uma planta à mão. Uso: /floor-plan <caminho da planta>
---

# /floor-plan

Argumento: caminho do arquivo da planta (PNG, JPG, WEBP, GIF ou PDF).

Leia o arquivo com a ferramenta `Read` (ela abre imagens e PDFs) e responda com os cômodos. Quando chamada pelo backend, a resposta segue um JSON Schema (`--json-schema`): preencha exatamente os campos pedidos, sem texto fora deles. Não use outras ferramentas nem grave arquivos.

## 1. Cada cômodo

Liste **todos** os ambientes desenhados, um por um (dois quartos = duas entradas).

**`type`** — o tipo do catálogo do House Shopping:

| Na planta                                                                          | `type`         |
| ---------------------------------------------------------------------------------- | -------------- |
| Quarto, Dormitório, Dorm., Suíte, Quarto de hóspedes                               | `quarto`       |
| Quarto do bebê, Quarto infantil (só se estiver escrito)                            | `quarto-bebe`  |
| Sala, Sala de estar, Sala de jantar, Living, Sala de TV, Estar/Jantar              | `sala`         |
| Cozinha, Copa, Cozinha americana                                                   | `cozinha`      |
| Banheiro, BWC, WC, Lavabo, Banho                                                   | `banheiro`     |
| Área de serviço, A.S., Lavanderia                                                  | `lavanderia`   |
| Varanda, Sacada, Terraço, Quintal, Área gourmet, Churrasqueira, Jardim             | `area-externa` |
| Escritório, Home office, Estúdio                                                   | `escritorio`   |
| Hall, Circulação, Corredor, Closet, Depósito, Despensa, Garagem, Escada, Shaft, Ático | `outro`     |

- Sala de estar e de jantar no mesmo ambiente = **uma** `sala`. Separadas por parede = duas.
- Cozinha americana aberta para a sala: `cozinha` e `sala` separadas.
- Cômodo sem nome: deduza pelo desenho (vaso/chuveiro = banheiro, cama = quarto, pia + fogão = cozinha). Na dúvida, `outro`.

**`label`** — o nome como está escrito na planta ("Suíte", "Dorm. 2", "A. Serviço"); sem nome, o tipo em português ("Quarto").

**`areaM2`** — a área em m²:

1. escrita na planta ("12,50 m²") → use;
2. senão, pelas medidas ("3,00 x 4,20") → largura × comprimento;
3. senão → `null`. **Não estime pelo tamanho do desenho**: área errada escolhe a cama errada.

**`x`, `y`, `width`, `height`** — o retângulo que envolve o cômodo, em frações do desenho da planta inteira (0 a 1): `x`/`y` = canto de cima à esquerda; `width`/`height` = tamanho. Cômodo em L: o retângulo que o envolve. Os retângulos podem se tocar, mas não devem se sobrepor muito.

## 2. O desenho todo

**`aspect`** — largura ÷ altura da área desenhada da planta (só a construção, sem margens, legenda ou carimbo). Planta mais larga que alta > 1.

**`notes`** — avisos curtos em português para a pessoa conferir, ou `""`. Exemplos: "Medidas ilegíveis: áreas não informadas", "Planta com 2 pavimentos: só o térreo foi lido", "Não parece uma planta de imóvel".

Se o arquivo não for uma planta (foto, documento, outra coisa): `rooms: []`, `aspect: 1` e explique em `notes`.
