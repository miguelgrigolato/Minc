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
