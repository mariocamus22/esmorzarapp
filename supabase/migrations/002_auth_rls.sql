-- Autenticación: cada almuerzo pertenece a un usuario. Storage: rutas userId/almuerzoId/archivo
-- Ejecutar después de 001_initial.sql (o aplicar vía MCP / SQL Editor).

alter table public.almuerzos add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- Datos antiguos sin usuario (MVP abierto): eliminar o no serán visibles con RLS
delete from public.almuerzos where user_id is null;

alter table public.almuerzos alter column user_id set not null;

drop policy if exists "mvp_anon_all_almuerzos" on public.almuerzos;

create policy "almuerzos_select_own" on public.almuerzos for select using (auth.uid() = user_id);

create policy "almuerzos_insert_own" on public.almuerzos for insert
with
  check (auth.uid() = user_id);

create policy "almuerzos_update_own" on public.almuerzos for
update
using (auth.uid() = user_id)
with
  check (auth.uid() = user_id);

create policy "almuerzos_delete_own" on public.almuerzos for delete using (auth.uid() = user_id);

-- Storage: primera carpeta del path = auth.uid()
drop policy if exists "mvp_read_photos" on storage.objects;

drop policy if exists "mvp_insert_photos" on storage.objects;

drop policy if exists "mvp_update_photos" on storage.objects;

drop policy if exists "mvp_delete_photos" on storage.objects;

create policy "storage_select_own" on storage.objects for select
using (
  bucket_id = 'almuerzo-fotos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "storage_insert_own" on storage.objects for insert
with
  check (
    bucket_id = 'almuerzo-fotos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "storage_update_own" on storage.objects for
update
using (
  bucket_id = 'almuerzo-fotos'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "storage_delete_own" on storage.objects for delete using (
  bucket_id = 'almuerzo-fotos'
  and split_part(name, '/', 1) = auth.uid()::text
);
