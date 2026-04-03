import { type FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { autoLoginSharedPassword, isAutoLoginEmail } from '../lib/autoLogin'
import { hasSupabaseConfig, passwordLoginEnabled } from '../lib/env'
import { supabase } from '../lib/supabaseClient'

/**
 * Acceso por enlace mágico al correo (Supabase Auth).
 */
export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const allowPassword = passwordLoginEnabled()
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!hasSupabaseConfig()) {
    return (
      <main className="page">
        <p className="banner banner-warn">Falta el archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</p>
        <Link to="/">Volver</Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Cargando…</p>
      </main>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setErr('Escribe tu correo electrónico.')
      return
    }

    setSubmitting(true)

    const emailNorm = trimmed.toLowerCase()
    const shared = autoLoginSharedPassword()
    const useAutoLogin = isAutoLoginEmail(trimmed) && shared != null

    if (isAutoLoginEmail(trimmed) && !shared) {
      setSubmitting(false)
      setErr(
        'Este correo usa acceso directo: añade VITE_AUTO_LOGIN_SHARED_PASSWORD al archivo .env (ver .env.example).',
      )
      return
    }

    const res = useAutoLogin
      ? await supabase.auth.signInWithPassword({
          email: emailNorm,
          password: shared,
        })
      : allowPassword && password.trim()
        ? await supabase.auth.signInWithPassword({
            email: trimmed,
            password: password.trim(),
          })
        : await supabase.auth.signInWithOtp({
            email: trimmed,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
            },
          })

    setSubmitting(false)

    if (res.error) {
      setErr(formatSupabaseError(res.error))
      return
    }

    if (useAutoLogin || (allowPassword && password.trim())) {
      return
    }
    setSent(true)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Iniciar sesión</h1>
        <p className="muted">
          {isAutoLoginEmail(email) && autoLoginSharedPassword()
            ? 'Con este correo entras directamente (sin correo ni contraseña en pantalla).'
            : allowPassword
              ? 'Con contraseña entras sin correo (ideal para pruebas). Déjala vacía para el enlace mágico.'
              : 'Te enviaremos un enlace mágico a tu correo (sin contraseña).'}
        </p>
      </header>

      {sent ? (
        <div className="banner banner-warn" role="status">
          <p>
            Revisa tu bandeja de entrada (y spam). Abre el enlace del correo para entrar en Esmorzapp.
          </p>
          <p className="small muted login-hint">Puedes cerrar esta pestaña después.</p>
        </div>
      ) : (
        <form className="stack-form" onSubmit={onSubmit}>
          {err && (
            <p className="banner banner-error" role="alert">
              {err}
            </p>
          )}
          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </label>
          {allowPassword && !(isAutoLoginEmail(email) && autoLoginSharedPassword()) && (
            <label className="field">
              <span>Contraseña (solo QA)</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Vacío = enlace mágico"
              />
            </label>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? isAutoLoginEmail(email) && autoLoginSharedPassword()
                ? 'Entrando…'
                : 'Enviando…'
              : isAutoLoginEmail(email) && autoLoginSharedPassword()
                ? 'Entrar'
                : allowPassword && password.trim()
                  ? 'Entrar'
                  : 'Enviar enlace'}
          </button>
        </form>
      )}
    </main>
  )
}
