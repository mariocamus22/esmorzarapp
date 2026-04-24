import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { formatSupabaseError } from '../lib/errors'
import { getFotoPublicUrl, listAlmuerzos, listLevels } from '../lib/almuerzosApi'
import { barLocationLine } from '../lib/barLocation'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo, LevelRow, UserProfile } from '../types/almuerzo'
import { FirstAlmuerzoCelebrationModal } from '../components/FirstAlmuerzoCelebrationModal'
import { MAIN_CONTENT_ID } from '../components/SkipToMainContent'
import { IconEsmorzar } from '../components/IconEsmorzar'

function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Nombre del bocadillo para la zona inferior de la tarjeta del historial (texto completo). */
function nomBocadilloResum(a: Almuerzo): string {
  const n = a.bocadillo_name?.trim()
  if (n) return n
  return 'Sin bocadillo'
}

function firstName(user: User | null): string {
  if (!user) return 'amigo'
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const full =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : null
  if (full?.trim()) {
    const part = full.trim().split(/\s+/)[0]
    return part || 'amigo'
  }
  const email = user.email?.split('@')[0]
  return email?.trim() || 'amigo'
}

/** Progreso hacia el siguiente nivel según `total_meals` del perfil y la tabla `levels`. */
function nextLevelProgress(
  profile: UserProfile | null,
  levels: LevelRow[],
  levelsReady: boolean,
  profileLoading: boolean,
):
  | { kind: 'loading' }
  | { kind: 'fallback' }
  | { kind: 'next'; remaining: number }
  | { kind: 'max' } {
  if (!levelsReady || (profileLoading && profile == null)) return { kind: 'loading' }
  if (!profile || levels.length === 0) return { kind: 'fallback' }
  const total = profile.total_meals
  const next = levels.find((l) => l.min_meals > total)
  if (!next) return { kind: 'max' }
  return { kind: 'next', remaining: Math.max(0, next.min_meals - total) }
}

function levelHintText(progress: ReturnType<typeof nextLevelProgress>): string {
  if (progress.kind === 'loading') {
    return 'Cargando tu progreso…'
  }
  if (progress.kind === 'fallback') {
    return 'Añade almuerzos para pasar al siguiente nivel.'
  }
  if (progress.kind === 'max') {
    return '¡Has alcanzado el nivel más alto!'
  }
  if (progress.remaining <= 0) {
    return '¡Siguiente nivel desbloqueado!'
  }
  if (progress.remaining === 1) {
    return 'Añade 1 almuerzo más para pasar al siguiente nivel.'
  }
  return `Añade ${progress.remaining} almuerzos más para pasar al siguiente nivel.`
}

function IconCroissant() {
  return (
    <svg
      className="home-logo-svg"
      width={44}
      height={44}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <g fill="currentColor" transform="translate(12 12) rotate(-22)">
        <ellipse cx="-5.2" cy="0" rx="3.6" ry="5.2" />
        <ellipse cx="0" cy="0" rx="4.2" ry="5.6" />
        <ellipse cx="5.2" cy="0" rx="3.6" ry="5.2" />
      </g>
    </svg>
  )
}

function IconBowlEmpty() {
  return (
    <svg width={56} height={56} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M14 30c0 16 10.5 24 18 24s18-8 18-24H14z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M46 22l10 12M56 22L46 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Burbuja de mensaje + idea: sugiere opiniones y mejoras. */
function IconFeedback() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M6.5 18.5L5 21l3.2-.9c.9.5 1.9.8 3 .9h4.1c2.5 0 4.5-2 4.5-4.5v-6C20 7.5 18 5.5 15.5 5.5H8.5C6 5.5 4 7.5 4 10v6c0 .9.3 1.7.8 2.4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 3.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2z"
        fill="currentColor"
        opacity={0.92}
      />
    </svg>
  )
}

type FeedbackModalProps = {
  open: boolean
  onClose: () => void
}

function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const titleId = useId()
  const descId = useId()
  const fieldId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [shake, setShake] = useState(false)

  useFocusTrap(dialogRef, { active: open, initialFocusRef: taRef })

  useEffect(() => {
    if (!open) return
    const t1 = window.setTimeout(() => {
      setText('')
    }, 0)
    return () => {
      window.clearTimeout(t1)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const send = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
      taRef.current?.focus()
      return
    }
    const to = (import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined)?.trim()
    const subject = encodeURIComponent('Esmorzapp — Feedback')
    const body = encodeURIComponent(trimmed)
    const href = to
      ? `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`
    window.location.href = href
    onClose()
  }, [text, onClose])

  if (!open) return null

  return (
    <div className="feedback-modal-root" role="presentation">
      <button
        type="button"
        className="feedback-modal-backdrop"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="feedback-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="feedback-modal-head">
          <div className="feedback-modal-head-text">
            <h2 id={titleId} className="feedback-modal-title">
              Cuéntanos qué mejorarías
            </h2>
            <p id={descId} className="feedback-modal-desc">
              Ideas, fallos que hayas visto o cualquier sugerencia nos ayuda a pulir Esmorzapp.
            </p>
          </div>
          <button type="button" className="feedback-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <label className="feedback-modal-label" htmlFor={fieldId}>
          <span className="feedback-modal-label-text">Tu mensaje</span>
          <textarea
            ref={taRef}
            id={fieldId}
            className={`feedback-modal-textarea ${shake ? 'feedback-modal-textarea--shake' : ''}`}
            rows={5}
            placeholder="Por ejemplo: me gustaría poder filtrar por bar, o el botón X no responde en…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="feedback-modal-actions">
          <button type="button" className="btn btn-ghost feedback-modal-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary feedback-modal-btn-primary" onClick={send}>
            Enviar con el correo
          </button>
        </div>
        <p className="feedback-modal-footnote">
          Se abrirá tu app de correo con el mensaje listo. Si no tienes cuenta configurada, copia el
          texto antes de cerrar.
        </p>
      </div>
    </div>
  )
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconHistoryCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** Icono modo lista (historial en filas). */
function IconViewList({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h13M8 12h13M8 17h13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="5" cy="7" r="1.35" fill="currentColor" />
      <circle cx="5" cy="12" r="1.35" fill="currentColor" />
      <circle cx="5" cy="17" r="1.35" fill="currentColor" />
    </svg>
  )
}

/** Icono modo calendario (con rejilla de días). */
function IconViewCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8.25" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="15.75" cy="13.5" r="1.1" fill="currentColor" />
      <circle cx="8.25" cy="17.25" r="1.1" fill="currentColor" />
      <circle cx="12" cy="17.25" r="1.1" fill="currentColor" />
    </svg>
  )
}

const HOME_RECENT_VIEW_KEY = 'esmorzapp-home-recent-view'

type RecentViewMode = 'list' | 'calendar'

function readStoredRecentView(): RecentViewMode {
  try {
    const v = localStorage.getItem(HOME_RECENT_VIEW_KEY)
    if (v === 'list' || v === 'calendar') return v
  } catch {
    /* ignore */
  }
  return 'list'
}

function monthFromLatestMeal(items: Almuerzo[]): { year: number; month: number } {
  if (items.length === 0) {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  const iso = items[0].meal_date.slice(0, 10)
  const [y, m] = iso.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return { year: y, month: m }
}

function dateKeyFromAlmuerzo(a: Almuerzo): string {
  return a.meal_date.slice(0, 10)
}

function mealsGroupedByDate(items: Almuerzo[]): Map<string, Almuerzo[]> {
  const m = new Map<string, Almuerzo[]>()
  for (const a of items) {
    const k = dateKeyFromAlmuerzo(a)
    const arr = m.get(k) ?? []
    arr.push(a)
    m.set(k, arr)
  }
  return m
}

/** Primer almuerzo del día según el orden de `items` (fecha ↓, creación ↓). */
function firstAlmuerzoForDateKey(items: Almuerzo[], dateKey: string): Almuerzo | null {
  for (const a of items) {
    if (dateKeyFromAlmuerzo(a) === dateKey) return a
  }
  return null
}

/** Primer día de la semana = lunes (índice 0..6). */
function mondayIndexFromDate(d: Date): number {
  const sun = d.getDay()
  return sun === 0 ? 6 : sun - 1
}

const WEEKDAY_LABELS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

type HomeMealCalendarProps = {
  items: Almuerzo[]
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
}

function HomeMealCalendar({ items, year, month, onPrevMonth, onNextMonth }: HomeMealCalendarProps) {
  const byDate = useMemo(() => mealsGroupedByDate(items), [items])

  const { title, cells } = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const startPad = mondayIndexFromDate(first)
    const daysInM = new Date(year, month, 0).getDate()
    const totalCells = Math.ceil((startPad + daysInM) / 7) * 7
    const out: { day: number | null; key: string | null; hasMeal: boolean; isToday: boolean }[] = []

    const today = new Date()
    const isThisMonth =
      today.getFullYear() === year && today.getMonth() + 1 === month
    const todayNum = isThisMonth ? today.getDate() : -1

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startPad + 1
      if (dayNum < 1 || dayNum > daysInM) {
        out.push({ day: null, key: null, hasMeal: false, isToday: false })
        continue
      }
      const key = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
      const hasMeal = (byDate.get(key)?.length ?? 0) > 0
      out.push({
        day: dayNum,
        key,
        hasMeal,
        isToday: dayNum === todayNum,
      })
    }

    const title = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    return { title, cells: out }
  }, [year, month, byDate])

  return (
    <div className="home-meal-calendar">
      <div className="home-meal-cal-nav">
        <button type="button" className="home-meal-cal-nav-btn" onClick={onPrevMonth} aria-label="Mes anterior">
          ‹
        </button>
        <span className="home-meal-cal-title">{title}</span>
        <button type="button" className="home-meal-cal-nav-btn" onClick={onNextMonth} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="home-meal-cal-weekdays" aria-hidden>
        {WEEKDAY_LABELS_ES.map((l, i) => (
          <span key={`wd-${i}`} className="home-meal-cal-weekday">
            {l}
          </span>
        ))}
      </div>
      <div className="home-meal-cal-grid" role="grid" aria-label="Días con almuerzos registrados">
        {cells.map((c, idx) => {
          if (c.day == null) {
            return <div key={`e-${idx}`} className="home-meal-cal-cell home-meal-cal-cell--empty" />
          }
          const count = c.key ? byDate.get(c.key)?.length ?? 0 : 0
          const cellClass = `home-meal-cal-cell${c.hasMeal ? ' home-meal-cal-cell--has-meal' : ''}${c.isToday ? ' home-meal-cal-cell--today' : ''}`

          if (c.hasMeal && c.key) {
            const first = firstAlmuerzoForDateKey(items, c.key)
            if (first) {
              const ariaDay =
                count > 1
                  ? `${c.day}: ${count} almuerzos, abrir el más reciente`
                  : `${c.day}: 1 almuerzo, ver detalle`
              return (
                <Link
                  key={c.key}
                  to={`/almuerzo/${first.id}`}
                  className={cellClass}
                  role="gridcell"
                  aria-label={ariaDay}
                >
                  <span className="home-meal-cal-day-num">{c.day}</span>
                </Link>
              )
            }
          }

          return (
            <div
              key={c.key}
              className={cellClass}
              role="gridcell"
              aria-label={
                c.hasMeal
                  ? `${c.day}: ${count} almuerzo${count === 1 ? '' : 's'}`
                  : `${c.day}: sin almuerzos`
              }
            >
              <span className="home-meal-cal-day-num">{c.day}</span>
            </div>
          )
        })}
      </div>
      <p className="home-meal-cal-legend">
        <span className="home-meal-cal-legend-dot" aria-hidden />
        Día con almuerzo: pulsa para abrir la ficha (si hay varios, el más reciente)
      </p>
    </div>
  )
}

function HistoryCardAvatar({ photoPath }: { photoPath: string | null }) {
  if (photoPath) {
    return (
      <img
        src={getFotoPublicUrl(photoPath)}
        alt=""
        className="home-history-avatar-img"
        loading="lazy"
      />
    )
  }
  return (
    <div className="home-history-avatar-placeholder" aria-hidden>
      <IconEsmorzar className="home-history-avatar-placeholder-icon" />
    </div>
  )
}

/**
 * Pantalla principal: resumen, estadísticas y últimos almuerzos.
 */
export function HomeList() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    user,
    signOut,
    profile,
    profileLoading,
    refreshProfile,
    greetingHint,
    effectiveUserId,
    isImpersonating,
  } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [items, setItems] = useState<Almuerzo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [levelsReady, setLevelsReady] = useState(false)
  const [recentViewMode, setRecentViewMode] = useState<RecentViewMode>(() => readStoredRecentView())
  const [calMonth, setCalMonth] = useState<{ year: number; month: number }>(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const celebrateFirstAlmuerzo = useMemo(() => {
    const s = location.state as { celebrateFirstAlmuerzo?: boolean } | null
    return Boolean(s?.celebrateFirstAlmuerzo)
  }, [location.state])

  const dismissFirstAlmuerzoCelebration = useCallback(() => {
    navigate('.', { replace: true, state: {} })
  }, [navigate])

  useEffect(() => {
    if (!celebrateFirstAlmuerzo) return
    void refreshProfile()
  }, [celebrateFirstAlmuerzo, refreshProfile])

  const persistRecentView = useCallback((mode: RecentViewMode) => {
    setRecentViewMode(mode)
    try {
      localStorage.setItem(HOME_RECENT_VIEW_KEY, mode)
    } catch {
      /* ignore */
    }
  }, [])

  const goCalPrev = useCallback(() => {
    setCalMonth((prev) => {
      if (prev.month <= 1) return { year: prev.year - 1, month: 12 }
      return { year: prev.year, month: prev.month - 1 }
    })
  }, [])

  const goCalNext = useCallback(() => {
    setCalMonth((prev) => {
      if (prev.month >= 12) return { year: prev.year + 1, month: 1 }
      return { year: prev.year, month: prev.month + 1 }
    })
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig() || !effectiveUserId) {
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
  }, [effectiveUserId])

  useEffect(() => {
    if (!hasSupabaseConfig()) {
      setLevels([])
      setLevelsReady(true)
      return
    }
    let cancelled = false
    setLevelsReady(false)
    void listLevels()
      .then((L) => {
        if (!cancelled) setLevels(L)
      })
      .catch(() => {
        if (!cancelled) setLevels([])
      })
      .finally(() => {
        if (!cancelled) setLevelsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sinConfig = !hasSupabaseConfig()
  const showRecentViewToggle = !sinConfig && !loading && !error && items.length > 0
  const nom = greetingHint ?? firstName(user)
  /** Contador de almuerzos: misma fuente que la lista (evita desfase con `profile.total_meals`). */
  const esmorzarCount = items.length
  /** Bares distintos (nombre normalizado): solo sube cuando aparece un bar nuevo en el historial. */
  const uniqueBars = useMemo(
    () => new Set(items.map((i) => i.bar_name.trim().toLowerCase())).size,
    [items],
  )
  const nivell = profile?.level?.label ?? '…'

  const statEsmorzars = loading ? '—' : String(esmorzarCount)
  const statBars = loading ? '—' : String(uniqueBars)
  const statNivell = loading || (profileLoading && profile == null) ? '…' : nivell

  const levelProgress = useMemo(
    () => nextLevelProgress(profile, levels, levelsReady, profileLoading),
    [profile, levels, levelsReady, profileLoading],
  )

  const statsHint = useMemo(() => {
    if (sinConfig) {
      return 'Cuando registres almuerzos, aquí verás cuántos faltan para el siguiente nivel.'
    }
    return levelHintText(levelProgress)
  }, [sinConfig, levelProgress])

  return (
    <main id={MAIN_CONTENT_ID} className="page home-page">
      <FirstAlmuerzoCelebrationModal
        open={celebrateFirstAlmuerzo}
        onClose={dismissFirstAlmuerzoCelebration}
        levelLabel={profile?.level?.label}
      />
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <header className="home-top-bar">
        <div className="home-brand">
          <IconCroissant />
          <span className="home-brand-name">Esmorzapp</span>
        </div>
        <div className="home-top-actions">
          <button
            type="button"
            className="home-theme-toggle"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Modo oscuro"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            onClick={toggleTheme}
          >
            <span className="home-theme-toggle-track" aria-hidden>
              <span className="home-theme-toggle-thumb" />
            </span>
          </button>
          <button
            type="button"
            className="home-feedback-btn"
            onClick={() => setFeedbackOpen(true)}
            aria-label="Enviar opiniones o informar de un problema"
            title="Tu opinión nos ayuda a mejorar"
          >
            <IconFeedback />
          </button>
        </div>
      </header>

      <h1 className="home-greeting">¿Dónde toca almorzar hoy, {nom}?</h1>

      <div className="home-stats-row" aria-live="polite">
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
              {statEsmorzars}
            </span>
          </div>
          <span className="home-stat-label">Almuerzos</span>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
              {statBars}
            </span>
          </div>
          <span className="home-stat-label">Bares</span>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span
              className={`home-stat-value home-stat-value--level ${loading ? 'home-stat-value--muted' : ''}`}
            >
              {statNivell}
            </span>
          </div>
          <span className="home-stat-label">Nivel</span>
        </div>
      </div>

      <p className="home-stats-hint">{statsHint}</p>

      {sinConfig && (
        <p className="banner banner-warn" role="status">
          Configura Supabase: copia <code>.env.example</code> a <code>.env</code> y pega la URL y la clave
          anónima del panel.
        </p>
      )}

      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}

      {isImpersonating ? (
        <p className="banner banner-warn home-cta-readonly" role="status">
          Modo solo lectura: estás viendo la app como otro usuario. No se pueden crear ni editar
          almuerzos.
        </p>
      ) : (
        <Link to="/nuevo" className="btn btn-primary home-cta">
          <span className="home-cta-icon" aria-hidden>
            +
          </span>
          Nuevo almuerzo
        </Link>
      )}

      <section className="home-recent" aria-labelledby="home-recent-heading">
        <div className="home-recent-head">
          <h2 id="home-recent-heading" className="home-recent-title">
            Últimos almuerzos
          </h2>
          {showRecentViewToggle && (
            <div className="home-recent-view-toggle" role="group" aria-label="Vista del listado de bares">
              <button
                type="button"
                className={`home-recent-view-btn${recentViewMode === 'list' ? ' home-recent-view-btn--active' : ''}`}
                onClick={() => persistRecentView('list')}
                aria-pressed={recentViewMode === 'list'}
                aria-label="Vista en lista"
                title="Lista"
              >
                <IconViewList />
              </button>
              <button
                type="button"
                className={`home-recent-view-btn${recentViewMode === 'calendar' ? ' home-recent-view-btn--active' : ''}`}
                onClick={() => {
                  setCalMonth(monthFromLatestMeal(items))
                  persistRecentView('calendar')
                }}
                aria-pressed={recentViewMode === 'calendar'}
                aria-label="Vista en calendario"
                title="Calendario"
              >
                <IconViewCalendar />
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="home-loading-inline" aria-busy="true" aria-live="polite">
            <span className="spinner" aria-hidden />
            <span>Cargando…</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && !sinConfig && (
          <div className="home-empty-card" aria-live="polite">
            <div className="home-empty-icon">
              <IconBowlEmpty />
            </div>
            <p className="home-empty-title">
              {isImpersonating ? 'Este usuario no tiene almuerzos registrados' : 'Todavía no tienes ningún almuerzo'}
            </p>
            <p className="home-empty-desc">
              {isImpersonating
                ? 'Prueba con otro usuario desde la barra de administración.'
                : 'Añade el primero para empezar a llevar un registro.'}
            </p>
          </div>
        )}

        {!loading && items.length > 0 && recentViewMode === 'calendar' && (
          <HomeMealCalendar
            items={items}
            year={calMonth.year}
            month={calMonth.month}
            onPrevMonth={goCalPrev}
            onNextMonth={goCalNext}
          />
        )}

        {!loading && items.length > 0 && recentViewMode === 'list' && (
          <ul className="home-recent-list">
            {items.map((a) => {
              const firstPhoto = a.photo_paths?.[0] ?? null
              return (
                <li key={a.id}>
                  <Link to={`/almuerzo/${a.id}`} className="home-history-card">
                    <div className="home-history-card-header">
                      <HistoryCardAvatar photoPath={firstPhoto} />
                      <div className="home-history-text">
                        <span className="home-history-bar">{a.bar_name}</span>
                        <span className="home-history-city">{barLocationLine(a.bar_formatted_address)}</span>
                        <div className="home-history-date">
                          <IconHistoryCalendar className="home-history-date-icon" />
                          <span className="home-history-date-text">{formatFechaLarga(a.meal_date)}</span>
                        </div>
                      </div>
                      <IconChevron className="home-history-chevron" />
                    </div>
                    <div className="home-history-divider-wrap" aria-hidden>
                      <span className="home-history-divider" />
                    </div>
                    <div className="home-history-summary">
                      <IconEsmorzar className="home-history-burger-icon" width={16} height={16} />
                      <p className="home-history-summary-text">
                        <span className="home-history-summary-label">Bocadillo:</span>{' '}
                        <span className="home-history-summary-name">{nomBocadilloResum(a)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <footer className="home-footer">
        <button type="button" className="home-sign-out" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </footer>
    </main>
  )
}
