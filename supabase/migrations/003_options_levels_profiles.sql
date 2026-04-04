-- Opciones de menú (gasto / bebida / café), niveles, perfiles y triggers de stats.
-- Ejecutar después de 002_auth_rls.sql.

-- ---------------------------------------------------------------------------
-- Niveles (umbrales por total de almuerzos)
-- ---------------------------------------------------------------------------
create table if not exists public.levels (
  id smallserial primary key,
  code text not null unique,
  label text not null,
  min_meals int not null unique
);

insert into public.levels (code, label, min_meals)
values
  ('principiante', 'Principiante', 0),
  ('novato', 'Novato', 1),
  ('profesional', 'Profesional', 4),
  ('experto', 'Experto', 10),
  ('maestro', 'Maestro', 20),
  ('rey_almuerzo', 'Rey del almuerzo', 35)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Categorías y opciones de comida
-- ---------------------------------------------------------------------------
create table if not exists public.meal_option_categories (
  id smallserial primary key,
  code text not null unique,
  label text not null
);

insert into public.meal_option_categories (code, label)
values
  ('gasto', 'Gasto'),
  ('bebida', 'Bebida'),
  ('cafe', 'Café')
on conflict (code) do nothing;

create table if not exists public.meal_options (
  id uuid primary key default gen_random_uuid(),
  category_id smallint not null references public.meal_option_categories (id) on delete restrict,
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category_id, label)
);

create index if not exists meal_options_category_active_idx
  on public.meal_options (category_id, is_active, sort_order);

-- Seeds: etiquetas con emoji en gasto según producto
insert into public.meal_options (category_id, label, sort_order)
select c.id, v.label, v.ord
from public.meal_option_categories c
cross join lateral (
  values
    ('gasto', '🥜 Cacahuetes del collaret', 10),
    ('gasto', '🫘 Cacahuetes fritos', 20),
    ('gasto', '🫒 Olivas', 30),
    ('gasto', '🟡 Altramuces', 40),
    ('gasto', '🥒 Encurtidos', 50),
    ('gasto', '🥗 Ensalada', 60),
    ('gasto', 'Otro', 70),
    ('bebida', 'Cerveza', 10),
    ('bebida', 'Vino', 20),
    ('bebida', 'Vino con gaseosa', 30),
    ('bebida', 'Refresco', 40),
    ('bebida', 'Agua', 50),
    ('bebida', 'Zumo / Bebida natural', 60),
    ('cafe', 'Cremaet', 10),
    ('cafe', 'Carajillo', 20),
    ('cafe', 'Bombón', 30),
    ('cafe', 'Café solo', 40),
    ('cafe', 'Cortado', 50),
    ('cafe', 'Café con leche', 60),
    ('cafe', 'Descafeinado', 70),
    ('cafe', 'Americano', 80),
    ('cafe', 'Infusión (manzanilla, poleo, té...)', 85),
    ('cafe', 'Sin café', 90)
) as v(cat_code, label, ord)
where c.code = v.cat_code
on conflict (category_id, label) do nothing;

-- ---------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  total_meals int not null default 0,
  level_id smallint not null references public.levels (id) on delete restrict,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_level_id_idx on public.profiles (level_id);
create index if not exists profiles_total_meals_idx on public.profiles (total_meals desc);

-- ---------------------------------------------------------------------------
-- Almuerzos: FKs a opciones (MVP: una opción por categoría)
-- ---------------------------------------------------------------------------
alter table public.almuerzos
  add column if not exists gasto_option_id uuid,
  add column if not exists bebida_option_id uuid,
  add column if not exists cafe_option_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'almuerzos_gasto_option_id_fkey'
  ) then
    alter table public.almuerzos
      add constraint almuerzos_gasto_option_id_fkey
      foreign key (gasto_option_id) references public.meal_options (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'almuerzos_bebida_option_id_fkey'
  ) then
    alter table public.almuerzos
      add constraint almuerzos_bebida_option_id_fkey
      foreign key (bebida_option_id) references public.meal_options (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'almuerzos_cafe_option_id_fkey'
  ) then
    alter table public.almuerzos
      add constraint almuerzos_cafe_option_id_fkey
      foreign key (cafe_option_id) references public.meal_options (id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Sincronizar columnas texto legadas con las etiquetas de la opción elegida
-- ---------------------------------------------------------------------------
create or replace function public.tg_almuerzos_sync_option_text()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.gasto_option_id is not null then
    select mo.label into new.gasto from public.meal_options mo where mo.id = new.gasto_option_id;
  end if;
  if new.bebida_option_id is not null then
    select mo.label into new.drink from public.meal_options mo where mo.id = new.bebida_option_id;
  end if;
  if new.cafe_option_id is not null then
    select mo.label into new.coffee from public.meal_options mo where mo.id = new.cafe_option_id;
  end if;
  return new;
end;
$fn$;

-- Nombres con prefijo numérico: el orden alfabético ejecuta 01 antes que 02.
drop trigger if exists almuerzos_01_validate_option_categories on public.almuerzos;
drop trigger if exists almuerzos_02_sync_option_text on public.almuerzos;
drop trigger if exists almuerzos_validate_option_categories on public.almuerzos;
drop trigger if exists almuerzos_sync_option_text on public.almuerzos;

-- ---------------------------------------------------------------------------
-- Validar que cada FK apunta a una opción de la categoría correcta
-- ---------------------------------------------------------------------------
create or replace function public.tg_almuerzos_validate_option_categories()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.gasto_option_id is not null then
    if not exists (
      select 1
      from public.meal_options mo
      join public.meal_option_categories c on c.id = mo.category_id
      where mo.id = new.gasto_option_id
        and c.code = 'gasto'
    ) then
      raise exception 'gasto_option_id no pertenece a la categoría gasto';
    end if;
  end if;
  if new.bebida_option_id is not null then
    if not exists (
      select 1
      from public.meal_options mo
      join public.meal_option_categories c on c.id = mo.category_id
      where mo.id = new.bebida_option_id
        and c.code = 'bebida'
    ) then
      raise exception 'bebida_option_id no pertenece a la categoría bebida';
    end if;
  end if;
  if new.cafe_option_id is not null then
    if not exists (
      select 1
      from public.meal_options mo
      join public.meal_option_categories c on c.id = mo.category_id
      where mo.id = new.cafe_option_id
        and c.code = 'cafe'
    ) then
      raise exception 'cafe_option_id no pertenece a la categoría cafe';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger almuerzos_01_validate_option_categories
  before insert or update of gasto_option_id, bebida_option_id, cafe_option_id
  on public.almuerzos
  for each row
  execute function public.tg_almuerzos_validate_option_categories();

create trigger almuerzos_02_sync_option_text
  before insert or update of gasto_option_id, bebida_option_id, cafe_option_id
  on public.almuerzos
  for each row
  execute function public.tg_almuerzos_sync_option_text();

-- ---------------------------------------------------------------------------
-- Recalcular total_meals y nivel en profiles
-- ---------------------------------------------------------------------------
create or replace function public.recalculate_user_meal_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c int;
  lid smallint;
begin
  select count(*)::int into c from public.almuerzos where user_id = p_user_id;

  select l.id into lid
  from public.levels l
  where l.min_meals <= c
  order by l.min_meals desc
  limit 1;

  if lid is null then
    select l.id into lid from public.levels l order by l.min_meals asc limit 1;
  end if;

  insert into public.profiles (id, total_meals, level_id)
  values (p_user_id, c, lid)
  on conflict (id) do update
  set
    total_meals = excluded.total_meals,
    level_id = excluded.level_id,
    updated_at = now();
end;
$fn$;

create or replace function public.tg_almuerzos_after_meal_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_user_meal_stats(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.recalculate_user_meal_stats(old.user_id);
  elsif tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      perform public.recalculate_user_meal_stats(old.user_id);
      perform public.recalculate_user_meal_stats(new.user_id);
    elsif new.user_id is not null then
      -- El conteo solo cambia si antes no existía fila… en UPDATE normal no cambia;
      -- mantenemos recálculo solo si afecta user_id (arriba). No hacer nada más.
      null;
    end if;
  end if;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists almuerzos_after_meal_stats on public.almuerzos;
create trigger almuerzos_after_meal_stats
  after insert or delete or update of user_id on public.almuerzos
  for each row
  execute function public.tg_almuerzos_after_meal_stats();

-- ---------------------------------------------------------------------------
-- Nuevo usuario → fila en profiles
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  lid smallint;
begin
  select l.id into lid from public.levels l where l.code = 'principiante' limit 1;
  insert into public.profiles (id, level_id, total_meals)
  values (new.id, lid, 0)
  on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.levels enable row level security;
alter table public.meal_option_categories enable row level security;
alter table public.meal_options enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "levels_select_all" on public.levels;
create policy "levels_select_all" on public.levels for select using (true);

drop policy if exists "meal_option_categories_select_all" on public.meal_option_categories;
create policy "meal_option_categories_select_all"
  on public.meal_option_categories for select using (true);

drop policy if exists "meal_options_select_all" on public.meal_options;
create policy "meal_options_select_all" on public.meal_options for select using (true);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Perfiles para usuarios ya existentes + recalcular totales
-- ---------------------------------------------------------------------------
insert into public.profiles (id, level_id, total_meals)
select
  u.id,
  coalesce(
    (
      select l.id
      from public.levels l
      where l.min_meals <= (select count(*)::int from public.almuerzos a where a.user_id = u.id)
      order by l.min_meals desc
      limit 1
    ),
    (select id from public.levels where code = 'principiante' limit 1)
  ),
  (select count(*)::int from public.almuerzos a where a.user_id = u.id)
from auth.users u
on conflict (id) do update
set
  total_meals = excluded.total_meals,
  level_id = excluded.level_id,
  updated_at = now();

-- Alinear stats con trigger (por si hubo desvíos)
do $$
declare
  r record;
begin
  for r in select id from auth.users loop
    perform public.recalculate_user_meal_stats(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime: replicar cambios en profiles (y almuerzos si hace falta en cliente)
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.almuerzos;
exception
  when duplicate_object then null;
end $$;
