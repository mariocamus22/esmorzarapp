-- Nueva opción de café: infusiones (té, manzanilla, etc.).
-- Ejecutar después de 009 (o en proyectos ya desplegados que sigan el orden de migraciones).

insert into public.meal_options (category_id, label, sort_order)
select c.id, 'Infusión (manzanilla, poleo, té...)', 85
from public.meal_option_categories c
where c.code = 'cafe'
on conflict (category_id, label) do nothing;
