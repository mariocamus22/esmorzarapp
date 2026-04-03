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

Orden: `001` → `002` → `003` → opcional `004` (antes de `005` si lo usas) → `005_multi_gasto_bebida_emojis.sql` → `006_optional_gasto_remove_nada_dedupe_bebida.sql` (gasto opcional sin “Nada”, dedupe bebidas). Ejecuta en el SQL Editor de Supabase o con la CLI.
