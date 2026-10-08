# MINC — Aplicativo de Peritagem v5.6.0

PWA (HTML + CSS + JavaScript puro) com Supabase. Funciona offline, instala no tablet/notebook e sincroniza na nuvem.

## Estrutura
```
minc-peritagem/
├─ public/             ← o site (é esta pasta que vai para o Netlify)
│  ├─ catalogo.js      ← listas editáveis: providências, atividades, embalagem padrão, cabeçalho do formulário
│  ├─ config.js        ← URL e chave pública do Supabase
│  ├─ _headers         ← segurança e cache
│  └─ …                ← index.html, app.js, styles.css, service-worker.js, manifest, fonts/, icons/, vendor/
├─ supabase/
│  ├─ schema.sql       ← registro do que foi aplicado no banco (migrações 001 a 008)
│  └─ functions/admin-users/  ← função segura do servidor (cadastro de usuários)
├─ tests/            ← teste da sincronização na nuvem (simulador do Supabase)
├─ netlify.toml
└─ DEPLOY-NETLIFY.md   ← passo a passo da publicação
```

## Novidades da v5.9.0
**Fotos do documento com borda preta:** cada foto ganha um contorno preto fino na tela, na impressão e no PDF arquivado (no PDF a borda contorna a própria foto, em qualquer proporção).

**Correções do teste de pior caso** (`tests/pior-caso`)
- Anexo com nome longo não empurra mais a lixeira para fora da tela nem alarga a página: o nome é cortado com "…" e aparece inteiro ao passar o dedo/mouse.
- Status (Rascunho / Em execução / Concluído) ocupa a linha inteira da Identificação: "Concluído" não é mais cortado. Em celular de 320 px as três opções cabem.
- Lista de processos mostra 100 por vez, com "Mostrar mais". Com 1.000 processos: voltar para "Todos" caiu de ~960 ms para ~40 ms; cada tecla na busca, de ~300 ms para ~80 ms. Selecionar um processo não redesenha mais a lista inteira.
- Nome de usuário longo na barra superior fica numa linha só, cortado com "…".
- Foto que ainda não foi baixada neste aparelho mostra um quadro "Foto ainda não baixada" em vez do ícone de imagem quebrada (no documento: "Foto não baixada").
- Número de processo sem espaços quebra de linha na lista em vez de ser cortado na borda.
- Topo do processo no celular: o último dado ocupa a linha inteira (sem caixa cinza vazia).
- Contagens com plural e milhar certos: "1 foto", "2 fotos", "1.000 cadastrados" (nada de "(s)").
- Campos de texto limitados a 200 caracteres e observações a 4.000 (valores antigos maiores não são cortados). O banco continua sem limite.

## Novidades da v5.8.0
**Troca de status animada**
- Em Rascunho / Em execução / Concluído (e nos outros controles do mesmo tipo: Estrutura/Lista de compras, abas da Administração) a pílula escura **desliza** da opção anterior até a nova em 260 ms; fundo e texto trocam juntos, sem cor intermediária. O selo de status no topo do processo entra com o valor novo.
- Ao filtrar a lista (Todos / Rascunho / Em execução / Concluído) as linhas visíveis entram em cascata curta.
- Com "reduzir movimento" ligado no aparelho, tudo isso troca na hora, sem deslocamento.

**Sensação de app no celular e tablet**
- Efeitos de mouse (realce, elevação, brilho) só em aparelhos com mouse: no toque eles não ficam mais "presos" depois de tocar.
- Toque sem espera de duplo toque; segurar um botão não seleciona o texto dele.
- Campos com letra de 16 px em tela de toque (o iPhone não dá mais zoom ao tocar num campo).
- Altura correta da tela no celular (barra do navegador), conteúdo longe do entalhe com o celular deitado, cor da barra de status igual à barra do app.
- A barra superior não estoura mais a largura em celulares de 390 px: a pílula de sincronização vira só o ponto de status.
- Arrastar a página para baixo no meio do preenchimento não recarrega mais o app.

**Teste de pior caso** (só para desenvolvimento, não vai para o Netlify): `python3 tests/pior-caso/servir.py` e abra `http://localhost:8790/tests/pior-caso/`. Botões na parte de baixo trocam entre Demo, Pior caso, Vazio, Um e 1.000 processos, e entre larguras de tela.

## Novidades da v5.7.0
**Camada "Movimento & Letras"** (só visual; arquivos novos `movimento.css` e `movimento.js`, sem mexer em `styles.css` nem `app.js`)
- **Letras:** a fonte condensada (Barlow Condensed) passa a ser a voz de todos os títulos (painéis, seções, etapas, listas vazias, "Peritagem" da barra), não só dos números. Títulos maiores e balanceados; números com largura fixa.
- **Botões:** um ponto de luz segue o mouse/dedo sobre botões e cartões de opção; o toque deixa uma onda; o ícone "+" gira, a seta avança, "Voltar" recua e a lixeira inclina. O brilho que atravessa o botão principal continua.
- **Trocar de processo:** o título entra com desfoque, os dados do equipamento e as etapas entram em sequência. É o único momento encenado da tela inicial.
- **Detalhes:** o texto da linha selecionada avança 3 px; o anel de foco cresce até a posição final; "Salvando" respira; barras de rolagem e cursor usam a cor de destaque.
- **Sem mudanças:** cores, tema claro/escuro, campos, fluxo, documento de execução, impressão e PDF. "Reduzir movimento" e "aumentar contraste" desligam tudo isto.

## Novidades da v5.6.0
**Providência: só uma por item**
- Escolher outra providência substitui a anterior; tocar de novo na marcada não desmarca. Vale na aba Componentes e na Estrutura.
- Item antigo com duas providências mostra um aviso e fica com pendência até ficar só uma.

**Materiais e serviços**
- **Matéria-prima** só aparece em **Fabricar** e **Substituir**. **Serviço** pode ser adicionado em **qualquer** providência.
- Em Recuperar e Reutilizar o painel vira "Serviços", só com "Adicionar serviço". Um item com serviço já dispensa atividade.
- Se um item com matéria-prima muda para Recuperar/Reutilizar, a matéria-prima **não é apagada**: some da tela, do documento e da lista de compras (com aviso) e volta ao escolher Fabricar ou Substituir.
- No documento, o título se ajusta: "Serviços", "Materiais a comprar" ou "Materiais e serviços a comprar". A lista de compras e o Excel passam a incluir serviços de qualquer providência.

**Tipo de vedação:** nova opção **"Não aplicável"**.

**Visual "Aço & Vidro"**
- Superfícies claras com brilho fino na borda de cima; barra superior, barra de ações, etapas (tablet) e avisos em vidro fumê.
- Preto e branco da marca + uma única luz azul de instrumento, só no que está ativo ou em foco (etapa atual, escolha marcada, campo em digitação).
- Movimento: botões encolhem no toque (96,5 %) e voltam com mola sem quique; cartões sobem levemente no mouse; brilho que atravessa o botão principal; o "check" da escolha marcada é o único que quica; interruptor com mola; diálogos e avisos chegam com mola e o fundo do diálogo desfoca. Login com luz e linha de varredura (uma vez).
- Acessibilidade: "reduzir movimento" zera as animações; "reduzir transparência" troca o vidro por cor sólida; "aumentar contraste" reforça as bordas. Alvos de toque continuam com 44 px ou mais.
- O documento de execução (tela, impressão e PDF) não foi alterado.

## Novidades da v5.5.0
**Atividades**
- **Fabricar** e **Substituir** não exigem atividades: isso é trabalho da Engenharia de Processos. A seção "Atividades" continua na tela, marcada como opcional. Recuperar e Reutilizar seguem exigindo ao menos uma atividade.

**Cadastro de usuários**
- Novo interruptor **"Nome em CAIXA ALTA"** (ligado por padrão, como antes). Desligado, o nome é gravado exatamente como digitado. Vale para o cadastro na nuvem e para o cadastro local.

**Galeria → Anexos**
- O botão "Galeria" virou **"Anexos"**. Ao tocar, escolha **Galeria de fotos** ou **Arquivos** (PDF, Word, Excel, CSV, TXT, PowerPoint, DWG/DXF, ZIP…, até 25 MB por arquivo).
- Fotos continuam como antes (entram no documento). **PDF e outros arquivos viram anexos**: aparecem numa lista logo abaixo das fotos, abrem com um toque e podem ser removidos (com "Desfazer"). Não entram no documento de execução.
- Anexos existem no equipamento (aba Informações) e em cada componente.

**Pasta por processo na nuvem**
- Cada processo novo ganha uma pasta no Storage com o nome **Processo_Pedido_Equipamento_Cliente** (ex.: `123_P-9-1_Valvula-Gaveta-6_Petrobras-S-A`), com subpastas `fotos/`, `anexos/` e `documentos/` (PDF e JSON dos documentos arquivados).
- A pasta só é criada quando os quatro campos estão preenchidos; até lá, fotos e anexos ficam guardados no aparelho e sobem depois. O nome fica **fixo** a partir da primeira criação (aparece na aba Informações), mesmo que a identificação seja editada depois.
- Arquivos de antes da v5.5.0 continuam em `<id do processo>/` e seguem sendo lidos de lá; nada foi movido. **Sem migração de banco**: o caminho completo de cada arquivo já é guardado nas tabelas `photos` e `process_documents`.

## Novidades da v5.4.0
**Subcomponentes na aba Componentes**
- Cada componente tem uma seção **"Subcomponentes"** com o botão **"Adicionar subcomponente"** e atalhos para os filhos já criados.
- Numeração hierárquica, seguindo o componente principal: **1, 1.1, 1.2, 1.1.1, 2, 2.1…** Cada nível conta só entre irmãos, em ordem de criação. É a mesma numeração na aba Componentes, na Estrutura, no documento e no Excel.
- Cada subcomponente é um componente completo: **providência, atividades, materiais, fotos e observação próprios**, com as mesmas regras de preenchimento. A pendência dele aparece com o número dele ("Componente 1.1 — …").
- Na aba, os componentes principais continuam do mais novo para o mais antigo; os subcomponentes ficam logo abaixo do pai, recuados e com um trilho preto à esquerda.
- Excluir um componente exclui os subcomponentes (com confirmação e "Desfazer"). Mover ou excluir renumera automaticamente, sem buraco (ex.: excluir o 1.1 faz o 1.2 virar 1.1).

**Documento de execução e PDF**
- **Cada subcomponente é uma caixa separada**, igual às dos componentes principais, logo abaixo do pai: 1, 1.1, 1.1.1, 1.2, 2, 2.1… Nenhum bloco novo no formulário: só mais caixas.
- TESTE, PLACA e EMBALAGEM continuam sem Providência e seguem a numeração dos componentes **principais** (com 2 componentes principais: 3, 4 e 5).
- Processos sem subcomponentes ficam exatamente como antes (1, 2, 3…).

**Excel:** a coluna "Item" usa o mesmo rótulo (1, 1.1…); inteiro sai como número e o composto como texto.

## Novidades da v5.3.0
**Aba 6: "Materiais" virou "Estrutura"**
- Árvore de componentes no formato da lista de materiais do Nomus: cada componente pode ter **subcomponentes, matérias-primas e serviços**. O nó da árvore é o mesmo componente da aba Componentes, então providência, atividades e fotos continuam sendo editadas lá e o documento de execução não muda.
- A **providência** pode ser marcada direto na árvore.
- **Código** digitado à mão (opcional) e caixa **"Não tem cadastro"** em cada item: marcada, ela ignora o código digitado sem apagá-lo.
- Recolher/expandir, mover um item para outro pai (sem criar laço) e excluir com os subcomponentes (com confirmação e "Desfazer").
- A tabela antiga ficou como segunda visão, **"Lista de compras"** (só Fabricar/Substituir).
- **Excel com 3 planilhas:** Estrutura (com níveis), Compras e Para cadastro (só aparece se houver itens marcados "Não tem cadastro").
- Serviço não exige "Material / norma". Nenhuma migração de banco: tudo fica no JSON do processo, e processos antigos abrem como lista plana.

**Documento de execução**
- **Providência removida dos itens TESTE, PLACA e EMBALAGEM**, na tela, na impressão e no PDF arquivado. Os componentes continuam com Providência. O formulário em si não foi alterado em mais nada.

**Correção**
- No celular, todas as abas estouravam a largura da tela (a barra de etapas alargava a página). Corrigido. Ainda sobram ~22 px causados pela barra superior em telas de 390 px (celular não é o aparelho-alvo).

**Integração com o Nomus:** ver `docs/INTEGRACAO-NOMUS.md` (o que pedir à TI e como entra no app).

## Novidades da v5.2.0
- **Acionamento:** adicionada a opção **"Sem Acionamento"**.
- **Providência "Serviço externo" removida.** Itens antigos que já usavam essa providência continuam com os dados e mostram a marca "Descontinuada", igual ao que já acontecia com o Retrofit — nada foi apagado, só não é mais possível escolher essa opção em itens novos. O catálogo de serviços externos (em Administração) continua existindo, para quem ainda precisar editar um item antigo.
- **Observação em cada teste:** Teste de acionamento, Teste de estanqueidade da sede, Teste de estanqueidade do corpo e cada Ensaio adicional agora têm um campo de observação próprio (sempre opcional). Aparece no documento logo depois dos dados do teste.

## Ajuste da v5.1.1
- Acionamento: adicionada a opção **"Motor"** (ficou esquecida na v5.1.0). Lista agora: Atuador Eletromecânico, Atuador Hidráulico, Atuador Pneumático, Manual, Motor.

## Novidades da v5.1.0
**Ajustes de formulário**
- **Acionamento:** "Alavanca" virou **"Manual"**. Um processo antigo com "Alavanca" continua mostrando o valor (marcado como opção à parte), sem ser apagado.
- **Plaqueta de identificação:** ficaram só **Equipamento** (era "Tipo"), **DN**, **O.S.**, **TAG** e **Data do reparo**. Pressão, temperatura e materiais de corpo/sede saíram da tela (dados já preenchidos antes continuam guardados e aparecem no documento se existirem, mas não são mais editáveis).
- **Testes de estanqueidade (sede e corpo):** **Tipo de teste** e **Duração** passaram a ser **obrigatórios**; o campo **Fluido** foi removido (tela, documento e PDF). **Atenção:** processos já existentes que tinham só a pressão preenchida agora ficam com pendência nessa etapa até alguém completar Tipo de teste e Duração — isso não apaga nada já gerado, mas pode bloquear a reabertura da aba Documento até o preenchimento.
- **Lista de materiais:** tirado o botão "Exportar Excel" duplicado da barra inferior; ficou só o do painel.

**Logo oficial da Minc**
- Adicionada em `icons/logo-minc.png`. Aparece automaticamente na tela de login e no lugar do texto "MINC" no cabeçalho do documento — tanto na versão impressa/HTML quanto no PDF arquivado (com a proporção da imagem medida automaticamente). Se o arquivo não existir ou não carregar, tudo volta ao texto "MINC" sozinho, sem quebrar nada.

**Duas travas de segurança a mais** (mesma categoria do problema da v5.0.1): a medição do tamanho da logo para o PDF agora tem limite de tempo (3 s) — sem isso, um navegador que nunca disparasse o evento de carregamento da imagem travaria a geração do documento para sempre, do mesmo jeito que o banco local travava a tela inicial.

## Correção da v5.0.1 — tela de carregamento presa
**Sintoma:** depois de publicar a v5.0.0, a tela ficava travada nas barras cinzas de carregamento, sem nunca abrir o login.
**Causa confirmada** (inspecionei o site ao vivo pelo navegador): o app abre um banco local (IndexedDB) na primeira tela, e a versão anterior nunca liberava essa conexão ao ser substituída. Com uma aba antiga ainda aberta (ou simplesmente uma conexão perdida de uma sessão anterior), a abertura do banco ficava esperando para sempre — sem erro, sem aviso — e a tela nunca saía do esqueleto cinza.
**Correção:**
- O app agora libera a conexão sozinho quando uma versão mais nova pede para abrir o banco (`onversionchange`).
- A abertura do banco tem um limite de 6 s: se não conseguir, o app segue sem o armazenamento local nesta aba, em vez de travar.
- A confirmação da sessão na nuvem também tem limite de tempo (10 s).
- Se, por qualquer outro motivo, a inicialização não terminar em 15 s, o app força a tela de login sozinho.
Testado reproduzindo o travamento real (uma aba antiga com o banco aberto e nunca liberado): antes, carregamento infinito; depois, sai da tela de carregamento em menos de 200 ms.

## Novidades da v5.0 (Fases C e D)
**Documentos arquivados em PDF (versionados)**
- Na etapa *Documento*: **Gerar e arquivar nova versão**. O PDF é montado no aparelho (funciona offline) com os mesmos dados da tela (setor/atividade, materiais, testes, plaqueta, embalagem, fotos reduzidas, assinaturas e numeração de páginas).
- Vai para o Supabase Storage (pasta privada `documentos-peritagem`) como `<processo>/<id>.pdf`, junto de um instantâneo `.json` dos dados. O registro (versão, quem gerou, quando, tamanho, SHA-256, código/revisão do formulário, observação) fica na tabela `process_documents`.
- **Nada é sobrescrito**: cada geração cria a versão seguinte e a anterior vira "Substituída". Só o administrador exclui uma versão (se for a atual, a anterior volta a ser a atual).
- **Ver** e **Baixar** usam link assinado de curta duração; o arquivo baixado leva a versão no nome (`..._v3.pdf`). Offline, a versão fica "Aguardando envio" e sobe sozinha.
- Sem nuvem (modo local), o botão é só "Baixar PDF".

**Usuários pelo administrador (Administração → Usuários)**
- **Novo usuário** por **convite**: a pessoa recebe o e-mail e **define a própria senha**. O administrador nunca vê nem define senha. Alternativa: **Gerar link** para enviar por outro canal.
- Alterar perfil, **bloquear/desbloquear**, **reenviar acesso** (convite ou redefinição de senha) e ver as **últimas ações** (auditoria).
- Tudo passa pela **Edge Function `admin-users`**: a chave de serviço (`service_role`) existe **só** nos segredos da função no Supabase, nunca no navegador nem neste projeto. A função confere o login, exige administrador ativo, restringe a origem ao site do app, impede alterar o próprio perfil e **remover/bloquear o último administrador** (e o banco também tem essa trava).
- Bloqueio vale na hora: o banco recusa qualquer dado a quem está bloqueado e o aparelho cai na tela "Acesso bloqueado".
- Tela **"Defina sua senha"** para quem abre o link do convite; link vencido volta ao login com orientação.
- O administrador deixou de poder editar perfis direto pela API do navegador (política removida): só pela função.

## Configuração obrigatória no Supabase (uma vez)
1. *Authentication → URL Configuration*: **Site URL** = `https://minc-peritagem.netlify.app` e o mesmo endereço em **Redirect URLs**. Sem isso os links de convite não voltam para o app.
2. *Authentication → SMTP*: o envio padrão do Supabase tem limites baixos (confira os atuais). Para uso real configure um **servidor de e-mail próprio**. Enquanto isso, use **Gerar link**.
3. Recomendado: desligar *Allow new users to sign up*; ativar *Leaked password protection* (pode depender do plano).
4. Se mudar o endereço do site (domínio próprio), atualize `SITE_URL`/`ALLOWED_ORIGINS` em `supabase/functions/admin-users/handler.ts` e publique a função de novo.

## Novidades da v4.4 (Fase B: catálogos)
- **Atividades por setor** (Usinagem, Caldeiraria, Mecânica, Pintura, Qualidade), conforme o quadro da engenharia. As atividades genéricas (Desmontagem, Usinar, Acabamento, Recuperação superficial...) saíram.
  - O usuário escolhe o **setor** e só vê as atividades dele; toca para marcar/desmarcar. Um item pode ter atividades de **vários setores**.
  - Cada linha mostra o setor, aceita **detalhe** (obrigatório em "Aplicar Tinta Conforme Observação" e "Fazer Modificação na Peça Conforme Desenho") e pode ser reordenada.
  - Linhas antigas (texto livre) continuam válidas e aparecem como "Sem setor (anterior)".
  - No documento: `SETOR: ATIVIDADE — detalhe`.
- **Serviço externo:** ao marcar a providência, aparece a lista de serviços (múltipla seleção) mais "Outro serviço" com descrição livre e observação por serviço. Os serviços entram no documento.
- **Administração → Catálogos:** o administrador cria, renomeia, reordena, ativa/desativa setores, atividades e serviços externos, e marca "Exige detalhe", **sem republicar o app**. Itens desativados saem da escolha mas continuam nos documentos antigos (cada linha guarda o nome como estava).
- Catálogo guardado no aparelho para uso offline; sem nuvem, vale o catálogo padrão de `catalogo.js`.
- Banco: tabelas `catalog_sectors`, `catalog_activities`, `catalog_external_services` (leitura por membros; escrita só por administrador). Migração 006 em `supabase/schema.sql`. Uma cópia dos dados foi feita antes, no schema `backup_2026_10_06`.

## Novidades da v4.3 (Fase A: ajustes de formulário)
- **Ordem** e **Fluido de trabalho** (antes "Fluido") agora são **opcionais**. A lista mostra o selo "Sem ordem" e o documento mostra "—".
- **Retrofit** saiu das providências. Itens antigos que o usavam mostram a marca "Descontinuada" e o Retrofit pode ser removido com um toque; nada é apagado automaticamente.
- Itens comuns: "Graxa de montagem" foi substituída por **"Elementos de fixação"** (`catalogo.js`).
- **Matéria-prima:** sem "Peso, kg"; a linha ficou **Quantidade | Unidade | Observação (ampla)**. O campo **Código** não tem mais exemplo. Pesos já gravados aparecem como nota e não vão mais ao documento nem ao Excel.
- **Testes:** sentidos **Contra a sede / A favor da sede / Em ambos os sentidos**; "Meio do teste" virou **Tipo de teste** e há um campo **Fluido** (com sugestões dos já usados); "Parâmetros gerais" saiu e só o **Critério de aceitação** permanece, no final da aba. Dados antigos de fluido/norma gerais continuam guardados, mas ocultos.
- Sem mudança no banco de dados nesta fase.

## Novidades da v4.2
**Fase 3 — aderência ao formulário R-MINC-046-DEP-PT**
- Seis providências (Fabricar, Recuperar, Reutilizar, Substituir, Serviço externo, Retrofit), **mais de uma por item**.
- **Atividades em linhas de texto** (como no documento), com atalhos do catálogo, sugestões das já usadas, reordenar e `Enter` para a próxima linha.
- Materiais a comprar com **dimensão e código**; observação por item.
- Cabeçalho do documento: Peritagem Nomus, Revisão, Motivo da revisão, Data, Elaborado por / Aprovado por.
- Dados da plaqueta (tipo, DN, pressão, temperatura, material do corpo e da sede, O.S., TAG, data do reparo).
- Testes com meio, duração, repetições, fluido, norma, critério de aceitação e ensaios adicionais.
- **Documento** no layout do formulário (itens 1…N, depois TESTE, PLACA e EMBALAGEM com o que foi preenchido, rodapé de assinaturas).
- Dados antigos são migrados sozinhos (checkbox de operações viram linhas de atividade).

**Movimento (perfil Corporate, sensação de metal rígido)** — curva única `cubic-bezier(.2,0,0,1)`, 120/240/400 ms, sem quicar.
Entrada de telas, troca de etapa com direção, acordeão de componentes, pulso ao escolher, tremida ao bloquear avanço,
barra de contagem no "Desfazer", diálogos e avisos com saída, indicador de sincronização girando. Respeita "reduzir movimento" do sistema.

**Marca** na barra superior refinada e agora é **botão para a tela inicial**.

## Itens a confirmar pelo responsável (marcados em `catalogo.js`)
- Revisão vigente do formulário (OS 2104 está na Rev. 01; Nomus 3709 na Rev. 00). Foi usada a mais recente.
- Se o texto da embalagem do documento da OS 2104 é mesmo o **Padrão MINC**.
- Se **Serviço externo** e **Retrofit** também pedem "Materiais a comprar" (hoje só Fabricar e Substituir).
- Se o campo **Processo** do app equivale a **Peritagem Nomus** (hoje são campos separados).

## Testes automatizados
492 verificações aprovadas (182 do app local + 90 da Estrutura e do documento + 32 dos subcomponentes + 11 da logo + 105 da nuvem + 51 da função + 14 do salto de versão + 7 do travamento do IndexedDB reproduzido), mais a comparação com os 3 processos reais, regras do banco testadas no projeto e a conferência visual em Chromium (desktop, tablet e celular).
Não substituem o teste em tablet e notebook reais.
