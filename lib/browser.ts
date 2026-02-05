// /lib/browser.ts

/**
 * ✅ Returns true if running in the browser environment.
 */
export const inBrowser = (): boolean => typeof window !== 'undefined'

/**
 * ✅ Safe wrapper for window.location.href
 *    Returns '' on server
 */
export const getHref = (): string => {
  return inBrowser() ? window.location.href : ''
}

/**
 * ✅ Safe wrapper for window.location.origin
 *    Returns '' on server
 */
export const getOrigin = (): string => {
  return inBrowser() ? window.location.origin : ''
}
