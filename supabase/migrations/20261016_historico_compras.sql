-- MINC ServiceHub v5.30.0 — histórico de compras importado da planilha do Nomus ("BD - Custos").
-- O app limpa a planilha antes de gravar (ver custos-calc.js > limparCompras): linhas com valor/quantidade
-- errados NÃO entram; serviços entram (tipo_item = 'servico').
create table if not exists public.purchase_imports (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  by_id uuid references public.profiles(id),
  by_name text,
  arquivo text,
  linhas integer not null default 0,
  mantidas integer not null default 0,
  novas integer not null default 0,
  descartadas jsonb not null default '{}'::jsonb,
  periodo_ini timestamptz,
  periodo_fim timestamptz
);
create table if not exists public.purchase_history (
  id bigint generated always as identity primary key,
  chave text not null unique,
  codigo text not null,
  descricao text not null,
  familia text,
  tipo text,
  tipo_item text not null check (tipo_item in ('material','servico')),
  um text not null,
  qtd numeric(18,4) not null check (qtd > 0),
  vtot numeric(16,2) not null check (vtot > 0),
  vun numeric(18,6) not null check (vun > 0),
  data timestamptz not null,
  fornecedor text,
  movimentacao text,
  lote bigint references public.purchase_imports(id),
  created_at timestamptz not null default now()
);
create index if not exists purchase_history_cod on public.purchase_history (codigo, data desc);
create index if not exists purchase_history_srv on public.purchase_history (tipo_item, descricao);
alter table public.purchase_history enable row level security;
alter table public.purchase_imports enable row level security;
-- ler: quem acessa custos; importar: só administrador/gestor; sem update/delete em purchase_history
create policy "compras: ver" on public.purchase_history for select using ((select private.can_costs()));
create policy "compras: importar" on public.purchase_history for insert with check ((select private.is_manager()));
create policy "importacoes: ver" on public.purchase_imports for select using ((select private.can_costs()));
create policy "importacoes: criar" on public.purchase_imports for insert with check ((select private.is_manager()) and by_id = (select auth.uid()));
create policy "importacoes: atualizar" on public.purchase_imports for update using ((select private.is_manager())) with check ((select private.is_manager()));
