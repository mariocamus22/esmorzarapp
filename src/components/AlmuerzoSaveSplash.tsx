import { createPortal } from 'react-dom'
import {
  Component,
  type ErrorInfo,
  memo,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'
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

function SandwichIcon() {
  return (
    <svg
      className="almuerzo-save-splash__sandwich"
      viewBox="0 0 120 100"
      width={120}
      height={100}
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

/** Ilustración CSS/SVG si Lottie falla (chunk, Safari, memoria). */
function SplashStaticStage() {
  return (
    <div className="almuerzo-save-splash__stage" aria-hidden>
      <div className="almuerzo-save-splash__static-bocata">
        <SandwichIcon />
        <PeanutGarnish />
      </div>
      <div className="almuerzo-save-splash__static-drink">
        <span className="almuerzo-save-splash__static-drink-glass" />
      </div>
      <div className="almuerzo-save-splash__cup-wrap">
        <SteamIcon />
        <div className="almuerzo-save-splash__cup" />
      </div>
    </div>
  )
}

type LottieBoundaryProps = { children: ReactNode; fallback: ReactNode }

class SplashLottieBoundary extends Component<LottieBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[AlmuerzoSaveSplash] Lottie error, s\'usa fallback estàtic:', error.message, info.componentStack)
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

/** Fila Lottie: memo per no re-render al canviar subtítols. */
const SplashLottieRow = memo(function SplashLottieRow({
  play,
  onDataFailed,
}: {
  play: boolean
  onDataFailed: () => void
}) {
  const fail = () => {
    onDataFailed()
  }

  return (
    <div className="almuerzo-save-splash__lottie-row" aria-hidden>
      <div className="almuerzo-save-splash__lottie-cell almuerzo-save-splash__lottie-cell--bocata">
        <div className="almuerzo-save-splash__lottie-wrap">
          <Lottie
            className="almuerzo-save-splash__lottie"
            animationData={breadAnimation}
            loop={play}
            autoplay={play}
            onDataFailed={fail}
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
            onDataFailed={fail}
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
            onDataFailed={fail}
          />
        </div>
      </div>
    </div>
  )
})

/**
 * Pantalla de carga a pantalla completa mentre es guarda un almuerzo.
 * Animacions Lottie: Noto Emoji (OFL). Import síncron: evita fallos amb PWA/chunks async.
 */
export function AlmuerzoSaveSplash({ visible }: Props) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [useStaticVisual, setUseStaticVisual] = useState(false)
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

  const visual =
    useStaticVisual || reducedMotion ? (
      <SplashStaticStage />
    ) : (
      <SplashLottieBoundary fallback={<SplashStaticStage />}>
        <SplashLottieRow play={lottiePlay} onDataFailed={() => setUseStaticVisual(true)} />
      </SplashLottieBoundary>
    )

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
        {visual}
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
