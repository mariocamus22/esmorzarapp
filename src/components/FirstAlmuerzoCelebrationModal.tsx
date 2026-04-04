import Lottie from 'lottie-react'
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from 'react'

import confettiAnimation from '../assets/lottie/confetti.json'

function subscribeReducedMotion(onChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function reducedMotionSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

class CelebrationLottieBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[FirstAlmuerzoCelebration] Lottie error:', error.message, info.componentStack)
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function ConfettiStaticFallback() {
  return (
    <div className="first-almuerzo-celebration__confetti-fallback" aria-hidden>
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--1" />
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--2" />
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--3" />
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--4" />
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--5" />
      <span className="first-almuerzo-celebration__confetti-bit first-almuerzo-celebration__confetti-bit--6" />
    </div>
  )
}

function ConfettiLottie({ play }: { play: boolean }) {
  const [dataFailed, setDataFailed] = useState(false)

  const onDataFailed = useCallback(() => {
    setDataFailed(true)
  }, [])

  if (dataFailed) {
    return <ConfettiStaticFallback />
  }

  return (
    <Lottie
      className="first-almuerzo-celebration__lottie"
      animationData={confettiAnimation}
      loop={play}
      autoplay={play}
      onDataFailed={onDataFailed}
    />
  )
}

type Props = {
  open: boolean
  onClose: () => void
  /** Etiqueta del nivel tras refrescar perfil; por defecto «Novato» (coherente con la BD). */
  levelLabel?: string | null
}

export function FirstAlmuerzoCelebrationModal({ open, onClose, levelLabel }: Props) {
  const titleId = useId()
  const descId = useId()
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false)
  const playLottie = !reducedMotion

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const nivelMostrar = levelLabel?.trim() || 'Novato'

  return (
    <div className="first-almuerzo-celebration-root" role="presentation">
      <div className="first-almuerzo-celebration-lottie-layer" aria-hidden>
        {playLottie ? (
          <CelebrationLottieBoundary fallback={<ConfettiStaticFallback />}>
            <ConfettiLottie play />
          </CelebrationLottieBoundary>
        ) : (
          <ConfettiStaticFallback />
        )}
      </div>
      <button
        type="button"
        className="first-almuerzo-celebration-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="first-almuerzo-celebration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="first-almuerzo-celebration-head">
          <div className="first-almuerzo-celebration-head-text">
            <h2 id={titleId} className="first-almuerzo-celebration-title">
              ¡Enhorabuena!
            </h2>
            <p id={descId} className="first-almuerzo-celebration-desc">
              Has guardado tu primer almuerzo. Tu nivel ahora es{' '}
              <strong className="first-almuerzo-celebration-level">{nivelMostrar}</strong>: sigue registrando
              para subir en la clasificación.
            </p>
          </div>
          <button type="button" className="first-almuerzo-celebration-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="first-almuerzo-celebration-actions">
          <button type="button" className="btn btn-primary first-almuerzo-celebration-btn" onClick={onClose}>
            Genial
          </button>
        </div>
      </div>
    </div>
  )
}
