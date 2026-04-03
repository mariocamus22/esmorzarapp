# Lo que tú debes hacer en tu cuenta (paso a paso)

Ya está hecho en el repo: código, `git init`, primer commit, `vercel.json`, `netlify.toml`, migraciones SQL y `.env.example`. **Lo que sigue requiere tu login** en GitHub, Vercel/Netlify y Supabase.

---

## 1. Archivo `.env` en tu Mac (solo en tu ordenador)

1. En la carpeta del proyecto, si no existe `.env`, cópialo desde el ejemplo:
   ```bash
   cd /Users/mariocamusferragud/Desktop/EsmorzarAPP
   cp .env.example .env
   ```
2. Abre `.env` con un editor y pega:
   - `VITE_SUPABASE_URL` = `https://TU_PROJECT_ID.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = tu clave anon / publishable (del panel de Supabase).
   - Opcional pero recomendable para la **cerca de bars** (Google Places): `VITE_GOOGLE_MAPS_API_KEY` = clave de navegador de Google Cloud (la misma que usarás en Vercel; ver sección 3).
3. **No subas `.env` a GitHub** (ya está en `.gitignore`).

---

## 2. Subir el código a GitHub

1. Entra en [https://github.com/new](https://github.com/new) y crea un repositorio **vacío** (sin README, sin .gitignore).
2. Anota la URL, por ejemplo `https://github.com/TU_USUARIO/esmorzarapp.git`.
3. En la terminal, dentro de la carpeta del proyecto:
   ```bash
   cd /Users/mariocamusferragud/Desktop/EsmorzarAPP
   git remote add origin https://github.com/TU_USUARIO/esmorzarapp.git
   git branch -M main
   git push -u origin main
   ```
   Si GitHub pide login, usa **HTTPS + token personal** o **SSH** según cómo tengas configurado Git.

---

## 3. Desplegar en Vercel (recomendado para Vite)

1. Entra en [https://vercel.com](https://vercel.com) e inicia sesión (puedes usar “Continue with GitHub”).
2. **Add New… → Project** → importa el repo `esmorzarapp`.
3. **Framework Preset:** Vite (o “Other” si no aparece; el build sigue siendo el mismo).
4. **Build Command:** `npm run build`  
   **Output Directory:** `dist`
5. **Environment Variables** (Settings → Environment Variables del proyecto, o en el asistente del primer deploy):
   - `VITE_SUPABASE_URL` — mismo valor que en tu `.env` local.
   - `VITE_SUPABASE_ANON_KEY` — mismo valor que en tu `.env` local.
   - `VITE_GOOGLE_MAPS_API_KEY` — **copia el valor desde tu `.env` del Mac** (no lo subas a GitHub). Sin esta variable, el despliegue seguirá funcionando pero el campo del bar será solo texto, sin autocompletado de Google.
   - Para cada una, marca **Production** y **Preview** (así funcionan tanto la URL principal como los despliegues de rama).
6. **Google Cloud** (misma clave que acabas de pegar): en la credencial de la API, restricción por **referentes HTTP**, añade también:
   - `https://*.vercel.app/*` (o la URL concreta tipo `https://tu-proyecto.vercel.app/*`) para producción y previews.
7. Pulsa **Deploy** (o **Redeploy** si el proyecto ya existía tras añadir variables). Cuando termine, te dará una URL `https://algo.vercel.app`.

---

## 4. Supabase: que el login y el despliegue funcionen

En [https://supabase.com/dashboard](https://supabase.com/dashboard) → tu proyecto:

### 4.1 URLs de redirección (enlace mágico)

1. Ve a **Authentication → URL Configuration**.
2. **Site URL:** pon la URL de producción, por ejemplo `https://tu-app.vercel.app` (la que te dio Vercel).
3. En **Redirect URLs**, añade una línea por cada origen desde el que uses la app, por ejemplo:
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`
   - `https://tu-app.vercel.app/**`
4. Guarda.

### 4.2 Proveedor Email

1. **Authentication → Providers → Email**: activado.
2. En desarrollo, los correos de prueba a veces van a spam; en producción puedes configurar SMTP propio más adelante.

### 4.3 Si algo falla al guardar datos

1. **SQL Editor:** ejecuta en orden `001_initial.sql`, `002_auth_rls.sql`, `003_options_levels_profiles.sql`; si aplica, `004_backfill_option_ids_from_text.sql` **antes** de `005`; luego `005`, `006`, `007_sin_cafe_y_cacahuetes_collaret.sql` y, si usas Google Places al guardar bars, `008_almuerzos_google_places.sql`.

### 4.4 Nivel y tiempo real (perfil)

La migración `003` añade la tabla `profiles` a la publicación `supabase_realtime`. Si el nivel no se actualiza en vivo en otro dispositivo, en Supabase revisa **Database → Replication** y confirma que `profiles` está publicada (la migración lo intenta por SQL).

---

## 5. Probar en el móvil con la URL pública

1. Abre en tu móvil Chrome **la URL de Vercel** (HTTPS).
2. Inicia sesión con el enlace mágico.
3. Crea un almuerzo de prueba y sube una foto.
4. Opcional: menú del navegador → **“Instalar aplicación”** o **“Añadir a pantalla de inicio”**.

---

## 6. Alternativa: Netlify

1. [https://app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** → GitHub → el mismo repo.
2. Build: `npm run build`, publish: `dist` (el archivo `netlify.toml` ya lo indica).
3. **Site settings → Environment variables:** añade `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_GOOGLE_MAPS_API_KEY` (valor copiado de tu `.env` local). Define los mismos nombres para **Production** y para **Deploy Previews** si usas ramas.
4. En **Google Cloud → Credenciales**, en los referentes HTTP de la clave, incluye `https://tu-app.netlify.app/*` (y el dominio de preview de Netlify si aplica).
5. Repite los pasos de **Supabase → Redirect URLs** con la URL que te dé Netlify (`https://tu-app.netlify.app`).

---

## Resumen

| Quién | Qué |
|--------|-----|
| Ya hecho en el repo | Código, git inicial, commit, configs Vercel/Netlify, migraciones, PWA |
| Tú | `.env` local, GitHub remoto, `git push`, proyecto en Vercel o Netlify, variables de entorno allí, URLs en Supabase, pruebas en el móvil |

Si te atascas en un paso concreto (por ejemplo Git o el primer push), dime en qué mensaje de error te quedas y lo vemos.
