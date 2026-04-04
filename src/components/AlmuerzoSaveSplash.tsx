import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

const MESSAGES = [
  'Empaquetando el bocata con mimo…',
  'Sirviendo el café en la nube…',
  'Preguntando al camarero si ya está…',
  'Untando tomate en el registro…',
  'Contando las aceitunas del bar…',
  'Metiendo fotos en la vitrina digital…',
  'Ajustando el nivel de croqueta en el servidor…',
]

function SandwichIcon() {
  return (
    <svg
      className="almuerzo-save-splash__sandwich"
      viewBox="0 0 120 100"
      width="120"
      height="100"
      aria-hidden
    >
      <ellipse cx="60" cy="22" rx="48" ry="14" fill="#e8b84a" />
      <rect x="14" y="28" width="92" height="18" rx="6" fill="#f4e6c8" />
      <rect x="12" y="44" width="96" height="14" rx="5" fill="#c45c3e" />
      <rect x="14" y="56" width="92" height="12" rx="4" fill="#6b9f4a" />
      <rect x="16" y="68" width="88" height="16" rx="6" fill="#f4e6c8" />
      <ellipse cx="60" cy="88" rx="48" ry="12" fill="#d4a03a" />
    </svg>
  )
}

function SteamIcon() {
  return (
    <svg className="almuerzo-save-splash__steam" viewBox="0 0 40 48" width="40" height="48" aria-hidden>
      <path
        className="almuerzo-save-splash__steam-line almuerzo-save-splash__steam-line--1"
        d="M12 44 Q8 32 12 22 Q16 12 12 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="almuerzo-save-splash__steam-line almuerzo-save-splash__steam-line--2"
        d="M20 44 Q24 34 20 24 Q16 14 20 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="almuerzo-save-splash__steam-line almuerzo-save-splash__steam-line--3"
        d="M28 44 Q32 30 28 18 Q24 8 28 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

type Props = {
  visible: boolean
}

/**
 * Pantalla de carga a pantalla completa mientras se guarda un almuerzo (reduce frustración en subidas lentas).
 */
export function AlmuerzoSaveSplash({ visible }: Props) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    if (visible) setMsgIndex(0)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2600)
    return () => window.clearInterval(id)
  }, [visible])

  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  if (!visible) return null

  return createPortal(
    <div
      className="almuerzo-save-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-relevant="text"
    >
      <div className="almuerzo-save-splash__bg" aria-hidden />
      <div className="almuerzo-save-splash__inner">
        <div className="almuerzo-save-splash__stage">
          <div className="almuerzo-save-splash__cup-wrap">
            <SteamIcon />
            <div className="almuerzo-save-splash__cup" />
          </div>
          <SandwichIcon />
        </div>
        <h2 id="almuerzo-save-splash-title" className="almuerzo-save-splash__title">
          Guardando tu almuerzo
        </h2>
        <p key={msgIndex} className="almuerzo-save-splash__msg">
          {MESSAGES[msgIndex]}
        </p>
        <div className="almuerzo-save-splash__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>,
    document.body,
  )
}
