-- Gasto: selección múltiple (tabla puente). Bebidas: emojis + "Sin bebida". Nuevo gasto "🤷🏻‍♂️ Nada".
-- Ejecutar después de 003 (y opcionalmente 004).

-- ---------------------------------------------------------------------------
-- Tabla puente almuerzo ↔ opciones de gasto (múltiples por almuerzo)
-- ---------------------------------------------------------------------------
create table if not exists public.almuerzo_gasto_selections (
  almuerzo_id uuid not null references public.almuerzos (id) on delete cascade,
  option_id uuid not null references public.meal_options (id) on delete restrict,
  primary key (almuerzo_id, option_id)
);

create index if not exists almuerzo_gasto_selections_option_id_idx
  on public.almuerzo_gasto_selections (option_id);

-- Migrar selección única antigua (solo si existe la columna de 003; si saltaste 003, no hay nada que copiar)
do $mig_gasto_col$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'almuerzos'
      and column_name = 'gasto_option_id'
  ) then
    insert into public.almuerzo_gasto_selections (almuerzo_id, option_id)
    select a.id, a.gasto_option_id
    from public.almuerzos a
    where a.gasto_option_id is not null
    on conflict do nothing;
  end if;
end $mig_gasto_col$;

-- ---------------------------------------------------------------------------
-- Sincronizar columna texto `gasto` desde la tabla puente
-- ---------------------------------------------------------------------------
create or replace function public.refresh_almuerzo_gasto_text(p_almuerzo_id uuid)
returns void
language plpgsql
set search_path = public
as $fn$
declare
  txt text;
begin
  select string_agg(mo.label, ', ' order by mo.sort_order, mo.label)
  into txt
  from public.almuerzo_gasto_selections ags
  join public.meal_options mo on mo.id = ags.option_id
  where ags.almuerzo_id = p_almuerzo_id;

  update public.almuerzos
  set gasto = txt
  where id = p_almuerzo_id;
end;
$fn$;

create or replace function public.tg_almuerzo_gasto_selections_after()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_almuerzo_gasto_text(old.almuerzo_id);
  else
    perform public.refresh_almuerzo_gasto_text(new.almuerzo_id);
  end if;
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists almuerzo_gasto_selections_after on public.almuerzo_gasto_selections;
create trigger almuerzo_gasto_selections_after
  after insert or update or delete on public.almuerzo_gasto_selections
  for each row
  execute function public.tg_almuerzo_gasto_selections_after();

create or replace function public.tg_almuerzo_gasto_selections_validate()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if not exists (
    select 1
    from public.meal_options mo
    join public.meal_option_categories c on c.id = mo.category_id
    where mo.id = new.option_id
      and c.code = 'gasto'
  ) then
    raise exception 'almuerzo_gasto_selections: option_id debe ser categoría gasto';
  end if;
  return new;
end;
$fn$;

drop trigger if exists almuerzo_gasto_selections_validate on public.almuerzo_gasto_selections;
create trigger almuerzo_gasto_selections_validate
  before insert or update on public.almuerzo_gasto_selections
  for each row
  execute function public.tg_almuerzo_gasto_selections_validate();

-- Refrescar textos tras migración inicial
do $$
declare
  r record;
begin
  for r in select distinct almuerzo_id from public.almuerzo_gasto_selections loop
    perform public.refresh_almuerzo_gasto_text(r.almuerzo_id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Quitar gasto_option_id de almuerzos; triggers solo bebida/café
-- ---------------------------------------------------------------------------
drop trigger if exists almuerzos_01_validate_option_categories on public.almuerzos;
drop trigger if exists almuerzos_02_sync_option_text on public.almuerzos;

alter table public.almuerzos drop constraint if exists almuerzos_gasto_option_id_fkey;
alter table public.almuerzos drop column if exists gasto_option_id;

create or replace function public.tg_almuerzos_sync_option_text()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if new.bebida_option_id is not null then
    select mo.label into new.drink from public.meal_options mo where mo.id = new.bebida_option_id;
  end if;
  if new.cafe_option_id is not null then
    select mo.label into new.coffee from public.meal_options mo where mo.id = new.cafe_option_id;
  end if;
  return new;
end;
$fn$;

create or replace function public.tg_almuerzos_validate_option_categories()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
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
  before insert or update of bebida_option_id, cafe_option_id
  on public.almuerzos
  for each row
  execute function public.tg_almuerzos_validate_option_categories();

create trigger almuerzos_02_sync_option_text
  before insert or update of bebida_option_id, cafe_option_id
  on public.almuerzos
  for each row
  execute function public.tg_almuerzos_sync_option_text();

-- ---------------------------------------------------------------------------
-- Nuevas opciones y actualización de etiquetas de bebida
-- ---------------------------------------------------------------------------
insert into public.meal_options (category_id, label, sort_order)
select c.id, v.label, v.ord
from public.meal_option_categories c
cross join lateral (
  values
    ('gasto', '🤷🏻‍♂️ Nada', 65),
    ('bebida', '🚫 Sin bebida', 70)
) as v(cat_code, label, ord)
where c.code = v.cat_code
on conflict (category_id, label) do nothing;

update public.meal_options mo
set label = m.new_label
from public.meal_option_categories c
join (
  values
    ('bebida', 'Cerveza', '🍺 Cerveza'),
    ('bebida', 'Vino', '🍷 Vino'),
    ('bebida', 'Vino con gaseosa', '🍷🫧 Vino con gaseosa'),
    ('bebida', 'Refresco', '🥤 Refresco'),
    ('bebida', 'Agua', '💧 Agua'),
    ('bebida', 'Zumo / Bebida natural', '🧃 Zumo / Bebida natural'),
    ('bebida', '🍺 Cerveza', '🍺 Cerveza'),
    ('bebida', '🍷 Vino', '🍷 Vino'),
    ('bebida', '🍷🫧 Vino con gaseosa', '🍷🫧 Vino con gaseosa'),
    ('bebida', '🥤 Refresco', '🥤 Refresco'),
    ('bebida', '💧 Agua', '💧 Agua'),
    ('bebida', '🧃 Zumo / Bebida natural', '🧃 Zumo / Bebida natural')
) as m(cat_code, old_label, new_label) on c.code = m.cat_code
where mo.category_id = c.id
  and mo.label = m.old_label;

-- ---------------------------------------------------------------------------
-- RLS tabla puente
-- ---------------------------------------------------------------------------
alter table public.almuerzo_gasto_selections enable row level security;

drop policy if exists "almuerzo_gasto_sel_select_own" on public.almuerzo_gasto_selections;
create policy "almuerzo_gasto_sel_select_own" on public.almuerzo_gasto_selections
  for select using (
    exists (
      select 1 from public.almuerzos a
      where a.id = almuerzo_gasto_selections.almuerzo_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "almuerzo_gasto_sel_insert_own" on public.almuerzo_gasto_selections;
create policy "almuerzo_gasto_sel_insert_own" on public.almuerzo_gasto_selections
  for insert with check (
    exists (
      select 1 from public.almuerzos a
      where a.id = almuerzo_gasto_selections.almuerzo_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "almuerzo_gasto_sel_delete_own" on public.almuerzo_gasto_selections;
create policy "almuerzo_gasto_sel_delete_own" on public.almuerzo_gasto_selections
  for delete using (
    exists (
      select 1 from public.almuerzos a
      where a.id = almuerzo_gasto_selections.almuerzo_id
        and a.user_id = auth.uid()
    )
  );

drop policy if exists "almuerzo_gasto_sel_update_own" on public.almuerzo_gasto_selections;
create policy "almuerzo_gasto_sel_update_own" on public.almuerzo_gasto_selections
  for update using (
    exists (
      select 1 from public.almuerzos a
      where a.id = almuerzo_gasto_selections.almuerzo_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.almuerzos a
      where a.id = almuerzo_gasto_selections.almuerzo_id
        and a.user_id = auth.uid()
    )
  );
