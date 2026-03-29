import { type TouchEvent, useEffect, useRef, useState } from 'react'
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

function gastoPartsList(g: string | null | undefined): string[] {
  return (g ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Comilles d'obertura (estil ❝), 20×20, color via `currentColor`. */
function IconQuoteOpen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2.8 15.2V9.9c0-1.9 1.3-3.4 3.2-4l.8 1.9c-.7.3-1.2 1-1.2 1.8v.4h2.2v5.2H2.8zm8.6 0V9.9c0-1.9 1.3-3.4 3.2-4l.8 1.9c-.7.3-1.2 1-1.2 1.8v.4h2.2v5.2h-4.8z" />
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

const SWIPE_MIN_PX = 48

function DetailHero({ paths }: { paths: string[] }) {
  const [i, setI] = useState(0)
  const n = paths.length
  const touchStartX = useRef<number | null>(null)
  const touchLastX = useRef<number | null>(null)

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

  function goNext() {
    setI((prev) => Math.min(prev + 1, n - 1))
  }

  function goPrev() {
    setI((prev) => Math.max(prev - 1, 0))
  }

  function onTouchStart(e: TouchEvent) {
    if (n <= 1) return
    touchStartX.current = e.touches[0].clientX
    touchLastX.current = e.touches[0].clientX
  }

  function onTouchMove(e: TouchEvent) {
    touchLastX.current = e.touches[0].clientX
  }

  function onTouchEnd() {
    if (n <= 1) return
    const start = touchStartX.current
    const end = touchLastX.current
    touchStartX.current = null
    touchLastX.current = null
    if (start == null || end == null) return
    const dx = start - end
    if (dx > SWIPE_MIN_PX) goNext()
    else if (dx < -SWIPE_MIN_PX) goPrev()
  }

  const translatePct = n > 0 ? (i / n) * 100 : 0

  return (
    <div className="detail-hero">
      <div
        className="detail-hero-viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="detail-hero-track"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(-${translatePct}%)`,
          }}
        >
          {paths.map((p, idx) => (
            <div
              key={`${p}-${idx}`}
              className="detail-hero-slide"
              style={{ width: `${100 / n}%` }}
            >
              <img src={getFotoPublicUrl(p)} alt="" draggable={false} />
            </div>
          ))}
        </div>
      </div>
      {n > 1 && (
        <div className="detail-hero-dots-row" role="tablist" aria-label="Seleccionar foto">
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

  const reviewTrim = row.review?.trim() ?? ''
  const hasReview = reviewTrim.length > 0
  const hasPrice = typeof row.price === 'number' && Number.isFinite(row.price)
  const bocText = [row.bocadillo_name?.trim(), row.bocadillo_ingredients?.trim()]
    .filter(Boolean)
    .join(', ')
  const gastoItems = gastoPartsList(row.gasto)
  const drinkText = row.drink?.trim() ?? ''
  const coffeeText = row.coffee?.trim() ?? ''
  const hasDrink = drinkText !== ''
  const hasCoffee = coffeeText !== ''
  const dualCols = (hasDrink && hasCoffee) || (!hasDrink && !hasCoffee)

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

            {hasReview && (
              <blockquote className="detail-review-quote">
                <IconQuoteOpen className="detail-review-quote-icon" />
                <p className="detail-review-quote-text">{reviewTrim}</p>
              </blockquote>
            )}
          </div>

          <div className="detail-hero-wrap">
            <DetailHero paths={row.photo_paths} />
          </div>

          <div className="detail-pad detail-stack">
            <section className="detail-static-root" aria-label="Detalls de l'esmorzar">
              <header className="detail-static-head">
                <span className="detail-static-title">Detalls de l&apos;esmorzar</span>
                {hasPrice && row.price != null && (
                  <span className="detail-static-price">
                    <span className="detail-static-price-label">Preu:</span>{' '}
                    <span className="detail-static-price-value">{formatPrecioPill(row.price)} €</span>
                  </span>
                )}
              </header>

              <div className="detail-static-section">
                <h3 className="detail-static-label">Bocadillo</h3>
                <p className="detail-static-boc-text">{bocText || 'No registrat'}</p>
              </div>

              <div className="detail-static-section">
                <h3 className="detail-static-label">Gasto</h3>
                {gastoItems.length > 0 ? (
                  <div className="detail-static-chip-row">
                    {gastoItems.map((label, i) => (
                      <span key={`${label}-${i}`} className="detail-static-chip">
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="detail-empty-val">No registrat</p>
                )}
              </div>

              <div className={`detail-static-drink-coffee ${dualCols ? 'is-dual' : ''}`}>
                {(dualCols || hasDrink) && (
                  <div className="detail-static-section">
                    <h3 className="detail-static-label">Beguda</h3>
                    {hasDrink ? (
                      <span className="detail-static-chip">{drinkText}</span>
                    ) : (
                      <p className="detail-empty-val">No registrat</p>
                    )}
                  </div>
                )}
                {(dualCols || hasCoffee) && (
                  <div className="detail-static-section">
                    <h3 className="detail-static-label">Café</h3>
                    {hasCoffee ? (
                      <span className="detail-static-chip">{coffeeText}</span>
                    ) : (
                      <p className="detail-empty-val">No registrat</p>
                    )}
                  </div>
                )}
              </div>
            </section>
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
