import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  createAlmuerzo,
  getAlmuerzo,
  getFotoPublicUrl,
  listAllMealOptions,
  MAX_FOTOS_ALMUERZO,
  updateAlmuerzo,
} from '../lib/almuerzosApi'
import { BarPlaceSearch, type BarPlaceResolved } from '../components/BarPlaceSearch'
import { DrinkOptionEmoji } from '../components/DrinkOptionEmoji'
import { MapsStepDiagnostics } from '../components/MapsStepDiagnostics'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { scrollAppViewportToTop } from '../lib/scrollAppViewport'
import { barLocationLine } from '../lib/barLocation'
import { hasSupabaseConfig } from '../lib/env'
import {
  beverageSelectLabel,
  dedupeBebidaOptions,
  stripLeadingEmojisFromLabel,
} from '../lib/optionLabels'
import type { AlmuerzoInput, MealOptionCategoryCode, MealOptionRow } from '../types/almuerzo'

type FormMode = 'create' | 'edit'

type Props = {
  mode: FormMode
}

const BAR_SEARCH_PLACEHOLDER = 'Busca un bar… (ej. La Mesedora, Algemesí)'

const BOCADILLO_NAME_PLACEHOLDER = 'Ej: Chivito, Tortilla francesa con longanizas...'

const ES_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

function esMonthPhrase(monthIndex: number): string {
  return `de ${ES_MONTHS[monthIndex]}`
}

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
  const inner = `${day} ${esMonthPhrase(d.getMonth())}`
  return isToday ? `Hoy (${inner})` : inner
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function buildInput(
  barName: string,
  googlePlaceId: string | null,
  barFormattedAddress: string | null,
  barLat: number | null,
  barLng: number | null,
  mealDate: string,
  gastoOptionIds: string[],
  bebidaOptionId: string,
  cafeOptionId: string,
  bocName: string,
  bocIng: string,
  priceStr: string,
  review: string,
): AlmuerzoInput {
  const priceTrim = priceStr.trim()
  let price: number | null = null
  if (priceTrim !== '') {
    const n = Number(priceTrim.replace(',', '.'))
    price = Number.isFinite(n) ? n : null
  }
  const uniqueGasto = [...new Set(gastoOptionIds.filter((id) => id.trim() !== ''))]
  return {
    bar_name: barName.trim(),
    google_place_id: googlePlaceId,
    bar_formatted_address: barFormattedAddress,
    bar_lat: barLat,
    bar_lng: barLng,
    meal_date: mealDate,
    gasto_option_ids: uniqueGasto,
    bebida_option_id: bebidaOptionId.trim() === '' ? null : bebidaOptionId.trim(),
    cafe_option_id: cafeOptionId.trim() === '' ? null : cafeOptionId.trim(),
    bocadillo_name: bocName,
    bocadillo_ingredients: bocIng,
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

/** Icono bocadillo (asset esmorzar.svg) */
function IconSandwich(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4.838 10.405C4.000 9.000 6.000 7.000 7.038 6.595C9.500 5.500 17.500 12.000 19.162 13.595C19.000 15.000 17.500 18.000 16.962 17.405C12.000 19.000 6.000 11.000 4.838 10.405Z M10.302 8.941C10.822 9.241 7.982 11.759 8.502 12.059 M12.900 10.441C13.420 10.741 10.580 13.259 11.100 13.559 M15.498 11.941C16.018 12.241 13.178 14.759 13.698 15.059"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
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

function IconCameraPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10h2.5l1.8-2.2h7.4L17.5 10H20v9H4V10z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18.5 5.5v3M17 7h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconDrinkTab(props: { className?: string }) {
  return (
    <svg className={props.className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3h8l-1 14.5a2 2 0 01-2 1.5h-2a2 2 0 01-2-1.5L8 3zM6 8h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconCoffeeTab(props: { className?: string }) {
  return (
    <svg className={props.className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function optionsForCategory(
  rows: MealOptionRow[],
  code: MealOptionCategoryCode,
): MealOptionRow[] {
  return rows.filter((r) => r.meal_option_categories?.code === code)
}

function labelByOptionId(rows: MealOptionRow[], id: string): string {
  const t = id.trim()
  if (t === '') return ''
  return rows.find((r) => r.id === t)?.label ?? ''
}

type MidStep = 2 | 3 | 4

const FORM_HISTORY_STATE_KEY = 'almuerzoFormStep' as const

function FormSteps234Shell({
  step,
  barName,
  barSubtitle,
  closeHref,
  onTab,
  onAtras,
  onSiguiente,
  accionPrincipalLabel = 'Siguiente',
  children,
}: {
  step: MidStep
  barName: string
  barSubtitle: string
  closeHref: string
  onTab: (s: MidStep) => void
  onAtras: () => void
  onSiguiente: () => void
  accionPrincipalLabel?: string
  children: ReactNode
}) {
  return (
    <>
      <header className="form-mid-shell-header">
        <span className="form-mid-header-spacer" aria-hidden />
        <div className="form-mid-head-center">
          <h2 className="form-mid-bar-title">{barName.trim() || 'Bar'}</h2>
          <p className="form-mid-bar-subtitle">{barSubtitle}</p>
        </div>
        <Link to={closeHref} className="form-step1-close" aria-label="Cerrar">
          ×
        </Link>
      </header>

      <nav className="form-mid-tabs" aria-label="Pasos del almuerzo">
        <button
          type="button"
          className={`form-mid-tab ${step === 2 ? 'is-active' : ''}`}
          onClick={() => onTab(2)}
        >
          <IconSandwich className="form-mid-tab-icon" />
          <span className="form-mid-tab-text">Bocadillo y Gasto</span>
        </button>
        <button
          type="button"
          className={`form-mid-tab ${step === 3 ? 'is-active' : ''}`}
          onClick={() => onTab(3)}
        >
          <IconDrinkTab className="form-mid-tab-icon" />
          <span className="form-mid-tab-text">Bebida</span>
        </button>
        <button
          type="button"
          className={`form-mid-tab ${step === 4 ? 'is-active' : ''}`}
          onClick={() => onTab(4)}
        >
          <IconCoffeeTab className="form-mid-tab-icon" />
          <span className="form-mid-tab-text">Café</span>
        </button>
      </nav>

      <div className="form-mid-content">{children}</div>

      <footer className="form-mid-footer-row">
        <button type="button" className="form-mid-btn-atras" onClick={onAtras}>
          Atrás
        </button>
        <button type="button" className="form-mid-btn-siguiente" onClick={onSiguiente}>
          {accionPrincipalLabel}
          <span className="form-mid-btn-arrow" aria-hidden>
            →
          </span>
        </button>
      </footer>
    </>
  )
}

export function AlmuerzoForm({ mode }: Props) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mapsDebug = searchParams.get('mapsDebug') === '1'
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const barSearchInputRef = useRef<HTMLInputElement>(null)
  const step1BlurTimerRef = useRef<number | null>(null)
  const focusBarAfterClearRef = useRef(false)

  const [step, setStep] = useState(1)
  const [step1BarDocked, setStep1BarDocked] = useState(false)

  const [barName, setBarName] = useState('')
  /** Nombre devuelto por Places en la última selección; si el usuario edita el texto, se limpian metadatos. */
  const [barNameFromPlace, setBarNameFromPlace] = useState<string | null>(null)
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [barFormattedAddress, setBarFormattedAddress] = useState<string | null>(null)
  const [barLat, setBarLat] = useState<number | null>(null)
  const [barLng, setBarLng] = useState<number | null>(null)
  const [mealDate, setMealDate] = useState(todayISO())
  const [gastoOptionIds, setGastoOptionIds] = useState<string[]>([])
  const [bebidaOptionId, setBebidaOptionId] = useState('')
  const [cafeOptionId, setCafeOptionId] = useState('')
  const [bocName, setBocName] = useState('')
  const [bocIng, setBocIng] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [review, setReview] = useState('')

  const [mealOptions, setMealOptions] = useState<MealOptionRow[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  const [keepPaths, setKeepPaths] = useState<string[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])

  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Remonta el input con Places (uncontrolled) al limpiar el bar para vaciar el DOM. */
  const [barFieldKey, setBarFieldKey] = useState(0)

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
    if (!hasSupabaseConfig()) {
      setOptionsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setOptionsLoading(true)
        const rows = await listAllMealOptions()
        if (!cancelled) {
          setMealOptions(rows)
          setOptionsError(null)
        }
      } catch (e) {
        if (!cancelled) setOptionsError(formatSupabaseError(e))
      } finally {
        if (!cancelled) setOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
          if (!cancelled && !row) setError('No hemos encontrado ese almuerzo.')
          return
        }
        setBarName(row.bar_name)
        setGooglePlaceId(row.google_place_id)
        setBarFormattedAddress(row.bar_formatted_address)
        setBarLat(row.bar_lat)
        setBarLng(row.bar_lng)
        setBarNameFromPlace(row.google_place_id ? row.bar_name : null)
        setMealDate(row.meal_date)
        setGastoOptionIds(row.gasto_opts.map((g) => g.id))
        setBebidaOptionId(row.bebida_option_id ?? '')
        setCafeOptionId(row.cafe_option_id ?? '')
        setBocName(row.bocadillo_name ?? '')
        setBocIng(row.bocadillo_ingredients ?? '')
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

  useEffect(() => {
    if (step !== 1) {
      if (step1BlurTimerRef.current != null) {
        window.clearTimeout(step1BlurTimerRef.current)
        step1BlurTimerRef.current = null
      }
      setStep1BarDocked(false)
    }
  }, [step])

  useLayoutEffect(() => {
    scrollAppViewportToTop()
  }, [step])

  useEffect(() => {
    return () => {
      if (step1BlurTimerRef.current != null) window.clearTimeout(step1BlurTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!focusBarAfterClearRef.current) return
    focusBarAfterClearRef.current = false
    const id = window.setTimeout(() => {
      barSearchInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [barFieldKey])

  const gastoOpts = useMemo(
    () =>
      optionsForCategory(mealOptions, 'gasto').filter(
        (o) => !(/🤷/u.test(o.label) && /nada/i.test(o.label)),
      ),
    [mealOptions],
  )
  const bebidaOptsRaw = useMemo(() => optionsForCategory(mealOptions, 'bebida'), [mealOptions])
  const bebidaOpts = useMemo(() => dedupeBebidaOptions(bebidaOptsRaw), [bebidaOptsRaw])
  const cafeOpts = useMemo(() => optionsForCategory(mealOptions, 'cafe'), [mealOptions])

  const barNameFromPlaceRef = useRef<string | null>(null)
  useEffect(() => {
    barNameFromPlaceRef.current = barNameFromPlace
  }, [barNameFromPlace])

  const handleBarInputChange = useCallback((v: string) => {
    setBarName(v)
    const prev = barNameFromPlaceRef.current
    if (prev !== null && v.trim() !== prev.trim()) {
      setGooglePlaceId(null)
      setBarFormattedAddress(null)
      setBarLat(null)
      setBarLng(null)
      setBarNameFromPlace(null)
    }
  }, [])

  const handlePlaceResolved = useCallback((p: BarPlaceResolved) => {
    setBarName(p.name)
    setGooglePlaceId(p.googlePlaceId)
    setBarFormattedAddress(p.formattedAddress)
    setBarLat(p.lat)
    setBarLng(p.lng)
    setBarNameFromPlace(p.name)
  }, [])

  const onBarSearchFocus = useCallback(() => {
    if (step1BlurTimerRef.current != null) {
      window.clearTimeout(step1BlurTimerRef.current)
      step1BlurTimerRef.current = null
    }
    setStep1BarDocked(true)
  }, [])

  const onBarSearchBlur = useCallback(() => {
    if (step1BlurTimerRef.current != null) window.clearTimeout(step1BlurTimerRef.current)
    step1BlurTimerRef.current = window.setTimeout(() => {
      setStep1BarDocked(false)
      step1BlurTimerRef.current = null
    }, 220)
  }, [])

  const clearBarSearch = useCallback(() => {
    focusBarAfterClearRef.current = true
    handleBarInputChange('')
    setStep1BarDocked(true)
    if (step1BlurTimerRef.current != null) {
      window.clearTimeout(step1BlurTimerRef.current)
      step1BlurTimerRef.current = null
    }
    setBarFieldKey((k) => k + 1)
  }, [handleBarInputChange])

  const barMidSubtitle = barLocationLine(barFormattedAddress)

  const toggleGastoOption = useCallback((optId: string) => {
    setGastoOptionIds((prev) =>
      prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId],
    )
  }, [])

  useEffect(() => {
    if (optionsLoading || mealOptions.length === 0) return
    const valid = new Set(gastoOpts.map((o) => o.id))
    setGastoOptionIds((prev) => {
      const next = prev.filter((id) => valid.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [optionsLoading, mealOptions.length, gastoOpts])

  useEffect(() => {
    if (optionsLoading || mealOptions.length === 0) return
    const dedupedIds = new Set(bebidaOpts.map((o) => o.id))
    setBebidaOptionId((prev) => {
      const t = prev.trim()
      if (t === '') return prev
      if (dedupedIds.has(t)) return prev
      const row = bebidaOptsRaw.find((o) => o.id === t)
      if (!row) return prev
      const plain = stripLeadingEmojisFromLabel(row.label).toLowerCase().trim()
      const canonical = bebidaOpts.find(
        (o) => stripLeadingEmojisFromLabel(o.label).toLowerCase().trim() === plain,
      )
      return canonical?.id ?? prev
    })
  }, [optionsLoading, mealOptions.length, bebidaOpts, bebidaOptsRaw])

  const totalFotos = keepPaths.length + newFiles.length
  const puedeMasFotos = totalFotos < MAX_FOTOS_ALMUERZO

  const closeHref = mode === 'create' ? '/' : `/almuerzo/${id}`

  const pushFormHistory = useCallback((next: 2 | 3 | 4 | 5) => {
    window.history.pushState({ [FORM_HISTORY_STATE_KEY]: next }, '', window.location.href)
  }, [])

  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const v = (e.state as Record<string, unknown> | null)?.[FORM_HISTORY_STATE_KEY]
      if (typeof v === 'number' && v >= 1 && v <= 5) {
        setStep(v)
      } else {
        setStep(1)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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
      setError('El nombre del bar es obligatorio.')
      return
    }
    pushFormHistory(2)
    setStep(2)
  }

  const step2Complete = useCallback(() => bocName.trim() !== '', [bocName])

  const step3Complete = useCallback(() => bebidaOptionId.trim() !== '', [bebidaOptionId])
  const step4Complete = useCallback(() => cafeOptionId.trim() !== '', [cafeOptionId])

  function handleMidTab(s: MidStep) {
    setError(null)
    if (s < step) {
      window.history.go(s - step)
      return
    }
    if (s === step) return
    if (s === 3) {
      if (!step2Complete()) {
        setError('Completa el nombre del bocadillo antes de continuar.')
        return
      }
      pushFormHistory(3)
      setStep(3)
      return
    }
    if (s === 4) {
      if (!step2Complete()) {
        setError('Completa el nombre del bocadillo antes de continuar.')
        return
      }
      if (!step3Complete()) {
        setError('Elige una bebida antes de continuar.')
        return
      }
      pushFormHistory(4)
      setStep(4)
    }
  }

  function handleMidAtras() {
    setError(null)
    window.history.back()
  }

  function handleMidSiguiente() {
    setError(null)
    if (step === 2) {
      if (!step2Complete()) {
        setError('Completa el nombre del bocadillo antes de continuar.')
        return
      }
      pushFormHistory(3)
      setStep(3)
    } else if (step === 3) {
      if (!step3Complete()) {
        setError('Elige una bebida antes de continuar.')
        return
      }
      pushFormHistory(4)
      setStep(4)
    } else if (step === 4) {
      if (!step4Complete()) {
        setError('Elige un café antes de continuar.')
        return
      }
      pushFormHistory(5)
      setStep(5)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!barName.trim()) {
      setError('El nombre del bar es obligatorio.')
      return
    }
    if (!step2Complete() || !step3Complete() || !step4Complete()) {
      setError('Faltan datos obligatorios (bocadillo, bebida o café).')
      return
    }

    const input = buildInput(
      barName,
      googlePlaceId,
      barFormattedAddress,
      barLat,
      barLng,
      mealDate,
      gastoOptionIds,
      bebidaOptionId,
      cafeOptionId,
      bocName,
      bocIng,
      priceStr,
      review,
    )

    try {
      setSaving(true)
      if (mode === 'create') {
        const row = await createAlmuerzo(input, newFiles)
        await refreshProfile()
        navigate(`/almuerzo/${row.id}`, { replace: true })
      } else if (id) {
        await updateAlmuerzo(id, input, keepPaths, newFiles)
        await refreshProfile()
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
        <p className="banner banner-warn">Configura primero el archivo .env con Supabase.</p>
        <Link to="/" className="back-link">
          ← Volver
        </Link>
      </main>
    )
  }

  if (loadingEdit || optionsLoading) {
    return (
      <main className="page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando formulario…</span>
        </div>
      </main>
    )
  }

  const mainClass = [
    'page',
    step === 1
      ? `form-flow form-flow--step1${step1BarDocked ? ' form-flow--step1-bar-docked' : ''}`
      : '',
    step >= 2 && step <= 4 ? 'form-flow form-flow--mid' : '',
    step === 5 ? 'form-flow form-flow--step5' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const bocSummaryText = [bocName.trim(), bocIng.trim()].filter(Boolean).join('\n\n') || '—'
  const gastoSummaryText =
    gastoOptionIds.length === 0
      ? '—'
      : gastoOptionIds.map((id) => labelByOptionId(mealOptions, id)).filter(Boolean).join(', ') ||
        '—'
  const drinkSummaryText = labelByOptionId(mealOptions, bebidaOptionId) || '—'
  const coffeeSummaryText = labelByOptionId(mealOptions, cafeOptionId) || '—'

  return (
    <main className={mainClass}>
      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}
      {optionsError && (
        <p className="banner banner-error" role="alert">
          {optionsError}
        </p>
      )}

      {step === 1 && (
        <>
          <div className="form-step1-header-row">
            <Link to={closeHref} className="form-step1-close" aria-label="Cerrar">
              ×
            </Link>
          </div>

          <div className="form-step1-center">
            <h1 className="form-step1-title">¿Dónde has almorzado?</h1>

            {mapsDebug && <MapsStepDiagnostics apiKey={mapsApiKey} />}

            <div className="form-step1-body">
              <label className="form-step1-label" htmlFor="form-step1-bar">
                Bar
              </label>
              <div
                className={`form-step1-search-wrap${barName.trim() ? ' form-step1-search-wrap--has-value' : ''}`}
              >
                <IconSearch className="form-step1-search-icon" />
                <BarPlaceSearch
                  ref={barSearchInputRef}
                  key={barFieldKey}
                  id="form-step1-bar"
                  className="form-step1-search-input"
                  value={barName}
                  onBarInputChange={handleBarInputChange}
                  onPlaceResolved={handlePlaceResolved}
                  apiKey={mapsApiKey}
                  placeholder={BAR_SEARCH_PLACEHOLDER}
                  onSearchFocus={onBarSearchFocus}
                  onSearchBlur={onBarSearchBlur}
                />
                {barName.trim() !== '' && (
                  <button
                    type="button"
                    className="form-step1-search-clear"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={clearBarSearch}
                    aria-label="Borrar bar y buscar otro"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="form-step1-date-row">
                <input
                  ref={dateInputRef}
                  type="date"
                  className="visually-hidden"
                  tabIndex={-1}
                  value={mealDate}
                  onChange={(e) => setMealDate(e.target.value)}
                  aria-label="Fecha del almuerzo"
                />
                <button
                  type="button"
                  className="form-step1-date-btn"
                  onClick={openDatePicker}
                  aria-label="Abrir selector de fecha"
                >
                  <IconCalendar />
                  <span>{mealDateChipLabel(mealDate)}</span>
                  <IconChevronDown />
                </button>
              </div>
            </div>
          </div>

          <div className="form-step1-cta">
            <button type="button" className="btn btn-primary" onClick={handleStep1Next}>
              Siguiente
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <FormSteps234Shell
          step={2}
          barName={barName}
          barSubtitle={barMidSubtitle}
          closeHref={closeHref}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
        >
          <section className="form-mid-section">
            <h3 className="form-mid-section-title">Bocadillo</h3>
            <div className="form-boc-pill-wrap">
              <IconSandwich className="form-boc-pill-icon" />
              <input
                id="form-step2-boc"
                className="form-boc-pill-input"
                type="text"
                value={bocName}
                onChange={(e) => {
                  const raw = e.target.value
                  const next =
                    raw.length > 0 ? raw.charAt(0).toLocaleUpperCase('es') + raw.slice(1) : raw
                  setBocName(next)
                }}
                autoComplete="off"
                autoCapitalize="sentences"
                placeholder={BOCADILLO_NAME_PLACEHOLDER}
              />
            </div>
          </section>

          <section className="form-mid-section">
            <h3 className="form-mid-section-title">
              Gasto <span className="muted">(opcional)</span>
            </h3>
            <div className="form-gasto-grid" role="group" aria-label="Gasto en el bar (opcional)">
              {gastoOpts.map((opt) => {
                const selected = gastoOptionIds.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`form-gasto-chip ${selected ? 'is-selected' : ''}`}
                    onClick={() => toggleGastoOption(opt.id)}
                  >
                    <span className="form-gasto-chip-label">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </FormSteps234Shell>
      )}

      {step === 3 && (
        <FormSteps234Shell
          step={3}
          barName={barName}
          barSubtitle={barMidSubtitle}
          closeHref={closeHref}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
        >
          <section className="form-mid-section">
            <h3 className="form-mid-section-title">Bebida</h3>
            <div className="form-drink-card-grid" role="group" aria-label="Elige la bebida">
              {bebidaOpts.map((opt) => {
                const selected = bebidaOptionId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`form-drink-card ${selected ? 'is-selected' : ''}`}
                    onClick={() =>
                      setBebidaOptionId((prev) => (prev === opt.id ? '' : opt.id))
                    }
                  >
                    <DrinkOptionEmoji label={opt.label} className="form-drink-card-emoji" />
                    <span className="form-drink-card-label form-drink-card-label--full">
                      {beverageSelectLabel(opt.label)}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </FormSteps234Shell>
      )}

      {step === 4 && (
        <FormSteps234Shell
          step={4}
          barName={barName}
          barSubtitle={barMidSubtitle}
          closeHref={closeHref}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
          accionPrincipalLabel="Finalizar"
        >
          <section className="form-mid-section form-mid-section--cafe">
            <h3 className="form-mid-section-title">Café</h3>
            <div className="form-cafe-row-list" role="listbox" aria-label="Elige el café">
              {cafeOpts.map((opt) => {
                const selected = cafeOptionId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`form-cafe-row ${selected ? 'is-selected' : ''}`}
                    onClick={() =>
                      setCafeOptionId((prev) => (prev === opt.id ? '' : opt.id))
                    }
                  >
                    <IconCoffeeTab className="form-cafe-row-icon" aria-hidden />
                    <span className="form-cafe-row-label">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </FormSteps234Shell>
      )}

      {step === 5 && (
        <>
          <div className="form-step5-header-row">
            <Link to={closeHref} className="form-step1-close" aria-label="Cerrar">
              ×
            </Link>
          </div>

          <form className="form-step5" onSubmit={onSubmit}>
            <div className="form-step5-body">
              <div className="form-summary-card">
                <h2 className="form-summary-bar">{barName.trim() || '—'}</h2>
                <p className="form-summary-loc">{barMidSubtitle}</p>
                <div className="form-summary-rows">
                  <div className="form-summary-row">
                    <IconSandwich className="form-summary-icon" />
                    <p className="form-summary-text">{bocSummaryText}</p>
                  </div>
                  <div className="form-summary-row">
                    <IconSummaryGasto className="form-summary-icon" />
                    <p className="form-summary-text">{gastoSummaryText}</p>
                  </div>
                  <div className="form-summary-row form-summary-row--inline">
                    <span className="form-summary-inline-item">
                      <IconDrinkTab className="form-summary-icon" />
                      <span className="form-summary-text form-summary-text--inline">{drinkSummaryText}</span>
                    </span>
                    <span className="form-summary-inline-item">
                      <IconCoffeeTab className="form-summary-icon" />
                      <span className="form-summary-text form-summary-text--inline">{coffeeSummaryText}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-step5-review-block">
                <label className="form-step5-review-label" htmlFor="form-step5-review">
                  Nota personal / Reseña (opcional)
                </label>
                <p className="form-step5-review-hint">Este comentario es privado y solo lo podrás ver tú.</p>
                <textarea
                  id="form-step5-review"
                  className="form-step5-review-textarea"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  rows={4}
                  placeholder="El bocadillo de calamares estaba espectacular…"
                />
              </div>

              <div className="form-step5-price-block">
                <div className="form-step5-price-head">
                  <span className="form-step5-price-title">Precio (€)</span>
                  <span id="form-step5-price-optional-note" className="form-step5-price-optional">
                    Opcional
                  </span>
                </div>
                <div className="form-step5-price-row">
                  <input
                    id="form-step5-price"
                    className="form-step5-price-input"
                    type="text"
                    inputMode="decimal"
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    placeholder="9.50"
                    aria-describedby="form-step5-price-optional-note"
                  />
                  <input
                    id="form-step5-files"
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
                  <label
                    htmlFor="form-step5-files"
                    className={`form-step5-photo-add ${!puedeMasFotos ? 'is-disabled' : ''}`}
                  >
                    <IconCameraPlus className="form-step5-photo-add-icon" />
                    <span className="form-step5-photo-add-label">Añadir fotos</span>
                  </label>
                </div>
              </div>

              {totalFotos > 0 && (
                <div className="form-step5-photos-meta">
                  <p className="form-step5-photos-count muted small">
                    {totalFotos}/{MAX_FOTOS_ALMUERZO} fotos
                  </p>
                  <div className="photo-previews">
                    {keepPaths.map((path) => (
                      <div key={path} className="photo-preview-wrap">
                        <img src={getFotoPublicUrl(path)} alt="" className="photo-thumb" />
                        <button
                          type="button"
                          className="btn-remove-photo"
                          onClick={() => removeKeepPath(path)}
                          aria-label="Quitar foto"
                        >
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
                </div>
              )}
            </div>

            <footer className="form-mid-footer-row form-step5-footer">
              <button type="button" className="form-step5-btn-atras" onClick={() => window.history.back()}>
                Atrás
              </button>
              <button type="submit" className="form-mid-btn-siguiente" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar almuerzo'}
                {!saving && (
                  <span className="form-mid-btn-arrow" aria-hidden>
                    →
                  </span>
                )}
              </button>
            </footer>
          </form>
        </>
      )}
    </main>
  )
}
