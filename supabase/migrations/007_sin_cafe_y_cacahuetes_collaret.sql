-- Plural correcto en gasto; nueva opción de café "Sin café".
-- Ejecutar después de 006 (o tras 003+ si aplicas solo parches sueltos).

update public.meal_options mo
set label = '🥜 Cacahuetes del collaret'
from public.meal_option_categories c
where mo.category_id = c.id
  and c.code = 'gasto'
  and mo.label = '🥜 Cacahuete del collaret';

insert into public.meal_options (category_id, label, sort_order)
select c.id, 'Sin café', 90
from public.meal_option_categories c
where c.code = 'cafe'
on conflict (category_id, label) do nothing;

-- Sincronizar columna texto `gasto` si ya había almuerzos con esa opción
do $ref$
declare
  r record;
begin
  for r in
    select distinct ags.almuerzo_id as aid
    from public.almuerzo_gasto_selections ags
    join public.meal_options mo on mo.id = ags.option_id
    where mo.label = '🥜 Cacahuetes del collaret'
  loop
    perform public.refresh_almuerzo_gasto_text(r.aid);
  end loop;
end $ref$;
