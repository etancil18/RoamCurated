import {
  BLOCKED_PUBLIC_WEBSITE_HOSTS,
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  hostnameMatchesAllowedHost,
} from './constants'

import type {
  CreatorSocialPlatform,
} from './types'

/**
 * Maximum URL length enforced by the Creator Mode database,
 * schemas, and form inputs.
 *
 * This value intentionally mirrors:
 *
 *   CREATOR_FIELD_LIMITS.socialUrl
 *
 * It is kept local here to avoid importing broader validation
 * configuration into a small URL utility.
 */
const MAX_SOCIAL_URL_LENGTH = 2048

/**
 * Supported public URL protocols.
 *
 * HTTPS is preferred, but HTTP remains accepted so creators
 * can link to legitimate sites that have not migrated yet.
 */
const ALLOWED_PROTOCOLS = new Set([
  'https:',
  'http:',
])

/**
 * Common private IPv4 ranges that should never be published
 * as creator profile links.
 */
const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

/**
 * IPv6 ranges that should not be accepted as public creator
 * links.
 */
const PRIVATE_IPV6_PREFIXES = [
  '::1',
  'fc',
  'fd',
  'fe80',
]

export type SocialUrlValidationCode =
  | 'required'
  | 'too_long'
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'credentials_not_allowed'
  | 'hostname_required'
  | 'private_host'
  | 'platform_mismatch'

export type SocialUrlValidationSuccess = {
  valid: true
  platform: CreatorSocialPlatform
  normalizedUrl: string
  hostname: string
  error: null
  code: null
}

export type SocialUrlValidationFailure = {
  valid: false
  platform: CreatorSocialPlatform
  normalizedUrl: null
  hostname: string | null
  error: string
  code: SocialUrlValidationCode
}

export type SocialUrlValidationResult =
  | SocialUrlValidationSuccess
  | SocialUrlValidationFailure

/**
 * Validates and normalizes a creator social URL.
 *
 * This is the canonical runtime validator for:
 *
 * - Creator Mode server actions
 * - settings forms
 * - import scripts
 * - admin tooling
 *
 * It does not make a network request and does not verify that
 * the linked account exists or belongs to the creator.
 */
export function validateCreatorSocialUrl({
  platform,
  value,
}: {
  platform: CreatorSocialPlatform
  value: unknown
}): SocialUrlValidationResult {
  const definition =
    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[platform]

  if (
    typeof value !== 'string' ||
    value.trim().length === 0
  ) {
    return failure({
      platform,
      code: 'required',
      error: `${definition.label} URL is required.`,
    })
  }

  const trimmedValue = value.trim()

  if (
    trimmedValue.length >
    MAX_SOCIAL_URL_LENGTH
  ) {
    return failure({
      platform,
      code: 'too_long',
      error: `${definition.label} URL must be ${MAX_SOCIAL_URL_LENGTH} characters or fewer.`,
    })
  }

  const parsedUrl = parseUrl(trimmedValue)

  if (!parsedUrl) {
    return failure({
      platform,
      code: 'invalid_url',
      error: `Enter a valid ${definition.label} URL.`,
    })
  }

  if (
    !ALLOWED_PROTOCOLS.has(
      parsedUrl.protocol.toLowerCase()
    )
  ) {
    return failure({
      platform,
      code: 'unsupported_protocol',
      error:
        'URL must begin with https:// or http://.',
      hostname: normalizeHostname(
        parsedUrl.hostname
      ),
    })
  }

  if (
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0
  ) {
    return failure({
      platform,
      code: 'credentials_not_allowed',
      error:
        'URLs containing usernames or passwords are not allowed.',
      hostname: normalizeHostname(
        parsedUrl.hostname
      ),
    })
  }

  const hostname = normalizeHostname(
    parsedUrl.hostname
  )

  if (!hostname) {
    return failure({
      platform,
      code: 'hostname_required',
      error: 'URL must include a valid hostname.',
    })
  }

  if (isPrivateOrLocalHostname(hostname)) {
    return failure({
      platform,
      code: 'private_host',
      error:
        'Local and private-network URLs are not allowed.',
      hostname,
    })
  }

  if (
    !definition.isGeneralWebsite &&
    !definition.allowedHosts.some(
      (allowedHost) =>
        hostnameMatchesAllowedHost(
          hostname,
          allowedHost
        )
    )
  ) {
    return failure({
      platform,
      code: 'platform_mismatch',
      error: `The URL does not match ${definition.label}.`,
      hostname,
    })
  }

  return {
    valid: true,
    platform,
    normalizedUrl:
      normalizePublicUrl(parsedUrl),
    hostname,
    error: null,
    code: null,
  }
}

/**
 * Backward-compatible boolean helper.
 *
 * Use this when a caller only needs a yes/no answer.
 *
 * Prefer `validateCreatorSocialUrl` in server actions so the
 * UI can display the specific validation error.
 */
export function validateSocialUrl(
  platform: CreatorSocialPlatform,
  value: unknown
): boolean {
  return validateCreatorSocialUrl({
    platform,
    value,
  }).valid
}

/**
 * Returns the normalized URL or null.
 *
 * Useful when a server action wants to store a canonical URL
 * after validation.
 */
export function normalizeCreatorSocialUrl({
  platform,
  value,
}: {
  platform: CreatorSocialPlatform
  value: unknown
}): string | null {
  const result =
    validateCreatorSocialUrl({
      platform,
      value,
    })

  return result.valid
    ? result.normalizedUrl
    : null
}

/**
 * Throws a descriptive error when a URL is invalid.
 *
 * Useful in scripts, imports, or service-layer code where
 * returning a structured result would be unnecessarily verbose.
 */
export function assertValidCreatorSocialUrl({
  platform,
  value,
}: {
  platform: CreatorSocialPlatform
  value: unknown
}): string {
  const result =
    validateCreatorSocialUrl({
      platform,
      value,
    })

  if (!result.valid) {
    throw new Error(result.error)
  }

  return result.normalizedUrl
}

/**
 * Detects whether a hostname points to a local or private
 * network destination.
 *
 * This prevents obviously unsafe or non-public URLs from being
 * displayed on public creator profiles.
 *
 * It is not a replacement for network-layer SSRF protection.
 * This utility never performs a network request.
 */
export function isPrivateOrLocalHostname(
  hostname: string
): boolean {
  const normalizedHostname =
    normalizeHostname(hostname)

  if (!normalizedHostname) {
    return true
  }

  if (
    BLOCKED_PUBLIC_WEBSITE_HOSTS.some(
      (blockedHost) =>
        hostnameMatchesAllowedHost(
          normalizedHostname,
          blockedHost
        )
    )
  ) {
    return true
  }

  if (
    normalizedHostname.endsWith('.local') ||
    normalizedHostname.endsWith(
      '.localhost'
    )
  ) {
    return true
  }

  if (
    PRIVATE_IPV4_PATTERNS.some(
      (pattern) =>
        pattern.test(normalizedHostname)
    )
  ) {
    return true
  }

  if (
    isPrivateIpv6Hostname(
      normalizedHostname
    )
  ) {
    return true
  }

  return false
}

/**
 * Produces a normalized hostname suitable for comparison.
 */
export function normalizeHostname(
  hostname: string
): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
}

/**
 * Produces a stable public URL representation.
 *
 * Normalization includes:
 *
 * - lowercase protocol and hostname
 * - removal of default ports
 * - removal of URL fragments
 * - removal of unnecessary trailing slashes
 *
 * Query parameters are preserved because creator profile links
 * may legitimately include platform-specific tracking or route
 * information.
 */
export function normalizePublicUrl(
  url: URL
): string {
  const normalized = new URL(url.toString())

  normalized.protocol =
    normalized.protocol.toLowerCase()

  normalized.hostname =
    normalizeHostname(
      normalized.hostname
    )

  normalized.hash = ''

  if (
    normalized.protocol === 'https:' &&
    normalized.port === '443'
  ) {
    normalized.port = ''
  }

  if (
    normalized.protocol === 'http:' &&
    normalized.port === '80'
  ) {
    normalized.port = ''
  }

  if (
    normalized.pathname.length > 1
  ) {
    normalized.pathname =
      normalized.pathname.replace(
        /\/+$/,
        ''
      )
  }

  return normalized.toString()
}

/**
 * Returns true when two URLs normalize to the same public URL.
 *
 * Useful for duplicate social-link detection.
 */
export function creatorSocialUrlsEqual(
  first: string,
  second: string
): boolean {
  const firstUrl = parseUrl(first)
  const secondUrl = parseUrl(second)

  if (!firstUrl || !secondUrl) {
    return (
      first.trim().toLowerCase() ===
      second.trim().toLowerCase()
    )
  }

  return (
    normalizePublicUrl(firstUrl) ===
    normalizePublicUrl(secondUrl)
  )
}

/**
 * Attempts to extract a display handle from a supported social
 * URL.
 *
 * This is a convenience helper only. Creators can still supply
 * a custom handle explicitly.
 */
export function extractCreatorSocialHandle({
  platform,
  value,
}: {
  platform: CreatorSocialPlatform
  value: unknown
}): string | null {
  const result =
    validateCreatorSocialUrl({
      platform,
      value,
    })

  if (!result.valid) {
    return null
  }

  const url = new URL(
    result.normalizedUrl
  )

  const segments = url.pathname
    .split('/')
    .map((segment) =>
      decodeURIComponent(segment).trim()
    )
    .filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  switch (platform) {
    case 'instagram':
    case 'threads':
    case 'tiktok': {
      const candidate =
        segments[0]?.replace(/^@+/, '')

      return sanitizeExtractedHandle(
        candidate
      )
    }

    case 'youtube': {
      const firstSegment = segments[0]

      if (
        firstSegment?.startsWith('@')
      ) {
        return sanitizeExtractedHandle(
          firstSegment.replace(/^@+/, '')
        )
      }

      if (
        ['channel', 'c', 'user'].includes(
          firstSegment ?? ''
        )
      ) {
        return sanitizeExtractedHandle(
          segments[1]
        )
      }

      return null
    }

    case 'linkedin': {
      if (
        ['in', 'company'].includes(
          segments[0] ?? ''
        )
      ) {
        return sanitizeExtractedHandle(
          segments[1]
        )
      }

      return null
    }

    case 'pinterest':
    case 'x': {
      return sanitizeExtractedHandle(
        segments[0]
      )
    }

    case 'website':
      return null
  }
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

function parseUrl(
  value: string
): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isPrivateIpv6Hostname(
  hostname: string
): boolean {
  if (!hostname.includes(':')) {
    return false
  }

  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')

  if (normalized === '::1') {
    return true
  }

  return PRIVATE_IPV6_PREFIXES.some(
    (prefix) =>
      normalized.startsWith(prefix)
  )
}

function sanitizeExtractedHandle(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null
  }

  const normalized = value
    .trim()
    .replace(/^@+/, '')

  if (
    !normalized ||
    normalized.length > 100 ||
    /\s|[/?#]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function failure({
  platform,
  code,
  error,
  hostname = null,
}: {
  platform: CreatorSocialPlatform
  code: SocialUrlValidationCode
  error: string
  hostname?: string | null
}): SocialUrlValidationFailure {
  return {
    valid: false,
    platform,
    normalizedUrl: null,
    hostname,
    error,
    code,
  }
}