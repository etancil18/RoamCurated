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

export type CreatorCompetitionWinStat = {
  /**
   * Stable competition identifier.
   */
  competitionId: string

  /**
   * Public competition label shown in the hero.
   *
   * Example:
   *   Taste Duel
   */
  competitionLabel: string

  /**
   * Number of settled wins for this creator in this competition.
   *
   * Values <= 0 are intentionally not rendered.
   */
  wins: number
}

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
   * Settled competition win aggregates for this creator.
   *
   * Only competition-specific stats with at least one win are
   * rendered in the hero.
   *
   * Do not pass losses, participation counts, scores, or reputation
   * data here.
   */
  competitionWins?: readonly CreatorCompetitionWinStat[]

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
  competitionWins = [],
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

  const normalizedCompetitionWins =
    normalizeCompetitionWins(
      competitionWins
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
        'relative w-full min-w-0 overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-white/[0.065] via-white/[0.03] to-transparent text-white shadow-[0_30px_100px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.075]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CreatorHeroBackground />

      <div className="relative z-10 w-full min-w-0 p-5 sm:p-7 lg:p-8">
        <div className="flex min-w-0 items-start gap-4 sm:gap-6">
          <CreatorAvatar
            displayName={
              normalizedDisplayName
            }
            avatarUrl={
              normalizedAvatarUrl
            }
            initials={initials}
          />

          <CreatorIdentity
            displayName={
              normalizedDisplayName
            }
            username={
              normalizedUsername
            }
          />
        </div>

        <CreatorStory
          headline={
            normalizedHeadline
          }
          bio={
            normalizedBio
          }
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
          competitionWins={
            normalizedCompetitionWins
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(103,232,249,0.08),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.09),_transparent_34%)]" />

      <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.07] blur-[100px]" />

      <div className="absolute -bottom-32 right-[-5rem] h-80 w-80 rounded-full bg-indigo-500/[0.08] blur-[110px]" />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/[0.08] to-transparent" />
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
      <div className="relative">
        <div className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-cyan-300/[0.09] to-indigo-400/[0.08] blur-xl" />

        <div className="relative h-24 w-24 overflow-hidden rounded-[1.75rem] bg-white/[0.05] shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-white/[0.09] sm:h-28 sm:w-28">
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
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-300/[0.12] via-white/[0.03] to-indigo-400/[0.12]">
              <span
                aria-label={`${displayName} initials`}
                className="text-2xl font-black tracking-[-0.04em] text-white"
              >
                {initials}
              </span>
            </div>
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-inset ring-white/[0.08]"
          />
        </div>
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
}: {
  displayName: string
  username: string | null
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/[0.045] px-3 py-1.5 ring-1 ring-white/[0.07]">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]" />

        <p className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
          Roam Creator
        </p>
      </div>

      <h1
        id="creator-hero-title"
        className="mt-3 break-words text-[2rem] font-black leading-[0.98] tracking-[-0.045em] text-white sm:mt-4 sm:text-5xl"
      >
        {displayName}
      </h1>

      {username ? (
        <p className="mt-2 break-all text-sm font-semibold text-zinc-500">
          @{username}
        </p>
      ) : null}

      <span className="mt-4 inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-white/[0.045] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 ring-1 ring-white/[0.07]">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300"
        />

        Creator Mode
      </span>
    </div>
  )
}

/* =========================================================
 * Creator story
 * ======================================================= */

function CreatorStory({
  headline,
  bio,
  primaryCity,
}: {
  headline: string | null
  bio: string | null
  primaryCity: string | null
}) {
  if (
    !headline &&
    !bio &&
    !primaryCity
  ) {
    return null
  }

  return (
    <div className="mt-6 min-w-0">
      {headline ? (
        <p className="max-w-3xl break-words text-lg font-black leading-7 tracking-[-0.02em] text-white sm:text-[1.35rem] sm:leading-8">
          {headline}
        </p>
      ) : null}

      {bio ? (
        <p
          className={[
            'max-w-3xl whitespace-pre-line break-words text-sm leading-6 text-zinc-400 sm:text-[15px] sm:leading-7',
            headline
              ? 'mt-3'
              : '',
          ].join(' ')}
        >
          {bio}
        </p>
      ) : null}

      {primaryCity ? (
        <div
          className={[
            'flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-500',
            headline || bio
              ? 'mt-4'
              : '',
          ].join(' ')}
        >
          <MapPin
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-cyan-300"
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
  competitionWins,
}: {
  followersCount: number
  followingCount: number
  passportLevel: number | null
  competitionWins: CreatorCompetitionWinStat[]
}) {
  return (
    <dl
      aria-label="Creator profile statistics"
      className="mt-6 grid min-w-0 grid-cols-2 gap-2.5 sm:flex sm:flex-wrap"
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
          label="Passport level"
          value={passportLevel}
          emphasized
        />
      ) : null}

      {competitionWins.map(
        (
          competition
        ) => (
          <CreatorProfileMetric
            key={
              competition.competitionId
            }
            label={`${competition.competitionLabel} wins`}
            value={
              competition.wins
            }
            emphasized
          />
        )
      )}
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
        'flex min-h-[88px] min-w-0 flex-col justify-between rounded-[1.35rem] px-4 py-3.5 ring-1 sm:min-w-[112px]',
        emphasized
          ? 'bg-cyan-300/[0.075] ring-cyan-300/15'
          : 'bg-black/25 ring-white/[0.055]',
      ].join(' ')}
    >
      <dd
        className={[
          'text-2xl font-black leading-none tracking-[-0.04em]',
          emphasized
            ? 'text-cyan-100'
            : 'text-white',
        ].join(' ')}
      >
        {value.toLocaleString()}
      </dd>

      <dt
        className={[
          'mt-3 text-[10px] font-bold uppercase leading-tight tracking-[0.11em]',
          emphasized
            ? 'text-cyan-300/70'
            : 'text-zinc-600',
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
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/[0.08] px-3 py-2 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/15">
          <BriefcaseBusiness
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          Open to collaborations
        </span>
      ) : null}

      {availableForTravel ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-400/[0.08] px-3 py-2 text-xs font-bold text-indigo-200 ring-1 ring-indigo-300/15">
          <Plane
            aria-hidden="true"
            className="h-3.5 w-3.5"
          />

          Available to travel
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
    <div className="mt-7 flex min-w-0 flex-col gap-3 border-t border-white/[0.055] pt-5 sm:flex-row sm:flex-wrap sm:items-center">
      {publicEmail ? (
        <a
          href={`mailto:${publicEmail}`}
          className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-black transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0b0d]"
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
      className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-full bg-white/[0.035] px-3 py-2 text-xs font-bold text-zinc-400 ring-1 ring-white/[0.06] transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
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
        className="h-3 w-3 shrink-0 text-zinc-700 transition group-hover:text-zinc-400"
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

function normalizeCompetitionWins(
  wins: readonly CreatorCompetitionWinStat[]
): CreatorCompetitionWinStat[] {
  const byCompetitionId =
    new Map<
      string,
      CreatorCompetitionWinStat
    >()

  for (const stat of wins) {
    if (!stat) {
      continue
    }

    const competitionId =
      normalizeNullableText(
        stat.competitionId
      )

    const competitionLabel =
      normalizeNullableText(
        stat.competitionLabel
      )

    const winCount =
      normalizePublicCount(
        stat.wins
      )

    /**
     * Public creator hero rule:
     *
     * Competition statistics are visible only when this creator has
     * at least one settled win for that specific competition.
     */
    if (
      !competitionId ||
      !competitionLabel ||
      winCount < 1
    ) {
      continue
    }

    byCompetitionId.set(
      competitionId,
      {
        competitionId,
        competitionLabel,
        wins: winCount,
      }
    )
  }

  return [
    ...byCompetitionId.values(),
  ].sort(
    (
      first,
      second
    ) => {
      if (
        second.wins !==
        first.wins
      ) {
        return (
          second.wins -
          first.wins
        )
      }

      const labelOrder =
        first.competitionLabel.localeCompare(
          second.competitionLabel
        )

      if (
        labelOrder !==
        0
      ) {
        return labelOrder
      }

      return first.competitionId.localeCompare(
        second.competitionId
      )
    }
  )
}

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