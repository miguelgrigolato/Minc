-- MINC Peritagem v5.15.0 — Lista padronizada de matéria-prima com código do Nomus.
-- APLICADA em 14/10/2026 no projeto minc-peritagem. O cadastro é carregado pelo administrador no app
-- (Administração > Configurações > Lista de matéria-prima > Importar planilha), não por SQL.
-- Mesmas regras das demais listas do catálogo: todos os membros leem; só o administrador escreve.

create table if not exists public.catalog_materials (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null check (char_length(codigo) between 1 and 60),       -- código do produto no Nomus
  codigo2    text check (char_length(codigo2) <= 200),                          -- código secundário: informação complementar
  descricao  text not null check (char_length(descricao) between 1 and 300),
  unidade    text check (char_length(unidade) <= 30),
  grupo      text check (char_length(grupo) <= 60),                             -- cada aba da planilha: Parafusos, Porcas, Arruelas, Chapas…
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists catalog_materials_codigo_uq on public.catalog_materials (lower(codigo));
create index if not exists catalog_materials_grupo_idx on public.catalog_materials (grupo);
alter table public.catalog_materials enable row level security;

create policy "materiais: ver"     on public.catalog_materials for select using ((select private.is_member()));
create policy "materiais: criar"   on public.catalog_materials for insert with check ((select private.is_admin()));
create policy "materiais: editar"  on public.catalog_materials for update using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "materiais: excluir" on public.catalog_materials for delete using ((select private.is_admin()));

create trigger catalog_materials_touch before update on public.catalog_materials
  for each row execute function public.touch_catalog();

-- Os aparelhos só baixam a lista de novo quando a chave app_settings 'materiais_versao' muda (o app atualiza a cada edição do administrador).
