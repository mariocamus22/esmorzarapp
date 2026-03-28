import { type FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { hasSupabaseConfig } from '../lib/env'
import { supabase } from '../lib/supabaseClient'

/**
 * Acceso por enlace mágico al correo (Supabase Auth).
 */
export function LoginPage() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
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
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    setSubmitting(false)

    if (error) {
      setErr(formatSupabaseError(error))
      return
    }
    setSent(true)
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Iniciar sesión</h1>
        <p className="muted">Te enviaremos un enlace mágico a tu correo (sin contraseña).</p>
      </header>

      {sent ? (
        <div className="banner banner-warn" role="status">
          <p>
            Revisa tu bandeja de entrada (y spam). Abre el enlace del correo para entrar en Esmorzar.
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
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
    </main>
  )
}
