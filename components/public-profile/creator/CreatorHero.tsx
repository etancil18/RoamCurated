import Image from 'next/image'
import {
  BriefcaseBusiness,
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Plane,
  Youtube,
} from 'lucide-react'

import {
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  getCreatorSocialDisplayLabel,
} from '@/lib/creator/constants'

import type {
  CreatorSocialPlatform,
  PublicCreatorSocialLink,
} from '@/lib/creator/types'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorHeroProps = {
  /**
   * Creator's public-facing display name.
   *
   * Falls back to `@username` when empty.
   */
  displayName?: string | null

  /**
   * Public profile username without the leading `@`.
   */
  username: string

  /**
   * Optional public avatar URL.
   */
  avatarUrl?: string | null

  /**
   * Short creator positioning statement.
   */
  headline?: string | null

  /**
   * Longer public creator introduction.
   */
  bio?: string | null

  /**
   * Creator's primary public city.
   */
  primaryCity?: string | null

  /**
   * Signals that the creator is open to collaboration requests.
   */
  acceptingCollaborations?: boolean

  /**
   * Signals that the creator may travel for opportunities.
   */
  availableForTravel?: boolean

  /**
   * Optional public contact email.
   */
  publicEmail?: string | null

  /**
   * Already-filtered public social links.
   *
   * Private links must never be passed into this component.
   */
  socialLinks?: readonly PublicCreatorSocialLink[]

  /**
   * Public number of users following this creator.
   */
  followersCount?: number

  /**
   * Public number of users this creator follows.
   */
  followingCount?: number

  /**
   * Public Roam Passport level.
   *
   * Pass `null` when the creator has disabled public XP and
   * Passport-level visibility.
   */
  passportLevel?: number | null

  /**
   * Maximum number of social links rendered in the hero.
   *
   * Remaining links can be rendered in a dedicated social-links
   * section farther down the profile.
   */
  socialLinkLimit?: number

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorHero({
  displayName,
  username,
  avatarUrl,
  headline,
  bio,
  primaryCity,
  acceptingCollaborations = false,
  availableForTravel = false,
  publicEmail,
  socialLinks = [],
  followersCount = 0,
  followingCount = 0,
  passportLevel = null,
  socialLinkLimit = 4,
  className = '',
}: CreatorHeroProps) {
  const normalizedUsername =
    normalizeUsername(username)

  const normalizedDisplayName =
    normalizeNullableText(displayName) ??
    (normalizedUsername
      ? `@${normalizedUsername}`
      : 'Roam Creator')

  const normalizedHeadline =
    normalizeNullableText(headline)

  const normalizedBio =
    normalizeNullableText(bio)

  const normalizedPrimaryCity =
    normalizeNullableText(primaryCity)

  const normalizedEmail =
    normalizePublicEmail(publicEmail)

  const normalizedAvatarUrl =
    normalizePublicImageUrl(avatarUrl)

  const normalizedFollowersCount =
    normalizePublicCount(
      followersCount
    )

  const normalizedFollowingCount =
    normalizePublicCount(
      followingCount
    )

  const normalizedPassportLevel =
    passportLevel === null
      ? null
      : normalizePublicCount(
          passportLevel
        )

  const visibleSocialLinks =
    normalizeSocialLinks({
      links: socialLinks,
      limit: socialLinkLimit,
    })

  const initials =
    getCreatorInitials(
      normalizedDisplayName
    )

  return (
    <section
      aria-labelledby="creator-hero-title"
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[2rem] border border-neutral-800/90 bg-neutral-950/85 text-white shadow-2xl shadow-black/30',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CreatorHeroBackground />

      <div className="relative z-10 w-full min-w-0 p-5 sm:p-7 lg:p-8">
        <div className="flex min-w-0 flex-col gap-6 md:flex-row md:items-start">
          <CreatorAvatar
            displayName={
              normalizedDisplayName
            }
            avatarUrl={
              normalizedAvatarUrl
            }
            initials={initials}
          />

          <div className="min-w-0 flex-1">
            <CreatorIdentity
              displayName={
                normalizedDisplayName
              }
              username={
                normalizedUsername
              }
              headline={
                normalizedHeadline
              }
              bio={normalizedBio}
              primaryCity={
                normalizedPrimaryCity
              }
            />

            <CreatorProfileMetrics
              followersCount={
                normalizedFollowersCount
              }
              followingCount={
                normalizedFollowingCount
              }
              passportLevel={
                normalizedPassportLevel
              }
            />

            <CreatorAvailability
              acceptingCollaborations={
                acceptingCollaborations
              }
              availableForTravel={
                availableForTravel
              }
            />

            <CreatorHeroActions
              publicEmail={
                normalizedEmail
              }
              socialLinks={
                visibleSocialLinks
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Background
 * ======================================================= */

function CreatorHeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-indigo-500/[0.08]" />

      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="absolute -bottom-32 right-[-5rem] h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
    </div>
  )
}

/* =========================================================
 * Avatar
 * ======================================================= */

function CreatorAvatar({
  displayName,
  avatarUrl,
  initials,
}: {
  displayName: string
  avatarUrl: string | null
  initials: string
}) {
  return (
    <div className="shrink-0">
      <div className="relative h-24 w-24 overflow-hidden rounded-[1.75rem] border border-white/10 bg-neutral-900 shadow-xl shadow-black/40 sm:h-28 sm:w-28">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={`${displayName} profile photo`}
            fill
            sizes="(min-width: 640px) 112px, 96px"
            unoptimized
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-400/20 to-indigo-500/20">
            <span
              aria-label={`${displayName} initials`}
              className="text-2xl font-semibold tracking-tight text-white"
            >
              {initials}
            </span>
          </div>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/10"
        />
      </div>
    </div>
  )
}

/* =========================================================
 * Identity
 * ======================================================= */

function CreatorIdentity({
  displayName,
  username,
  headline,
  bio,
  primaryCity,
}: {
  displayName: string
  username: string | null
  headline: string | null
  bio: string | null
  primaryCity: string | null
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            Roam Creator
          </p>

          <h1
            id="creator-hero-title"
            className="mt-2 break-words text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            {displayName}
          </h1>

          {username ? (
            <p className="mt-1 break-all text-sm font-medium text-neutral-500">
              @{username}
            </p>
          ) : null}
        </div>

        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-cyan-300"
          />

          Creator Mode
        </span>
      </div>

      {headline ? (
        <p className="mt-5 max-w-3xl break-words text-lg font-medium leading-7 text-neutral-100 sm:text-xl">
          {headline}
        </p>
      ) : null}

      {bio ? (
        <p className="mt-3 max-w-3xl whitespace-pre-line break-words text-sm leading-6 text-neutral-400 sm:text-base sm:leading-7">
          {bio}
        </p>
      ) : null}

      {primaryCity ? (
        <div className="mt-4 flex min-w-0 items-center gap-2 text-sm text-neutral-400">
          <MapPin
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-cyan-400"
          />

          <span className="break-words">
            Based in {primaryCity}
          </span>
        </div>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Public profile metrics
 * ======================================================= */

function CreatorProfileMetrics({
  followersCount,
  followingCount,
  passportLevel,
}: {
  followersCount: number
  followingCount: number
  passportLevel: number | null
}) {
  return (
    <dl
      aria-label="Creator profile statistics"
      className="mt-5 flex min-w-0 flex-wrap gap-2"
    >
      <CreatorProfileMetric
        label="Followers"
        value={followersCount}
      />

      <CreatorProfileMetric
        label="Following"
        value={followingCount}
      />

      {passportLevel !== null ? (
        <CreatorProfileMetric
          label="Passport Level"
          value={passportLevel}
          emphasized
        />
      ) : null}
    </dl>
  )
}

function CreatorProfileMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string
  value: number
  emphasized?: boolean
}) {
  return (
    <div
      className={[
        'inline-flex min-w-[104px] flex-col rounded-2xl border px-4 py-3',
        emphasized
          ? 'border-cyan-500/25 bg-cyan-500/[0.08]'
          : 'border-neutral-800 bg-black/30',
      ].join(' ')}
    >
      <dd
        className={[
          'text-lg font-semibold leading-none',
          emphasized
            ? 'text-cyan-100'
            : 'text-white',
        ].join(' ')}
      >
        {value.toLocaleString()}
      </dd>

      <dt
        className={[
          'mt-1.5 text-[11px] leading-tight',
          emphasized
            ? 'text-cyan-300/70'
            : 'text-neutral-500',
        ].join(' ')}
      >
        {label}
      </dt>
    </div>
  )
}

/* =========================================================
 * Availability
 * ======================================================= */

function CreatorAvailability({
  acceptingCollaborations,
  availableForTravel,
}: {
  acceptingCollaborations: boolean
  availableForTravel: boolean
}) {
  if (
    !acceptingCollaborations &&
    !availableForTravel
  ) {
    return null
  }

  return (
    <div
      aria-label="Creator availability"
      className="mt-5 flex flex-wrap gap-2"
    >
      {acceptingCollaborations ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
          <BriefcaseBusiness
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          Accepting collaborations
        </span>
      ) : null}

      {availableForTravel ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200">
          <Plane
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          Available for travel
        </span>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Actions and social links
 * ======================================================= */

function CreatorHeroActions({
  publicEmail,
  socialLinks,
}: {
  publicEmail: string | null
  socialLinks: PublicCreatorSocialLink[]
}) {
  if (
    !publicEmail &&
    socialLinks.length === 0
  ) {
    return null
  }

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-3 border-t border-neutral-800/80 pt-5 sm:flex-row sm:flex-wrap sm:items-center">
      {publicEmail ? (
        <a
          href={`mailto:${publicEmail}`}
          className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        >
          <Mail
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          />

          <span className="truncate">
            Contact creator
          </span>
        </a>
      ) : null}

      {socialLinks.length > 0 ? (
        <nav
          aria-label="Creator social links"
          className="flex min-w-0 flex-wrap gap-2"
        >
          {socialLinks.map((link) => (
            <CreatorSocialLinkButton
              key={link.id}
              link={link}
            />
          ))}
        </nav>
      ) : null}
    </div>
  )
}

function CreatorSocialLinkButton({
  link,
}: {
  link: PublicCreatorSocialLink
}) {
  const definition =
    CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
      link.platform
    ]

  const displayLabel =
    getCreatorSocialDisplayLabel(link)

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      aria-label={`Open ${definition.label}${
        displayLabel
          ? ` profile for ${displayLabel}`
          : ''
      }`}
      title={
        displayLabel
          ? `${definition.label}: ${displayLabel}`
          : definition.label
      }
      className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-neutral-800 bg-black/35 px-3 py-2 text-xs font-semibold text-neutral-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.08] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
    >
      <CreatorSocialIcon
        platform={link.platform}
      />

      <span className="max-w-[10rem] truncate">
        {displayLabel ??
          definition.label}
      </span>

      <ExternalLink
        aria-hidden="true"
        className="h-3 w-3 shrink-0 text-neutral-600"
      />
    </a>
  )
}

/* =========================================================
 * Social icons
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
          aria-hidden="true"
          className={className}
        />
      )

    case 'youtube':
      return (
        <Youtube
          aria-hidden="true"
          className={className}
        />
      )

    case 'linkedin':
      return (
        <Linkedin
          aria-hidden="true"
          className={className}
        />
      )

    case 'website':
      return (
        <Globe2
          aria-hidden="true"
          className={className}
        />
      )

    case 'tiktok':
      return (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-black"
        >
          TT
        </span>
      )

    case 'threads':
      return (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-sm font-bold"
        >
          @
        </span>
      )

    case 'pinterest':
      return (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-sm font-bold"
        >
          P
        </span>
      )

    case 'x':
      return (
        <span
          aria-hidden="true"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-sm font-semibold"
        >
          X
        </span>
      )
  }
}

/* =========================================================
 * Normalization
 * ======================================================= */

function normalizeSocialLinks({
  links,
  limit,
}: {
  links: readonly PublicCreatorSocialLink[]
  limit: number
}): PublicCreatorSocialLink[] {
  const normalizedLimit =
    normalizeSocialLinkLimit(limit)

  const byId = new Map<
    string,
    PublicCreatorSocialLink
  >()

  for (const link of links) {
    if (
      !link ||
      typeof link.id !== 'string' ||
      !link.id.trim() ||
      typeof link.url !== 'string' ||
      !link.url.trim()
    ) {
      continue
    }

    byId.set(link.id, link)
  }

  return [...byId.values()]
    .sort(compareSocialLinks)
    .slice(0, normalizedLimit)
}

function compareSocialLinks(
  first: PublicCreatorSocialLink,
  second: PublicCreatorSocialLink
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

  return first.id.localeCompare(
    second.id
  )
}

function normalizeSocialLinkLimit(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return 4
  }

  return Math.min(
    8,
    Math.max(0, value)
  )
}

function normalizePublicCount(
  value: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizeUsername(
  value: string
): string | null {
  const normalized = value
    .trim()
    .replace(/^@+/, '')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeNullableText(
  value:
    | string
    | null
    | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/[ \t]+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizePublicEmail(
  value:
    | string
    | null
    | undefined
): string | null {
  const normalized =
    normalizeNullableText(value)

  if (
    !normalized ||
    normalized.includes('\n') ||
    normalized.includes('\r') ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized.toLowerCase()
}

function normalizePublicImageUrl(
  value:
    | string
    | null
    | undefined
): string | null {
  const normalized =
    normalizeNullableText(value)

  if (!normalized) {
    return null
  }

  try {
    const parsed = new URL(normalized)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    if (
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function getCreatorInitials(
  displayName: string
): string {
  const cleaned = displayName
    .replace(/^@+/, '')
    .trim()

  if (!cleaned) {
    return 'RC'
  }

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 1) {
    return words[0]
      ?.slice(0, 2)
      .toUpperCase() ?? 'RC'
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}