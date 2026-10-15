-- JÁ APLICADA em produção (em partes, pelo SQL do painel). v5.18.0 — perfil GESTOR (acesso a tudo, menos Administração de usuários) e histórico de alterações dos processos.

-- 1) perfil "gestor"
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','gestor','operador','pendente'));

create or replace function private.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','gestor') and status = 'ativo') $$;
revoke all on function private.is_manager() from public, anon;
grant execute on function private.is_manager() to authenticated;

create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','gestor','operador') and status = 'ativo') $$;

-- catálogos, modelos, configurações, exclusões definitivas: passam de "só admin" para "admin ou gestor".
-- Só a auditoria de usuários (admin_audit) e a função de usuários continuam exclusivas do administrador.
do $$
declare r record; u text; w text; stmt text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies
           where (coalesce(qual,'') || coalesce(with_check,'')) ilike '%private.is_admin()%' and tablename <> 'admin_audit' loop
    u := replace(r.qual, 'private.is_admin()', 'private.is_manager()');
    w := replace(r.with_check, 'private.is_admin()', 'private.is_manager()');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if u is not null then stmt := stmt || ' using (' || u || ')'; end if;
    if w is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- aprovação de RTS: administrador ou gestor
create or replace function public.rts_guard_approval() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Aprovado' and not private.is_manager() then raise exception 'Só o administrador ou o gestor aprova um RTS.' using errcode = '42501'; end if;
    return new;
  end if;
  if new.status = 'Aprovado' and old.status is distinct from 'Aprovado' and not private.is_manager() then raise exception 'Só o administrador ou o gestor aprova um RTS.' using errcode = '42501'; end if;
  if old.status = 'Aprovado' and new.status = 'Aprovado' and new.data is distinct from old.data and not private.is_manager() then raise exception 'RTS aprovado não pode ser alterado: reabra para edição.' using errcode = '42501'; end if;
  return new;
end $$;
revoke execute on function public.rts_guard_approval() from public, anon, authenticated;

-- 2) histórico de alterações dos processos (quem mudou o quê)
create table if not exists public.process_history (
  id          bigint generated always as identity primary key,
  process_id  text not null,
  rev         integer,
  changed_by  uuid,
  changed_at  timestamptz not null default now(),
  fields      text[] not null default '{}',
  status_from text,
  status_to   text
);
create index if not exists process_history_proc_idx on public.process_history (process_id, changed_at desc);
alter table public.process_history enable row level security;
drop policy if exists "historico: ver" on public.process_history;
create policy "historico: ver" on public.process_history for select to authenticated using ((select private.is_member()));

create or replace function public.log_process_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare f text[] := '{}'; k text;
begin
  if new.process_no is distinct from old.process_no then f := f || 'process'; end if;
  if new.pedido is distinct from old.pedido then f := f || 'pedido'; end if;
  if new.ordem is distinct from old.ordem then f := f || 'ordem'; end if;
  if new.equipamento is distinct from old.equipamento then f := f || 'equipamento'; end if;
  if new.cliente is distinct from old.cliente then f := f || 'cliente'; end if;
  if new.deleted_at is distinct from old.deleted_at then f := f || 'excluido'; end if;
  for k in select coalesce(n.key, o.key) from jsonb_each(coalesce(new.data,'{}'::jsonb)) n
           full join jsonb_each(coalesce(old.data,'{}'::jsonb)) o on n.key = o.key
           where n.value is distinct from o.value
             and coalesce(n.key, o.key) not in ('updatedAt','updatedBy','createdAt','createdBy','id','process','pedido','ordem','equipamento','cliente','status','deletedAt') loop
    f := f || k;
  end loop;
  if array_length(f,1) is null and new.status is not distinct from old.status then return new; end if;
  insert into public.process_history (process_id, rev, changed_by, fields, status_from, status_to)
  values (new.id, new.rev, auth.uid(), f, case when new.status is distinct from old.status then old.status end,
          case when new.status is distinct from old.status then new.status end);
  return new;
end $$;
revoke execute on function public.log_process_change() from public, anon, authenticated;
drop trigger if exists processes_history on public.processes;
create trigger processes_history after update on public.processes for each row execute function public.log_process_change();
