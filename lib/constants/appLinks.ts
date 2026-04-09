/**
 * Centralized app download / deep link configuration
 *
 * Use this everywhere instead of hardcoding links.
 */

export const APP_LINKS = {
  ios: 'https://apps.apple.com/us/app/roam-curated/id6759286009',

  /**
   * Placeholder for future Android support
   * Replace when Play Store link is available
   */
  android: null as string | null,

  /**
   * Fallback for desktop or unknown devices
   * For now, send to iOS app store
   * Later: replace with a marketing / landing page or universal link
   */
  fallback: 'https://apps.apple.com/us/app/roam-curated/id6759286009',
}

/**
 * Simple device-aware resolver
 * (lightweight — avoids needing external libraries)
 */
export function getAppDownloadLink(): string {
  if (typeof window === 'undefined') {
    return APP_LINKS.fallback
  }

  const ua = navigator.userAgent.toLowerCase()

  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isAndroid = /android/.test(ua)

  if (isIOS) return APP_LINKS.ios
  if (isAndroid && APP_LINKS.android) return APP_LINKS.android

  return APP_LINKS.fallback
}