-- Nueva opción de gasto: mix de frutos secos.
-- Ejecutar después de 010 (o en proyectos ya desplegados que sigan el orden de migraciones).

insert into public.meal_options (category_id, label, sort_order)
select c.id, '🥜🌰 Mix frutos secos', 25
from public.meal_option_categories c
where c.code = 'gasto'
on conflict (category_id, label) do nothing;
