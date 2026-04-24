import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isFocusableSurface(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  if (el.hasAttribute('disabled')) return false
  const ti = el.getAttribute('tabindex')
  if (ti === '-1') return false
  return true
}

/** Elementos enfocables por teclado dentro de un contenedor (orden DOM). */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
    isFocusableSurface(el),
  )
}

type UseFocusTrapOptions = {
  active: boolean
  /** Si existe y está dentro del contenedor, recibe el foco al activar. */
  initialFocusRef?: RefObject<HTMLElement | null>
}

/**
 * Mantiene el foco dentro de `containerRef` con Tab / Mayús+Tab y restaura el foco previo al desactivar.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, initialFocusRef }: UseFocusTrapOptions,
): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previous =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null

    const applyInitialFocus = () => {
      const initial = initialFocusRef?.current
      if (initial && container.contains(initial)) {
        initial.focus()
        return
      }
      getFocusableElements(container)[0]?.focus()
    }

    let innerRaf = 0
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => applyInitialFocus())
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const list = getFocusableElements(container)
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.cancelAnimationFrame(outerRaf)
      if (innerRaf) window.cancelAnimationFrame(innerRaf)
      document.removeEventListener('keydown', onKeyDown, true)
      if (previous && document.contains(previous)) {
        previous.focus()
      }
    }
  }, [active, containerRef, initialFocusRef])
}
