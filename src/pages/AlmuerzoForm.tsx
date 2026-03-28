import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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

  return (
    <main className={`page ${step === 1 ? 'form-flow form-flow--step1' : ''}`}>
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
        <>
          <header className="page-header">
            <button type="button" className="back-link form-flow-back" onClick={() => setStep(1)}>
              ← Enrere
            </button>
            <h1>{title}</h1>
            <p className="muted">Pas 2 de 5 · Bocadillo i gasto</p>
          </header>

          <div className="stack-form">
            <label className="field">
              <span>Bocadillo (nombre)</span>
              <input type="text" value={bocName} onChange={(e) => setBocName(e.target.value)} />
            </label>
            <label className="field">
              <span>Gasto</span>
              <textarea
                value={gasto}
                onChange={(e) => setGasto(e.target.value)}
                rows={2}
                placeholder="Olivas, cacahuetes…"
              />
            </label>
            <label className="field">
              <span>Ingredientes del bocadillo</span>
              <textarea value={bocIng} onChange={(e) => setBocIng(e.target.value)} rows={2} />
            </label>
          </div>
          <div className="form-flow-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              Enrere
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
              Següent
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <header className="page-header">
            <button type="button" className="back-link form-flow-back" onClick={() => setStep(2)}>
              ← Enrere
            </button>
            <h1>{title}</h1>
            <p className="muted">Pas 3 de 5 · Bebida</p>
          </header>
          <div className="stack-form">
            <label className="field">
              <span>Bebida</span>
              <input
                type="text"
                value={drink}
                onChange={(e) => setDrink(e.target.value)}
                placeholder="Vino con gaseosa, cerveza…"
              />
            </label>
          </div>
          <div className="form-flow-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
              Enrere
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
              Següent
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <header className="page-header">
            <button type="button" className="back-link form-flow-back" onClick={() => setStep(3)}>
              ← Enrere
            </button>
            <h1>{title}</h1>
            <p className="muted">Pas 4 de 5 · Café</p>
          </header>
          <div className="stack-form">
            <label className="field">
              <span>Café</span>
              <input
                type="text"
                value={coffee}
                onChange={(e) => setCoffee(e.target.value)}
                placeholder="Cremaet, cortado…"
              />
            </label>
          </div>
          <div className="form-flow-nav">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>
              Enrere
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(5)}>
              Següent
            </button>
          </div>
        </>
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
