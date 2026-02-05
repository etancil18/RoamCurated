// /lib/browser.ts

import { useEffect, useState } from 'react'

/**
 * ✅ Returns true if running in the browser environment.
 */
export const inBrowser = (): boolean => typeof window !== 'undefined'

/**
 * ✅ Safe wrapper for window.location.href
 *    Returns '' on server
 */
export const getHref = (): string => {
  if (!inBrowser()) return ''
  return window.location.href
}

/**
 * ✅ Safe wrapper for window.location.origin
 *    Returns '' on server
 */
export const getOrigin = (): string => {
  if (!inBrowser()) return ''
  return window.location.origin
}

/**
 * ✅ Returns search params object or empty if not in browser
 */
export const getSearchParams = (): URLSearchParams | null => {
  if (!inBrowser()) return null
  return new URLSearchParams(window.location.search)
}

/**
 * ✅ React hook to detect client-side mount (hydration-safe)
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}
