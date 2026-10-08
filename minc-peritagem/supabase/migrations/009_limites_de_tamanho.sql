-- 009 · Limites de tamanho nos textos (v5.9.0). Só acrescenta regras (CHECK); não altera nem apaga dado nenhum.
-- O app já limita a digitação (200 caracteres nos campos, 4.000 nas observações). O banco passa a recusar
-- o que vier maior por qualquer outro caminho (API, importação, versão antiga do app).
-- Os limites do banco são iguais ou maiores que os do app, para nada que o app aceita ser recusado aqui.

-- Processos: colunas de identificação (cópias usadas em busca e relatórios; o valor completo fica em "data")
alter table public.processes
  add constraint processes_process_no_len  check (char_length(process_no)  <= 200),
  add constraint processes_pedido_len      check (char_length(pedido)      <= 200),
  add constraint processes_ordem_len       check (char_length(ordem)       <= 200),
  add constraint processes_equipamento_len check (char_length(equipamento) <= 200),
  add constraint processes_cliente_len     check (char_length(cliente)     <= 200),
  add constraint processes_observacoes_len check (char_length(coalesce(data->>'observacoes', '')) <= 4000),
  -- teto para o JSON inteiro do processo (componentes, testes...). Hoje o maior tem ~21 KB; fotos e anexos não ficam aqui.
  add constraint processes_data_size       check (octet_length(data::text) <= 5242880);

-- Fotos e anexos: o app corta nomes em 200 caracteres
alter table public.photos
  add constraint photos_name_len         check (char_length(name) <= 300),
  add constraint photos_storage_path_len check (char_length(storage_path) <= 512);

-- Documentos arquivados
alter table public.process_documents
  add constraint process_documents_file_name_len     check (char_length(file_name) <= 300),
  add constraint process_documents_note_len          check (char_length(note) <= 4000),
  add constraint process_documents_storage_path_len  check (char_length(storage_path) <= 512),
  add constraint process_documents_snapshot_path_len check (char_length(snapshot_path) <= 512);

-- Catálogos (editados pelo administrador)
alter table public.catalog_sectors           add constraint catalog_sectors_name_len    check (char_length(name) <= 200);
alter table public.catalog_activities        add constraint catalog_activities_name_len check (char_length(name) <= 200);
alter table public.catalog_external_services add constraint catalog_services_name_len   check (char_length(name) <= 200);

-- Perfis: nome até 120 (a função de administração já corta em 80). O cadastro automático corta também,
-- para um nome longo vindo do convite nunca impedir a criação do usuário.
alter table public.profiles add constraint profiles_name_len check (char_length(name) <= 120);
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 120), new.email);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
