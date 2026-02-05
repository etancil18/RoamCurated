import { useEffect, useState } from 'react'

/**
 * ✅ Returns true if running in the browser environment.
 */
export const inBrowser = (): boolean => typeof window !== 'undefined'

/**
 * ✅ Safe wrapper for window.location.href
 */
export const getHref = (): string => {
  return inBrowser() ? window.location.href : ''
}

/**
 * ✅ Safe wrapper for window.location.origin
 */
export const getOrigin = (): string => {
  return inBrowser() ? window.location.origin : ''
}

/**
 * ✅ Always-safe search param getter
 */
export const getSearchParams = (): URLSearchParams => {
  return inBrowser() ? new URLSearchParams(window.location.search) : new URLSearchParams()
}

/**
 * ✅ Hook for SSR-safe client detection
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}
