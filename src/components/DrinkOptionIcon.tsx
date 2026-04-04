import type { SVGProps } from 'react'
import { stripLeadingEmojisFromLabel } from '../lib/optionLabels'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

function IconBeer({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M7 4h8v9a3 3 0 01-3 3h-2a3 3 0 01-3-3V4zM15 6h2.2a2.3 2.3 0 011.3 4.2L17 11M6 19h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconWine({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M8 3h8l-.5 7a3.5 3.5 0 11-7 0L8 3zM12 14v5M9 21h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconWineSoda({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M8 3h7l-.4 5.5a3 3 0 01-6.2 0L8 3zM11.5 12v2.5M9 18h5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16.2 6.3l1.6 1.6M17.8 6.3l-1.6 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconSoda({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M9 4h6l1 14a2 2 0 01-2 2h-4a2 2 0 01-2-2L9 4zM8 8h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 3h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function IconWater({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M12 3s4 6.5 4 10a4 4 0 11-8 0c0-3.5 4-10 4-10z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconJuice({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M8 5h8l-1 12a2 2 0 01-2 2h-2a2 2 0 01-2-2L8 5zM7 9h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M10 3c.8 1.2 1.5 2 3 2s2.2-.8 3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconNoDrink({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 7l10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M9 6h6l-.8 8a1.5 1.5 0 01-1.5 1.3h-1.4a1.5 1.5 0 01-1.5-1.3L9 6z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.45"
      />
    </svg>
  )
}

function IconDrinkGeneric({ className, ...rest }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden {...rest}>
      <path
        d="M8 3h8l-1 14.5a2 2 0 01-2 1.5h-2a2 2 0 01-2-1.5L8 3zM6 8h12"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Props = {
  label: string
  className?: string
}

/**
 * Icono según el texto de la opción de bebida (etiqueta de `meal_options`, con o sin emoji).
 */
export function DrinkOptionIcon({ label, className }: Props) {
  const plain = stripLeadingEmojisFromLabel(label).toLowerCase().trim()

  if (plain.includes('sin bebida')) return <IconNoDrink className={className} />
  if (plain.includes('vino') && plain.includes('gaseosa')) return <IconWineSoda className={className} />
  if (plain.includes('cerveza')) return <IconBeer className={className} />
  if (plain.includes('vino')) return <IconWine className={className} />
  if (plain.includes('refresco')) return <IconSoda className={className} />
  if (plain.includes('agua')) return <IconWater className={className} />
  if (plain.includes('zumo') || plain.includes('bebida natural')) return <IconJuice className={className} />

  return <IconDrinkGeneric className={className} />
}
