import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css' // ✅ Import Leaflet CSS
import '@/app/globals.css'

export default function MyApp({ Component, pageProps }: AppProps) {
  // ✅ Patch Leaflet default marker icons
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  return <Component {...pageProps} />
}
