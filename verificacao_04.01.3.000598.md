# Verificação de desenhos — Válvula Borboleta Dupla Alavanca DN700 (Nomus 04.01.3.000598)

Conjunto geral 022-007300 + 69 folhas de detalhe (70 páginas). Conferido: lista de materiais (BOM) de cada conjunto x desenho da peça (material, peso, quantidade, nº do desenho), referências cruzadas nas notas, cotas/tolerâncias que se repetem em mais de um desenho.
Legenda: **[A]** erro claro · **[B]** verificar/provável erro · **[C]** detalhe de forma.

## A. Divergências que afetam a estrutura

| # | Onde | Divergência |
|---|------|-------------|
| 1 **[A]** | 007300 item 28 | Conjunto alavanca L-D: **8,8 kg**, mas 007342 pesa 4,4 kg (item 31 L-E está 4,4). |
| 2 **[A]** | 007300 item 1 | Corpo usinado **329,8 kg**; 007302/007303 dizem **326,8 kg**. |
| 3 **[A]** | 007300 item 5 | Tampa lateral 4,0 kg (qtd 2 = 2,0 cada). 007325: nota 4,3 kg, carimbo 2,0 kg. 185×185×15,88 já pesa 4,3 kg bruta. Três pesos diferentes. |
| 4 **[A]** | 007300 item 26 | Disco 73,6 kg; 007347 carimbo 73,8; 007346 nota 73,8; 007348 (70,4) + 007349 (2,4) = 72,8; 007346 BOM (71,1+2,4) = 73,5. |
| 5 **[A]** | 007300 item 38 | Pino menor do braço: BOM diz **ASTM A516 GR70**; 007363 diz **SAE 8550** (nitretado). |
| 6 **[A]** | 007302 item 3 | Flange: BOM **ASTM A-36**; 007308 diz **ASTM A516 GR70**. |
| 7 **[A]** | 007369 item 3 | Nervura da flange: BOM **A516 GR70**; 007366 diz **ASTM A36**. |
| 8 **[A]** | 007341 item 1 | Tubo da alavanca: BOM "ASTM **A5165** GR70" (typo); 007344 diz **ASTM A106 GR C**. |
| 9 **[A]** | 007331 item 3 | Tampão aponta **022-007351** (que é a bucha do cj alavanca). O tampão é **022-007371** (007337 e 007300 estão corretos). |
| 10 **[A]** | 007341 item 3 | Barra superior da alavanca = **022-007345 — não há desenho no PDF**. |
| 11 **[A]** | 007300 BOM x balões | Balões **52, 62, 65** no desenho e **sem linha na BOM**. Item **64** (tubo Ø10) está na BOM e **sem balão**. (52 aparece junto ao 51 = M16x45, provável arruela/porca M16.) |
| 12 **[B]** | 007300 item 20 x 007331 | Bucha central 2 (007336) é soldada na placa central (007331, item 4) e o peso do item 17 (5,0 kg) já a inclui; mas ela também aparece como **item 20 avulso** na 007300 → duplicidade na estrutura. |
| 13 **[A]** | 007309 / 007312 / 007302 | Peso do cj suporte: 007309 e 007312 dizem **6,2 / 6,1 kg**; soma da BOM da 007309 (0,9 + 2×1,1) = **3,1 kg**; 007302 lista 3,15 kg qtd 1 e o peso do corpo (326,8) só fecha com 3,1. |
| 14 **[A]** | 007337 / 007352 | Nota "peso acabado **4,5 kg**" e carimbo da 007352 "2,5 kg"; soma da BOM 007337 = ~6,9 kg, e 007300 item 30 = 6,8 kg. |
| 15 **[A]** | 007320 | Nota "peso 4,5 kg"; carimbo e 007321 = **16,1 kg**. |
| 16 **[A]** | 007347 | Notas copiadas do cavalete: "soldar ver **007306**", "usinagem ver **007303**" (deveria ser 007346 / ela mesma) e "peso **9,1 kg**" (real ≈ 73,8). |
| 17 **[A]** | 007324 | Carimbo "CHAPA **1"**" mas desenhada com **19,05 (3/4")**; peso bruto 9,3 kg confere com 3/4". |
| 18 **[A]** | 007323 | Peso bruto **19,0 kg** (250×250×19,05 = ~9,3 kg; nota 7,2 kg acabado está certa). |
| 19 **[A]** | 007371 | Tampão Ø6 acabado com **8 mm**; matéria-prima "Ø6 x **6** mm" (menor que a peça). |
| 20 **[A]** | 007304 nota 2 | Fala "roscas **M10** e M12"; desenhos 007304/007303 têm **M8x1,25** e M12. Profundidade M8: 007303 diz 20 e 22, 007304 diz 16. |

## B. A verificar com o projetista

- **007307 tubo**: Ø int. acabado **149,6** menor que o bruto Ø**150** (não dá para usinar para menor).
- **007304 bosse 1**: cota "70 +0,2/+0,1" sem Ø, Ø88 e Ø105 com extensões iguais — ambíguo. Peso 6,0 kg parece alto (cálculo ≈ 4,5 kg com Ø105x75 + Ø88).
- **007326 anel guarda-pó**: furos Ø105 (PCD); 007303 vista K mostra Ø109 — conferir se é o mesmo círculo.
- **007318 eixo**: Ø70 aparece **-0,05/-0,10** na elevação e **-0,10/-0,15** na seção A-A. Entalhes do anel DIN 471 Ø60 (item 8) exigem fundo Ø57; desenho mostra Ø52.
- **007300 item 27 O-ring Ø641x10**: conferir com o canal do disco (centro Ø647,5; diâmetro interno do canal ≈ Ø638–642) — pode estar grande para esticar.
- **007300 item 24** parafuso M16x50: 0,01 kg (provável 0,1). **Item 4** rolamento SKF 22312 E: 1,6 kg qtd 2 (catálogo ≈ 2,2 kg cada).
- **007308 flange**: furos Ø17 (8x) sem cota do PCD (só aparece na 007368: Ø225).
- **007364 anel de ajuste do eixo**: sem cota do diâmetro externo (só Ø110 na matéria-prima).
- **007370 junta**: Ø176 no desenho, Ø175 na matéria-prima.
- Pesos de bucha/anéis pequenos na BOM da 007300 divergem dos desenhos (ex.: 36 = 0,3 x 4×0,1; 33 = 0,2 x 4×0,1) — arredondamentos.

## C. Forma / digitação
- Datas: 007348 em **29/09/2029**; 007353 "**128**/09/2026".
- 007340 "A516 **G70**"; 007300 itens 12/13 "AISI A36" (drawing: ASTM A36); 007369 "TUDO da flange"; 007358 "N ITRETAÇÃO"; notas com item "2" repetido (007343, 007344, 007350, 007301 nota 4 etc.); "QUABRAR" (007306/13/14/15); 007339 matéria-prima "Ø275xØ95" (é 275x95).
- Nomes diferentes: 007336 é "bucha central 2" no desenho e "bucha central da placa" na 007331.
- Qtd no carimbo da peça (sempre 1) difere da qtd do conjunto (ex.: bosse 1 x2, suporte da placa); BOMs misturam peso bruto e acabado.

## D. Desenhos conferidos sem divergência encontrada
007301, 007305, 007306 (soma 19,7 kg ok), 007309 (BOM), 007310, 007311, 007313–007317, 007319, 007321/22 (soma ok), 007327–007330, 007332–007335, 007338–007340, 007343, 007349–007351, 007353–007361, 007365–007368. Ajustes de tolerância de buchas/pinos/furos (Ø40, Ø32, Ø45, Ø50, Ø95, Ø105, Ø70) conferem entre peça e conjunto.

## Limites
Leitura visual + texto do PDF; não validei interferências 3D nem o conjunto geral cota a cota. Não tenho acesso ao Nomus daqui.
