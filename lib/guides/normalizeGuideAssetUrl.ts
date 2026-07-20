// lib/guides/normalizeGuideAssetUrl.ts

export function normalizeGuideAssetUrl(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  const normalizedPath = trimmed
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')

  if (!normalizedPath) {
    return null
  }

  return `/${normalizedPath}`
}