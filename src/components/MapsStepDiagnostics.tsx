import { useEffect, useState } from 'react'

type Props = {
  apiKey: string | undefined
}

/**
 * Panell opcional: obre /nuevo?mapsDebug=1 per veure si la clau va al build i si el SDK de Maps s’ha carregat.
 */
export function MapsStepDiagnostics({ apiKey }: Props) {
  const trimmed = apiKey?.trim() ?? ''
  const [sdkLabel, setSdkLabel] = useState('Esperant…')

  useEffect(() => {
    const id = window.setTimeout(() => {
      const g = (window as Window & { google?: { maps?: unknown } }).google
      setSdkLabel(g?.maps ? 'google.maps carregat' : 'google.maps NO carregat (revisa consola i referents a GCP)')
    }, 2800)
    return () => window.clearTimeout(id)
  }, [trimmed])

  return (
    <div className="banner banner-warn maps-debug-panel" role="status">
      <strong>Maps debug</strong> (només es mostra amb <code>?mapsDebug=1</code> a la URL)
      <ul className="maps-debug-list">
        <li>
          <strong>Clau al build:</strong>{' '}
          {trimmed
            ? `sí (longitud ${trimmed.length}, prefix ${trimmed.slice(0, 8)}…)`
            : 'no — a Vercel comprova el nom exacte VITE_GOOGLE_MAPS_API_KEY, entorns Production/Preview i Redeploy'}
        </li>
        <li>
          <strong>SDK (~3s):</strong> {sdkLabel}
        </li>
      </ul>
      <p className="maps-debug-hint">
        Si tens la PWA instal·lada i tot sembla antic: desinstal·la o esborra dades del lloc per a aquest domini.
      </p>
      <p className="maps-debug-hint">
        A Google Cloud, la clau ha de tenir referent <code>https://el-teu-dominio/*</code> (sense cometes al valor a
        Vercel).
      </p>
    </div>
  )
}
