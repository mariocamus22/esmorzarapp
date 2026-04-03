import { useEffect, useState } from 'react'

type Props = {
  apiKey: string | undefined
}

/**
 * Panel opcional: abre /nuevo?mapsDebug=1 para ver si la clave va al build y si el SDK de Maps se ha cargado.
 */
export function MapsStepDiagnostics({ apiKey }: Props) {
  const trimmed = apiKey?.trim() ?? ''
  const [sdkLabel, setSdkLabel] = useState('Esperando…')

  useEffect(() => {
    const id = window.setTimeout(() => {
      const g = (window as Window & { google?: { maps?: unknown } }).google
      setSdkLabel(
        g?.maps
          ? 'google.maps cargado'
          : 'google.maps NO cargado (revisa consola y referentes en GCP)',
      )
    }, 2800)
    return () => window.clearTimeout(id)
  }, [trimmed])

  return (
    <div className="banner banner-warn maps-debug-panel" role="status">
      <strong>Maps debug</strong> (solo se muestra con <code>?mapsDebug=1</code> en la URL)
      <ul className="maps-debug-list">
        <li>
          <strong>Clave en el build:</strong>{' '}
          {trimmed
            ? `sí (longitud ${trimmed.length}, prefijo ${trimmed.slice(0, 8)}…)`
            : 'no — en Vercel comprueba el nombre exacto VITE_GOOGLE_MAPS_API_KEY, los entornos Production y Preview y vuelve a desplegar'}
        </li>
        <li>
          <strong>SDK (~3s):</strong> {sdkLabel}
        </li>
      </ul>
      <p className="maps-debug-hint">
        Si tienes la PWA instalada y todo parece antiguo: desinstálala o borra los datos del sitio para este
        dominio.
      </p>
      <p className="maps-debug-hint">
        En Google Cloud, la clave debe tener el referente <code>https://tu-dominio/*</code> (sin comillas en el
        valor en Vercel).
      </p>
    </div>
  )
}
