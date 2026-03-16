'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function OpenPropertyPage() {

  const params = useParams<{ city: string; slug: string }>()

  const city = params?.city
  const slug = params?.slug

  const deepLink =
    city && slug
      ? `roam://property/${city}/${slug}`
      : ''

  const webLink =
    city && slug
      ? `/property/${city}/${slug}`
      : '/'

  useEffect(() => {

    if (!city || !slug) return

    let fallbackTimer: ReturnType<typeof setTimeout>

    /* ------------------------------------------------ */
    /* Detect if browser lost focus (app opened)        */
    /* ------------------------------------------------ */

    const handleVisibilityChange = () => {

      if (document.visibilityState === 'hidden') {
        clearTimeout(fallbackTimer)
      }

    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    /* ------------------------------------------------ */
    /* Attempt deep link                                */
    /* ------------------------------------------------ */

    window.location.href = deepLink

    /* ------------------------------------------------ */
    /* Fallback to website if app doesn't open          */
    /* ------------------------------------------------ */

    fallbackTimer = setTimeout(() => {
      window.location.href = webLink
    }, 1500)

    return () => {

      clearTimeout(fallbackTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

    }

  }, [city, slug, deepLink, webLink])

  /* ------------------------------------------------ */
  /* Manual open button                               */
  /* ------------------------------------------------ */

  function openApp() {

    if (!deepLink) return

    window.location.href = deepLink

  }

  return (

    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">

      <p className="text-sm text-muted-foreground">
        Opening guide in the Roam app...
      </p>

      <button
        onClick={openApp}
        className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition"
      >
        Open in App
      </button>

      <p className="text-xs text-muted-foreground">
        If nothing happens, you'll be redirected to the web version.
      </p>

    </div>

  )

}