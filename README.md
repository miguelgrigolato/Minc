# MINC ServiceHub (v5.22.0)

App web (PWA) da engenharia de serviço da Indústrias Minc (antes "MINC Peritagem"): peritagem/D.E, RTS, painel de gestão, catálogos e integração com o Nomus. Sem build: arquivos estáticos
(`index.html`, `app.js`, ...). Dados no Supabase (projeto `minc-peritagem`) com cópia local no aparelho.

## Novidades da v5.11.0
- **Modelos de válvula (projetos)** — Administração > Modelos de válvula (`modelos.js`). Cada modelo guarda as POS/componentes.
  "Novo processo" oferece escolher o modelo: os componentes já entram na aba Componentes. Sem projeto, tudo segue como antes.
- **Checklist de entrega** — na tela "Documento de execução" (e como atalho após gerar o DEP): PDF com as peças que a
  desmontagem entrega à fábrica. O código do formulário fica em `catalogo.js` > `CHECKLIST.codigo` (ainda vazio).
- **RTS (Relatório Técnico de Serviço)** — aba "RTS" no topo (`rts.js`), independente da peritagem. POS com providência,
  atividades padrão (`catalogo.js` > `RTS_BIBLIOTECA`), lista de materiais e PDF no layout R-MINC-060-RTS-PT.

## v5.22.0 — Manual por perfil
- Ajuda e manual mostra só o que vale para quem está logado: Funcionário (Primeiros passos + Funcionário), Gestor (+ Gestor e Treinamento), Administrador (tudo).
- Manual detalhado: cada tela e etapa da D.E, com tabela "botão / para que serve"; RTS, painel, aprovações, comparativos, catálogos e usuários.
- Manuais em Word por perfil em `docs/manual/` (gerados do mesmo conteúdo de `ajuda.js`).

## v5.21.0 — Qualidade e acabamento
- **Checklist R-MINC-078-IRS-PT** (Checklist de verificação de itens reutilizados para serviço, Rev. 00): lista os componentes com providência "Reutilizar" (opção de incluir todos). Modelo Word atualizado em `docs/modelos-formularios/`.
- **Painel de gestão completo** (`painel.js`): período (30 dias a tudo), indicadores, processos por mês (criados × concluídos), tempo médio por etapa (histórico de status), providências, componentes / serviços / matérias-primas mais frequentes, produtividade por pessoa, RTS (aprovação, devoluções) e comparativos; todo gráfico com dica e "Ver tabela"; exportação para Excel.
- **Avisos** (`avisos.js`): sino na barra — RTS para aprovar, RTS aprovado/devolvido, comparativos para avaliar/avaliados; avisos do sistema quando a pessoa permitir.
- **Sem internet**: faixa fixa, pedido de armazenamento protegido ao navegador, situação do armazenamento no detalhe de envio e alerta ao fechar com pendências.
- **Ajuda e manual** (`ajuda.js`, menu do usuário) por perfil + roteiro de treinamento; versões Word em `docs/manual/`.

## v5.19.0 — Comparativo RTS × D.E
- No RTS (editor), painel **Vínculo com a D.E**: escolha o processo da peritagem. O app compara RTS e D.E (cabeçalho, POS/componentes, providências, quantidades e materiais; casa por nº da POS e, na falta dele, pelo nome) e envia o relatório de diferenças ao **Painel de gestão**.
- Painel: seção "Diferenças RTS × D.E para avaliar" — o gestor abre o relatório, decide (Resolvido / Diferença aceita / Descartado) e anota. Tabela `rts_dep_reports` (migração `20261017_comparativo_rts_dep.sql`, aplicada). Módulo `comparar.js`.

## v5.18.0 — Perfil Gestor, painel, histórico e busca
- **Perfil Gestor** (cadastro de usuário): acesso a tudo, menos a aba de usuários (e a auditoria deles). Edita catálogos, modelos e configurações, aprova RTS e vê o Painel.
  Banco: `private.is_manager()`, políticas dos catálogos trocadas de `is_admin` para `is_manager`; função `admin-users` v3. Migração `20261016_perfil_gestor_e_historico.sql` (aplicada).
- **Painel de gestão** (aba "Painel", só admin/gestor, `painel.js`): processos parados (prazo ajustável), sem ordem, itens sem cadastro por família, RTS aguardando, envios pendentes, atividade recente.
- **Histórico de alterações** por processo (botão "Histórico" na ficha, só admin/gestor): tabela `process_history`, preenchida por gatilho; mostra quem, quando e quais campos mudaram.
- **Busca em tudo** (lupa na barra superior, todos): processos, componentes/materiais, RTS, modelos e lista do Nomus, com `%`.
- **Envio para a nuvem**: tocar em "N pendentes" mostra o que ainda não foi enviado e permite enviar agora.
- Modelos editáveis em Word dos formulários (DEP, RTS e checklist) em `docs/modelos-formularios/`.

## v5.17.1 — Consulta ao Nomus (somente leitura) — DESLIGADA por padrão (Configurações > "Busca no Nomus"); servidor do Nomus ainda recusa o TLS do Supabase
- No processo (Identificação): **Buscar no Nomus** — `PD 002292` (pedido) ou `OS000123` (ordem) — preenche pedido, cliente, equipamento e ordem (`nomus.js`).
- Configurações: **Testar conexão com o Nomus**. Função `supabase/functions/nomus` (a chave fica no segredo `NOMUS_CHAVE`; base `https://minc.nomus.com.br/minc/rest`). Não grava nada no Nomus.

## v5.16.0 — Lista completa do Nomus por família + item sem cadastro
- Importação da exportação do Nomus (`dwlc_produtos.xlsx`: colunas Código/Descrição/Unidade/Família de produto) em Configurações > Lista de matéria-prima > Importar planilha (3.416 itens, 59 famílias).
- Seletor de matéria-prima com filtros por Família e Unidade, ordenação (A–Z, Z–A, código…) e botão `%`; a regra do `%` continua valendo.
- "Não encontrei: item sem cadastro": o perito escolhe a família e preenche a ficha dela (`fichas.js`, definições em `catalogo.js` > `MP_FICHAS`; famílias sem ficha própria usam a genérica). Campos obrigatórios bloqueiam a conclusão.
- Estrutura ganhou **Lista de cadastro** (itens sem cadastro por família) e a aba "Para cadastro" no Excel. Migração: `20261015_materia_prima_familia.sql` (aplicada).

## v5.15.0 — Matéria-prima padronizada (código do Nomus)
- Administração > Configurações > **Lista de matéria-prima** (`materiais.js`, tabela `catalog_materials`): só o administrador adiciona, edita, desativa, exclui,
  **importa a planilha do Nomus** (.xlsx/.csv; cada aba vira um grupo; código secundário vira informação complementar) e exporta.
- Em Componentes e Estrutura, "Adicionar matéria-prima" abre a lista para **marcar**. A caixa é busca com `%` para pular palavras:
  `paraf%sext%m10%30`. Sem `%`, todas as palavras precisam aparecer. Também busca pelo código.
- Regra "Permitir matéria-prima fora da lista" (Configurações): liga/desliga o botão de item digitado à mão. Migração: `20261014_lista_materia_prima_nomus.sql`.

## v5.14.0 — Serviços padronizados (código do Nomus)
- Administração > Configurações > **Lista de serviços**: só o administrador adiciona, edita, desativa, exclui, importa (colar do Excel) e exporta (CSV).
- Em Componentes e Estrutura, "Adicionar serviço" abre a lista para **marcar** os serviços; nome e código entram prontos. A caixa de texto é só busca;
  não existe "serviço fora da lista". Migração: `supabase/migrations/20261014_servicos_com_codigo_nomus.sql` (aplicada).

## v5.13.0 — Configurações
- Administração > **Configurações**: o administrador liga/desliga módulos para todos os usuários (`ajustes.js`, tabela `app_settings`).
  A aba **RTS** vem **desligada** por padrão; desligada, a aba some, mas os RTS já criados continuam guardados.

## v5.12.0 — RTS a partir dos RTS reais (1135, 1168, 1188)
- **Aprovação dentro do app**: Rascunho → Aguardando aprovação → Aprovado. Só o administrador aprova ou devolve (com motivo);
  o RTS fica travado fora do rascunho; o PDF só sai com "Aprovado por" depois da aprovação (antes, marca d'água).
- Observações técnicas, seções extras (ex.: Delineamento Contratual) e anexos (imagens, desenhos, lista de materiais) são listas livres,
  com biblioteca em `catalogo.js`. Padrão de pintura e formato do título de cada POS escolhidos por RTS.
- Imagens dos anexos: ficam no aparelho e sobem para o bucket `peritagem-fotos` em `rts/<id do RTS>/`.
- Só o administrador cadastra/edita modelos de válvula (tela e regra do banco).

## Banco de dados
A migração `supabase/migrations/20261013_modelos_valvula_e_rts.sql` (já aplicada no projeto `minc-peritagem`) cria `valve_models`,
`rts_documents` e `app_settings`, com RLS iguais às das demais tabelas. Sem ela o app continua funcionando e guarda tudo só no aparelho.

## Estrutura dos módulos
`modelos.js` e `rts.js` carregam antes do `app.js` e se registram em `window.MINC_EXT` (`act`, `chg`, `sub`, `inp`, `views`,
`sync`, `boot`); o `app.js` mescla tudo antes do `boot()`.
