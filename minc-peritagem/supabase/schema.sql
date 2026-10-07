-- =====================================================================
-- MINC · Peritagem — esquema do Supabase (JÁ APLICADO no projeto "minc-peritagem")
-- Este arquivo é a documentação/backup do que foi executado (migrações 001 a 008).
-- Só rode de novo em um projeto NOVO e vazio.
-- =====================================================================

-- 1) Perfis. Quem se cadastra entra como 'pendente' e NÃO acessa dados até um admin aprovar.
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text,
  role       text not null default 'pendente' check (role in ('admin','operador','pendente')),
  created_at timestamptz not null default now()
);

-- Funções de permissão ficam em schema privado (não expostas pela API).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
$$;
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','operador'))
$$;
revoke execute on function private.is_admin(), private.is_member() from public, anon;
grant  execute on function private.is_admin(), private.is_member() to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Processos. id é TEXT: o app gera o id no aparelho (permite criar offline).
create table public.processes (
  id          text primary key,
  process_no  text,
  pedido      text,
  ordem       text,
  equipamento text,
  cliente     text,
  status      text not null default 'Rascunho' check (status in ('Rascunho','Em execução','Concluído')),
  data        jsonb not null default '{}'::jsonb,   -- componentes, testes, embalagem, observações...
  rev         integer not null default 1,           -- sobe a cada gravação; detecta edição concorrente
  created_by  uuid default auth.uid() references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                            -- exclusão lógica (permite desfazer e propagar a exclusão)
);
create index processes_updated_idx    on public.processes (updated_at);
create index processes_cliente_idx    on public.processes (cliente);
create index processes_created_by_idx on public.processes (created_by);

create or replace function public.touch_process() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.rev := old.rev + 1;
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger processes_touch before update on public.processes
  for each row execute function public.touch_process();

-- 3) Fotos e anexos: arquivo no Storage (bucket privado), registro aqui.
--    Desde a v5.5.0 o caminho é <pasta do processo>/fotos|anexos/<id>.<ext>, onde a pasta é Processo_Pedido_Equipamento_Cliente
--    (guardada em processes.data->>'pasta'). Documentos: <pasta>/documentos/<id>.pdf|json. Arquivos antigos ficam em <id do processo>/.
create table public.photos (
  id           text primary key,
  process_id   text not null references public.processes(id) on delete cascade,
  component_id text,                                  -- null = foto do equipamento
  storage_path text not null,                         -- <pasta>/fotos/<id>.jpg ou <pasta>/anexos/<id>.<ext> (antigas: <id do processo>/<id>.jpg)
  name         text,
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);
create index photos_process_idx    on public.photos (process_id);
create index photos_created_by_idx on public.photos (created_by);

insert into storage.buckets (id, name, public) values ('peritagem-fotos', 'peritagem-fotos', false)
on conflict (id) do nothing;

-- 4) Lista de materiais consolidada (compras / Excel / BI). item_no segue a numeração do app.
--    Entende providências múltiplas ("acoes") e dados antigos (só "action"). Migração 005.
create or replace view public.v_materiais with (security_invoker = true) as
select p.id as process_id, p.process_no, p.equipamento, p.cliente,
       (jsonb_array_length(p.data->'components') - c.idx + 1) as item_no,
       c.comp->>'name'    as componente,
       c.comp->>'drawing' as desenho,
       m->>'raw'          as materia_prima,
       m->>'material'     as material,
       m->>'unit'         as unidade,
       case when replace(m->>'qty', ',', '.') ~ '^[0-9]+(\.[0-9]+)?$' then replace(m->>'qty', ',', '.')::numeric end as quantidade,
       m->>'obs'          as observacao,
       m->>'dimensao'     as dimensao,
       m->>'codigo'       as codigo,
       m->>'peso'         as peso,
       coalesce(c.comp->'acoes', jsonb_build_array(c.comp->>'action')) as providencias
from public.processes p
cross join lateral jsonb_array_elements(p.data->'components') with ordinality as c(comp, idx)
cross join lateral jsonb_array_elements(coalesce(c.comp->'materials', '[]'::jsonb)) as m
where p.deleted_at is null
  and coalesce(c.comp->'acoes', jsonb_build_array(c.comp->>'action')) ?| array['Fabricar','Substituir'];

-- 5) Segurança por linha (RLS)
alter table public.profiles  enable row level security;
alter table public.processes enable row level security;
alter table public.photos    enable row level security;

create policy "perfil: ver" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_member()));
create policy "perfil: admin altera" on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "processo: ver" on public.processes for select to authenticated
  using ((select private.is_member()));
create policy "processo: criar" on public.processes for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "processo: editar" on public.processes for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "processo: excluir de vez" on public.processes for delete to authenticated
  using ((select private.is_admin()));

create policy "foto: ver" on public.photos for select to authenticated using ((select private.is_member()));
create policy "foto: criar" on public.photos for insert to authenticated with check ((select private.is_member()));
create policy "foto: excluir" on public.photos for delete to authenticated using ((select private.is_member()));

create policy "storage: ver fotos" on storage.objects for select to authenticated
  using (bucket_id = 'peritagem-fotos' and (select private.is_member()));
create policy "storage: enviar fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'peritagem-fotos' and (select private.is_member()));
create policy "storage: apagar fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'peritagem-fotos' and (select private.is_member()));

-- 6) PRIMEIRO ADMIN (rode depois de criar o usuário em Authentication > Users):
-- update public.profiles set role = 'admin' where email = 'SEU@EMAIL.COM';


-- 7) CATÁLOGOS (migração 006, Fase B) -----------------------------------
--    Setores, atividades e serviços externos editáveis pelo administrador. Não se apaga item em uso: desativa-se.
create table public.catalog_sectors (
  id uuid primary key default gen_random_uuid(), name text not null unique, position integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.catalog_activities (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.catalog_sectors(id) on delete restrict,
  name text not null, position integer not null default 0,
  requires_detail boolean not null default false,          -- a linha da atividade exige texto complementar
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (sector_id, name));
create index catalog_activities_sector_idx on public.catalog_activities (sector_id);
create table public.catalog_external_services (
  id uuid primary key default gen_random_uuid(), name text not null unique, position integer not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create or replace function public.touch_catalog() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger catalog_sectors_touch  before update on public.catalog_sectors           for each row execute function public.touch_catalog();
create trigger catalog_activ_touch    before update on public.catalog_activities        for each row execute function public.touch_catalog();
create trigger catalog_services_touch before update on public.catalog_external_services for each row execute function public.touch_catalog();

alter table public.catalog_sectors enable row level security;
alter table public.catalog_activities enable row level security;
alter table public.catalog_external_services enable row level security;
-- leitura: membros; escrita: só administrador (4 políticas por tabela: ver, criar, editar, excluir)
create policy "setores: ver"     on public.catalog_sectors for select to authenticated using ((select private.is_member()));
create policy "setores: criar"   on public.catalog_sectors for insert to authenticated with check ((select private.is_admin()));
create policy "setores: editar"  on public.catalog_sectors for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "setores: excluir" on public.catalog_sectors for delete to authenticated using ((select private.is_admin()));
create policy "atividades: ver"     on public.catalog_activities for select to authenticated using ((select private.is_member()));
create policy "atividades: criar"   on public.catalog_activities for insert to authenticated with check ((select private.is_admin()));
create policy "atividades: editar"  on public.catalog_activities for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "atividades: excluir" on public.catalog_activities for delete to authenticated using ((select private.is_admin()));
create policy "servicos: ver"     on public.catalog_external_services for select to authenticated using ((select private.is_member()));
create policy "servicos: criar"   on public.catalog_external_services for insert to authenticated with check ((select private.is_admin()));
create policy "servicos: editar"  on public.catalog_external_services for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "servicos: excluir" on public.catalog_external_services for delete to authenticated using ((select private.is_admin()));

-- carga inicial: quadro de setores e atividades definido pela engenharia (igual a SETORES_PADRAO em catalogo.js)
insert into public.catalog_sectors (name, position) values ('Usinagem',1),('Caldeiraria',2),('Mecânica',3),('Pintura',4),('Qualidade',5);
insert into public.catalog_activities (sector_id, name, position, requires_detail)
select s.id, a.name, a.pos, a.req from (values
  ('Usinagem','Normalizar Faces',1,false),('Usinagem','Refazer/Fazer Ranhura',2,false),('Usinagem','Normalizar Furos',3,false),
  ('Usinagem','Fazer Furos',4,false),('Usinagem','Calibrar Rosca',5,false),('Usinagem','Polimento',6,false),
  ('Caldeiraria','Preencher Área com Solda',1,false),('Caldeiraria','Fazer Modificação na Peça Conforme Desenho',2,true),
  ('Mecânica','Montar Produto',1,false),('Mecânica','Lapidar Sede',2,false),
  ('Pintura','Jateamento',1,false),('Pintura','Aplicar Primer N1202',2,false),('Pintura','Aplicar Tinta Conforme Observação',3,true),
  ('Qualidade','Realizar Ensaio de LP',1,false)) as a(sector,name,pos,req)
join public.catalog_sectors s on s.name = a.sector;
insert into public.catalog_external_services (name, position) values ('Serviço de Tratamento Térmico',1),('Serviço de Recuperação',2);


-- 8) DOCUMENTOS ARQUIVADOS (migração 007, Fase C) -------------------------
--    O PDF fica como arquivo no Storage (bucket privado); a tabela guarda o registro e o histórico de versões.
create table public.process_documents (
  id uuid primary key default gen_random_uuid(),
  process_id text not null references public.processes(id) on delete cascade,
  version integer not null,                    -- numerada automaticamente (gatilho)
  is_current boolean not null default true,    -- só uma versão atual por processo
  kind text not null default 'execucao',
  storage_path text not null,                  -- <process_id>/<id>.pdf
  snapshot_path text,                          -- <process_id>/<id>.json (dados do processo naquele momento)
  file_name text not null, size_bytes bigint, sha256 text,
  form_code text, form_rev text, process_rev integer, note text,
  generated_by uuid default auth.uid() references auth.users(id), generated_by_name text,
  generated_at timestamptz not null default now(),
  unique (process_id, version));
create unique index process_documents_one_current on public.process_documents (process_id) where is_current;
create index process_documents_process_idx on public.process_documents (process_id, version desc);
create index process_documents_generated_by_idx on public.process_documents (generated_by);

create or replace function public.assign_document_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.process_id));
  new.version := coalesce((select max(version) from public.process_documents where process_id = new.process_id), 0) + 1;
  new.is_current := true;
  update public.process_documents set is_current = false where process_id = new.process_id and is_current;
  return new;
end $$;
create trigger process_documents_version before insert on public.process_documents for each row execute function public.assign_document_version();
create or replace function public.restore_current_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.is_current then
    update public.process_documents set is_current = true
    where id = (select id from public.process_documents where process_id = old.process_id order by version desc limit 1);
  end if;
  return old;
end $$;
create trigger process_documents_restore after delete on public.process_documents for each row execute function public.restore_current_document();
revoke execute on function public.assign_document_version(), public.restore_current_document() from public, anon, authenticated;

alter table public.process_documents enable row level security;
create policy "documento: ver"     on public.process_documents for select to authenticated using ((select private.is_member()));
create policy "documento: criar"   on public.process_documents for insert to authenticated with check ((select private.is_member()) and generated_by = (select auth.uid()));
create policy "documento: excluir" on public.process_documents for delete to authenticated using ((select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-peritagem', 'documentos-peritagem', false, 26214400, array['application/pdf','application/json']) on conflict (id) do nothing;
create policy "docs storage: ver"    on storage.objects for select to authenticated using (bucket_id = 'documentos-peritagem' and (select private.is_member()));
create policy "docs storage: enviar" on storage.objects for insert to authenticated with check (bucket_id = 'documentos-peritagem' and (select private.is_member()));
create policy "docs storage: apagar" on storage.objects for delete to authenticated using (bucket_id = 'documentos-peritagem' and (select private.is_admin()));

-- 9) USUÁRIOS PELO ADMINISTRADOR (migração 008, Fase D) -----------------
--    Perfis só mudam pela Edge Function "admin-users" (chave de serviço no servidor), nunca direto do navegador.
alter table public.profiles add column status text not null default 'ativo' check (status in ('ativo','bloqueado'));
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin' and status = 'ativo') $$;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','operador') and status = 'ativo') $$;
drop policy if exists "perfil: admin altera" on public.profiles;

create or replace function public.guard_last_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.status = 'ativo' and (new.role <> 'admin' or new.status <> 'ativo') then
    if not exists (select 1 from public.profiles where id <> old.id and role = 'admin' and status = 'ativo') then
      raise exception 'Não é possível remover ou bloquear o último administrador ativo.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_last_admin before update on public.profiles for each row execute function public.guard_last_admin();
revoke execute on function public.guard_last_admin() from public, anon, authenticated;

create table public.admin_audit (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  actor_id uuid, actor_email text, action text not null, target_id uuid, target_email text, details jsonb not null default '{}'::jsonb);
create index admin_audit_at_idx on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
create policy "auditoria: ver" on public.admin_audit for select to authenticated using ((select private.is_admin()));
