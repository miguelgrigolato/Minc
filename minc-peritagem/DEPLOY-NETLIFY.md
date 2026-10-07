# Publicar o app no Netlify (plano gratuito) ligado ao Supabase

**Como as peças se encaixam:** o Netlify só guarda os arquivos do app (site estático). Os dados e as fotos ficam no
Supabase. O navegador de cada aparelho conversa direto com o Supabase, então o Netlify não vê nenhum dado.
O app instalado (PWA) continua funcionando offline e sincroniza quando a internet volta.

## 1) O que o plano gratuito oferece hoje (confira antes de decidir)
- O plano Free funciona por **créditos**: 300 por mês, limite rígido. Quando acabam, o site é pausado.
  Um *deploy* de produção custa 15 créditos e a banda custa algo entre 10 e 20 créditos por GB (as fontes divergem).
- Contas criadas antes de 04/09/2025 podem estar no modelo antigo (100 GB de banda, 300 min de build).
- **Para este app o consumo é mínimo:** ~0,7 MB na primeira abertura de cada aparelho; depois tudo vem do cache do aparelho.
  Publique de forma deliberada (junte as mudanças em um deploy só) para não gastar créditos à toa.
- Se o site for pausado, quem já tem o app instalado **continua usando e sincronizando** (a sincronização vai direto ao Supabase).
  Só ficam afetadas novas instalações e atualizações.
- Valores mudam: confirme em https://www.netlify.com/pricing/. Alternativas gratuitas que aceitam esta mesma pasta
  sem alteração: **Cloudflare Pages** e **GitHub Pages** (o arquivo `_headers` também funciona no Cloudflare Pages).

## 2) Caminho A — arrastar a pasta (mais rápido, ~5 minutos)
1. Entre em https://app.netlify.com (crie a conta com o e-mail da empresa, se ainda não tiver).
2. Abra https://app.netlify.com/drop e **arraste a pasta `public`** (a pasta, não o zip).
3. O Netlify devolve um endereço como `https://nome-aleatorio.netlify.app`.
4. Renomeie: *Site configuration → Change site name* (ex.: `minc-peritagem` → `https://minc-peritagem.netlify.app`).
5. Para atualizar depois: *Deploys* → arraste a nova pasta `public` de novo.

## 3) Caminho B — GitHub + publicação automática (recomendado para o dia a dia)
1. Crie um repositório (privado) no GitHub e envie o conteúdo desta pasta (inclui `netlify.toml`).
2. No Netlify: *Add new site → Import an existing project → GitHub* e escolha o repositório.
3. Em *Build settings*: **Build command: vazio** · **Publish directory: `public`** (já vem do `netlify.toml`).
4. Cada `git push` na branch principal publica sozinho. Cada publicação consome 15 créditos: agrupe as mudanças.

## 4) Configurar o Supabase para o novo endereço
No painel do projeto **minc-peritagem**: *Authentication → URL Configuration*
- **Site URL:** `https://SEU-SITE.netlify.app`
- **Redirect URLs:** adicione o mesmo endereço.
Isso não afeta o login por e-mail e senha, mas é necessário para e-mails de recuperação de senha funcionarem corretamente.
O arquivo `public/config.js` já contém a URL e a chave pública do projeto; não precisa mudar nada.

## 5) Instalar nos aparelhos
- **Tablet/notebook com Chrome ou Edge:** abra o endereço → ícone de instalar na barra → *Instalar*.
- **iPad/iPhone (Safari):** *Compartilhar → Adicionar à Tela de Início*.
- Entre uma vez **com internet** em cada aparelho. Depois disso o app funciona offline.

## 6) Checklist de teste (faça com 2 aparelhos)
1. Login com seu e-mail; a pílula da barra mostra *Sincronizado*.
2. Crie um processo com uma foto; no segundo aparelho ele aparece depois de alguns segundos.
3. Desligue a internet, edite, volte a internet: a pílula passa por *Offline, 1 pendente* e volta a *Sincronizado*.
4. Edite o mesmo processo nos dois aparelhos sem sincronizar: o app deve avisar *Conflito* e perguntar qual versão manter.
5. Abra o console (F12) e veja se há avisos de **CSP** (veja o item 7).

## 7) Segurança (o que é público e o que não é)
- **Público por desenho:** o endereço do site e a chave *publishable* do `config.js`. Quem protege os dados são as regras RLS do banco:
  só usuários aprovados leem e gravam.
- **Nunca coloque no app:** a chave `service_role` e a senha do banco.
- Em *Authentication → Sign In / Providers → Email*, **desligue "Allow new users to sign up"**. Usuários novos são criados por você
  no painel (*Authentication → Users → Add user*) e liberados em *Conta → Administração* dentro do app.
- `public/_headers` já envia: cabeçalhos de segurança, bloqueio de indexação (o app não aparece no Google) e cache correto.
  A **CSP está em modo relatório** (não bloqueia nada). Depois do checklist acima, sem avisos no console, troque
  `Content-Security-Policy-Report-Only` por `Content-Security-Policy` no `_headers` e publique.
- Domínio próprio (opcional, ex.: `peritagem.suaempresa.com.br`): *Domain management → Add a domain*. Exige criar um registro CNAME no DNS da
  empresa (peça à TI). O HTTPS é automático.

## 8) Atualizações e problemas comuns
| Situação | O que fazer |
|---|---|
| Publiquei uma versão nova | Os aparelhos recebem sozinhos; aparece o aviso *Nova versão instalada → Recarregar* |
| Troquei algo em `fonts/`, `icons/` ou `vendor/` | Aumente `VERSION` em `service-worker.js` para forçar o novo cache |
| Tela branca | Verifique se a pasta `public` inteira foi enviada (fonts, icons, vendor, config.js, catalogo.js) |
| "Sem conexão" ao entrar | O 1º login em cada aparelho precisa de internet; confirme que abriu por `https://` |
| Quero editar listas (atividades, providências, embalagem padrão, revisão do formulário) | Edite `public/catalogo.js` e publique |


## 9) Antes de cada publicação (v5.0)
1. Rode `python3 scripts/verificar-segredos.py`. Ele falha se houver chave **secreta** do Supabase dentro de `public/`. (Chaves públicas são aceitas.)
2. Publique a pasta `public` (arrastar o zip do site, ou `git push`). Cada deploy consome créditos no plano gratuito: junte as mudanças.
3. A função de usuários (`supabase/functions/admin-users`) **não** vai para o Netlify: ela roda no Supabase e já está publicada. Só republique se mudar o código dela.

## 10) Convites de usuários: configuração no Supabase (uma vez)
- *Authentication → URL Configuration*: **Site URL** e **Redirect URLs** = `https://minc-peritagem.netlify.app`.
- *Authentication → SMTP*: configure um servidor de e-mail próprio para uso real (o envio padrão tem limites baixos; confira os atuais). Sem SMTP use "Gerar link" na tela de usuários.
- Teste: cadastre um e-mail seu em *Administração → Usuários → Novo usuário*, abra o link recebido, defina a senha e entre.
- Problemas comuns: o link abre no endereço errado → revise *Site URL*/*Redirect URLs*; "Limite de e-mails atingido" → SMTP próprio ou "Gerar link"; link vencido → "Reenviar acesso".
