-- Metadatos del bar desde Google Places (opcional; registres antics sense valors).
alter table public.almuerzos
  add column if not exists google_place_id text null,
  add column if not exists bar_formatted_address text null,
  add column if not exists bar_lat double precision null,
  add column if not exists bar_lng double precision null;

comment on column public.almuerzos.google_place_id is 'Google Place ID quan l''usuari tria un lloc a Places';
comment on column public.almuerzos.bar_formatted_address is 'Adreça formatada de Google (subtítol al formulari)';
comment on column public.almuerzos.bar_lat is 'Latitud WGS84 del lloc triat';
comment on column public.almuerzos.bar_lng is 'Longitud WGS84 del lloc triat';
