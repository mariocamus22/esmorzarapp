import { coffeeEmojiForLabel } from '../lib/optionLabels'

type Props = {
  label: string
  className?: string
}

export function CoffeeOptionEmoji({ label, className }: Props) {
  return (
    <span className={className} aria-hidden>
      {coffeeEmojiForLabel(label)}
    </span>
  )
}
