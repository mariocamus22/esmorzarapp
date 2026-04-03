-- Opcional: intenta rellenar gasto_option_id / bebida_option_id / cafe_option_id
-- Ejecutar ANTES de 005_multi_gasto_bebida_emojis.sql (005 elimina gasto_option_id).
-- a partir de las columnas texto legadas (gasto, drink, coffee) cuando coincidan
-- exactamente con meal_options.label de la categoría correspondiente.
-- Ejecutar después de 003_options_levels_profiles.sql.

update public.almuerzos a
set gasto_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'gasto'
where a.gasto is not null
  and trim(a.gasto) <> ''
  and a.gasto_option_id is null
  and mo.label = trim(a.gasto);

-- Algunos registros antiguos pueden tener varios gastos separados por coma: tomar la primera coincidencia
update public.almuerzos a
set gasto_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'gasto'
where a.gasto is not null
  and a.gasto_option_id is null
  and mo.label = trim(split_part(a.gasto, ',', 1));

update public.almuerzos a
set bebida_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'bebida'
where a.drink is not null
  and trim(a.drink) <> ''
  and a.bebida_option_id is null
  and mo.label = trim(a.drink);

update public.almuerzos a
set cafe_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'cafe'
where a.coffee is not null
  and trim(a.coffee) <> ''
  and a.cafe_option_id is null
  and mo.label = trim(a.coffee);

-- Variantes comunes (etiquetas antiguas en catalán / mezclas)
update public.almuerzos a
set bebida_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'bebida'
where a.bebida_option_id is null
  and a.drink is not null
  and lower(trim(a.drink)) = lower(mo.label);

update public.almuerzos a
set cafe_option_id = mo.id
from public.meal_options mo
join public.meal_option_categories c on c.id = mo.category_id and c.code = 'cafe'
where a.cafe_option_id is null
  and a.coffee is not null
  and lower(trim(a.coffee)) = lower(mo.label);
