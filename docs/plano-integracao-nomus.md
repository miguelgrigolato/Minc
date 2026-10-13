# Plano de ação — integração com o Nomus e evolução do app

Versão de partida: **v5.12.0** (modelos de válvula, checklist de entrega, RTS com aprovação).
Este plano ordena o que fazer, como e em que sequência. O esforço é relativo (P = dias, M = 1–2 semanas, G = mais de 2 semanas).

## 1. Princípios

1. **O navegador nunca fala com o Nomus.** Toda chamada passa por uma função no servidor (Edge Function do Supabase) que guarda a chave como segredo e só atende usuário logado no app.
2. **Ler antes de gravar.** Primeiro consultar o Nomus; escrever só depois, com confirmação do usuário e registro de quem fez.
3. **O app continua funcionando offline.** Dado vindo do Nomus ajuda a preencher, mas o campo segue editável à mão.
4. **Só o administrador mexe em cadastros base** (modelos de válvula, bibliotecas, configuração da integração).
5. **Cada fase entrega algo usável sozinho.** Nenhuma fase depende de a seguinte para ter valor.

## 2. Mapa dos módulos

| # | Módulo | Estado hoje | O que falta |
|---|--------|-------------|-------------|
| A | **Cadastro de válvulas (modelos)** | Pronto: POS, componentes, quantidade; só administrador edita | Código do produto no Nomus, desenho/PDF do projeto anexado, versão do projeto, importar/exportar planilha, "salvar como modelo" a partir de um DEP |
| B | **RTS** | Pronto: escopo por POS, observações, anexos com imagens, aprovação pelo administrador, PDF | Vínculo com a proposta do Nomus, vínculo com o processo, arquivar versões do PDF aprovado na nuvem |
| C | **Processo (DEP)** | Pronto: componentes, testes, embalagem, PDF versionado | Aba **RTS** dentro do processo, criar peritagem a partir do RTS, comparação RTS × DEP |
| D | **Lista de materiais** | RTS tem anexo de materiais; DEP tem "materiais a comprar" | Exportar e importar planilha, lista consolidada, conferência de código no Nomus |
| E | **Checklist de entrega** | Pronto (PDF) | Arquivar na nuvem, assinatura na tela, registro de divergência |
| F | **Databook** | Não existe | PDF único com fases, fotos, testes, checklist, certificados anexados |
| G | **Acompanhamento** | Não existe | Etapas por pedido, prazo correndo, histórico por TAG/nº de série |
| H | **Integração Nomus** | Não existe | Edge Function, configuração, consultas, depois gravações |
| I | **Administração** | Usuários e catálogos de atividades | Editar biblioteca de atividades/observações do RTS pelo app, avisos ao aprovador |

## 3. Fases

### Fase 0 — Preparação (P)
- Aplicar a migração `20261013_modelos_valvula_e_rts.sql` no Supabase e publicar a v5.12.0 no Netlify.
- Reunir: documentação da API do Nomus, chave de teste (ou de produção só leitura), lista dos módulos usados (propostas, pedidos, OS, produtos, lista de materiais).
- Definir com a engenharia quais campos do Nomus mandam (cliente, código do produto, número do pedido/OS).
- **Pronto quando:** modelos e RTS aparecem em todos os aparelhos e a documentação do Nomus está em mãos.

### Fase 1 — RTS dentro do processo, sem Nomus (M)
- Campo `rtsId` no processo e **aba "RTS"** dentro da peritagem: mostra o RTS vinculado (número, status, aprovado por), abre o PDF e permite vincular/desvincular.
- Botão **"Criar peritagem a partir do RTS"**: cliente, equipamento, POS e quantidades entram prontos (reaproveita o carregamento de modelo que já existe).
- **Comparação RTS × DEP** ao fechar o DEP: lista POS cuja providência mudou ("no RTS era Reutilizar, na peritagem virou Substituir") e itens que apareceram ou sumiram. Serve de base para revisar a proposta ou emitir aditivo.
- **"Salvar como modelo"** (só administrador) no DEP de uma válvula sem projeto: o banco de modelos cresce com o uso.
- **Pronto quando:** abrir um RTS aprovado e gerar a peritagem dele em poucos toques; ver as divergências ao final.

### Fase 2 — Exportar e importar lista de materiais (M)
- **Exportar** (XLSX e CSV): lista do RTS, lista do DEP ("materiais a comprar") e consolidada por processo, com colunas combinadas com o Nomus (a confirmar: código, descrição, unidade, quantidade, POS, origem).
- **Importar** planilha com **prévia antes de gravar** ("serão criados 12 itens, 3 já existem, 2 com erro"): materiais do RTS, componentes de um modelo de válvula, lista de POS.
- Modelo de planilha para baixar, com instruções na primeira aba.
- Funciona com ou sem API. Se a API do Nomus aceitar a importação depois, a mesma planilha vira o envio.
- **Pronto quando:** a engenharia consegue montar um modelo de válvula novo colando uma planilha e exportar a lista de compras de um RTS aprovado.

### Fase 3 — Nomus: leitura (M)
- **Edge Function** `nomus-proxy` no Supabase: guarda a chave, exige usuário logado, só permite as consultas previstas (lista fixa), limita taxa e registra cada chamada.
- Tela de administração "Integração Nomus": URL, estado da conexão, botão de teste (a chave fica no segredo do servidor, não na tela).
- Consultas:
  1. **Proposta/pedido → RTS** (cliente, produto, código, quantidade) ao digitar o número da proposta.
  2. **Peritagem/OS/pedido → processo** (campos "Peritagem Nomus", pedido, ordem, cliente).
  3. **Código de componente e matéria-prima**: busca por nome ou código nos campos que já existem na estrutura do DEP; a caixa "Não tem cadastro" continua valendo.
  4. **Conferência da lista de materiais**: marca no app o que já existe no Nomus.
- Cache local para funcionar offline e para não depender da velocidade do Nomus.
- **Pronto quando:** digitar o número de uma proposta preenche o RTS; o código de um item é encontrado pelo nome.

### Fase 4 — Nomus: gravação (G, opcional e só depois da fase 3 estável)
- Criar item sem cadastro, enviar lista de materiais aprovada, anexar o PDF aprovado ao pedido, atualizar status.
- Regras: sempre com confirmação, **modo simulação** que mostra o que seria enviado, identificador único para não duplicar, registro de quem enviou e quando, possibilidade de tentar de novo sem duplicar.
- **Pronto quando:** um envio de teste cria exatamente uma vez o que deveria, e o erro de rede não gera duplicidade.

### Fase 5 — Acompanhamento e entregas finais (G, em partes)
- **Databook automático**: DEP + fotos + testes + checklist + certificados anexados, em um PDF com capa e sumário.
- **Painel de etapas e prazos**: recebida → peritagem → aprovada pelo cliente → fabricação → teste → expedida; alerta de prazo.
- **Histórico por TAG/nº de série**: peritagens e RTS anteriores da mesma válvula.
- **Checklist de entrega**: assinatura na tela e PDF arquivado na nuvem.
- **Avisos**: e-mail ou notificação para o aprovador quando houver RTS pendente.
- **Administração**: editar biblioteca de atividades e observações do RTS pelo app.

## 4. Ordem recomendada

`Fase 0 → Fase 1 → Fase 2 → Fase 3 → (Fase 4 se fizer sentido) → Fase 5 em partes`

As fases 1 e 2 não dependem do Nomus e já tiram retrabalho. A fase 3 só começa quando a documentação e a chave de teste chegarem; se atrasarem, as fases 1 e 2 seguem sem bloqueio.

## 5. Riscos e como reduzir

| Risco | Como reduzir |
|-------|--------------|
| API sem documentação clara ou com limites de uso | Pedir a documentação na fase 0; começar por uma única consulta; cache e limite de taxa |
| Chave do Nomus exposta | Só no segredo da Edge Function; nunca no site nem em conversa; chave de teste/leitura primeiro |
| Duplicar cadastro ao gravar | Leitura primeiro; escrita com simulação, identificador único e confirmação |
| Nomus fora do ar ou lento | App continua offline; dado do Nomus é ajuda, não obrigação |
| Layout da planilha mudar | Modelo de planilha versionado e prévia antes de importar |
| Conflito de edição entre usuários | Já existe controle de revisão; manter nas tabelas novas |
| Permissões | Administrador para cadastros base e aprovação; regras também no banco, não só na tela |

## 6. Decisões pendentes

1. Documentação da API do Nomus e uma chave de teste.
2. Qual dor primeiro na fase 3: número do pedido/proposta, código dos itens ou lista de materiais?
3. A peritagem acontece sempre depois do RTS aprovado, ou às vezes o RTS é feito depois?
4. O administrador pode aprovar o próprio RTS, ou a aprovação deve ser sempre de outra pessoa?
5. Quem cadastra modelo de válvula e quem pode usar "Salvar como modelo": só o administrador?
6. Formato da planilha de lista de materiais que o Nomus importa (modelo atual de vocês).
