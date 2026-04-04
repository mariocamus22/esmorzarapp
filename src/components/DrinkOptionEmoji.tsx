import { drinkEmojiForLabel } from '../lib/optionLabels'

type Props = {
  label: string
  className?: string
}

export function DrinkOptionEmoji({ label, className }: Props) {
  return (
    <span className={className} aria-hidden>
      {drinkEmojiForLabel(label)}
    </span>
  )
}
