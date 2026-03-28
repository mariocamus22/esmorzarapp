import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatSupabaseError } from '../lib/errors'
import { deleteAlmuerzo, getAlmuerzo, getFotoPublicUrl } from '../lib/almuerzosApi'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo } from '../types/almuerzo'

const PLACEHOLDER_CIUTAT_PROVINCIA = 'València, València'

function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPrecioPill(n: number): string {
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

function IconBurgerSummary({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSummaryGasto({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5h11l-1 14H8L7 5zM7 5V4a2 2 0 012-2h2a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 9h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconDrinkTab({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3h8l-1 14.5a2 2 0 01-2 1.5h-2a2 2 0 01-2-1.5L8 3zM6 8h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCoffeeTab({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6h12v6a4 4 0 01-4 4H10a4 4 0 01-4-4V6zM18 9h1.5a2.5 2.5 0 010 5H18M8 20h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLocationPin({ className }: { className?: string }) {
  return (
    <svg className={className} width={12} height={12} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21c0 0 7-4.55 7-10a7 7 0 10-14 0c0 5.45 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.25" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconDetailCamera({ className }: { className?: string }) {
  return (
    <svg className={className} width={48} height={48} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h3l1.5-2h7l1.5 2h3v9H4V10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DetailHero({ paths }: { paths: string[] }) {
  const [i, setI] = useState(0)
  const n = paths.length

  useEffect(() => {
    setI((prev) => (n === 0 ? 0 : Math.min(prev, n - 1)))
  }, [n])

  if (n === 0) {
    return (
      <div className="detail-hero detail-hero--empty" aria-label="Sense fotos">
        <IconDetailCamera className="detail-hero-empty-icon" />
      </div>
    )
  }

  return (
    <div className="detail-hero">
      <div className="detail-hero-viewport">
        <div className="detail-hero-track" style={{ transform: `translateX(-${i * 100}%)` }}>
          {paths.map((p) => (
            <div key={p} className="detail-hero-slide">
              <img src={getFotoPublicUrl(p)} alt="" />
            </div>
          ))}
        </div>
        {n > 1 && (
          <div className="detail-hero-dots" role="tablist" aria-label="Seleccionar foto">
            {paths.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === i}
                className={`detail-hero-dot ${idx === i ? 'is-active' : ''}`}
                onClick={() => setI(idx)}
                aria-label={`Foto ${idx + 1} de ${n}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Detall d'un esmorzar: lectura, editar i eliminar (amb confirmació).
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
          setError(data ? null : 'No hem trobat aquest esmorzar.')
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
      'Segur que vols eliminar aquest esmorzar? Aquesta acció no es pot desfer.',
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
        <p className="banner banner-warn">Falta configurar el fitxer .env amb Supabase.</p>
        <Link to="/">← Tornar</Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="page detail-page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Carregant…</span>
        </div>
      </main>
    )
  }

  if (error || !row) {
    return (
      <main className="page">
        <p className="banner banner-error">{error ?? 'No trobat'}</p>
        <Link to="/" className="back-link">
          ← Tornar al llistat
        </Link>
      </main>
    )
  }

  const bocText =
    [row.bocadillo_name?.trim(), row.bocadillo_ingredients?.trim()].filter(Boolean).join('\n\n') || '—'
  const gastoText = row.gasto?.trim() || '—'
  const drinkText = row.drink?.trim() || '—'
  const coffeeText = row.coffee?.trim() || '—'
  const reviewTrim = row.review?.trim() ?? ''
  const hasReview = reviewTrim.length > 0

  return (
    <main className="page detail-page">
      <div className="detail-layout">
        <div className="detail-scroll">
          <div className="detail-pad">
            <header className="detail-header-editorial">
              <div className="detail-header-x-row">
                <Link to="/" className="detail-close" aria-label="Tancar">
                  ×
                </Link>
              </div>
              <div className="detail-header-inner">
                <time className="detail-header-date" dateTime={row.meal_date}>
                  {formatFechaLarga(row.meal_date)}
                </time>
                <h1 className="detail-header-title">{row.bar_name}</h1>
                <div className="detail-header-loc">
                  <IconLocationPin className="detail-header-pin" aria-hidden />
                  <span className="detail-header-loc-text">{PLACEHOLDER_CIUTAT_PROVINCIA}</span>
                </div>
              </div>
            </header>
          </div>

          <div className="detail-hero-wrap">
            <DetailHero paths={row.photo_paths} />
          </div>

          <div className="detail-pad detail-stack">
            <div className="form-summary-card detail-summary-card">
              <div className="form-summary-rows">
                <div className="form-summary-row">
                  <IconBurgerSummary className="form-summary-icon" />
                  <p className="form-summary-text">{bocText}</p>
                </div>
                <div className="form-summary-row">
                  <IconSummaryGasto className="form-summary-icon" />
                  <p className="form-summary-text">{gastoText}</p>
                </div>
                <div className="form-summary-row">
                  <IconDrinkTab className="form-summary-icon" />
                  <p className="form-summary-text">{drinkText}</p>
                </div>
                <div className="form-summary-row">
                  <IconCoffeeTab className="form-summary-icon" />
                  <p className="form-summary-text">{coffeeText}</p>
                </div>
              </div>
            </div>

            {hasReview && (
              <div className="detail-review-block">
                <span className="detail-review-label">La teua nota</span>
                <p className="detail-review-sublabel">Este comentario es privado</p>
                <textarea
                  className="detail-review-readonly"
                  readOnly
                  tabIndex={-1}
                  rows={4}
                  value={reviewTrim}
                  aria-label="La teua nota"
                />
              </div>
            )}

            {typeof row.price === 'number' && Number.isFinite(row.price) && (
              <div className="detail-price-wrap">
                <span className="detail-price-pill" aria-label="Preu">
                  {formatPrecioPill(row.price)} €
                </span>
              </div>
            )}
          </div>
        </div>

        <footer className="detail-footer">
          <div className="detail-footer-row">
            <button
              type="button"
              className="detail-btn-delete"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Eliminant…' : 'Eliminar'}
            </button>
            <Link to={`/almuerzo/${id}/editar`} className="detail-btn-edit">
              <IconPencil className="detail-btn-edit-icon" aria-hidden />
              Editar esmorzar
            </Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
