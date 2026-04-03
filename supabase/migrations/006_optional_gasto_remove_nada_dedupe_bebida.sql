-- Gasto opcional: elimina la opción "🤷🏻‍♂️ Nada" y selecciones asociadas.
-- Re-ejecuta la fusión bebida (con/sin emoji) por si quedaron duplicados.

-- ---------------------------------------------------------------------------
-- Quitar opción gasto "Nada" (y variantes con 🤷 + "nada" en etiqueta)
-- ---------------------------------------------------------------------------
delete from public.almuerzo_gasto_selections ags
using public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id
where ags.option_id = mo.id
  and c.code = 'gasto'
  and mo.label ~* 'nada'
  and mo.label ~ '🤷';

delete from public.meal_options mo
using public.meal_option_categories c
where mo.category_id = c.id
  and c.code = 'gasto'
  and mo.label ~* 'nada'
  and mo.label ~ '🤷';

-- ---------------------------------------------------------------------------
-- Duplicados bebida: fusionar FK y borrar fila plana (idempotente, como 005)
-- ---------------------------------------------------------------------------
do $bebida_merge$
declare
  cid smallint;
begin
  select c.id into cid from public.meal_option_categories c where c.code = 'bebida' limit 1;
  if cid is null then
    return;
  end if;

  update public.almuerzos a
  set bebida_option_id = e.id
  from public.meal_options e, public.meal_options p
  where e.category_id = cid
    and p.category_id = cid
    and p.id <> e.id
    and a.bebida_option_id = p.id
    and (
      (p.label = 'Cerveza' and e.label = '🍺 Cerveza')
      or (p.label = 'Vino' and e.label = '🍷 Vino')
      or (p.label = 'Vino con gaseosa' and e.label = '🍷🫧 Vino con gaseosa')
      or (p.label = 'Refresco' and e.label = '🥤 Refresco')
      or (p.label = 'Agua' and e.label = '💧 Agua')
      or (p.label = 'Zumo / Bebida natural' and e.label = '🧃 Zumo / Bebida natural')
    );

  delete from public.meal_options p
  using public.meal_options e
  where p.category_id = cid
    and e.category_id = cid
    and p.id <> e.id
    and (
      (p.label = 'Cerveza' and e.label = '🍺 Cerveza')
      or (p.label = 'Vino' and e.label = '🍷 Vino')
      or (p.label = 'Vino con gaseosa' and e.label = '🍷🫧 Vino con gaseosa')
      or (p.label = 'Refresco' and e.label = '🥤 Refresco')
      or (p.label = 'Agua' and e.label = '💧 Agua')
      or (p.label = 'Zumo / Bebida natural' and e.label = '🧃 Zumo / Bebida natural')
    );
end $bebida_merge$;

-- Etiquetas planas → con emoji (por si quedó alguna fila suelta)
update public.meal_options mo
set label = '🍺 Cerveza'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Cerveza';

update public.meal_options mo
set label = '🍷 Vino'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Vino';

update public.meal_options mo
set label = '🍷🫧 Vino con gaseosa'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Vino con gaseosa';

update public.meal_options mo
set label = '🥤 Refresco'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Refresco';

update public.meal_options mo
set label = '💧 Agua'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Agua';

update public.meal_options mo
set label = '🧃 Zumo / Bebida natural'
where mo.category_id = (select id from public.meal_option_categories where code = 'bebida' limit 1)
  and mo.label = 'Zumo / Bebida natural';
