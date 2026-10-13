-- MINC Peritagem v5.14.0 — Lista padronizada de serviços com código do Nomus.
-- APLICADA em 14/10/2026 no projeto minc-peritagem (por etapas, via SQL).
-- Reaproveita a tabela catalog_external_services (leitura: membros; escrita: só administrador) e acrescenta a coluna "codigo".

alter table public.catalog_external_services add column if not exists codigo text check (char_length(codigo) <= 60);
-- um código do Nomus não se repete
create unique index if not exists catalog_external_services_codigo_uq on public.catalog_external_services (lower(codigo)) where codigo is not null and codigo <> '';

-- cadastro inicial (lista enviada pela engenharia; o REVESTIMENTO veio repetido e entra uma vez só)
update public.catalog_external_services
   set name = 'SERVIÇO DE TRATAMENTO TÉRMICO', codigo = '09.1.0002', position = 2, active = true
 where name = 'Serviço de Tratamento Térmico';

insert into public.catalog_external_services (name, codigo, position, active) values
  ('SERVIÇO DE TRATAMENTO DE SUPERFÍCIE', '09.1.0011', 1, true),
  ('SERVIÇO DE BRUNIMENTO',               '09.19.069', 3, true),
  ('SERVIÇO DE REVESTIMENTO',             '09.1.0004', 4, true),
  ('SERVIÇO DE CALANDRAGEM DE CHAPA',     '09.1.0009', 5, true),
  ('SERVIÇO DE CORTE DE CHAPA',           '09.1.0003', 6, true)
on conflict do nothing;

-- o exemplo antigo "Serviço de Recuperação" ficou desativado e sem uso (o administrador pode excluí-lo na tela)
update public.catalog_external_services set position = 99 where name = 'Serviço de Recuperação';
