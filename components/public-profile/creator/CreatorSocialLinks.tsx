import {
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  Youtube,
} from 'lucide-react'

import {
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  getCreatorSocialDisplayLabel,
} from '@/lib/creator/constants'

import {
  validateCreatorSocialUrl,
} from '@/lib/creator/validateSocialUrl'

import type {
  CreatorSocialPlatform,
  PublicCreatorSocialLink,
} from '@/lib/creator/types'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorSocialLinksProps = {
  /**
   * Public social-link projection returned by the public creator
   * loader.
   *
   * Private rows must never be passed into this component.
   */
  links: readonly PublicCreatorSocialLink[]

  /**
   * Optional section title.
   */
  title?: string

  /**
   * Optional supporting copy.
   */
  description?: string

  /**
   * Maximum number of links rendered.
   *
   * Defaults to every valid supplied link, capped at the number
   * of supported Creator Mode platforms.
   */
  limit?: number

  /**
   * Controls whether the surrounding section heading is shown.
   */
  showHeading?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorSocialLinks({
  links,
  title = 'Find me online',
  description =
    'Explore the public channels where this creator shares work, recommendations, and collaborations.',
  limit,
  showHeading = true,
  className = '',
}: CreatorSocialLinksProps) {
  const normalizedLinks = normalizePublicSocialLinks({
    links,
    limit,
  })

  if (normalizedLinks.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby={
        showHeading
          ? 'creator-social-links-title'
          : undefined
      }
      className={[
        'w-full min-w-0 rounded-[1.75rem] border border-neutral-800/90 bg-neutral-950/70 p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showHeading ? (
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
            Social presence
          </p>

          <h2
            id="creator-social-links-title"
            className="mt-2 break-words text-xl font-semibold tracking-tight text-white"
          >
            {title}
          </h2>

          {description ? (
            <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-neutral-400">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label="Creator social profiles"
        className={[
          'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2',
          showHeading ? 'mt-5' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {normalizedLinks.map((link) => (
          <CreatorSocialLinkCard
            key={link.id}
            link={link}
          />
        ))}
      </nav>
    </section>
  )
}

/* =========================================================
 * Individual social-link card
 * ======================================================= */

function CreatorSocialLinkCard({
  link,
}: {
  link: NormalizedPublicCreatorSocialLink
}) {
  const definition =
    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
      link.platform
    ]

  const displayLabel =
    getCreatorSocialDisplayLabel(link) ??
    definition.label

  const hostname =
    getDisplayHostname(link.url)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Open ${definition.label} profile${
        displayLabel !== definition.label
          ? ` for ${displayLabel}`
          : ''
      }`}
      className={[
        'group flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-3 transition',
        'hover:border-cyan-500/40 hover:bg-cyan-500/[0.06]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
      ].join(' ')}
    >
      <CreatorSocialIconShell
        platform={link.platform}
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white transition group-hover:text-cyan-100">
          {displayLabel}
        </span>

        <span className="mt-0.5 block truncate text-xs text-neutral-500">
          {hostname ?? definition.label}
        </span>
      </span>

      <ExternalLink
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-neutral-600 transition group-hover:text-cyan-300"
      />
    </a>
  )
}

/* =========================================================
 * Social icon shell
 * ======================================================= */

function CreatorSocialIconShell({
  platform,
}: {
  platform: CreatorSocialPlatform
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 transition group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10 group-hover:text-cyan-200"
    >
      <CreatorSocialIcon
        platform={platform}
      />
    </span>
  )
}

/* =========================================================
 * Platform icons
 * ======================================================= */

function CreatorSocialIcon({
  platform,
}: {
  platform: CreatorSocialPlatform
}) {
  const className =
    'h-4 w-4 shrink-0'

  switch (platform) {
    case 'instagram':
      return (
        <Instagram
          className={className}
        />
      )

    case 'youtube':
      return (
        <Youtube
          className={className}
        />
      )

    case 'linkedin':
      return (
        <Linkedin
          className={className}
        />
      )

    case 'website':
      return (
        <Globe2
          className={className}
        />
      )

    case 'tiktok':
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-black tracking-[-0.08em]">
          TT
        </span>
      )

    case 'threads':
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center text-base font-bold leading-none">
          @
        </span>
      )

    case 'pinterest':
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center text-sm font-bold leading-none">
          P
        </span>
      )

    case 'x':
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center text-sm font-semibold leading-none">
          X
        </span>
      )
  }
}

/* =========================================================
 * Normalized internal shape
 * ======================================================= */

type NormalizedPublicCreatorSocialLink =
  PublicCreatorSocialLink & {
    url: string
    handle: string | null
    sort_order: number
  }

/* =========================================================
 * Public-link normalization
 * ======================================================= */

function normalizePublicSocialLinks({
  links,
  limit,
}: {
  links: readonly PublicCreatorSocialLink[]
  limit?: number
}): NormalizedPublicCreatorSocialLink[] {
  const normalizedLimit =
    normalizeLimit(limit)

  const byPlatform = new Map<
    CreatorSocialPlatform,
    NormalizedPublicCreatorSocialLink
  >()

  const seenUrls = new Set<string>()

  for (const link of links) {
    const normalizedLink =
      normalizePublicSocialLink(link)

    if (!normalizedLink) {
      continue
    }

    const normalizedUrlKey =
      normalizedLink.url.toLowerCase()

    if (seenUrls.has(normalizedUrlKey)) {
      continue
    }

    const existingPlatformLink =
      byPlatform.get(
        normalizedLink.platform
      )

    /**
     * Creator Mode currently allows one social link per
     * supported platform. If malformed upstream data contains
     * duplicates, keep the highest-priority valid row.
     */
    if (
      existingPlatformLink &&
      compareSocialLinks(
        existingPlatformLink,
        normalizedLink
      ) <= 0
    ) {
      continue
    }

    if (existingPlatformLink) {
      seenUrls.delete(
        existingPlatformLink.url.toLowerCase()
      )
    }

    byPlatform.set(
      normalizedLink.platform,
      normalizedLink
    )

    seenUrls.add(normalizedUrlKey)
  }

  return [...byPlatform.values()]
    .sort(compareSocialLinks)
    .slice(0, normalizedLimit)
}

function normalizePublicSocialLink(
  value: PublicCreatorSocialLink
): NormalizedPublicCreatorSocialLink | null {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return null
  }

  if (
    typeof value.id !== 'string' ||
    value.id.trim().length === 0
  ) {
    return null
  }

  if (
    !isCreatorSocialPlatform(
      value.platform
    )
  ) {
    return null
  }

  const validation =
    validateCreatorSocialUrl({
      platform: value.platform,
      value: value.url,
    })

  if (!validation.valid) {
    return null
  }

  return {
    id: value.id.trim(),
    platform: value.platform,
    url: validation.normalizedUrl,
    handle: normalizeHandle(
      value.handle
    ),
    sort_order:
      normalizeSortOrder(
        value.sort_order
      ),
  }
}

/* =========================================================
 * Sorting
 * ======================================================= */

function compareSocialLinks(
  first: NormalizedPublicCreatorSocialLink,
  second: NormalizedPublicCreatorSocialLink
): number {
  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const platformComparison =
    getPlatformSortOrder(
      first.platform
    ) -
    getPlatformSortOrder(
      second.platform
    )

  if (platformComparison !== 0) {
    return platformComparison
  }

  return first.id.localeCompare(
    second.id
  )
}

function getPlatformSortOrder(
  platform: CreatorSocialPlatform
): number {
  const order: Record<
    CreatorSocialPlatform,
    number
  > = {
    instagram: 0,
    tiktok: 1,
    youtube: 2,
    website: 3,
    linkedin: 4,
    threads: 5,
    pinterest: 6,
    x: 7,
  }

  return order[platform]
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeLimit(
  value: number | undefined
): number {
  const supportedPlatformCount =
    Object.keys(
      CREATOR_SOCIAL_PLATFORM_DEFINITIONS
    ).length

  if (value === undefined) {
    return supportedPlatformCount
  }

  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return supportedPlatformCount
  }

  return Math.min(
    supportedPlatformCount,
    Math.max(0, value)
  )
}

function normalizeSortOrder(
  value: number
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return Number.MAX_SAFE_INTEGER
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizeHandle(
  value: string | null
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')

  if (!normalized) {
    return null
  }

  return normalized.slice(0, 100)
}

function getDisplayHostname(
  value: string
): string | null {
  try {
    const hostname =
      new URL(value).hostname
        .toLowerCase()
        .replace(/^www\./, '')
        .replace(/\.$/, '')

    return hostname || null
  } catch {
    return null
  }
}

function isCreatorSocialPlatform(
  value: unknown
): value is CreatorSocialPlatform {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(
      CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
      value
    )
  )
}