# Esmorzar (PWA)

App para registrar almuerzos valencianos. Stack: **Vite**, **React**, **TypeScript**, **Supabase** (datos + auth por enlace mágico + fotos).

## En local

```bash
cp .env.example .env   # rellena URL y clave de Supabase
npm install
npm run dev
```

Abre la URL que muestra la terminal (p. ej. `http://localhost:5173`).

## Despliegue y Supabase (lo que haces tú en el navegador)

Instrucciones detalladas: **[GUIA_PASOS_MANUALES.md](GUIA_PASOS_MANUALES.md)** (GitHub, Vercel/Netlify, variables, URLs en Supabase, móvil).

## Scripts

| Comando        | Acción              |
|----------------|---------------------|
| `npm run dev`  | Servidor desarrollo |
| `npm run build`| Compilación producción → `dist` |
| `npm run preview` | Previsualizar el build |
| `npm run lint` | ESLint              |

## Migraciones SQL

Orden: `001_initial.sql` → `002_auth_rls.sql` → `003_options_levels_profiles.sql` → opcional `004_backfill_option_ids_from_text.sql` (en el SQL Editor de Supabase o con la CLI).
