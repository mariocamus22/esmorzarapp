-- Privacidad: las políticas MVP (001) permitían CRUD/lectura global. En Postgres, varias
-- políticas para el mismo comando se combinan con OR: si sigue activa `mvp_anon_all_almuerzos`,
-- cualquier usuario autenticado ve y modifica todos los almuerzos aunque existan políticas
-- "own". Esta migración elimina las políticas permisivas y deja solo acceso por auth.uid().

-- ---------------------------------------------------------------------------
-- public.almuerzos
-- ---------------------------------------------------------------------------
alter table public.almuerzos enable row level security;

drop policy if exists "mvp_anon_all_almuerzos" on public.almuerzos;

drop policy if exists "almuerzos_select_own" on public.almuerzos;
drop policy if exists "almuerzos_insert_own" on public.almuerzos;
drop policy if exists "almuerzos_update_own" on public.almuerzos;
drop policy if exists "almuerzos_delete_own" on public.almuerzos;

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

create index if not exists almuerzos_user_id_meal_date_idx on public.almuerzos (user_id, meal_date desc);

-- ---------------------------------------------------------------------------
-- storage.objects (bucket almuerzo-fotos): mismas políticas MVP OR con las restrictivas
-- ---------------------------------------------------------------------------
drop policy if exists "mvp_read_photos" on storage.objects;
drop policy if exists "mvp_insert_photos" on storage.objects;
drop policy if exists "mvp_update_photos" on storage.objects;
drop policy if exists "mvp_delete_photos" on storage.objects;

drop policy if exists "storage_select_own" on storage.objects;
drop policy if exists "storage_insert_own" on storage.objects;
drop policy if exists "storage_update_own" on storage.objects;
drop policy if exists "storage_delete_own" on storage.objects;

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
