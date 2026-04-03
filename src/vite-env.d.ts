/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' para mostrar login con contraseña (QA / evitar rate limit de email) */
  readonly VITE_ENABLE_PASSWORD_LOGIN?: string
  /** Contraseña para correos en autoLogin (ver src/lib/autoLogin.ts); solo .env local */
  readonly VITE_AUTO_LOGIN_SHARED_PASSWORD?: string
  /** Clau del navegador (Maps JavaScript API + Places); restricció per referrers a GCP */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
