import {
  type FocusEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  createAlmuerzo,
  fetchProfile,
  getAlmuerzo,
  getFotoPublicUrl,
  listAllMealOptions,
  MAX_FOTOS_ALMUERZO,
  updateAlmuerzo,
} from '../lib/almuerzosApi'
import { BarPlaceSearch, type BarPlaceResolved } from '../components/BarPlaceSearch'
import { DrinkOptionEmoji } from '../components/DrinkOptionEmoji'
import { IconEsmorzar } from '../components/IconEsmorzar'
import { AlmuerzoSaveSplash } from '../components/AlmuerzoSaveSplash'
import { MAIN_CONTENT_ID } from '../components/SkipToMainContent'
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

const BAR_SEARCH_PLACEHOLDER = 'Escribe el nombre del bar'

const BOCADILLO_NAME_PLACEHOLDER = 'Escribe el bocadillo'

/** Placeholder sin €: el sufijo fijo completa la lectura “0,00€”. */
const PRECIO_PLACEHOLDER = '0,00'

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

function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
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
  const priceTrim = priceStr.replace(/[^\d,.-]/g, '').trim()
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

/** Solo dígitos y coma decimal; el símbolo € se muestra fijo fuera del input. */
function formatPriceInputNumeric(rawValue: string): string {
  return rawValue.replace(/\./g, ',').replace(/[^\d,]/g, '')
}

function placeCaretAtEnd(el: HTMLInputElement) {
  const len = el.value.length
  requestAnimationFrame(() => {
    try {
      el.setSelectionRange(len, len)
    } catch {
      /* ignore */
    }
  })
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

function IconScrollDown(props: { className?: string }) {
  return (
    <svg className={props.className} width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 13l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

const FORM_EXIT_CONFIRM_MSG =
  '¿Seguro que quieres salir? Los cambios que has hecho en el formulario no se guardarán.'

function FormSteps234Shell({
  formMode,
  step,
  mealDate,
  barName,
  barSubtitle,
  onCloseClick,
  onTab,
  onAtras,
  onSiguiente,
  accionPrincipalLabel = 'Siguiente',
  children,
}: {
  formMode: 'create' | 'edit'
  step: MidStep
  mealDate: string
  barName: string
  barSubtitle: string
  onCloseClick: () => void
  onTab: (s: MidStep) => void
  onAtras: () => void
  onSiguiente: () => void
  accionPrincipalLabel?: string
  children: ReactNode
}) {
  const pageTitle = formMode === 'edit' ? 'Editar almuerzo' : 'Registrar almuerzo'
  return (
    <>
      <h1 className="visually-hidden">{pageTitle}</h1>
      <header className="form-mid-shell-header">
        <span className="form-mid-header-spacer" aria-hidden />
        <div className="form-mid-head-center">
          <time className="form-mid-head-date" dateTime={mealDate}>
            {formatFechaLarga(mealDate)}
          </time>
          <h2 className="form-mid-bar-title">{barName.trim() || 'Bar'}</h2>
          <div className="form-mid-head-loc">
            <IconLocationPin className="form-mid-head-pin" />
            <span className="form-mid-head-loc-text">{barSubtitle}</span>
          </div>
        </div>
        <button
          type="button"
          className="form-step1-close"
          aria-label="Cerrar"
          onClick={onCloseClick}
        >
          ×
        </button>
      </header>

      <nav className="form-mid-tabs" aria-label="Pasos del almuerzo">
        <button
          type="button"
          className={`form-mid-tab ${step === 2 ? 'is-active' : ''}`}
          onClick={() => onTab(2)}
          aria-current={step === 2 ? 'step' : undefined}
        >
          <IconEsmorzar className="form-mid-tab-icon" />
          <span className="form-mid-tab-text">Bocadillo y Gasto</span>
        </button>
        <button
          type="button"
          className={`form-mid-tab ${step === 3 ? 'is-active' : ''}`}
          onClick={() => onTab(3)}
          aria-current={step === 3 ? 'step' : undefined}
        >
          <IconDrinkTab className="form-mid-tab-icon" />
          <span className="form-mid-tab-text">Bebida</span>
        </button>
        <button
          type="button"
          className={`form-mid-tab ${step === 4 ? 'is-active' : ''}`}
          onClick={() => onTab(4)}
          aria-current={step === 4 ? 'step' : undefined}
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
  const bocSectionTitleId = useId()
  const bocNameInlineErrorId = useId()
  const bebidaSectionTitleId = useId()
  const bebidaInlineErrorId = useId()
  const cafeSectionTitleId = useId()
  const cafeInlineErrorId = useId()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const mapsDebug = searchParams.get('mapsDebug') === '1'
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const navigate = useNavigate()
  const { refreshProfile, profile, user, isImpersonating } = useAuth()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const barSearchInputRef = useRef<HTMLInputElement>(null)
  const bocNameInputRef = useRef<HTMLInputElement>(null)
  const bebidaGridRef = useRef<HTMLDivElement>(null)
  const cafeListRef = useRef<HTMLDivElement>(null)
  const step1BlurTimerRef = useRef<number | null>(null)
  const focusBarAfterClearRef = useRef(false)
  const mainFormRef = useRef<HTMLElement>(null)
  const step5BodyRef = useRef<HTMLDivElement>(null)
  const step5PriceRowRef = useRef<HTMLDivElement>(null)
  const step5PriceInputRef = useRef<HTMLInputElement>(null)

  const onPriceInputFocus = useCallback((e: FocusEvent<HTMLInputElement>) => {
    placeCaretAtEnd(e.currentTarget)
  }, [])

  const onPriceInputClick = useCallback((e: MouseEvent<HTMLInputElement>) => {
    placeCaretAtEnd(e.currentTarget)
  }, [])

  const onPriceSuffixMouseDown = useCallback((e: MouseEvent<HTMLSpanElement>) => {
    const input = step5PriceInputRef.current
    if (!input) return
    e.preventDefault()
    input.focus()
    placeCaretAtEnd(input)
  }, [])

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
  /** Remonta la splash de guardado para reiniciar mensajes y animaciones en cada envío. */
  const [saveSplashKey, setSaveSplashKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showBocNameInlineError, setShowBocNameInlineError] = useState(false)
  const [showBebidaInlineError, setShowBebidaInlineError] = useState(false)
  const [showCafeInlineError, setShowCafeInlineError] = useState(false)
  /** Remonta el input con Places (uncontrolled) al limpiar el bar para vaciar el DOM. */
  const [barFieldKey, setBarFieldKey] = useState(0)
  const [showStep5ScrollHint, setShowStep5ScrollHint] = useState(false)
  const [step5ScrollHintDismissed, setStep5ScrollHintDismissed] = useState(false)

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
    if (!isImpersonating) return
    if (mode === 'create') {
      navigate('/', { replace: true })
      return
    }
    if (mode === 'edit' && id) {
      navigate(`/almuerzo/${id}`, { replace: true })
    }
  }, [isImpersonating, mode, id, navigate])

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
        setPriceStr(row.price != null ? formatPriceInputNumeric(String(row.price).replace('.', ',')) : '')
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

  useEffect(() => {
    if (step !== 2) {
      setShowBocNameInlineError(false)
    }
  }, [step])

  useEffect(() => {
    if (step !== 3) {
      setShowBebidaInlineError(false)
    }
  }, [step])

  useEffect(() => {
    if (step !== 4) {
      setShowCafeInlineError(false)
    }
  }, [step])

  useLayoutEffect(() => {
    scrollAppViewportToTop()
  }, [step])

  /** Con teclado virtual, 100dvh no coincide con el área visible: acotamos <main> al visualViewport para poder hacer scroll hasta el resumen. */
  useEffect(() => {
    const mainEl = mainFormRef.current
    if (step !== 5 || loadingEdit || optionsLoading) {
      if (mainEl) {
        mainEl.style.maxHeight = ''
        mainEl.style.minHeight = ''
      }
      return
    }
    const vv = window.visualViewport
    if (!vv || !mainEl) return

    const apply = () => {
      const m = mainFormRef.current
      if (!m) return
      const rect = m.getBoundingClientRect()
      const bottomVisible = vv.offsetTop + vv.height
      const h = Math.floor(bottomVisible - rect.top - 2)
      const capped = Math.max(260, h)
      m.style.maxHeight = `${capped}px`
      m.style.minHeight = `${capped}px`
    }

    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      const left = mainFormRef.current
      if (left) {
        left.style.maxHeight = ''
        left.style.minHeight = ''
      }
    }
  }, [step, loadingEdit, optionsLoading])

  useEffect(() => {
    return () => {
      if (step1BlurTimerRef.current != null) window.clearTimeout(step1BlurTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (step !== 5) {
      setShowStep5ScrollHint(false)
      return
    }
    const container = step5BodyRef.current
    const priceRow = step5PriceRowRef.current
    if (!container || !priceRow) {
      setShowStep5ScrollHint(false)
      return
    }

    const computeHintVisibility = () => {
      if (step5ScrollHintDismissed) {
        setShowStep5ScrollHint(false)
        return
      }
      const containerRect = container.getBoundingClientRect()
      const priceRect = priceRow.getBoundingClientRect()
      const firstFoldHidden = priceRect.top > containerRect.bottom - 2
      if (!firstFoldHidden) {
        setShowStep5ScrollHint(false)
        setStep5ScrollHintDismissed(true)
        return
      }
      const canScrollMore = container.scrollHeight > container.clientHeight + 4
      setShowStep5ScrollHint(canScrollMore)
    }

    computeHintVisibility()
    container.addEventListener('scroll', computeHintVisibility, { passive: true })
    window.addEventListener('resize', computeHintVisibility)
    const ro = new ResizeObserver(computeHintVisibility)
    ro.observe(container)
    ro.observe(priceRow)
    return () => {
      container.removeEventListener('scroll', computeHintVisibility)
      window.removeEventListener('resize', computeHintVisibility)
      ro.disconnect()
    }
  }, [step, keepPaths.length, newFiles.length, step5ScrollHintDismissed])

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

  const confirmCloseForm = useCallback(() => {
    if (window.confirm(FORM_EXIT_CONFIRM_MSG)) {
      navigate(closeHref)
    }
  }, [closeHref, navigate])

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

  function focusBocNameForCompletion() {
    setShowBocNameInlineError(true)
    const input = bocNameInputRef.current
    if (!input) return
    const focusInput = () => {
      input.focus()
      input.click()
    }
    window.requestAnimationFrame(focusInput)
  }

  function focusBebidaForCompletion() {
    setShowBebidaInlineError(true)
    const grid = bebidaGridRef.current
    const btn = grid?.querySelector('button')
    window.requestAnimationFrame(() => btn?.focus())
  }

  function focusCafeForCompletion() {
    setShowCafeInlineError(true)
    const list = cafeListRef.current
    const btn = list?.querySelector('button')
    window.requestAnimationFrame(() => btn?.focus())
  }

  const step2Complete = useCallback(() => bocName.trim() !== '', [bocName])

  const step3Complete = useCallback(() => bebidaOptionId.trim() !== '', [bebidaOptionId])
  const step4Complete = useCallback(() => cafeOptionId.trim() !== '', [cafeOptionId])

  const handleCafeOptionSelect = useCallback((optId: string) => {
    setCafeOptionId((prev) => {
      const next = prev === optId ? '' : optId
      if (next) setShowCafeInlineError(false)
      return next
    })
  }, [])

  function handleMidTab(s: MidStep) {
    setError(null)
    if (s < step) {
      window.history.go(s - step)
      return
    }
    if (s === step) return
    if (s === 3) {
      if (!step2Complete()) {
        focusBocNameForCompletion()
        return
      }
      pushFormHistory(3)
      setStep(3)
      return
    }
    if (s === 4) {
      if (!step2Complete()) {
        focusBocNameForCompletion()
        return
      }
      if (!step3Complete()) {
        focusBebidaForCompletion()
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
        focusBocNameForCompletion()
        return
      }
      pushFormHistory(3)
      setStep(3)
    } else if (step === 3) {
      if (!step3Complete()) {
        focusBebidaForCompletion()
        return
      }
      pushFormHistory(4)
      setStep(4)
    } else if (step === 4) {
      if (!step4Complete()) {
        focusCafeForCompletion()
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
      setSaveSplashKey((k) => k + 1)
      setSaving(true)
      if (mode === 'create') {
        let celebrateFirstAlmuerzo = false
        if (user?.id) {
          const p = profile ?? (await fetchProfile(user.id))
          celebrateFirstAlmuerzo = (p?.total_meals ?? -1) === 0
        }
        await createAlmuerzo(input, newFiles)
        navigate(
          '/',
          celebrateFirstAlmuerzo
            ? { replace: true, state: { celebrateFirstAlmuerzo: true } }
            : { replace: true },
        )
        void refreshProfile()
      } else if (id) {
        await updateAlmuerzo(id, input, keepPaths, newFiles)
        navigate('/', { replace: true })
        void refreshProfile()
      }
    } catch (err) {
      setError(formatSupabaseError(err))
    } finally {
      setSaving(false)
    }
  }

  if (!hasSupabaseConfig()) {
    return (
      <main ref={mainFormRef} id={MAIN_CONTENT_ID} className="page">
        <p className="banner banner-warn">Configura primero el archivo .env con Supabase.</p>
        <Link to="/" className="back-link">
          ← Volver
        </Link>
      </main>
    )
  }

  if (loadingEdit || optionsLoading) {
    return (
      <main ref={mainFormRef} id={MAIN_CONTENT_ID} className="page">
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

  const bocNameSummary = bocName.trim() || '—'
  const gastoSummaryLabels = gastoOptionIds
    .map((id) => labelByOptionId(mealOptions, id))
    .filter(Boolean)
  const bebidaRowSummary = mealOptions.find((r) => r.id === bebidaOptionId.trim())
  const drinkRawLabel = bebidaRowSummary?.label ?? ''
  const drinkChipPlain = drinkRawLabel ? beverageSelectLabel(drinkRawLabel) : '—'
  const coffeeChipText = labelByOptionId(mealOptions, cafeOptionId) || '—'

  return (
    <main ref={mainFormRef} id={MAIN_CONTENT_ID} className={mainClass}>
      <AlmuerzoSaveSplash key={saveSplashKey} visible={saving} />
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
            <button
              type="button"
              className="form-step1-close"
              aria-label="Cerrar"
              onClick={confirmCloseForm}
            >
              ×
            </button>
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
              <p className="form-step1-bar-example">Ej: La Mesedora Algemesí</p>

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
          formMode={mode}
          step={2}
          mealDate={mealDate}
          barName={barName}
          barSubtitle={barMidSubtitle}
          onCloseClick={confirmCloseForm}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
        >
          <section className="form-mid-section">
            <h3 id={bocSectionTitleId} className="form-mid-section-title">
              Bocadillo
            </h3>
            {showBocNameInlineError && (
              <p id={bocNameInlineErrorId} className="form-boc-inline-error" role="alert">
                Añade el nombre del bocadillo para continuar.
              </p>
            )}
            <div className="form-boc-pill-wrap">
              <IconEsmorzar className="form-boc-pill-icon" />
              <input
                ref={bocNameInputRef}
                id="form-step2-boc"
                className="form-boc-pill-input"
                type="text"
                aria-labelledby={bocSectionTitleId}
                aria-invalid={showBocNameInlineError}
                aria-describedby={showBocNameInlineError ? bocNameInlineErrorId : undefined}
                value={bocName}
                onChange={(e) => {
                  const raw = e.target.value
                  const next =
                    raw.length > 0 ? raw.charAt(0).toLocaleUpperCase('es') + raw.slice(1) : raw
                  setBocName(next)
                  if (next.trim() !== '') setShowBocNameInlineError(false)
                }}
                autoComplete="off"
                autoCapitalize="sentences"
                placeholder={BOCADILLO_NAME_PLACEHOLDER}
              />
            </div>
            <p className="form-boc-subtitle">Ej: Chivito, Tortilla francesa con longanizas...</p>
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
                    className={`form-gasto-chip form-option ${selected ? 'is-selected' : ''}`}
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
          formMode={mode}
          step={3}
          mealDate={mealDate}
          barName={barName}
          barSubtitle={barMidSubtitle}
          onCloseClick={confirmCloseForm}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
        >
          <section className="form-mid-section">
            <h3 id={bebidaSectionTitleId} className="form-mid-section-title">
              Bebida
            </h3>
            {showBebidaInlineError && (
              <p id={bebidaInlineErrorId} className="form-boc-inline-error" role="alert">
                Elige una bebida para continuar.
              </p>
            )}
            <div
              ref={bebidaGridRef}
              className="form-drink-card-grid"
              role="group"
              aria-labelledby={bebidaSectionTitleId}
              aria-describedby={showBebidaInlineError ? bebidaInlineErrorId : undefined}
            >
              {bebidaOpts.map((opt) => {
                const selected = bebidaOptionId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`form-drink-card form-option ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() =>
                      setBebidaOptionId((prev) => {
                        const next = prev === opt.id ? '' : opt.id
                        if (next) setShowBebidaInlineError(false)
                        return next
                      })
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
          formMode={mode}
          step={4}
          mealDate={mealDate}
          barName={barName}
          barSubtitle={barMidSubtitle}
          onCloseClick={confirmCloseForm}
          onTab={handleMidTab}
          onAtras={handleMidAtras}
          onSiguiente={handleMidSiguiente}
          accionPrincipalLabel="Finalizar"
        >
          <section className="form-mid-section">
            <h3 id={cafeSectionTitleId} className="form-mid-section-title">
              Café
            </h3>
            {showCafeInlineError && (
              <p id={cafeInlineErrorId} className="form-boc-inline-error" role="alert">
                Elige un café para continuar.
              </p>
            )}
            <div
              ref={cafeListRef}
              className="form-cafe-row-list"
              role="radiogroup"
              aria-labelledby={cafeSectionTitleId}
              aria-describedby={showCafeInlineError ? cafeInlineErrorId : undefined}
            >
              {cafeOpts.map((opt) => {
                const selected = cafeOptionId === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`form-cafe-row form-option ${selected ? 'is-selected' : ''}`}
                    onClick={() => handleCafeOptionSelect(opt.id)}
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
            <button
              type="button"
              className="form-step1-close"
              aria-label="Cerrar"
              onClick={confirmCloseForm}
            >
              ×
            </button>
          </div>

          <form className="form-step5" onSubmit={onSubmit}>
            <div ref={step5BodyRef} className="form-step5-body">
              <div className="form-summary-card">
                <div className="form-summary-header">
                  <time className="form-summary-head-date" dateTime={mealDate}>
                    {formatFechaLarga(mealDate)}
                  </time>
                  <h2 className="form-summary-head-title">{barName.trim() || '—'}</h2>
                  <div className="form-summary-head-loc">
                    <IconLocationPin className="form-summary-head-pin" />
                    <span className="form-summary-head-loc-text">{barMidSubtitle}</span>
                  </div>
                </div>
                <div className="form-summary-divider-wrap" aria-hidden>
                  <span className="form-summary-divider" />
                </div>
                <div className="form-summary-section">
                  <h3 className="detail-static-label detail-static-label--accent">Bocadillo y Gasto</h3>
                  <p className="form-summary-boc-name">{bocNameSummary}</p>
                  {gastoSummaryLabels.length > 0 ? (
                    <div className="detail-static-chip-row form-summary-gasto-chips">
                      {gastoSummaryLabels.map((label, i) => (
                        <span key={`${label}-${i}`} className="detail-static-chip">
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty-val form-summary-gasto-empty">Sin indicar</p>
                  )}
                </div>
                <div className="form-summary-drink-coffee">
                  <div className="form-summary-drink-coffee-col">
                    <h3 className="detail-static-label detail-static-label--accent">Bebida</h3>
                    <span className="detail-static-chip form-summary-drink-chip">
                      {drinkRawLabel ? (
                        <>
                          <DrinkOptionEmoji label={drinkRawLabel} className="form-summary-drink-chip-emoji" />
                          <span>{drinkChipPlain}</span>
                        </>
                      ) : (
                        drinkChipPlain
                      )}
                    </span>
                  </div>
                  <div className="form-summary-drink-coffee-col">
                    <h3 className="detail-static-label detail-static-label--accent">Café</h3>
                    <span className="detail-static-chip">{coffeeChipText}</span>
                  </div>
                </div>
              </div>

              <div className="form-step5-review-block">
                <label className="form-step5-review-label" htmlFor="form-step5-review">
                  Nota personal <span className="muted">(opcional)</span>
                </label>
                <p className="form-step5-review-hint">Este comentario es privado y solo lo podrás ver tú.</p>
                <textarea
                  id="form-step5-review"
                  className="form-step5-review-textarea"
                  value={review}
                  onChange={(e) => {
                    const raw = e.target.value
                    const next =
                      raw.length > 0 ? raw.charAt(0).toLocaleUpperCase('es') + raw.slice(1) : raw
                    setReview(next)
                  }}
                  rows={4}
                  placeholder="¿Qué te ha parecido el almuerzo?"
                />
              </div>

              <div className="form-step5-price-block">
                <label className="form-step5-review-label" htmlFor="form-step5-price">
                  Precio <span className="muted">(opcional)</span>
                </label>
                <div ref={step5PriceRowRef} className="form-step5-price-row">
                  <div className="form-step5-price-field">
                    <input
                      ref={step5PriceInputRef}
                      id="form-step5-price"
                      className="form-step5-price-input"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={priceStr}
                      onChange={(e) => setPriceStr(formatPriceInputNumeric(e.target.value))}
                      onFocus={onPriceInputFocus}
                      onClick={onPriceInputClick}
                      placeholder={PRECIO_PLACEHOLDER}
                    />
                    <span
                      className="form-step5-price-suffix"
                      aria-hidden="true"
                      onMouseDown={onPriceSuffixMouseDown}
                    >
                      €
                    </span>
                  </div>
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

            {showStep5ScrollHint && (
              <button
                type="button"
                className="form-step5-scroll-hint"
                onClick={() => {
                  const bodyEl = step5BodyRef.current
                  if (!bodyEl) return
                  setStep5ScrollHintDismissed(true)
                  setShowStep5ScrollHint(false)
                  bodyEl.scrollBy({ top: Math.max(220, bodyEl.clientHeight * 0.62), behavior: 'smooth' })
                }}
                aria-label="Bajar para ver precio y fotos"
              >
                <IconScrollDown className="form-step5-scroll-hint-icon" />
              </button>
            )}

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
