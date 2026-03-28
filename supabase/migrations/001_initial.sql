-- Ejecuta este SQL en el panel de Supabase: SQL Editor → New query → Run
-- Crea la tabla de almuerzos, políticas abiertas para el MVP (sin login) y el bucket de fotos.

-- Tabla principal: un registro = un almuerzo
create table if not exists public.almuerzos (
  id uuid primary key default gen_random_uuid(),
  bar_name text not null,
  meal_date date not null default ((now() at time zone 'utc'))::date,
  gasto text,
  drink text,
  bocadillo_name text,
  bocadillo_ingredients text,
  coffee text,
  price numeric(10, 2),
  review text,
  -- Rutas dentro del bucket Storage, ej: "uuid/foto1.jpg" (máx. 5; lo aplica la app)
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists almuerzos_meal_date_idx on public.almuerzos (meal_date desc);
create index if not exists almuerzos_created_at_idx on public.almuerzos (created_at desc);

alter table public.almuerzos enable row level security;

-- MVP sin autenticación: cualquiera con la anon key puede CRUD.
-- Cuando añadas login, sustituye esto por políticas por user_id.
drop policy if exists "mvp_anon_all_almuerzos" on public.almuerzos;
create policy "mvp_anon_all_almuerzos"
  on public.almuerzos
  for all
  using (true)
  with check (true);

-- Bucket público para leer fotos desde la app (URLs públicas)
insert into storage.buckets (id, name, public)
values ('almuerzo-fotos', 'almuerzo-fotos', true)
on conflict (id) do update set public = excluded.public;

-- Políticas del bucket: lectura pública; escritura/borrado con anon key (solo MVP)
drop policy if exists "mvp_read_photos" on storage.objects;
create policy "mvp_read_photos"
  on storage.objects for select
  using (bucket_id = 'almuerzo-fotos');

drop policy if exists "mvp_insert_photos" on storage.objects;
create policy "mvp_insert_photos"
  on storage.objects for insert
  with check (bucket_id = 'almuerzo-fotos');

drop policy if exists "mvp_update_photos" on storage.objects;
create policy "mvp_update_photos"
  on storage.objects for update
  using (bucket_id = 'almuerzo-fotos');

drop policy if exists "mvp_delete_photos" on storage.objects;
create policy "mvp_delete_photos"
  on storage.objects for delete
  using (bucket_id = 'almuerzo-fotos');
