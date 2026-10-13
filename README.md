# Minc — Peritagem (v5.11.0)

App web (PWA) de peritagem e recuperação de equipamentos da Indústrias Minc. Sem build: arquivos estáticos
(`index.html`, `app.js`, ...). Dados no Supabase (projeto `minc-peritagem`) com cópia local no aparelho.

## Novidades da v5.11.0
- **Modelos de válvula (projetos)** — Administração > Modelos de válvula (`modelos.js`). Cada modelo guarda as POS/componentes.
  "Novo processo" oferece escolher o modelo: os componentes já entram na aba Componentes. Sem projeto, tudo segue como antes.
- **Checklist de entrega** — na tela "Documento de execução" (e como atalho após gerar o DEP): PDF com as peças que a
  desmontagem entrega à fábrica. O código do formulário fica em `catalogo.js` > `CHECKLIST.codigo` (ainda vazio).
- **RTS (Relatório Técnico de Serviço)** — aba "RTS" no topo (`rts.js`), independente da peritagem. POS com providência,
  atividades padrão (`catalogo.js` > `RTS_BIBLIOTECA`), lista de materiais e PDF no layout R-MINC-060-RTS-PT.

## Banco de dados
A migração `supabase/migrations/20261013_modelos_valvula_e_rts.sql` cria `valve_models` e `rts_documents`
(com RLS iguais às das demais tabelas). **Aplique-a antes de usar os módulos com a nuvem ligada**; sem ela o app
continua funcionando e guarda modelos/RTS só neste aparelho.

## Estrutura dos módulos
`modelos.js` e `rts.js` carregam antes do `app.js` e se registram em `window.MINC_EXT` (`act`, `chg`, `sub`, `inp`, `views`,
`sync`, `boot`); o `app.js` mescla tudo antes do `boot()`.
