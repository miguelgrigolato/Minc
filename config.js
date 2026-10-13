/* Configuração do Supabase (projeto "minc-peritagem", região São Paulo).
   A chave "publishable" é PÚBLICA por desenho: quem protege os dados são as regras RLS do banco
   (só usuários aprovados leem/gravam). NUNCA coloque aqui a chave "service_role" nem a senha do banco.
   Para voltar ao modo local (sem nuvem), apague os dois valores abaixo. */
window.MINC_CONFIG = {
  supabaseUrl: 'https://oufqazvkalpgsdeaihyd.supabase.co',
  supabaseKey: 'sb_publishable_igkTHcKb551js5D_FsT_SQ_W1Tbl-oZ'
};
