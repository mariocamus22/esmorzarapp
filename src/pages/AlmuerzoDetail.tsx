import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DetailPhotoLightbox } from '../components/DetailPhotoLightbox'
import { useAuth } from '../hooks/useAuth'
import { barLocationLine } from '../lib/barLocation'
import { formatSupabaseError } from '../lib/errors'
import { deleteAlmuerzo, getAlmuerzo, getFotoPublicUrl } from '../lib/almuerzosApi'
import { hasSupabaseConfig } from '../lib/env'
import { MAIN_CONTENT_ID } from '../components/SkipToMainContent'
import type { Almuerzo } from '../types/almuerzo'

function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatPrecioPill(n: number): string {
  return new Intl.NumberFormat('es-ES', {
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

/** Comillas de apertura (estilo ❝), 20×20, color vía `currentColor`. */
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

const TAP_MOVE_MAX_PX = 14

function readCarouselIndex(el: HTMLDivElement | null, n: number): number {
  if (!el || n <= 0) return 0
  const w = el.clientWidth
  if (w <= 0) return 0
  return Math.min(Math.max(0, Math.round(el.scrollLeft / w)), n - 1)
}

function DetailHero({ paths }: { paths: string[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxStart, setLightboxStart] = useState(0)
  const gestureRef = useRef<{ x0: number; y0: number; moved: boolean } | null>(null)

  const n = paths.length
  const safeI = n === 0 ? 0 : Math.min(i, n - 1)

  const syncIndexFromViewport = useCallback(() => {
    setI(readCarouselIndex(viewportRef.current, n))
  }, [n])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || n <= 1) return
    const onScrollEnd = () => syncIndexFromViewport()
    el.addEventListener('scrollend', onScrollEnd)
    let t: ReturnType<typeof setTimeout>
    const onScroll = () => {
      window.clearTimeout(t)
      t = window.setTimeout(onScrollEnd, 70)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scrollend', onScrollEnd)
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(t)
    }
  }, [n, syncIndexFromViewport])

  if (n === 0) {
    return (
      <div className="detail-hero detail-hero--empty" aria-label="Sin fotos">
        <IconDetailCamera className="detail-hero-empty-icon" />
      </div>
    )
  }

  const openLightbox = (idx: number) => {
    setLightboxStart(Math.min(Math.max(0, idx), n - 1))
    setLightboxOpen(true)
  }

  const onHeroPointerDown = (e: ReactPointerEvent) => {
    gestureRef.current = { x0: e.clientX, y0: e.clientY, moved: false }
  }

  const onHeroPointerMove = (e: ReactPointerEvent) => {
    const g = gestureRef.current
    if (!g || e.buttons === 0) return
    if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_MOVE_MAX_PX) g.moved = true
  }

  const onHeroPointerUp = (idx: number, e: ReactPointerEvent) => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g) return
    if (g.moved || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_MOVE_MAX_PX) return
    openLightbox(idx)
  }

  return (
    <>
      <div className="detail-hero">
        <div ref={viewportRef} className="detail-hero-viewport" aria-label="Carrusel de fotos">
          {paths.map((p, idx) => (
            <div
              key={`${p}-${idx}`}
              role="button"
              tabIndex={0}
              aria-label={`Foto ${idx + 1} de ${n}. Pulsa para ver en grande`}
              className="detail-hero-slide detail-hero-slide--tap"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openLightbox(idx)
                }
              }}
              onPointerDown={onHeroPointerDown}
              onPointerMove={onHeroPointerMove}
              onPointerUp={(e) => onHeroPointerUp(idx, e)}
              onPointerCancel={() => {
                gestureRef.current = null
              }}
            >
              <img src={getFotoPublicUrl(p)} alt="" draggable={false} loading={idx === 0 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </div>
        {n > 1 && (
          <div className="detail-hero-dots-row" role="tablist" aria-label="Seleccionar foto">
            {paths.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === safeI}
                className={`detail-hero-dot ${idx === safeI ? 'is-active' : ''}`}
                onClick={() => {
                  const el = viewportRef.current
                  if (!el) return
                  el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
                  setI(idx)
                }}
                aria-label={`Foto ${idx + 1} de ${n}`}
              />
            ))}
          </div>
        )}
      </div>
      {lightboxOpen && (
        <DetailPhotoLightbox paths={paths} startIndex={lightboxStart} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}

/**
 * Detalle de un almuerzo: lectura, edición y borrado (con confirmación).
 */
export function AlmuerzoDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refreshProfile, isImpersonating, effectiveUserId } = useAuth()
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
          setError(data ? null : 'No hemos encontrado ese almuerzo.')
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
  }, [id, effectiveUserId])

  async function handleDelete() {
    if (!id || !row) return
    const ok = window.confirm(
      '¿Seguro que quieres eliminar este almuerzo? Esta acción no se puede deshacer.',
    )
    if (!ok) return

    try {
      setDeleting(true)
      await deleteAlmuerzo(id)
      await refreshProfile()
      navigate('/', { replace: true })
    } catch (e) {
      setError(formatSupabaseError(e))
    } finally {
      setDeleting(false)
    }
  }

  if (!hasSupabaseConfig()) {
    return (
      <main id={MAIN_CONTENT_ID} className="page">
        <p className="banner banner-warn">Falta configurar el archivo .env con Supabase.</p>
        <Link to="/">← Volver</Link>
      </main>
    )
  }

  if (loading) {
    return (
      <main id={MAIN_CONTENT_ID} className="page detail-page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando…</span>
        </div>
      </main>
    )
  }

  if (error || !row) {
    return (
      <main id={MAIN_CONTENT_ID} className="page">
        <p className="banner banner-error">{error ?? 'No encontrado'}</p>
        <Link to="/" className="back-link">
          ← Volver al listado
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
  const gastoItems =
    row.gasto_opts.length > 0
      ? row.gasto_opts.map((g) => g.label)
      : gastoPartsList(row.gasto)
  const drinkText = (row.bebida_opt?.label ?? row.drink)?.trim() ?? ''
  const coffeeText = (row.cafe_opt?.label ?? row.coffee)?.trim() ?? ''
  const hasDrink = drinkText !== ''
  const hasCoffee = coffeeText !== ''
  const dualCols = (hasDrink && hasCoffee) || (!hasDrink && !hasCoffee)

  return (
    <main id={MAIN_CONTENT_ID} className="page detail-page">
      <div className="detail-layout">
        <div className="detail-scroll">
          <div className="detail-pad">
            <header className="detail-header-editorial">
              <div className="detail-header-x-row">
                <Link to="/" className="detail-close" aria-label="Cerrar">
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
                  <span className="detail-header-loc-text">{barLocationLine(row.bar_formatted_address)}</span>
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
            <section className="detail-static-root" aria-label="Detalles del almuerzo">
              <header className="detail-static-head">
                <span className="detail-static-title">Detalles del almuerzo</span>
                {hasPrice && row.price != null && (
                  <span className="detail-static-price">
                    <span className="detail-static-price-label">Precio:</span>{' '}
                    <span className="detail-static-price-value">{formatPrecioPill(row.price)} €</span>
                  </span>
                )}
              </header>

              <div className="detail-static-section">
                <h3 className="detail-static-label detail-static-label--accent">Bocadillo</h3>
                <p className="detail-static-boc-text">{bocText || 'No registrado'}</p>
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
                  <p className="detail-empty-val">No registrado</p>
                )}
              </div>

              <div className={`detail-static-drink-coffee ${dualCols ? 'is-dual' : ''}`}>
                {(dualCols || hasDrink) && (
                  <div className="detail-static-section">
                    <h3 className="detail-static-label detail-static-label--accent">Bebida</h3>
                    {hasDrink ? (
                      <span className="detail-static-chip">{drinkText}</span>
                    ) : (
                      <p className="detail-empty-val">No registrado</p>
                    )}
                  </div>
                )}
                {(dualCols || hasCoffee) && (
                  <div className="detail-static-section">
                    <h3 className="detail-static-label detail-static-label--accent">Café</h3>
                    {hasCoffee ? (
                      <span className="detail-static-chip">{coffeeText}</span>
                    ) : (
                      <p className="detail-empty-val">No registrado</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <footer className="detail-footer">
          {isImpersonating ? (
            <p className="banner banner-warn detail-footer-readonly" role="status">
              Solo lectura: no puedes editar ni eliminar en nombre de otro usuario.
            </p>
          ) : (
            <div className="detail-footer-row">
              <button
                type="button"
                className="detail-btn-delete"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
              <Link to={`/almuerzo/${id}/editar`} className="detail-btn-edit">
                <IconPencil className="detail-btn-edit-icon" aria-hidden />
                Editar almuerzo
              </Link>
            </div>
          )}
        </footer>
      </div>
    </main>
  )
}
