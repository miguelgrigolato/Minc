-- v5.19.0 — comparativo RTS x D.E: relatório de diferenças enviado ao painel de gestão. JÁ APLICADA em produção.
create table if not exists public.rts_dep_reports (
  id text primary key, rts_id text not null, process_id text not null,
  status text not null default 'Pendente' check (status in ('Pendente','Resolvido','Aceito','Descartado')),
  total integer not null default 0, data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(), created_by_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  evaluated_by uuid, evaluated_by_name text, evaluated_at timestamptz,
  note text check (char_length(note) <= 2000)
);
create index if not exists rts_dep_reports_status_idx on public.rts_dep_reports (status, updated_at desc);
create index if not exists rts_dep_reports_pair_idx on public.rts_dep_reports (rts_id, process_id);
alter table public.rts_dep_reports enable row level security;
create policy "comparativo: ver" on public.rts_dep_reports for select to authenticated using ((select private.is_member()));
create policy "comparativo: criar" on public.rts_dep_reports for insert to authenticated with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "comparativo: editar" on public.rts_dep_reports for update to authenticated
  using ((select private.is_manager()) or ((select private.is_member()) and status = 'Pendente' and created_by = (select auth.uid())))
  with check ((select private.is_manager()) or ((select private.is_member()) and status = 'Pendente' and created_by = (select auth.uid())));
create policy "comparativo: excluir" on public.rts_dep_reports for delete to authenticated using ((select private.is_manager()));
create or replace function public.touch_catalog_cmp() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at := now(); return new; end $$;
revoke execute on function public.touch_catalog_cmp() from public, anon, authenticated;
create trigger rts_dep_reports_touch before update on public.rts_dep_reports for each row execute function public.touch_catalog_cmp();
