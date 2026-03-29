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

type DetailCategory = 'bocGasto' | 'drink' | 'coffee'

function gastoPartsList(g: string | null | undefined): string[] {
  return (g ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function DetailCategoryPanel({ category, row }: { category: DetailCategory; row: Almuerzo }) {
  const bocName = row.bocadillo_name?.trim() ?? ''
  const bocIng = row.bocadillo_ingredients?.trim() ?? ''
  const bocChipText = [bocName, bocIng].filter(Boolean).join('\n')
  const gastoItems = gastoPartsList(row.gasto)
  const drink = row.drink?.trim() ?? ''
  const coffee = row.coffee?.trim() ?? ''

  if (category === 'bocGasto') {
    return (
      <>
        <div className="detail-subsection">
          <h3 className="detail-subsection-title">Bocadillo</h3>
          {bocChipText ? (
            <span className="detail-readonly-chip detail-readonly-chip--block">{bocChipText}</span>
          ) : (
            <p className="detail-empty-val">No registrat</p>
          )}
        </div>
        <div className="detail-subsection">
          <h3 className="detail-subsection-title">Gasto</h3>
          {gastoItems.length > 0 ? (
            <div className="detail-readonly-chips-row">
              {gastoItems.map((label, i) => (
                <span key={`${label}-${i}`} className="detail-readonly-chip">
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="detail-empty-val">No registrat</p>
          )}
        </div>
      </>
    )
  }

  if (category === 'drink') {
    return (
      <div className="detail-subsection">
        <h3 className="detail-subsection-title">Beguda</h3>
        {drink ? (
          <span className="detail-readonly-chip detail-readonly-chip--block">{drink}</span>
        ) : (
          <p className="detail-empty-val">No registrat</p>
        )}
      </div>
    )
  }

  return (
    <div className="detail-subsection">
      <h3 className="detail-subsection-title">Cafè</h3>
      {coffee ? (
        <span className="detail-readonly-chip detail-readonly-chip--block">{coffee}</span>
      ) : (
        <p className="detail-empty-val">No registrat</p>
      )}
    </div>
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
  const [detailCategory, setDetailCategory] = useState<DetailCategory>('bocGasto')

  useEffect(() => {
    setDetailCategory('bocGasto')
  }, [id])

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
                <span className="detail-review-quote-mark" aria-hidden>
                  &ldquo;
                </span>
                <p className="detail-review-quote-text">{reviewTrim}</p>
              </blockquote>
            )}
          </div>

          <div className="detail-hero-wrap">
            <DetailHero paths={row.photo_paths} />
          </div>

          <div className="detail-pad detail-stack">
            <nav className="detail-nav-chips" role="tablist" aria-label="Categories de l'esmorzar">
              <button
                type="button"
                id="detail-tab-boc-gasto"
                role="tab"
                aria-selected={detailCategory === 'bocGasto'}
                aria-controls="detail-category-panel"
                className={`detail-nav-chip ${detailCategory === 'bocGasto' ? 'is-active' : ''}`}
                onClick={() => setDetailCategory('bocGasto')}
              >
                <span className="detail-nav-chip-emoji" aria-hidden>
                  🍔
                </span>
                <span>Bocadillo i Gasto</span>
              </button>
              <button
                type="button"
                id="detail-tab-drink"
                role="tab"
                aria-selected={detailCategory === 'drink'}
                aria-controls="detail-category-panel"
                className={`detail-nav-chip ${detailCategory === 'drink' ? 'is-active' : ''}`}
                onClick={() => setDetailCategory('drink')}
              >
                <span className="detail-nav-chip-emoji" aria-hidden>
                  🍺
                </span>
                <span>Beguda</span>
              </button>
              <button
                type="button"
                id="detail-tab-coffee"
                role="tab"
                aria-selected={detailCategory === 'coffee'}
                aria-controls="detail-category-panel"
                className={`detail-nav-chip ${detailCategory === 'coffee' ? 'is-active' : ''}`}
                onClick={() => setDetailCategory('coffee')}
              >
                <span className="detail-nav-chip-emoji" aria-hidden>
                  ☕
                </span>
                <span>Cafè</span>
              </button>
            </nav>

            <div
              id="detail-category-panel"
              className="detail-category-panel"
              role="tabpanel"
              aria-labelledby={
                detailCategory === 'bocGasto'
                  ? 'detail-tab-boc-gasto'
                  : detailCategory === 'drink'
                    ? 'detail-tab-drink'
                    : 'detail-tab-coffee'
              }
            >
              <DetailCategoryPanel category={detailCategory} row={row} />
            </div>

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
