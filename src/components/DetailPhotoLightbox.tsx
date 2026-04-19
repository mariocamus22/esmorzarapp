import { createPortal } from 'react-dom'
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { getFotoPublicUrl } from '../lib/almuerzosApi'

const PHOTO_LIGHTBOX_HISTORY_KEY = 'esmorzarPhotoLightbox' as const

const LB_DOUBLE_TAP_MS = 380
const LB_DOUBLE_TAP_DIST_PX = 42
const LB_MIN_SCALE = 1
const LB_MAX_SCALE = 4.5
const LB_DOUBLE_TAP_SCALE = 2.65
const LB_PINCH_MIN_DIST = 36
const LB_DISMISS_DIST_PX = 92
const LB_DISMISS_VEL_PX_MS = 0.42
const LB_AXIS_LOCK_PX = 12

type TapRef = { t: number; x: number; y: number } | null

type PtrRec = { x: number; y: number; slideIndex: number }

type GestureState =
  | { kind: 'pan'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'pinch'; dist0: number; s0: number; tx0: number; ty0: number }
  | {
      kind: 'dismiss'
      pointerId: number
      startY: number
      lastY: number
      lastT: number
      startT: number
    }
  | { kind: 'axis'; pointerId: number; sx: number; sy: number; slideIndex: number }

function IconChevronPhoto({ dir, className }: { dir: 'left' | 'right'; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={24} height={24} fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function readCarouselIndex(el: HTMLDivElement | null, n: number): number {
  if (!el || n <= 0) return 0
  const w = el.clientWidth
  if (w <= 0) return 0
  return Math.min(Math.max(0, Math.round(el.scrollLeft / w)), n - 1)
}

function distPoints(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pinchFromMap(m: Map<number, PtrRec>): { a: PtrRec; b: PtrRec; d: number } | null {
  const vals = [...m.values()]
  if (vals.length < 2) return null
  const a = vals[0]
  const b = vals[1]
  if (a.slideIndex !== b.slideIndex) return null
  const d = distPoints(a, b)
  return { a, b, d }
}

export type DetailPhotoLightboxProps = {
  paths: string[]
  startIndex: number
  onClose: () => void
}

/**
 * Visor a pantalla completa tipo galería: deslizar entre fotos, pinch y doble toque
 * para zoom, arrastre para mover la imagen ampliada y deslizar hacia abajo para cerrar.
 */
export function DetailPhotoLightbox({ paths, startIndex, onClose }: DetailPhotoLightboxProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const wrapRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const imgRefs = useRef<Map<number, HTMLImageElement>>(new Map())

  const ptrMap = useRef(new Map<number, PtrRec>())
  const gestureRef = useRef<GestureState | null>(null)
  const lastTapRef = useRef<TapRef>(null)
  const viewRef = useRef({ scale: LB_MIN_SCALE, tx: 0, ty: 0 })
  const gestureStartRef = useRef<{ x: number; y: number; slideIndex: number } | null>(null)

  const n = paths.length
  const [i, setI] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, n - 1)))
  const [zoomed, setZoomed] = useState(false)
  const iRef = useRef(i)

  useEffect(() => {
    iRef.current = i
  }, [i])

  const closeViaHistory = useCallback(() => {
    window.history.back()
  }, [])

  const applyInnerTransform = useCallback((slideIndex: number, withTransition: boolean) => {
    const inner = innerRefs.current.get(slideIndex)
    if (!inner) return
    const { scale, tx, ty } = viewRef.current
    if (slideIndex !== iRef.current) {
      inner.style.transition = ''
      inner.style.transform = 'translate3d(0,0,0) scale(1)'
      return
    }
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    inner.style.transformOrigin = 'center center'
    inner.style.transition =
      withTransition && !reduceMotion
        ? 'transform 0.24s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        : ''
    inner.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${scale})`
  }, [])

  const clampPan = useCallback((slideIndex: number, scale: number, tx: number, ty: number) => {
    const wrap = wrapRefs.current.get(slideIndex)
    const inner = innerRefs.current.get(slideIndex)
    const img = imgRefs.current.get(slideIndex)
    if (!wrap || !inner || !img) return { tx, ty }
    inner.style.transition = ''
    inner.style.transformOrigin = 'center center'
    let cx = tx
    let cy = ty
    for (let k = 0; k < 8; k++) {
      inner.style.transform = `translate3d(${cx}px,${cy}px,0) scale(${scale})`
      const wr = wrap.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      let dx = 0
      let dy = 0
      const pad = 0.5
      if (ir.left > wr.left + pad) dx = wr.left + pad - ir.left
      if (ir.right < wr.right - pad) dx = wr.right - pad - ir.right
      if (ir.top > wr.top + pad) dy = wr.top + pad - ir.top
      if (ir.bottom < wr.bottom - pad) dy = wr.bottom - pad - ir.bottom
      if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) break
      cx += dx
      cy += dy
    }
    return { tx: cx, ty: cy }
  }, [])

  const resetZoomDom = useCallback(() => {
    viewRef.current = { scale: LB_MIN_SCALE, tx: 0, ty: 0 }
    innerRefs.current.forEach((inner, j) => {
      inner.style.transition = ''
      inner.style.transform = 'translate3d(0,0,0) scale(1)'
      void j
    })
  }, [])

  const resetZoom = useCallback(() => {
    resetZoomDom()
    setZoomed(false)
  }, [resetZoomDom])

  const commitScaleZoomFlag = useCallback(() => {
    setZoomed(viewRef.current.scale > 1.04)
  }, [])

  const clearDismissVisual = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    root.style.transform = ''
    root.style.opacity = ''
    root.style.transition = ''
  }, [])

  useLayoutEffect(() => {
    innerRefs.current.forEach((inner, j) => {
      if (j !== iRef.current) {
        inner.style.transition = ''
        inner.style.transform = 'translate3d(0,0,0) scale(1)'
      }
    })
    applyInnerTransform(i, false)
  }, [i, applyInnerTransform])

  useLayoutEffect(() => {
    const el = stripRef.current
    if (!el || n === 0) return
    const idx = Math.min(Math.max(0, startIndex), n - 1)
    lastTapRef.current = null
    gestureRef.current = null
    ptrMap.current.clear()
    resetZoomDom()

    const applyScroll = () => {
      const w = el.clientWidth
      if (w > 0) el.scrollLeft = idx * w
      else requestAnimationFrame(applyScroll)
    }
    applyScroll()
    queueMicrotask(() => {
      setZoomed(false)
      setI(idx)
    })
  }, [startIndex, n, resetZoomDom])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => closeRef.current?.focus())
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    let active = true
    window.history.pushState({ [PHOTO_LIGHTBOX_HISTORY_KEY]: true }, '')

    const onPop = () => {
      if (active) onClose()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      active = false
      window.removeEventListener('popstate', onPop)
      const st = window.history.state as Record<string, unknown> | null
      if (st?.[PHOTO_LIGHTBOX_HISTORY_KEY] === true) {
        window.history.back()
      }
    }
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViaHistory()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeViaHistory])

  const syncIndexFromStrip = useCallback(() => {
    if (viewRef.current.scale > 1.04) return
    const ni = readCarouselIndex(stripRef.current, n)
    if (ni !== iRef.current) {
      resetZoom()
      setI(ni)
    }
  }, [n, resetZoom])

  useEffect(() => {
    const el = stripRef.current
    if (!el || n <= 1) return
    const onScrollEnd = () => syncIndexFromStrip()
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
  }, [n, syncIndexFromStrip])

  useEffect(() => {
    if (zoomed) return
    const id = requestAnimationFrame(() => {
      syncIndexFromStrip()
    })
    return () => cancelAnimationFrame(id)
  }, [zoomed, syncIndexFromStrip])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey) return
      ev.preventDefault()
      const idx = iRef.current
      const wrap = wrapRefs.current.get(idx)
      if (!wrap) return
      const wr = wrap.getBoundingClientRect()
      const factor = Math.exp(-ev.deltaY * 0.0075)
      const prev = viewRef.current
      let newScale = Math.min(LB_MAX_SCALE, Math.max(LB_MIN_SCALE, prev.scale * factor))
      if (newScale < 1.001) newScale = 1

      const cx = ev.clientX - wr.left - wr.width / 2
      const cy = ev.clientY - wr.top - wr.height / 2
      const ratio = newScale / (prev.scale || 1)
      let tx = prev.tx * ratio + cx * (1 - ratio)
      let ty = prev.ty * ratio + cy * (1 - ratio)

      if (newScale <= 1) {
        newScale = 1
        tx = 0
        ty = 0
      } else {
        const cl = clampPan(idx, newScale, tx, ty)
        tx = cl.tx
        ty = cl.ty
      }

      viewRef.current = { scale: newScale, tx, ty }
      applyInnerTransform(idx, false)
      setZoomed(newScale > 1.04)
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [paths.length, applyInnerTransform, clampPan])

  const goDot = (idx: number) => {
    const el = stripRef.current
    if (!el) return
    lastTapRef.current = null
    gestureRef.current = null
    ptrMap.current.clear()
    resetZoom()
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
    setI(idx)
  }

  const tryDoubleTap = useCallback(
    (slideIndex: number, clientX: number, clientY: number, timeStamp: number) => {
      const inner = innerRefs.current.get(slideIndex)
      if (!inner || slideIndex !== iRef.current) return false

      const now = timeStamp
      const prev = lastTapRef.current
      const isDouble =
        prev != null &&
        now - prev.t <= LB_DOUBLE_TAP_MS &&
        Math.hypot(clientX - prev.x, clientY - prev.y) <= LB_DOUBLE_TAP_DIST_PX

      if (!isDouble) {
        lastTapRef.current = { t: now, x: clientX, y: clientY }
        return true
      }

      lastTapRef.current = null
      const cur = viewRef.current
      if (cur.scale > 1.04) {
        viewRef.current = { scale: 1, tx: 0, ty: 0 }
        applyInnerTransform(slideIndex, true)
        setZoomed(false)
        window.setTimeout(() => {
          const el = innerRefs.current.get(slideIndex)
          if (el) el.style.transition = ''
        }, 260)
        return true
      }

      const s = LB_DOUBLE_TAP_SCALE
      viewRef.current = { scale: s, tx: 0, ty: 0 }
      const cl = clampPan(slideIndex, s, 0, 0)
      viewRef.current = { scale: s, tx: cl.tx, ty: cl.ty }
      applyInnerTransform(slideIndex, true)
      setZoomed(true)
      window.setTimeout(() => {
        const el = innerRefs.current.get(slideIndex)
        if (el) el.style.transition = ''
      }, 260)
      return true
    },
    [applyInnerTransform, clampPan],
  )

  const onSlidePointerDown = (slideIndex: number, e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return

    ptrMap.current.set(e.pointerId, { x: e.clientX, y: e.clientY, slideIndex })

    if (ptrMap.current.size === 2) {
      const p = pinchFromMap(ptrMap.current)
      if (p && p.d >= LB_PINCH_MIN_DIST) {
        gestureRef.current = {
          kind: 'pinch',
          dist0: p.d,
          s0: viewRef.current.scale,
          tx0: viewRef.current.tx,
          ty0: viewRef.current.ty,
        }
      }
      lastTapRef.current = null
      gestureStartRef.current = null
      return
    }

    if (ptrMap.current.size === 1) {
      const sc = viewRef.current.scale
      if (sc > 1.04 && slideIndex === iRef.current) {
        gestureRef.current = { kind: 'pan', pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        lastTapRef.current = null
        gestureStartRef.current = null
        return
      }
      if (sc <= 1.04 && slideIndex === iRef.current) {
        gestureRef.current = {
          kind: 'axis',
          pointerId: e.pointerId,
          sx: e.clientX,
          sy: e.clientY,
          slideIndex,
        }
        gestureStartRef.current = { x: e.clientX, y: e.clientY, slideIndex }
      }
    }
  }

  const onSlidePointerMove = (e: ReactPointerEvent) => {
    if (!ptrMap.current.has(e.pointerId)) return
    const rec = ptrMap.current.get(e.pointerId)!
    ptrMap.current.set(e.pointerId, { ...rec, x: e.clientX, y: e.clientY })

    if (ptrMap.current.size >= 2) {
      const p = pinchFromMap(ptrMap.current)
      if (!p) return

      if (gestureRef.current?.kind !== 'pinch') {
        if (p.d < LB_PINCH_MIN_DIST) return
        gestureRef.current = {
          kind: 'pinch',
          dist0: p.d,
          s0: viewRef.current.scale,
          tx0: viewRef.current.tx,
          ty0: viewRef.current.ty,
        }
      }

      const pg = gestureRef.current
      if (pg?.kind !== 'pinch') return
      if (pg.dist0 < LB_PINCH_MIN_DIST) return

      let newScale = Math.min(LB_MAX_SCALE, Math.max(LB_MIN_SCALE, pg.s0 * (p.d / pg.dist0)))
      if (newScale < 1.002) newScale = 1
      const ratio = newScale / (pg.s0 || 1)
      let newTx = pg.tx0 * ratio
      let newTy = pg.ty0 * ratio
      if (newScale <= 1) {
        newTx = 0
        newTy = 0
      } else {
        const cl = clampPan(iRef.current, newScale, newTx, newTy)
        newTx = cl.tx
        newTy = cl.ty
      }
      viewRef.current = { scale: newScale, tx: newTx, ty: newTy }
      applyInnerTransform(iRef.current, false)
      setZoomed(newScale > 1.04)
      e.preventDefault()
      return
    }

    const g = gestureRef.current

    if (g?.kind === 'pan' && e.pointerId === g.pointerId) {
      const dx = e.clientX - g.lastX
      const dy = e.clientY - g.lastY
      g.lastX = e.clientX
      g.lastY = e.clientY
      const { scale } = viewRef.current
      let { tx, ty } = viewRef.current
      tx += dx
      ty += dy
      const cl = clampPan(iRef.current, scale, tx, ty)
      viewRef.current = { scale, tx: cl.tx, ty: cl.ty }
      applyInnerTransform(iRef.current, false)
      e.preventDefault()
      return
    }

    if (g?.kind === 'axis' && e.pointerId === g.pointerId) {
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (Math.hypot(dx, dy) < LB_AXIS_LOCK_PX) return

      if (dy > 0 && Math.abs(dy) > Math.abs(dx) * 1.12) {
        gestureRef.current = {
          kind: 'dismiss',
          pointerId: e.pointerId,
          startY: g.sy,
          lastY: e.clientY,
          lastT: e.timeStamp,
          startT: e.timeStamp,
        }
        rootRef.current?.setPointerCapture(e.pointerId)
        e.preventDefault()
        return
      }
      if (Math.abs(dx) > Math.abs(dy) * 1.12) {
        gestureRef.current = null
        gestureStartRef.current = null
      }
      return
    }

    if (g?.kind === 'dismiss' && e.pointerId === g.pointerId) {
      const dy = e.clientY - g.startY
      g.lastY = e.clientY
      g.lastT = e.timeStamp
      const root = rootRef.current
      if (root && dy > 0) {
        root.style.transition = 'none'
        root.style.transform = `translate3d(0, ${dy}px, 0)`
        root.style.opacity = `${Math.max(0.38, 1 - dy / 400)}`
      } else if (root && dy <= 0) {
        root.style.transform = 'translate3d(0, 0, 0)'
        root.style.opacity = '1'
      }
      e.preventDefault()
    }
  }

  const onSlidePointerUp = (slideIndex: number, e: ReactPointerEvent) => {
    ptrMap.current.delete(e.pointerId)

    const g = gestureRef.current

    if (g?.kind === 'dismiss' && e.pointerId === g.pointerId) {
      const dy = e.clientY - g.startY
      const dt = Math.max(1, e.timeStamp - g.startT)
      const vy = dy / dt
      const shouldClose = dy > LB_DISMISS_DIST_PX || (dy > 52 && vy > LB_DISMISS_VEL_PX_MS)
      const root = rootRef.current
      if (shouldClose) {
        clearDismissVisual()
        closeViaHistory()
      } else if (root) {
        root.style.transition = 'transform 0.22s cubic-bezier(0.25, 0.82, 0.25, 1), opacity 0.2s ease'
        root.style.transform = 'translate3d(0, 0, 0)'
        root.style.opacity = '1'
        window.setTimeout(() => {
          root.style.transition = ''
        }, 240)
      }
      gestureRef.current = null
      gestureStartRef.current = null
      lastTapRef.current = null
      try {
        root?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      return
    }

    if (ptrMap.current.size === 1 && g?.kind === 'pinch') {
      const [pid] = [...ptrMap.current.keys()]
      const rec = ptrMap.current.get(pid)!
      if (viewRef.current.scale > 1.04 && rec.slideIndex === iRef.current) {
        gestureRef.current = { kind: 'pan', pointerId: pid, lastX: rec.x, lastY: rec.y }
      } else {
        gestureRef.current = null
      }
      commitScaleZoomFlag()
      return
    }

    if (ptrMap.current.size > 0) {
      if (g?.kind === 'pan' && e.pointerId === g.pointerId) {
        try {
          ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
        } catch {
          /* ignore */
        }
      }
      return
    }

    if (g?.kind === 'pan' && e.pointerId === g.pointerId) {
      try {
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }

    gestureRef.current = null

    const gs = gestureStartRef.current
    gestureStartRef.current = null
    const movedAxis =
      gs &&
      (Math.abs(e.clientX - gs.x) > LB_AXIS_LOCK_PX || Math.abs(e.clientY - gs.y) > LB_AXIS_LOCK_PX)

    if (!movedAxis && slideIndex === iRef.current && viewRef.current.scale <= 1.04) {
      tryDoubleTap(slideIndex, e.clientX, e.clientY, e.timeStamp)
    } else if (!movedAxis) {
      lastTapRef.current = null
    }

    commitScaleZoomFlag()
  }

  const onSlidePointerCancel = (e: ReactPointerEvent) => {
    const g0 = gestureRef.current
    if (g0?.kind === 'dismiss' && e.pointerId === g0.pointerId) {
      const root = rootRef.current
      if (root) {
        root.style.transition = 'transform 0.2s ease, opacity 0.2s ease'
        root.style.transform = 'translate3d(0, 0, 0)'
        root.style.opacity = '1'
        window.setTimeout(() => {
          root.style.transition = ''
        }, 220)
      }
      try {
        rootRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      gestureRef.current = null
      gestureStartRef.current = null
      ptrMap.current.delete(e.pointerId)
      commitScaleZoomFlag()
      return
    }

    ptrMap.current.delete(e.pointerId)
    if (ptrMap.current.size === 0) {
      gestureRef.current = null
      gestureStartRef.current = null
      clearDismissVisual()
      try {
        rootRef.current?.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    }
    commitScaleZoomFlag()
  }

  const safeI = n === 0 ? 0 : Math.min(i, n - 1)
  const showArrows = n > 1 && !zoomed

  return createPortal(
    <div ref={rootRef} className="detail-photo-lightbox" role="dialog" aria-modal="true" aria-label="Galería de fotos">
      <div className="detail-photo-lightbox-top">
        <button
          ref={closeRef}
          type="button"
          className="detail-photo-lightbox-close"
          onClick={closeViaHistory}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
      <p className="detail-photo-lightbox-hint detail-photo-lightbox-hint--below">
        {n > 1
          ? 'Desliza a los lados · pellizca o doble toque para zoom · arrastra la foto ampliada · desliza hacia abajo o ✕ para cerrar'
          : 'Pellizca o doble toque para zoom · arrastra si está ampliada · desliza hacia abajo o ✕ para cerrar'}
      </p>
      <div className="detail-photo-lightbox-main">
        {showArrows && (
          <button
            type="button"
            className="detail-photo-lightbox-arrow detail-photo-lightbox-arrow--prev"
            onClick={() => goDot(safeI - 1)}
            disabled={safeI <= 0}
            aria-label="Foto anterior"
          >
            <IconChevronPhoto dir="left" className="detail-photo-lightbox-arrow-icon" />
          </button>
        )}
        <div
          ref={stripRef}
          className={`detail-photo-lightbox-strip${zoomed ? ' is-zoomed' : ''}`}
          aria-label="Carrusel de fotos"
        >
          {paths.map((p, idx) => (
            <div
              key={`${p}-lb-${idx}`}
              className={`detail-photo-lightbox-slide${zoomed && idx === safeI ? ' is-zoomed' : ''}`}
              onPointerDown={(ev) => onSlidePointerDown(idx, ev)}
              onPointerMove={onSlidePointerMove}
              onPointerUp={(ev) => onSlidePointerUp(idx, ev)}
              onPointerCancel={onSlidePointerCancel}
            >
              <div
                ref={(el) => {
                  if (el) wrapRefs.current.set(idx, el)
                  else wrapRefs.current.delete(idx)
                }}
                className="detail-photo-lightbox-zoom-wrap"
              >
                <div
                  ref={(el) => {
                    if (el) innerRefs.current.set(idx, el)
                    else innerRefs.current.delete(idx)
                  }}
                  className={`detail-photo-lightbox-zoom-inner${zoomed && idx === safeI ? ' is-zoomed' : ''}`}
                >
                  <img
                    ref={(el) => {
                      if (el) imgRefs.current.set(idx, el)
                      else imgRefs.current.delete(idx)
                    }}
                    className="detail-photo-lightbox-img"
                    src={getFotoPublicUrl(p)}
                    alt={`Foto ${idx + 1} de ${n}`}
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {showArrows && (
          <button
            type="button"
            className="detail-photo-lightbox-arrow detail-photo-lightbox-arrow--next"
            onClick={() => goDot(safeI + 1)}
            disabled={safeI >= n - 1}
            aria-label="Foto siguiente"
          >
            <IconChevronPhoto dir="right" className="detail-photo-lightbox-arrow-icon" />
          </button>
        )}
      </div>
      {n > 1 && (
        <div className="detail-photo-lightbox-dots" role="tablist" aria-label="Seleccionar foto">
          {paths.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === safeI}
              className={`detail-photo-lightbox-dot ${idx === safeI ? 'is-active' : ''}`}
              onClick={() => goDot(idx)}
              aria-label={`Foto ${idx + 1} de ${n}`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
