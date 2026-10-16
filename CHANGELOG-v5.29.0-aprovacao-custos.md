# ServiceHub v5.29.0 — aprovação por ID, fotos com comentário, Custos do RTS

## Banco (projeto minc-peritagem) — já aplicado
Arquivos em `supabase/migrations/`. Tudo aditivo; nenhuma linha existente foi alterada ou apagada.

| Objeto | Para quê |
|---|---|
| `doc_approvers` | Quem aprova, por ID de usuário (hoje: alcenir.valente e Rogerio Gomes). Sem política de escrita: só o administrador do banco altera. |
| `private.can_approve()` | Função usada pelos gatilhos. |
| `rts_guard_approval()` (trocada) | RTS: só aprovador aprova/reabre; carimba quem aprovou e quando (o que o app manda é ignorado); congela RTS aprovado; exige RTS completo para enviar/aprovar. |
| `de_guard_approval()` + gatilho em `processes` | D.E.: estado em `data.aprovacao` (nenhum/aguardando/aprovado/reprovado). Mesmas regras; editar uma D.E. aprovada derruba a aprovação e registra quem. |
| `doc_audit` | Histórico imutável (só os gatilhos gravam): criado, enviado, aprovado, reprovado (com motivo), reaberto, envio cancelado, aprovação invalidada por edição, excluído/restaurado, e mudanças de custo. |
| `rts_costs` + `rts_costs_calc()` + `rts_costs_audit()` | Orçamento por RTS. O servidor recalcula cada linha e os totais; zero só se digitado; linha incompleta fica pendente. |
| `private.can_costs()` | Acesso aos custos: `app_settings.custos_config.acesso` = `membros` (padrão) ou `gestores`. |

Mudança de regra: antes aprovava quem era administrador/gestor (inclui Miguel e Andrey). Agora só quem está em `doc_approvers`.
Para incluir/retirar um aprovador: `insert into doc_approvers(user_id,note) values ('<id do perfil>','Nome');` / `delete ... where user_id=...`.

## App
- Aprovação: aprovador vê **Aprovar** (direto, sem enviar); os demais, **Enviar para aprovação**; reprovar pede motivo; reabrir é só de aprovador; Histórico dentro do documento. Vale para RTS e D.E. (D.E.: etapa Documento).
- Fotos dos anexos do RTS: “Foto N”, legenda e comentário por foto, reordenar (setas), remover; no PDF cada foto sai com seu texto.
- Lista de RTS: botões **Visualizar** e **Custo**. Detalhe do processo sem campos opcionais vazios e sem “buracos” na grade.
- **Custo**: previsão orçamentária por RTS (materiais, H/H, despesas, serviços externos), PDF na mesma moldura do RTS, Excel com números e fórmulas, histórico, importação da lista de materiais sem duplicar, referência de preço do Nomus (só sugestão).
- Nomus: novas ações `compras` e `compras_sonda` na função Netlify (somente leitura). **Ainda não validadas com a chave real**: ver `compras_sonda`.

## Testes
`node servicehub/tests/custos-calc.test.js` (14 regras de cálculo). Testes de navegador e de banco: ver o resumo da entrega.

---

# v5.30.0 — histórico de compras importado da planilha do Nomus

- Botão **Importar histórico** (tela Custo, só administrador/gestor): lê a planilha “BD - Custos” do Nomus, confere linha por linha e grava em `purchase_history`. Reimportar é seguro (linhas já gravadas são ignoradas).
- **Não entram**: quantidade/preço/total zerados; total que não confere com quantidade × valor unitário (unidade ou quantidade errada); código genérico “XML-NFe entrada”; linhas repetidas (fica 1 cópia); preço fora de 5×/0,2× a mediana do código (códigos com 3+ compras). **Serviços entram** (preço de serviço não passa pelo filtro de preço, pois varia com o escopo).
- “Baixar linhas descartadas” gera a lista do que ficou de fora e o motivo.
- “Buscar preços no histórico” (antes “no Nomus”) agora lê `purchase_history`: materiais e também serviços/despesas com código. Serviço sem código: “Vincular código” busca no histórico de serviços.
- Referência: média ponderada pela quantidade (peso limitado a 5× a quantidade mediana), descarta preço fora do padrão a partir de 3 compras, unidades do Nomus (UNIDADE, QUILOGRAMA, MILIMETRO…) casadas com as do app. Serviço: confiança no máximo “média”.
- Banco: `purchase_history` e `purchase_imports` (migração `20261016_historico_compras.sql`, já aplicada). Leitura: quem acessa custos. Gravação: só administrador/gestor. Sem atualizar/apagar.
- Resultado com a planilha enviada (4.923 linhas): 4.790 aproveitadas (3.766 material + 1.024 serviço), 133 descartadas (14 código genérico, 2 zeradas, 18 total não confere, 54 repetidas, 45 preço fora do padrão).

---

# v5.31.0 — referência de preço pelo NOME do item
- “Buscar preços no histórico” agora também acha o preço **pelo nome** quando o item não tem código do Nomus (ou o código não tem compras): tira artigos e plural, procura as palavras nas descrições das compras (tabela `purchase_history`, coluna `busca`, sem acento), agrupa por item parecido e usa a **mediana** dos preços por item (cada um pela média ponderada de suas compras). Só itens da mesma unidade.
- Cada estimativa mostra as palavras usadas, nº de compras e de itens parecidos, faixa (mín–máx), última compra e confiança (“baixa” quando é busca ampla ou há muitos itens diferentes). **“Ver itens parecidos”** deixa escolher o item exato: vincula o código e passa a valer o preço dele.
- Nada entra no orçamento sozinho: o preço só é aplicado em “Usar referência”.
- Serviços: busca com 1 palavra já vale (ex.: “usinagem”); materiais exigem 2 palavras quando o nome tem 2+.
- Linhas padrão em branco não são consultadas.
