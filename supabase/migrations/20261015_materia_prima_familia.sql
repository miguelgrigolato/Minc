-- v5.16.0 — a coluna "grupo" passa a se chamar "familia" (família de produto do Nomus). JÁ APLICADA em produção.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='catalog_materials' and column_name='grupo') then
    alter table public.catalog_materials rename column grupo to familia;
  end if;
end $$;
alter index if exists public.catalog_materials_grupo_idx rename to catalog_materials_familia_idx;
