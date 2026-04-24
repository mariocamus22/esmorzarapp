import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MAIN_CONTENT_ID } from './SkipToMainContent'

/**
 * Solo deja pasar a rutas hijas si hay sesión; si no, redirige a /login.
 */
export function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <main id={MAIN_CONTENT_ID} className="page">
        <div className="loading-block" role="status" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando sesión…</span>
        </div>
      </main>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
