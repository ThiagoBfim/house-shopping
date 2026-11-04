---
name: house-3d
description: Monta o modelo 3D de um imóvel para o House Shopping a partir da planta (imagem ou PDF), de fotos dos cômodos (opcional) e da lista de móveis com medidas — geometria em metros, portas (lado da dobradiça e para onde abrem), janelas (peitoril e altura), acabamentos de piso e parede tirados das fotos e, quando der, a posição de cada móvel. Usada pelo backend local (`npm run server`) no botão "Gerar casa em 3D". Uso: /house-3d <pasta com planta, fotos e moveis.json>
---

# /house-3d

Argumento: uma pasta com `planta.<ext>` (obrigatória), `foto-1.<ext>`, `foto-2.<ext>`… (opcionais) e `moveis.json` (os móveis da lista por cômodo, com medida em cm). Depois da pasta pode vir `realista` (botão "Gerar casa em 3D realista"): veja a seção 5.

Abra tudo com a ferramenta `Read` (imagens e PDF). Quando chamada pelo backend, a resposta segue um JSON Schema (`--json-schema`): preencha exatamente os campos pedidos. Não use outras ferramentas nem grave arquivos.

O objetivo é precisão: o site desenha a casa em 3D e deixa a pessoa andar por ela em primeira pessoa. Medida errada aparece como parede atravessando móvel ou porta dando em parede.

## 1. A planta em metros

- **`widthM` / `depthM`**: largura e profundidade da área construída inteira, em metros. Use as cotas da planta; sem cotas, deduza pela área escrita dos cômodos (soma das áreas ≈ área construída menos paredes); sem nada, estime pela proporção de um cômodo conhecido (porta = 0,80 m).
- **Cada cômodo** (`rooms`): retângulo que o envolve, em metros a partir do canto de cima à esquerda da planta (`xM`, `yM`, `widthM`, `depthM`). Os cômodos vizinhos dividem a parede: o fim de um é o começo do outro (sem buracos nem sobreposição). Confira: `widthM × depthM` ≈ área escrita na planta (até ~10% de diferença por causa das paredes).
- **Cômodo em L ou irregular** (sala de estar + jantar, sala que continua junto à varanda, cozinha americana em L): divida em retângulos que não se sobrepõem, **todos com o mesmo `type`**. O maior é o principal (sem `partOf`); os outros têm `partOf` = `label` do principal (ex.: `label` "Sala – estar junto à varanda", `partOf` "Sala"). Nunca marque um pedaço da sala como `outro`: ele é a sala. Entre as partes não há parede: ponha uma abertura `door` do comprimento do trecho em comum (sem `hinge`, sem `swing`): o site entende vão largo como passagem aberta e o que não cabe no principal vai para a parte.
- **`type`** e **`label`**: como na skill `/floor-plan` (quarto, quarto-bebe, sala, cozinha, banheiro, lavanderia, area-externa, escritorio, outro).

## 2. Portas e janelas (`openings`, por cômodo)

Como na `/floor-plan` (`kind`, `wall` do retângulo do cômodo, `position` 0–1 do centro ao longo da parede, `widthCm`), mais:

- **porta**: `hinge` = em qual ponta da abertura fica a dobradiça (`start` = esquerda/topo, `end` = direita/fundo, pelo arco da planta) e `swing` = `in` (abre para dentro deste cômodo) ou `out`. Porta de correr (dois traços paralelos, sem arco): `sliding: true`. A mesma porta aparece nos dois cômodos, com `swing` oposto (`in` num, `out` no outro).
- **Toda a casa precisa ser navegável** (a pessoa anda por ela em primeira pessoa): todo cômodo tem pelo menos uma porta para outro cômodo, e a casa tem a porta de entrada (porta numa parede externa). Se a planta não desenha a porta de um cômodo, coloque a mais provável (banheiro abre para a circulação ou para o quarto; cozinha e área de serviço para a sala ou entre si; varanda pela sala), com `widthCm` 70–80, e diga em `notes` quais foram deduzidas. Vão aberto sem porta (sala ↔ cozinha americana) = porta com `sliding: true`.
- **janela**: `sillCm` (altura do peitoril; 100 comum, 0 para porta-janela de varanda, 160 para basculante de banheiro) e `heightCm` (altura da janela).

## 3. Acabamentos (`finishes`, por cômodo)

Pelas **fotos**: identifique de qual cômodo é cada foto pelo que aparece (cama = quarto, vaso = banheiro, fogão = cozinha…). Leia:

- `floor`: `madeira` (laminado, taco, vinílico amadeirado), `porcelanato`, `ceramica`, `cimento`, `carpete` ou `deck`.
- `floorColor` e `wallColor`: a cor predominante em hex (`#d8c3a5`). Parede branca com luz amarelada continua branca (`#f2efe8`), não amarela.

Sem foto do cômodo: valor comum para o tipo (quarto e sala `madeira`; cozinha, banheiro e lavanderia `porcelanato` claro; área externa `deck` ou `ceramica`) e parede `#f2efe8`. Diga em `fromPhoto` se veio de foto.

Porcelanato e cerâmica: `tileCm` = lado da peça (porcelanato 60–120, cerâmica 30–45), contando as juntas na foto.

## 3b. Armários das fotos (`builtIns`, por cômodo)

O que **já está no imóvel** e aparece nas fotos (não é da lista de compras): armário embutido do quarto, bancada da cozinha com armário embaixo, armário aéreo, gabinete da pia do banheiro, prateleira fixa. Sem foto do cômodo: `[]`.

Para cada um, encostado numa parede do retângulo do cômodo:

- `kind`: `armario` (embutido, do chão até perto do teto), `bancada` (cozinha/lavanderia: armário de baixo + tampo), `aereo` (pendurado na parede), `gabinete` (pia do banheiro), `prateleira`.
- `wall` e `startCm` / `lengthCm`: em qual parede e de onde até onde vai, em cm a partir da ponta esquerda (paredes `top`/`bottom`) ou de cima (`left`/`right`) da parede.
- `depthCm`, `heightCm`, `elevationCm` (chão até a base). Medidas de referência para estimar pela foto: porta 80 × 210, bancada 90 de altura e 60 de profundidade, aéreo 35 de profundidade a 150 do chão, embutido 55–60 de profundidade, tomada a 30 cm do chão, interruptor a 110.
- `finish` (`madeira-clara`, `madeira-escura`, `branco`, `laca`, `cinza`) e `color` (hex da frente). Bancada: `topColor` (granito preto `#1f1f22`, branco `#e9e7e2`…), `sink` e `cooktop` se aparecem. `doors`: quantas portas na frente.

Associe a foto ao cômodo pelo que aparece e posicione pela parede onde está (janela, porta e bancada ajudam a saber qual parede é). Na dúvida sobre a parede, use a mais provável e avise em `notes`.

## 4. Móveis (`furniture`)

`moveis.json` lista, por cômodo (`instanceId`, ex.: `quarto-1`), os móveis com `key`, nome, `widthCm` × `depthCm` × `heightCm` e onde ficam (`floor`, `wall`, `rug`). O site já posiciona por regras (móvel encostado na parede, passagem de 60 cm, nada na frente de porta).

Só sugira posição quando a planta ou as fotos mostram onde o móvel **está ou cabe melhor** (cama desenhada na planta, bancada da cozinha, nicho de geladeira, armário embutido, foto do quarto com a cama numa parede). Para cada um: `key`, `unit` (0, 1… quando há mais de um), `xCm`/`yCm` = centro do móvel no cômodo (cm a partir do canto de cima à esquerda do retângulo do cômodo) e `rotation` = para onde a frente aponta (`down`, `up`, `left`, `right`; cama: a frente é o pé). O site confere cada sugestão (dentro do cômodo, sem bater em outro móvel, sem bloquear porta) e, se não passar, usa a regra. Na dúvida, não sugira.

## 5. Modo `realista`

Mais tempo e mais cuidado, para o modo realista do site:

- Abra **cada foto** e compare com a planta antes de responder; uma foto pode mostrar mais de um cômodo (sala integrada à cozinha).
- Armários: meça cada módulo (`startCm`, `lengthCm`) pelas referências da seção 3b; separe bancada, aéreo e embutido mesmo quando estão juntos.
- Cores: pegue a cor do meio da superfície, longe do reflexo da janela e da sombra; madeira = tom médio das tábuas.
- Piso: `tileCm` sempre que der para contar as peças.

## 6. `notes`

Avisos curtos em português (medidas estimadas, fotos que não deu para associar a um cômodo, planta de mais de um pavimento), ou `""`.
