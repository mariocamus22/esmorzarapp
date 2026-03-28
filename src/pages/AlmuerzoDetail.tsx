import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatSupabaseError } from '../lib/errors'
import { deleteAlmuerzo, getAlmuerzo, getFotoPublicUrl } from '../lib/almuerzosApi'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo } from '../types/almuerzo'

function formatFecha(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatPrecio(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

/**
 * Detalle de un almuerzo: lectura, editar y eliminar (con confirmación).
 */
export function AlmuerzoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [row, setRow] = useState<Almuerzo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id || !hasSupabaseConfig()) {
      setLoading(false)
      setRow(null)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const data = await getAlmuerzo(id)
        if (!cancelled) {
          setRow(data)
          setError(data ? null : 'No encontramos este almuerzo.')
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
  }, [id])

  async function handleDelete() {
    if (!id || !row) return
    const ok = window.confirm(
      '¿Seguro que quieres eliminar este almuerzo? Esta acción no se puede deshacer.',
    )
    if (!ok) return

    try {
      setDeleting(true)
      await deleteAlmuerzo(id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(formatSupabaseError(e))
    } finally {
      setDeleting(false)
    }
  }

  if (!hasSupabaseConfig()) {
    return (
      <main className="page">
        <p className="banner banner-warn">Falta configurar el archivo .env con Supabase.</p>
        <Link to="/">← Volver</Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando almuerzo…</span>
        </div>
      </main>
    )
  }

  if (error || !row) {
    return (
      <main className="page">
        <p className="banner banner-error">{error ?? 'No encontrado'}</p>
        <Link to="/" className="back-link">
          ← Volver al listado
        </Link>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <Link to="/" className="back-link">
          ← Volver al listado
        </Link>
        <h1>{row.bar_name}</h1>
        <p className="muted">{formatFecha(row.meal_date)}</p>
      </header>

      <dl className="detail-grid">
        <dt>Gasto</dt>
        <dd>{row.gasto ?? '—'}</dd>
        <dt>Bebida</dt>
        <dd>{row.drink ?? '—'}</dd>
        <dt>Bocadillo</dt>
        <dd>
          {row.bocadillo_name ?? '—'}
          {row.bocadillo_ingredients ? (
            <>
              <br />
              <span className="muted small">{row.bocadillo_ingredients}</span>
            </>
          ) : null}
        </dd>
        <dt>Café</dt>
        <dd>{row.coffee ?? '—'}</dd>
        <dt>Precio</dt>
        <dd>{formatPrecio(row.price)}</dd>
        <dt>Reseña</dt>
        <dd className="detail-review">{row.review ?? '—'}</dd>
      </dl>

      {row.photo_paths.length > 0 && (
        <section className="photo-grid" aria-label="Fotos del almuerzo">
          {row.photo_paths.map((path) => (
            <a key={path} href={getFotoPublicUrl(path)} target="_blank" rel="noreferrer">
              <img src={getFotoPublicUrl(path)} alt="" className="photo-thumb" />
            </a>
          ))}
        </section>
      )}

      <div className="actions-row">
        <Link to={`/almuerzo/${id}/editar`} className="btn btn-secondary">
          Editar
        </Link>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </main>
  )
}
