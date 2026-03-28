import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createAlmuerzo,
  getAlmuerzo,
  getFotoPublicUrl,
  MAX_FOTOS_ALMUERZO,
  updateAlmuerzo,
} from '../lib/almuerzosApi'
import { formatSupabaseError } from '../lib/errors'
import { hasSupabaseConfig } from '../lib/env'
import type { AlmuerzoInput } from '../types/almuerzo'

type FormMode = 'create' | 'edit'

type Props = {
  mode: FormMode
}

const CA_MONTHS = [
  'gener',
  'febrer',
  'març',
  'abril',
  'maig',
  'juny',
  'juliol',
  'agost',
  'setembre',
  'octubre',
  'novembre',
  'desembre',
] as const

function caMonthDeMonth(monthIndex: number): string {
  const m = CA_MONTHS[monthIndex]
  if (m === 'abril' || m === 'agost' || m === 'octubre') return `d'${m}`
  return `de ${m}`
}

/** Etiqueta tipus "Hui (26 d'octubre)" o "25 de novembre" */
function mealDateChipLabel(iso: string): string {
  const parts = iso.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return iso
  const [ys, ms, ds] = parts
  const d = new Date(ys, ms - 1, ds)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  const day = d.getDate()
  const inner = `${day} ${caMonthDeMonth(d.getMonth())}`
  return isToday ? `Hui (${inner})` : inner
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildInput(
  barName: string,
  mealDate: string,
  gasto: string,
  drink: string,
  bocName: string,
  bocIng: string,
  coffee: string,
  priceStr: string,
  review: string,
): AlmuerzoInput {
  const priceTrim = priceStr.trim()
  let price: number | null = null
  if (priceTrim !== '') {
    const n = Number(priceTrim.replace(',', '.'))
    price = Number.isFinite(n) ? n : null
  }
  return {
    bar_name: barName.trim(),
    meal_date: mealDate,
    gasto,
    drink,
    bocadillo_name: bocName,
    bocadillo_ingredients: bocIng,
    coffee,
    price,
    review,
  }
}

function IconSearch(props: { className?: string }) {
  return (
    <svg className={props.className} width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconCalendar(props: { className?: string }) {
  return (
    <svg className={props.className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconChevronDown(props: { className?: string }) {
  return (
    <svg className={props.className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPinSmall(props: { className?: string }) {
  return (
    <svg className={props.className} width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.5" fill="currentColor" />
    </svg>
  )
}

/** Futur: ciutat i província des de la BD del bar. */
const PLACEHOLDER_BAR_UBICACIO = 'València, València'

type MidStep = 2 | 3 | 4

/**
 * Capçalera compartida pasos 2–4: nom del bar, ubicació (placeholder) i barra de progrés (3 trams).
 */
function FormFlowMidChrome({
  step,
  barName,
  onBack,
  title,
  subtitle,
  children,
  footer,
}: {
  step: MidStep
  barName: string
  onBack: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  const progressPct = ((step - 1) / 3) * 100

  return (
    <>
      <div className="form-mid-top">
        <button type="button" className="form-mid-back" onClick={onBack} aria-label="Enrere">
          <span aria-hidden>←</span>
        </button>
        <div className="form-mid-context">
          <h2 className="form-mid-bar-name">{barName.trim() || 'Bar'}</h2>
          <p
            className="form-mid-location"
            title="En el futur, aquesta dada vindrà del bar triat a la base de dades."
          >
            <IconPinSmall className="form-mid-location-icon" />
            <span>{PLACEHOLDER_BAR_UBICACIO}</span>
          </p>
        </div>
      </div>

      <div
        className="form-mid-progress-wrap"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step - 1}
        aria-label={`Pas ${step - 1} de 3: bocadillo, beguda i cafè`}
      >
        <div className="form-mid-progress-track">
          <div className="form-mid-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="form-mid-progress-steps" aria-hidden>
          {[1, 2, 3].map((n) => {
            const sub = step - 1
            const cls = [sub >= n ? 'is-reached' : '', sub === n ? 'is-current' : '']
              .filter(Boolean)
              .join(' ')
            return (
              <span key={n} className={cls || undefined}>
                {n}
              </span>
            )
          })}
        </div>
      </div>

      <div className="form-mid-body">
        <div className="form-mid-step-head">
          <h1 className="form-mid-title">{title}</h1>
          {subtitle ? <p className="form-mid-subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </div>

      <div className="form-mid-footer">{footer}</div>
    </>
  )
}

/**
 * Formulari multipas per crear o editar un almuerzo (pas 1 amb UX dissenyada).
 */
export function AlmuerzoForm({ mode }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)

  const [barName, setBarName] = useState('')
  const [mealDate, setMealDate] = useState(todayISO())
  const [gasto, setGasto] = useState('')
  const [drink, setDrink] = useState('')
  const [bocName, setBocName] = useState('')
  const [bocIng, setBocIng] = useState('')
  const [coffee, setCoffee] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [review, setReview] = useState('')

  const [keepPaths, setKeepPaths] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = mode === 'create' ? 'Nou esmorzar' : 'Editar esmorzar'

  const newPreviewUrls = useMemo(
    () => newFiles.map((f) => URL.createObjectURL(f)),
    [newFiles],
  )

  useEffect(() => {
    return () => {
      newPreviewUrls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [newPreviewUrls])

  useEffect(() => {
    if (mode !== 'edit' || !id || !hasSupabaseConfig()) {
      setLoadingEdit(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoadingEdit(true)
        const row = await getAlmuerzo(id)
        if (cancelled || !row) {
          if (!cancelled && !row) setError('No hem trobat aquest esmorzar.')
          return
        }
        setBarName(row.bar_name)
        setMealDate(row.meal_date)
        setGasto(row.gasto ?? '')
        setDrink(row.drink ?? '')
        setBocName(row.bocadillo_name ?? '')
        setBocIng(row.bocadillo_ingredients ?? '')
        setCoffee(row.coffee ?? '')
        setPriceStr(row.price != null ? String(row.price) : '')
        setReview(row.review ?? '')
        setKeepPaths([...row.photo_paths])
        setError(null)
      } catch (e) {
        if (!cancelled) setError(formatSupabaseError(e))
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, id])

  const totalFotos = keepPaths.length + newFiles.length
  const puedeMasFotos = totalFotos < MAX_FOTOS_ALMUERZO

  const closeHref = mode === 'create' ? '/' : `/almuerzo/${id}`

  function openDatePicker() {
    const el = dateInputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.click()
    }
  }

  function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const incoming = Array.from(fileList)
    const room = MAX_FOTOS_ALMUERZO - totalFotos
    if (room <= 0) return
    const next = [...newFiles, ...incoming.slice(0, room)]
    setNewFiles(next)
  }

  function removeNewFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function removeKeepPath(path: string) {
    setKeepPaths((prev) => prev.filter((p) => p !== path))
  }

  function handleStep1Next() {
    setError(null)
    if (!barName.trim()) {
      setError('El nom del bar és obligatori.')
      return
    }
    setStep(2)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!barName.trim()) {
      setError('El nombre del bar es obligatorio.')
      return
    }

    const input = buildInput(
      barName,
      mealDate,
      gasto,
      drink,
      bocName,
      bocIng,
      coffee,
      priceStr,
      review,
    )

    try {
      setSaving(true)
      if (mode === 'create') {
        const row = await createAlmuerzo(input, newFiles)
        navigate(`/almuerzo/${row.id}`, { replace: true })
      } else if (id) {
        await updateAlmuerzo(id, input, keepPaths, newFiles)
        navigate(`/almuerzo/${id}`, { replace: true })
      }
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  if (!hasSupabaseConfig()) {
    return (
      <main className="page">
        <p className="banner banner-warn">Configura primer el fitxer .env amb Supabase.</p>
        <Link to="/" className="back-link">
          ← Tornar
        </Link>
      </main>
    )
  }

  if (loadingEdit) {
    return (
      <main className="page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Carregant formulari…</span>
        </div>
      </main>
    )
  }

  const mainClass = [
    'page',
    step === 1 ? 'form-flow form-flow--step1' : '',
    step >= 2 && step <= 4 ? 'form-flow form-flow--mid' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={mainClass}>
      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}

      {step === 1 && (
        <>
          <div className="form-step1-header-row">
            <Link to={closeHref} className="form-step1-close" aria-label="Tancar">
              ×
            </Link>
          </div>

          <h1 className="form-step1-title">¿On has esmorzat hui?</h1>

          <div className="form-step1-body">
            <label className="form-step1-label" htmlFor="form-step1-bar">
              Bar
            </label>
            <div className="form-step1-search-wrap">
              <IconSearch className="form-step1-search-icon" />
              <input
                id="form-step1-bar"
                className="form-step1-search-input"
                type="text"
                value={barName}
                onChange={(e) => setBarName(e.target.value)}
                autoComplete="off"
                placeholder="Busca un bar…"
                enterKeyHint="next"
              />
            </div>

            <div className="form-step1-date-row">
              <input
                ref={dateInputRef}
                type="date"
                className="visually-hidden"
                tabIndex={-1}
                value={mealDate}
                onChange={(e) => setMealDate(e.target.value)}
                aria-label="Data de l'esmorzar"
              />
              <button
                type="button"
                className="form-step1-date-btn"
                onClick={openDatePicker}
                aria-label="Obrir selector de data"
              >
                <IconCalendar />
                <span>{mealDateChipLabel(mealDate)}</span>
                <IconChevronDown />
              </button>
            </div>
          </div>

          <div className="form-step1-cta">
            <button type="button" className="btn btn-primary" onClick={handleStep1Next}>
              Següent
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <FormFlowMidChrome
          step={2}
          barName={barName}
          onBack={() => setStep(1)}
          title="¿Què has menjat?"
          subtitle="Bocadillo i aperitius del bar."
          footer={
            <button type="button" className="btn btn-primary form-mid-cta-primary" onClick={() => setStep(3)}>
              Següent
            </button>
          }
        >
          <label className="form-step2-label" htmlFor="form-step2-boc">
            Bocadillo
          </label>
          <input
            id="form-step2-boc"
            className="form-step2-pill"
            type="text"
            value={bocName}
            onChange={(e) => setBocName(e.target.value)}
            autoComplete="off"
            placeholder="Ex.: bikini, esgarrat, pernil…"
            enterKeyHint="next"
          />

          <label className="form-step2-label" htmlFor="form-step2-gasto">
            Gasto
          </label>
          <textarea
            id="form-step2-gasto"
            className="form-step2-area"
            value={gasto}
            onChange={(e) => setGasto(e.target.value)}
            rows={3}
            placeholder="Olives, creïlles, ametles…"
            enterKeyHint="next"
          />
        </FormFlowMidChrome>
      )}

      {step === 3 && (
        <FormFlowMidChrome
          step={3}
          barName={barName}
          onBack={() => setStep(2)}
          title="¿Què has begut?"
          subtitle="Beguda de l’esmorzar."
          footer={
            <button type="button" className="btn btn-primary form-mid-cta-primary" onClick={() => setStep(4)}>
              Següent
            </button>
          }
        >
          <label className="form-step2-label" htmlFor="form-step3-drink">
            Beguda
          </label>
          <input
            id="form-step3-drink"
            className="form-step2-pill"
            type="text"
            value={drink}
            onChange={(e) => setDrink(e.target.value)}
            placeholder="Vi amb gas, cervesa, aigua…"
            autoComplete="off"
          />
        </FormFlowMidChrome>
      )}

      {step === 4 && (
        <FormFlowMidChrome
          step={4}
          barName={barName}
          onBack={() => setStep(3)}
          title="I el cafè?"
          subtitle="Si n’has pres, digues quin."
          footer={
            <button type="button" className="btn btn-primary form-mid-cta-primary" onClick={() => setStep(5)}>
              Següent
            </button>
          }
        >
          <label className="form-step2-label" htmlFor="form-step4-coffee">
            Cafè
          </label>
          <input
            id="form-step4-coffee"
            className="form-step2-pill"
            type="text"
            value={coffee}
            onChange={(e) => setCoffee(e.target.value)}
            placeholder="Cremaet, tallat, sol…"
            autoComplete="off"
          />
        </FormFlowMidChrome>
      )}

      {step === 5 && (
        <>
          <header className="page-header">
            <button type="button" className="back-link form-flow-back" onClick={() => setStep(4)}>
              ← Enrere
            </button>
            <h1>{title}</h1>
            <p className="muted">Pas 5 de 5 · Resum, reseña, precio y fotos</p>
          </header>

          <form className="stack-form" onSubmit={onSubmit}>
            <label className="field">
              <span>Ingredientes del bocadillo</span>
              <textarea value={bocIng} onChange={(e) => setBocIng(e.target.value)} rows={2} />
            </label>
            <label className="field">
              <span>Precio (opcional)</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="Ej. 12,50"
              />
            </label>
            <label className="field">
              <span>Reseña</span>
              <textarea value={review} onChange={(e) => setReview(e.target.value)} rows={4} placeholder="Qué te ha parecido…" />
            </label>

            <fieldset className="field">
              <legend>Fotos (máx. {MAX_FOTOS_ALMUERZO})</legend>
              <p className="muted small">
                {totalFotos}/{MAX_FOTOS_ALMUERZO} fotos
              </p>

              <div className="photo-previews">
                {keepPaths.map((path) => (
                  <div key={path} className="photo-preview-wrap">
                    <img src={getFotoPublicUrl(path)} alt="" className="photo-thumb" />
                    <button type="button" className="btn-remove-photo" onClick={() => removeKeepPath(path)} aria-label="Quitar foto">
                      ×
                    </button>
                  </div>
                ))}
                {newFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="photo-preview-wrap">
                    <img src={newPreviewUrls[i]} alt="" className="photo-thumb" />
                    <button
                      type="button"
                      className="btn-remove-photo"
                      onClick={() => removeNewFile(i)}
                      aria-label="Quitar foto nueva"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <label className="file-input-label">
                <span className="btn btn-secondary">Añadir fotos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={!puedeMasFotos}
                  className="visually-hidden"
                  onChange={(e) => {
                    onPickFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </fieldset>

            <div className="actions-row form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  )
}
