-- Suplantación (solo lectura): el usuario indicado puede leer almuerzos, perfiles,
-- selecciones de gasto y fotos de cualquier cuenta para soporte / depuración.
-- El cliente limita la vista al usuario elegido; aquí se amplía SELECT en RLS.

-- UUID de mariocamus@hotmail.com (comprobar en auth.users si cambiara de cuenta).
-- ---------------------------------------------------------------------------
-- public.almuerzos: el admin puede hacer SELECT de cualquier fila
-- ---------------------------------------------------------------------------
drop policy if exists "almuerzos_select_support_admin" on public.almuerzos;
create policy "almuerzos_select_support_admin" on public.almuerzos for select using (
  auth.uid() = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'::uuid
);

-- ---------------------------------------------------------------------------
-- public.profiles
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_support_admin" on public.profiles;
create policy "profiles_select_support_admin" on public.profiles for select using (
  auth.uid() = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'::uuid
);

-- ---------------------------------------------------------------------------
-- public.almuerzo_gasto_selections (lecturas anidadas en almuerzos)
-- ---------------------------------------------------------------------------
drop policy if exists "almuerzo_gasto_sel_select_support_admin" on public.almuerzo_gasto_selections;
create policy "almuerzo_gasto_sel_select_support_admin" on public.almuerzo_gasto_selections
for select using (auth.uid() = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'::uuid);

-- ---------------------------------------------------------------------------
-- storage.objects (bucket almuerzo-fotos): ver fotos de cualquier usuario
-- ---------------------------------------------------------------------------
drop policy if exists "storage_select_support_admin" on storage.objects;
create policy "storage_select_support_admin" on storage.objects for select using (
  bucket_id = 'almuerzo-fotos'
  and auth.uid() = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'::uuid
);

-- ---------------------------------------------------------------------------
-- Búsqueda de usuarios por email o nombre (solo el admin)
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_users(p_query text default '')
returns table (id uuid, email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, p.display_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where auth.uid() = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'::uuid
    and (
      nullif(trim(p_query), '') is null
      or u.email ilike '%' || trim(p_query) || '%'
      or coalesce(p.display_name, '') ilike '%' || trim(p_query) || '%'
    )
  order by u.email asc
  limit 50;
$$;

revoke all on function public.admin_search_users(text) from public;
grant execute on function public.admin_search_users(text) to authenticated;
