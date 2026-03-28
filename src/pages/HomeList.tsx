import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { listAlmuerzos } from '../lib/almuerzosApi'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo } from '../types/almuerzo'

function formatFecha(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function resumen(a: Almuerzo): string {
  const b = a.bocadillo_name?.trim()
  if (b) return b
  const r = a.review?.trim()
  if (r) return r.length > 80 ? `${r.slice(0, 80)}…` : r
  return 'Sin descripción'
}

/**
 * Pantalla principal: lista de almuerzos (historial), más reciente primero.
 */
export function HomeList() {
  const { user, signOut } = useAuth()
  const [items, setItems] = useState<Almuerzo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSupabaseConfig() || !user?.id) {
      setLoading(false)
      setError(null)
      setItems([])
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const rows = await listAlmuerzos()
        if (!cancelled) {
          setItems(rows)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const sinConfig = !hasSupabaseConfig()

  return (
    <main className="page">
      <header className="page-header page-header-row">
        <div>
          <h1>Mis almuerzos</h1>
          <p className="muted">Tu historial de almuerzos valencianos.</p>
        </div>
        <div className="header-actions">
          <Link to="/nuevo" className="btn btn-primary btn-compact">
            Nuevo
          </Link>
          <button type="button" className="btn btn-ghost btn-compact" onClick={() => signOut()}>
            Salir
          </button>
        </div>
      </header>

      {sinConfig && (
        <p className="banner banner-warn" role="status">
          Configura Supabase: copia <code>.env.example</code> a <code>.env</code> y pega la URL y la
          clave anon del panel.
        </p>
      )}

      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <div className="loading-block" aria-busy="true" aria-live="polite">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando tu lista…</span>
        </div>
      )}

      {!loading && !error && items.length === 0 && !sinConfig && (
        <section className="empty-state" aria-live="polite">
          <p>Aún no has registrado ningún almuerzo.</p>
          <Link to="/nuevo" className="btn btn-primary">
            Nuevo almuerzo
          </Link>
        </section>
      )}

      {!loading && items.length > 0 && (
        <ul className="almuerzo-list">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={`/almuerzo/${a.id}`} className="almuerzo-card">
                <span className="almuerzo-card-title">{a.bar_name}</span>
                <span className="almuerzo-card-meta">{formatFecha(a.meal_date)}</span>
                <span className="almuerzo-card-snippet">{resumen(a)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
