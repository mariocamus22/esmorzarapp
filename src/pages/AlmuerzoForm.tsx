import { type FormEvent, useEffect, useMemo, useState } from 'react'
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

/**
 * Formulario para crear o editar un almuerzo (todos los campos + fotos, máx. 5).
 */
export function AlmuerzoForm({ mode }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [barName, setBarName] = useState('')
  const [mealDate, setMealDate] = useState(todayISO())
  const [gasto, setGasto] = useState('')
  const [drink, setDrink] = useState('')
  const [bocName, setBocName] = useState('')
  const [bocIng, setBocIng] = useState('')
  const [coffee, setCoffee] = useState('')
  const [priceStr, setPriceStr] = useState('')
  const [review, setReview] = useState('')

  /** En edición: rutas en Storage que el usuario decide conservar */
  const [keepPaths, setKeepPaths] = useState<string[]>([])
  /** Archivos nuevos a subir (solo en memoria hasta guardar) */
  const [newFiles, setNewFiles] = useState<File[]>([])

  const [loadingEdit, setLoadingEdit] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title = mode === 'create' ? 'Nuevo almuerzo' : 'Editar almuerzo'

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
          if (!cancelled && !row) setError('No encontramos este almuerzo.')
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
        <p className="banner banner-warn">Configura primero el archivo .env con Supabase.</p>
        <Link to="/" className="back-link">
          ← Volver
        </Link>
      </main>
    )
  }

  if (loadingEdit) {
    return (
      <main className="page">
        <div className="loading-block" aria-busy="true">
          <span className="spinner" aria-hidden />
          <span className="muted">Cargando formulario…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <Link to={mode === 'create' ? '/' : `/almuerzo/${id}`} className="back-link">
          ← Volver
        </Link>
        <h1>{title}</h1>
        <p className="muted">Completa lo que recuerdes; el precio es opcional.</p>
      </header>

      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}

      <form className="stack-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Bar *</span>
          <input
            type="text"
            value={barName}
            onChange={(e) => setBarName(e.target.value)}
            required
            autoComplete="off"
            placeholder="Nombre del bar"
          />
        </label>

        <label className="field">
          <span>Fecha</span>
          <input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
        </label>

        <label className="field">
          <span>Gasto</span>
          <textarea value={gasto} onChange={(e) => setGasto(e.target.value)} rows={2} placeholder="Olivas, cacahuetes…" />
        </label>

        <label className="field">
          <span>Bebida</span>
          <input type="text" value={drink} onChange={(e) => setDrink(e.target.value)} placeholder="Vino con gaseosa, cerveza…" />
        </label>

        <label className="field">
          <span>Bocadillo (nombre)</span>
          <input type="text" value={bocName} onChange={(e) => setBocName(e.target.value)} />
        </label>

        <label className="field">
          <span>Ingredientes del bocadillo</span>
          <textarea value={bocIng} onChange={(e) => setBocIng(e.target.value)} rows={2} />
        </label>

        <label className="field">
          <span>Café</span>
          <input type="text" value={coffee} onChange={(e) => setCoffee(e.target.value)} placeholder="Cremaet, cortado…" />
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
    </main>
  )
}
