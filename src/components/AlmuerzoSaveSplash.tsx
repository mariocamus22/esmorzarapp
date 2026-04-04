import { createPortal } from 'react-dom'
import { memo, useEffect, useState, useSyncExternalStore } from 'react'
import Lottie from 'lottie-react'

import breadAnimation from '../assets/lottie/emoji-bread.json'
import drinkAnimation from '../assets/lottie/emoji-drink.json'
import coffeeAnimation from '../assets/lottie/emoji-coffee.json'

/** Frases en valenciano (rotación durante el guardado). */
const MESSAGES = [
  'Un esmorzaret de categoria',
  'Que no falte el cremaet',
  'A la taula i al llit, al primer crit',
  '¡Comboi i germanor!',
] as const

const MESSAGE_INTERVAL_MS = 3100

type Props = {
  visible: boolean
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Indicación visual de cacahuetes sobre el pan / bocadillo (las Lottie son Noto Emoji, sin cacahuetes explícitos). */
function PeanutGarnish() {
  return (
    <svg
      className="almuerzo-save-splash__peanuts"
      viewBox="0 0 48 20"
      width={48}
      height={20}
      aria-hidden
    >
      <ellipse cx="10" cy="10" rx="7" ry="4.5" fill="#c4a35a" opacity={0.95} transform="rotate(-18 10 10)" />
      <ellipse cx="24" cy="10" rx="7" ry="4.5" fill="#b8924a" opacity={0.95} transform="rotate(8 24 10)" />
      <ellipse cx="38" cy="10" rx="7" ry="4.5" fill="#a67c3d" opacity={0.95} transform="rotate(-12 38 10)" />
    </svg>
  )
}

/** Fila Lottie aislada: no se re-renderiza al rotar subtítulos (menos trabajo en el hilo principal). */
const SplashLottieRow = memo(function SplashLottieRow({ play }: { play: boolean }) {
  return (
    <div className="almuerzo-save-splash__lottie-row" aria-hidden>
      <div className="almuerzo-save-splash__lottie-cell almuerzo-save-splash__lottie-cell--bocata">
        <div className="almuerzo-save-splash__lottie-wrap">
          <Lottie
            className="almuerzo-save-splash__lottie"
            animationData={breadAnimation}
            loop={play}
            autoplay={play}
          />
        </div>
        <PeanutGarnish />
      </div>
      <div className="almuerzo-save-splash__lottie-cell">
        <div className="almuerzo-save-splash__lottie-wrap">
          <Lottie
            className="almuerzo-save-splash__lottie"
            animationData={drinkAnimation}
            loop={play}
            autoplay={play}
          />
        </div>
      </div>
      <div className="almuerzo-save-splash__lottie-cell">
        <div className="almuerzo-save-splash__lottie-wrap">
          <Lottie
            className="almuerzo-save-splash__lottie"
            animationData={coffeeAnimation}
            loop={play}
            autoplay={play}
          />
        </div>
      </div>
    </div>
  )
})

/**
 * Pantalla de carga a pantalla completa mientras se guarda un almuerzo (reduce frustración en subidas lentas).
 * Animaciones Lottie: Noto Emoji (fonts.gstatic), licencia OFL — pan + bebida + cafè.
 */
export function AlmuerzoSaveSplash({ visible }: Props) {
  const [msgIndex, setMsgIndex] = useState(0)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false)

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, MESSAGE_INTERVAL_MS)
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

  const lottiePlay = !reducedMotion

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
        <SplashLottieRow play={lottiePlay} />
        <h2 id="almuerzo-save-splash-title" className="almuerzo-save-splash__title">
          Guardando tu almuerzo...
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

export default AlmuerzoSaveSplash
