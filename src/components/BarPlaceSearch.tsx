import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
  type Ref,
} from 'react'

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
  onSearchFocus?: () => void
  onSearchBlur?: () => void
  'aria-labelledby'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

function assignRef<T>(ref: Ref<T> | undefined, el: T | null) {
  if (!ref) return
  if (typeof ref === 'function') ref(el)
  else (ref as MutableRefObject<T | null>).current = el
}

/**
 * Campo de búsqueda de bar: con clave de Google, Autocomplete (Places + Maps JS);
 * sin clave, input de texto normal.
 */
export const BarPlaceSearch = forwardRef<HTMLInputElement, Props>(function BarPlaceSearch(
  {
    id,
    className,
    value,
    onBarInputChange,
    onPlaceResolved,
    apiKey,
    placeholder = 'Busca un bar… (ej. La Mesedora, Algemesí)',
    disabled = false,
    onSearchFocus,
    onSearchBlur,
    'aria-labelledby': ariaLabelledby,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
  },
  ref,
) {
  const [inputNode, setInputNode] = useState<HTMLInputElement | null>(null)
  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      setInputNode(el)
      assignRef(ref, el)
    },
    [ref],
  )

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
        '[Esmorzapp] Sin VITE_GOOGLE_MAPS_API_KEY en este build: el campo Bar es solo texto. En Vercel, añade la variable (Production + Preview) y vuelve a desplegar.',
      )
    }
  }, [trimmedKey])

  useEffect(() => {
    if (!trimmedKey) return
    if (!inputNode) return

    let cancelled = false

    ;(async () => {
      try {
        setOptions({ key: trimmedKey, v: 'weekly', language: 'es', region: 'ES' })
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
          '[Esmorzapp] No se pudo cargar Google Places (Maps JS). Revisa la clave VITE_GOOGLE_MAPS_API_KEY en el build de Vercel y las APIs/referentes en Google Cloud.',
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

  const sharedInputProps = {
    id,
    className,
    autoComplete: 'off' as const,
    placeholder,
    enterKeyHint: 'next' as const,
    disabled,
    onFocus: onSearchFocus,
    onBlur: onSearchBlur,
    'aria-labelledby': ariaLabelledby,
    'aria-invalid': ariaInvalid,
    'aria-describedby': ariaDescribedby,
  }

  /**
   * Con Autocomplete de Google, un input **controlado** (`value` + `onChange`) hace que React
   * vuelva a pintar el valor en cada tecla y el desplegable de sugerencias no funcione o quede vacío.
   * Sin clave, seguimos controlados para mantener el comportamiento anterior.
   */
  if (trimmedKey) {
    return (
      <input
        ref={setInputRef}
        type="text"
        defaultValue={value}
        onChange={onChange}
        {...sharedInputProps}
      />
    )
  }

  return (
    <input
      ref={setInputRef}
      type="text"
      value={value}
      onChange={onChange}
      {...sharedInputProps}
    />
  )
})
