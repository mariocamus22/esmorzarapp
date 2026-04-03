import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'

export type BarPlaceResolved = {
  name: string
  googlePlaceId: string
  formattedAddress: string | null
  lat: number | null
  lng: number | null
}

type Props = {
  id: string
  className: string
  value: string
  onBarInputChange: (value: string) => void
  onPlaceResolved: (place: BarPlaceResolved) => void
  apiKey: string | undefined
  placeholder?: string
  disabled?: boolean
}

/**
 * Camp de cerca de bar: amb clau de Google, Autocomplete (Places + Maps JS);
 * sense clau, input de text normal.
 */
export function BarPlaceSearch({
  id,
  className,
  value,
  onBarInputChange,
  onPlaceResolved,
  apiKey,
  placeholder = 'Busca un bar…',
  disabled = false,
}: Props) {
  /** Ref estable per al callback de React; l’efecte depèn de `inputNode` per evitar `ref.current === null` al primer useEffect. */
  const [inputNode, setInputNode] = useState<HTMLInputElement | null>(null)
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    setInputNode(el)
  }, [])

  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onPlaceResolvedRef = useRef(onPlaceResolved)

  const trimmedKey = apiKey?.trim() ?? ''

  useEffect(() => {
    onPlaceResolvedRef.current = onPlaceResolved
  }, [onPlaceResolved])

  useEffect(() => {
    if (!trimmedKey) {
      console.info(
        '[Esmorzapp] Sense VITE_GOOGLE_MAPS_API_KEY en aquest build: el camp Bar és només text. A Vercel, afegeix la variable (Production + Preview) i Redeploy.',
      )
    }
  }, [trimmedKey])

  useEffect(() => {
    if (!trimmedKey) return
    if (!inputNode) return

    let cancelled = false

    ;(async () => {
      try {
        setOptions({ key: trimmedKey, v: 'weekly', language: 'ca', region: 'ES' })
        await importLibrary('maps')
        const { Autocomplete } = await importLibrary('places')
        if (cancelled || !inputNode.isConnected) return

        const ac = new Autocomplete(inputNode, {
          componentRestrictions: { country: 'es' },
        })
        autocompleteRef.current = ac

        listenerRef.current = ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          const pid = place.place_id?.trim()
          if (!pid) return

          const name =
            (place.name && place.name.trim()) ||
            place.formatted_address?.split(',')[0]?.trim() ||
            ''
          if (!name) return

          const loc = place.geometry?.location
          const lat = loc != null ? loc.lat() : null
          const lng = loc != null ? loc.lng() : null

          onPlaceResolvedRef.current({
            name,
            googlePlaceId: pid,
            formattedAddress: place.formatted_address?.trim() ?? null,
            lat,
            lng,
          })
          if (inputNode.isConnected) inputNode.value = name
        })
      } catch (e) {
        console.warn(
          '[Esmorzapp] No s’ha pogut carregar Google Places (Maps JS). Revisa la clau VITE_GOOGLE_MAPS_API_KEY al build de Vercel i les APIs/referents a Google Cloud.',
          e,
        )
      }
    })()

    return () => {
      cancelled = true
      listenerRef.current?.remove()
      listenerRef.current = null
      const ac = autocompleteRef.current
      autocompleteRef.current = null
      if (ac && typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.clearInstanceListeners(ac)
      }
    }
  }, [trimmedKey, inputNode])

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onBarInputChange(e.target.value),
    [onBarInputChange],
  )

  /**
   * Amb Autocomplete de Google, un input **controlat** (`value` + `onChange`) fa que React
   * torne a pintar el valor a cada tecla i el desplegable de suggerències no funcioni o quede buit.
   * Sense clau, seguim controlats per mantenir el comportament anterior.
   */
  if (trimmedKey) {
    return (
      <input
        ref={setInputRef}
        id={id}
        className={className}
        type="text"
        defaultValue={value}
        onChange={onChange}
        autoComplete="off"
        placeholder={placeholder}
        enterKeyHint="next"
        disabled={disabled}
      />
    )
  }

  return (
    <input
      ref={setInputRef}
      id={id}
      className={className}
      type="text"
      value={value}
      onChange={onChange}
      autoComplete="off"
      placeholder={placeholder}
      enterKeyHint="next"
      disabled={disabled}
    />
  )
}
