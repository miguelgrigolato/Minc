-- MINC ServiceHub v5.29.0 — módulo de Custos do RTS (orçamento por RTS)
-- Aditiva: cria rts_costs (um orçamento por RTS), política de acesso configurável e gatilhos de cálculo/auditoria.
-- O servidor refaz o total de cada linha e os totais (o que o navegador manda como "total" é ignorado).
create table if not exists public.rts_costs (
  id text primary key,
  rts_id text not null unique references public.rts_documents(id) on delete restrict,
  data jsonb not null default '{}'::jsonb,
  total_geral numeric(14,2),
  pendentes integer not null default 0,
  rev integer not null default 1,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rts_costs enable row level security;

-- acesso: app_settings.custos_config.acesso = 'membros' (padrão) ou 'gestores'
create or replace function private.can_costs() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member() and (
    coalesce((select value->>'acesso' from public.app_settings where key = 'custos_config'), 'membros') = 'membros'
    or private.is_manager())
$$;
grant execute on function private.can_costs() to authenticated;

create policy "custos: ver" on public.rts_costs for select using ((select private.can_costs()));
create policy "custos: criar" on public.rts_costs for insert with check ((select private.can_costs()) and created_by = (select auth.uid()));
create policy "custos: editar" on public.rts_costs for update using ((select private.can_costs())) with check ((select private.can_costs()));
create policy "custos: excluir" on public.rts_costs for delete using ((select private.is_manager()));

create or replace function public.rts_costs_calc() returns trigger
language plpgsql set search_path = '' as $$
declare
  it jsonb; outarr jsonb := '[]'::jsonb;
  sec text; q numeric; p numeric; h numeric; t numeric; tipo text;
  sub jsonb := '{"mat":0,"mo":0,"out":0,"srv":0}'::jsonb;
  n_it int := 0; n_pend int := 0; n_ref int := 0; n_inf int := 0; tot numeric := 0;
  vazio boolean; completo boolean;
begin
  new.data := coalesce(new.data, '{}'::jsonb);
  if jsonb_typeof(new.data->'itens') is distinct from 'array' then new.data := jsonb_set(new.data, '{itens}', '[]'::jsonb); end if;
  if jsonb_array_length(new.data->'itens') > 600 then raise exception 'Orçamento com itens demais (máximo 600).' using errcode = '22023'; end if;
  for it in select * from jsonb_array_elements(new.data->'itens') loop
    sec := coalesce(it->>'sec', 'mat');
    if sec not in ('mat','mo','out','srv') then raise exception 'Seção de custo inválida: %', sec using errcode = '22023'; end if;
    q := nullif(btrim(coalesce(it->>'qtd','')), '')::numeric;
    p := nullif(btrim(coalesce(it->>'preco','')), '')::numeric;
    h := nullif(btrim(coalesce(it->>'horas','')), '')::numeric;
    if coalesce(q,0) < 0 or coalesce(p,0) < 0 or coalesce(h,0) < 0 then raise exception 'Quantidade, horas e preço não podem ser negativos.' using errcode = '23514'; end if;
    tipo := it->>'preco_tipo';
    if p is null then tipo := null;
    elsif tipo is null or tipo not in ('referencia','informado') then tipo := 'informado'; end if;
    if sec = 'mo' then vazio := h is null; completo := q is not null and p is not null and h is not null;
    else vazio := q is null and p is null; completo := q is not null and p is not null; end if;
    t := null;
    if completo then t := round(case when sec = 'mo' then q * h * p else q * p end, 2); end if;
    it := (it - 'total' - 'preco_tipo') || jsonb_build_object('total', t, 'preco_tipo', tipo);
    if not vazio then
      n_it := n_it + 1;
      if completo then
        tot := tot + t; sub := jsonb_set(sub, array[sec], to_jsonb((sub->>sec)::numeric + t));
        if tipo = 'referencia' then n_ref := n_ref + 1; else n_inf := n_inf + 1; end if;
      else n_pend := n_pend + 1; end if;
    end if;
    outarr := outarr || jsonb_build_array(it);
  end loop;
  new.data := jsonb_set(new.data, '{itens}', outarr) || jsonb_build_object('resumo', jsonb_build_object('subtotais', sub, 'total', tot, 'itens', n_it, 'pendentes', n_pend, 'estimados', n_ref, 'informados', n_inf, 'parcial', n_pend > 0));
  new.total_geral := tot; new.pendentes := n_pend;
  return new;
end $$;

create or replace function public.rts_costs_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ch jsonb := '[]'::jsonb; ni jsonb; oi jsonb; f text; ref text;
begin
  select numero into ref from public.rts_documents where id = new.rts_id;
  if tg_op = 'INSERT' then
    perform private.audit('custo', new.rts_id, ref, 'custo_criado', null, null, jsonb_build_object('itens', (new.data->'resumo'->>'itens')::int));
    return new;
  end if;
  for ni in select e.value from jsonb_array_elements(new.data->'itens') e loop
    select e.value into oi from jsonb_array_elements(old.data->'itens') e where e.value->>'id' = ni->>'id' limit 1;
    if oi is null then
      ch := ch || jsonb_build_array(jsonb_build_object('item', ni->>'desc', 'campo', 'item_incluido', 'para', ni->>'qtd'));
    else
      foreach f in array array['qtd','horas','preco','preco_tipo','un','desc'] loop
        if (oi->>f) is distinct from (ni->>f) then
          ch := ch || jsonb_build_array(jsonb_build_object('item', ni->>'desc', 'campo', f, 'de', oi->>f, 'para', ni->>f));
        end if;
      end loop;
    end if;
  end loop;
  for oi in select e.value from jsonb_array_elements(old.data->'itens') e loop
    if not exists (select 1 from jsonb_array_elements(new.data->'itens') e where e.value->>'id' = oi->>'id') then
      ch := ch || jsonb_build_array(jsonb_build_object('item', oi->>'desc', 'campo', 'item_removido', 'de', oi->>'qtd'));
    end if;
  end loop;
  if jsonb_array_length(ch) > 0 then
    perform private.audit('custo', new.rts_id, ref, 'custo_alterado', null, null,
      jsonb_build_object('mudancas', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select x from jsonb_array_elements(ch) x limit 40) s),
                         'qtd_mudancas', jsonb_array_length(ch), 'total_de', old.total_geral, 'total_para', new.total_geral));
  end if;
  return new;
end $$;

create trigger rts_costs_calc before insert or update on public.rts_costs
  for each row execute function public.rts_costs_calc();
create trigger rts_costs_touch before update on public.rts_costs
  for each row execute function public.touch_process();
create trigger rts_costs_zaudit after insert or update on public.rts_costs
  for each row execute function public.rts_costs_audit();
