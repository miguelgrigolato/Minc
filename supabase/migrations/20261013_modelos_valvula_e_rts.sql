-- MINC Peritagem v5.11.0 — Banco de modelos de válvula (projetos) e módulo RTS.
-- NÃO aplicada automaticamente. Reaproveita as funções e regras que já existem no projeto:
--   private.is_member()  -> admin ou operador ativo
--   private.is_admin()   -> administrador ativo
--   public.touch_process() -> gatilho que incrementa rev, updated_at e updated_by em todo UPDATE

-- ============================ Modelos de válvula ============================
-- Um modelo = uma válvula com projeto: nome, DN, tipo e a lista de POS/componentes (em data.components).
create table if not exists public.valve_models (
  id          text primary key,
  name        text not null check (char_length(name) <= 200),
  fabricante  text check (char_length(fabricante) <= 200),
  tipo        text check (char_length(tipo) <= 200),
  dn          text check (char_length(dn) <= 50),
  active      boolean not null default true,
  data        jsonb not null default '{}'::jsonb,
  rev         integer not null default 1,
  created_by  uuid default auth.uid() references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists valve_models_updated_idx on public.valve_models (updated_at);
alter table public.valve_models enable row level security;

create policy "modelos: ver"     on public.valve_models for select using ((select private.is_member()));
create policy "modelos: criar"   on public.valve_models for insert with check ((select private.is_admin()));
create policy "modelos: editar"  on public.valve_models for update using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "modelos: excluir" on public.valve_models for delete using ((select private.is_admin()));

create trigger valve_models_touch before update on public.valve_models
  for each row execute function public.touch_process();

-- ============================ RTS (Relatório Técnico de Serviço) ============================
-- Independente das peritagens: nasce na proposta, muitas vezes antes de ver a válvula.
create table if not exists public.rts_documents (
  id          text primary key,
  numero      text check (char_length(numero) <= 200),     -- nº da proposta, ex.: 1135-26
  cliente     text check (char_length(cliente) <= 200),
  produto     text check (char_length(produto) <= 400),
  status      text not null default 'Rascunho' check (status in ('Rascunho','Aguardando aprovação','Aprovado')),
  data        jsonb not null default '{}'::jsonb,
  rev         integer not null default 1,
  created_by  uuid default auth.uid() references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists rts_documents_updated_idx on public.rts_documents (updated_at);
alter table public.rts_documents enable row level security;

create policy "rts: ver"          on public.rts_documents for select using ((select private.is_member()));
create policy "rts: criar"        on public.rts_documents for insert with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "rts: editar"       on public.rts_documents for update using ((select private.is_member())) with check ((select private.is_member()));
create policy "rts: excluir de vez" on public.rts_documents for delete using ((select private.is_admin()));

create trigger rts_documents_touch before update on public.rts_documents
  for each row execute function public.touch_process();

-- ============================ Aprovação do RTS ============================
-- Só o administrador libera ("Aprovado"). Qualquer membro pode reabrir (volta a Rascunho) e o RTS aprovado
-- não pode ser alterado por quem não é administrador sem antes ser reaberto. Reforça no servidor o que o app já faz na tela.
create or replace function public.rts_guard_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Aprovado' and not private.is_admin() then
      raise exception 'Só o administrador aprova um RTS.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status = 'Aprovado' and old.status is distinct from 'Aprovado' and not private.is_admin() then
    raise exception 'Só o administrador aprova um RTS.' using errcode = '42501';
  end if;
  if old.status = 'Aprovado' and new.status = 'Aprovado' and new.data is distinct from old.data and not private.is_admin() then
    raise exception 'RTS aprovado não pode ser alterado: reabra para edição.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger rts_documents_guard before insert or update on public.rts_documents
  for each row execute function public.rts_guard_approval();
