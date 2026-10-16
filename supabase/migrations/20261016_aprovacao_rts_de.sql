-- MINC ServiceHub v5.29.0 — aprovação de RTS e D.E. validada no servidor + auditoria
-- Aditiva e segura: não apaga nem altera linhas existentes. Troca apenas a função do gatilho do RTS e cria o da D.E.
-- Quem aprova passa a ser uma lista de IDs de usuário (public.doc_approvers), e não o papel "gestor".

-- 1. Aprovadores (por ID interno do usuário). Sem política de escrita: só o administrador do banco altera.
create table if not exists public.doc_approvers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.doc_approvers enable row level security;
drop policy if exists "aprovadores: ver" on public.doc_approvers;
create policy "aprovadores: ver" on public.doc_approvers for select using ((select private.is_member()));

-- Alcenir Valente e Rogerio Gomes (conferidos em public.profiles)
insert into public.doc_approvers (user_id, note) values
  ('a315cc93-a3d8-419d-a7f2-5ed006967811', 'Alcenir Valente'),
  ('5069f2e2-28c2-48c9-9cc9-effb09371a4a', 'Rogerio Gomes')
on conflict (user_id) do nothing;

create or replace function private.can_approve() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.doc_approvers a join public.profiles p on p.id = a.user_id
    where a.user_id = (select auth.uid()) and p.status = 'ativo' and p.role in ('admin','gestor','operador'))
$$;
grant execute on function private.can_approve() to authenticated;

create or replace function private.actor_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select name from public.profiles where id = (select auth.uid())), '')
$$;
grant execute on function private.actor_name() to authenticated;

-- 2. Histórico de auditoria (somente leitura para o app; gravado só pelos gatilhos)
create table if not exists public.doc_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('rts','de','custo')),
  doc_id text not null,
  doc_ref text,
  action text not null,
  actor_id uuid,
  actor_name text,
  from_state text,
  to_state text,
  details jsonb
);
create index if not exists doc_audit_doc on public.doc_audit (kind, doc_id, at);
alter table public.doc_audit enable row level security;
drop policy if exists "auditoria: ver" on public.doc_audit;
create policy "auditoria: ver" on public.doc_audit for select using ((select private.is_member()));

create or replace function private.audit(p_kind text, p_id text, p_ref text, p_action text, p_from text, p_to text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.doc_audit (kind, doc_id, doc_ref, action, actor_id, actor_name, from_state, to_state, details)
  values (p_kind, p_id, p_ref, p_action, (select auth.uid()), private.actor_name(), p_from, p_to, p_details)
$$;
revoke all on function private.audit(text,text,text,text,text,text,jsonb) from public, anon, authenticated;

-- 3. RTS: o servidor decide quem aprova, carimba quem/quando e congela o aprovado
create or replace function private.rts_valid(r public.rts_documents) returns void
language plpgsql stable set search_path = '' as $$
begin
  if btrim(coalesce(r.numero,'')) = '' or btrim(coalesce(r.cliente,'')) = '' or btrim(coalesce(r.produto,'')) = ''
     or btrim(coalesce(r.data->>'objetivo','')) = '' then
    raise exception 'RTS incompleto: preencha proposta nº, cliente, produto e objetivo.' using errcode = '23514';
  end if;
  if jsonb_array_length(coalesce(r.data->'pos','[]'::jsonb)) = 0 and jsonb_array_length(coalesce(r.data->'geral'->'etapas','[]'::jsonb)) = 0 then
    raise exception 'RTS incompleto: o escopo está vazio.' using errcode = '23514';
  end if;
end $$;

create or replace function public.rts_guard_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  nm text := private.actor_name();
  ok boolean := private.can_approve();
  ts text := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  st_old text := case when tg_op = 'UPDATE' then old.status else null end;
  keep jsonb;
begin
  if uid is null then return new; end if;   -- conexão administrativa (sem usuário do app)
  if new.status not in ('Rascunho','Aguardando aprovação','Aprovado') then
    raise exception 'Situação inválida do RTS.' using errcode = '22023';
  end if;
  new.data := coalesce(new.data, '{}'::jsonb);

  if st_old = 'Aprovado' and new.status = 'Aprovado' then
    -- aprovado fica congelado: qualquer mudança de conteúdo exige reabrir (ação registrada)
    if (new.data - 'updatedAt' - 'updatedBy' - 'deletedAt' - 'aprovadoPor' - 'aprovadoPorId' - 'aprovadoEm')
         is distinct from (old.data - 'updatedAt' - 'updatedBy' - 'deletedAt' - 'aprovadoPor' - 'aprovadoPorId' - 'aprovadoEm')
       or new.numero is distinct from old.numero or new.cliente is distinct from old.cliente or new.produto is distinct from old.produto then
      raise exception 'RTS aprovado não pode ser alterado: reabra para edição.' using errcode = '42501';
    end if;
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into keep from jsonb_each(old.data) where key in ('aprovadoPor','aprovadoPorId','aprovadoEm');
    new.data := (new.data - 'aprovadoPor' - 'aprovadoPorId' - 'aprovadoEm') || keep;   -- o carimbo é do servidor
  elsif new.status = 'Aprovado' then
    if not ok then raise exception 'Só quem tem permissão de aprovação (Alcenir ou Rogério) aprova um RTS.' using errcode = '42501'; end if;
    perform private.rts_valid(new);
    new.data := new.data || jsonb_build_object('aprovadoPor', nm, 'aprovadoPorId', uid, 'aprovadoEm', ts, 'motivoDevolucao', '');
  elsif st_old = 'Aprovado' then
    if not ok then raise exception 'Só quem aprova pode reabrir um RTS aprovado.' using errcode = '42501'; end if;
    new.data := new.data || jsonb_build_object('aprovadoPor', '', 'aprovadoPorId', '', 'aprovadoEm', '');
  end if;

  if new.status = 'Aguardando aprovação' and st_old is distinct from 'Aguardando aprovação' then
    perform private.rts_valid(new);
    new.data := new.data || jsonb_build_object('enviadoPor', nm, 'enviadoPorId', uid, 'enviadoEm', ts);
  end if;
  if st_old = 'Aguardando aprovação' and new.status = 'Rascunho' and ok and nm <> coalesce(old.data->>'enviadoPor','') then
    if btrim(coalesce(new.data->>'motivoDevolucao','')) = '' then
      raise exception 'Informe o motivo da reprovação.' using errcode = '23514';
    end if;
    new.data := new.data || jsonb_build_object('devolvidoPor', nm, 'devolvidoPorId', uid, 'devolvidoEm', ts);
  end if;
  return new;
end $$;

create or replace function public.rts_audit_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  if tg_op = 'INSERT' then
    perform private.audit('rts', new.id, new.numero, 'criado', null, new.status, null);
    if new.status = 'Aprovado' then perform private.audit('rts', new.id, new.numero, 'aprovado', null, new.status, null); end if;
    return new;
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    perform private.audit('rts', new.id, new.numero, case when new.deleted_at is null then 'restaurado' else 'excluido' end, old.status, new.status, null);
  end if;
  if new.status is distinct from old.status then
    a := case
      when new.status = 'Aguardando aprovação' then 'enviado'
      when new.status = 'Aprovado' then 'aprovado'
      when old.status = 'Aprovado' then 'reaberto'
      when old.status = 'Aguardando aprovação' and coalesce(new.data->>'devolvidoEm','') <> '' and new.data->>'devolvidoEm' > coalesce(old.data->>'enviadoEm','') then 'reprovado'
      else 'envio_cancelado' end;
    perform private.audit('rts', new.id, new.numero, a, old.status, new.status,
      case when a = 'reprovado' then jsonb_build_object('motivo', new.data->>'motivoDevolucao') else null end);
  end if;
  return new;
end $$;

drop trigger if exists rts_documents_guard on public.rts_documents;
create trigger rts_documents_guard before insert or update on public.rts_documents
  for each row execute function public.rts_guard_approval();
drop trigger if exists rts_documents_audit on public.rts_documents;
create trigger rts_documents_audit after insert or update on public.rts_documents
  for each row execute function public.rts_audit_log();

-- 4. D.E. (tabela processes): estado de aprovação em data->'aprovacao' (nenhum | aguardando | aprovado | reprovado)
create or replace function public.de_guard_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  nm text := private.actor_name();
  ok boolean := private.can_approve();
  ts text := to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  oap jsonb := case when tg_op = 'UPDATE' then coalesce(old.data->'aprovacao', '{}'::jsonb) else '{}'::jsonb end;
  nap jsonb := coalesce(new.data->'aprovacao', '{}'::jsonb);
  eo text := coalesce(oap->>'estado', 'nenhum');
  en text := coalesce(nap->>'estado', 'nenhum');
  ign text[] := array['aprovacao','updatedAt','updatedBy','deletedAt','status','aprovadoPor','aprovadoData'];
  base jsonb;
  edited boolean := false;
begin
  if uid is null then return new; end if;
  if en not in ('nenhum','aguardando','aprovado','reprovado') then raise exception 'Situação de aprovação inválida.' using errcode = '22023'; end if;
  new.data := coalesce(new.data, '{}'::jsonb);

  if en = eo then
    if en = 'aprovado' and tg_op = 'UPDATE' then
      if (new.data - ign) is distinct from (old.data - ign) then
        edited := true;
      end if;
    end if;
    if edited then
      -- editar uma D.E. aprovada derruba a aprovação, de forma visível e registrada (não é silencioso)
      new.data := jsonb_set(new.data, '{aprovacao}', oap || jsonb_build_object('estado','nenhum','invalidadaPor',nm,'invalidadaPorId',uid,'invalidadaEm',ts,'aprovadoAnteriorPor',oap->>'aprovadoPor','aprovadoAnteriorEm',oap->>'aprovadoEm'))
                 || jsonb_build_object('aprovadoPor','','aprovadoData','');
    else
      new.data := jsonb_set(new.data, '{aprovacao}', oap);   -- carimbos só o servidor escreve
      if en = 'aprovado' then new.data := new.data || jsonb_build_object('aprovadoPor', coalesce(old.data->>'aprovadoPor',''), 'aprovadoData', coalesce(old.data->>'aprovadoData','')); end if;
    end if;
    return new;
  end if;

  base := oap;
  if en = 'aguardando' then
    if eo = 'aprovado' then raise exception 'Reabra a D.E. aprovada antes de enviar de novo.' using errcode = '42501'; end if;
    if btrim(coalesce(new.equipamento,'')) = '' then raise exception 'D.E. incompleta: informe o equipamento.' using errcode = '23514'; end if;
    base := base || jsonb_build_object('estado','aguardando','enviadoPor',nm,'enviadoPorId',uid,'enviadoEm',ts);
  elsif en = 'aprovado' then
    if not ok then raise exception 'Só quem tem permissão de aprovação (Alcenir ou Rogério) aprova uma D.E.' using errcode = '42501'; end if;
    if btrim(coalesce(new.equipamento,'')) = '' then raise exception 'D.E. incompleta: informe o equipamento.' using errcode = '23514'; end if;
    base := base || jsonb_build_object('estado','aprovado','aprovadoPor',nm,'aprovadoPorId',uid,'aprovadoEm',ts,'motivo','');
    new.data := new.data || jsonb_build_object('aprovadoPor', nm, 'aprovadoData', to_char(clock_timestamp() at time zone 'America/Sao_Paulo','YYYY-MM-DD'));
  elsif en = 'reprovado' then
    if not ok then raise exception 'Só quem tem permissão de aprovação (Alcenir ou Rogério) reprova uma D.E.' using errcode = '42501'; end if;
    if btrim(coalesce(nap->>'motivo','')) = '' then raise exception 'Informe o motivo da reprovação.' using errcode = '23514'; end if;
    base := base || jsonb_build_object('estado','reprovado','reprovadoPor',nm,'reprovadoPorId',uid,'reprovadoEm',ts,'motivo',nap->>'motivo');
    if eo = 'aprovado' then new.data := new.data || jsonb_build_object('aprovadoPor','','aprovadoData',''); end if;
  else  -- volta a "nenhum": cancelar envio / retomar após reprovação / reabrir aprovada
    if eo = 'aprovado' then
      if not ok then raise exception 'Só quem aprova pode reabrir uma D.E. aprovada.' using errcode = '42501'; end if;
      new.data := new.data || jsonb_build_object('aprovadoPor','','aprovadoData','');
    end if;
    base := base || jsonb_build_object('estado','nenhum');
  end if;
  new.data := jsonb_set(new.data, '{aprovacao}', base);
  return new;
end $$;

create or replace function public.de_audit_log() returns trigger
language plpgsql security definer set search_path = '' as $$
declare eo text; en text; a text;
begin
  if tg_op = 'INSERT' then
    perform private.audit('de', new.id, new.process_no, 'criado', null, null, null);
    return new;
  end if;
  eo := coalesce(old.data->'aprovacao'->>'estado','nenhum'); en := coalesce(new.data->'aprovacao'->>'estado','nenhum');
  if new.deleted_at is distinct from old.deleted_at then
    perform private.audit('de', new.id, new.process_no, case when new.deleted_at is null then 'restaurado' else 'excluido' end, eo, en, null);
  end if;
  if en is distinct from eo then
    a := case en when 'aguardando' then 'enviado' when 'aprovado' then 'aprovado' when 'reprovado' then 'reprovado'
         else case when eo = 'aprovado' then (case when coalesce(new.data->'aprovacao'->>'invalidadaEm','') <> coalesce(old.data->'aprovacao'->>'invalidadaEm','') then 'aprovacao_invalidada_por_edicao' else 'reaberto' end) else 'envio_cancelado' end end;
    perform private.audit('de', new.id, new.process_no, a, eo, en,
      case when a = 'reprovado' then jsonb_build_object('motivo', new.data->'aprovacao'->>'motivo') else null end);
  end if;
  return new;
end $$;

drop trigger if exists processes_a_guard on public.processes;
create trigger processes_a_guard before insert or update on public.processes
  for each row execute function public.de_guard_approval();
drop trigger if exists processes_z_audit on public.processes;
create trigger processes_z_audit after insert or update on public.processes
  for each row execute function public.de_audit_log();
