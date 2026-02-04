// /lib/browser.ts

export const inBrowser = () => typeof window !== 'undefined'

export const getHref = () => {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

export const getOrigin = () => {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}
