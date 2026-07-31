'use client'

import Link from 'next/link'

import FollowButton from '@/components/profile/FollowButton'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type DiscoverUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio?: string | null
  home_neighborhood?: string | null
  preferred_vibes?: string[] | null
  interest_categories?: string[] | null
  followers_count?: number | null
  is_following?: boolean | null

  /**
   * Optional discovery context.
   *
   * These fields allow the discover API to add a lightweight
   * reputation signal without turning Suggested Roamers into a
   * competitive leaderboard.
   */
  reputation_label?: string | null
  reputation_category_label?: string | null
  reputation_scope_label?: string | null
  top_percent?: number | null
}

type UserResultCardProps = {
  user: DiscoverUser
  currentUserId?: string | null
}

/* =========================================================
 * Component
 * ======================================================= */

export default function UserResultCard({
  user,
  currentUserId = null,
}: UserResultCardProps) {
  const isOwnProfile =
    currentUserId ===
    user.id

  const username =
    normalizeNullableText(
      user.username
    )

  const displayName =
    normalizeNullableText(
      user.full_name
    ) ??
    username ??
    'Roam User'

  const homeNeighborhood =
    normalizeNullableText(
      user.home_neighborhood
    )

  const bio =
    normalizeNullableText(
      user.bio
    )

  const profileHref =
    username
      ? `/u/${encodeURIComponent(
          username
        )}`
      : null

  const discoverySignals =
    buildDiscoverySignals(
      user
    )

  const reputationSignal =
    buildReputationSignal(
      user
    )

  const followerCount =
    normalizeNonNegativeInteger(
      user.followers_count
    )

  return (
    <article className="group relative w-full min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 transition duration-200 hover:border-cyan-500/35 hover:bg-neutral-950/95">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent opacity-0 transition group-hover:opacity-100"
      />

      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <ProfileAvatar
            href={
              profileHref
            }
            avatarUrl={
              user.avatar_url
            }
            displayName={
              displayName
            }
          />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <ProfileIdentityLink
                  href={
                    profileHref
                  }
                  displayName={
                    displayName
                  }
                  username={
                    username
                  }
                  homeNeighborhood={
                    homeNeighborhood
                  }
                />

                {reputationSignal ? (
                  <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.07] px-2.5 py-1 text-[10px] font-semibold text-cyan-200">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"
                    />

                    <span className="truncate">
                      {
                        reputationSignal
                      }
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="hidden shrink-0 sm:block">
                <UserAction
                  user={
                    user
                  }
                  isOwnProfile={
                    isOwnProfile
                  }
                />
              </div>
            </div>

            {bio ? (
              <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-neutral-400">
                {bio}
              </p>
            ) : (
              <p className="mt-3 text-sm leading-6 text-neutral-600">
                Discover their city
                activity, interests,
                and public Roam profile.
              </p>
            )}

            {discoverySignals.length >
            0 ? (
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {discoverySignals.map(
                  (
                    signal
                  ) => (
                    <DiscoverySignal
                      key={
                        signal.key
                      }
                      label={
                        signal.label
                      }
                      tone={
                        signal.tone
                      }
                    />
                  )
                )}
              </div>
            ) : null}

            <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-neutral-800/80 pt-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                {followerCount !==
                null ? (
                  <span>
                    <strong className="font-semibold text-neutral-300">
                      {followerCount.toLocaleString(
                        'en-US'
                      )}
                    </strong>{' '}
                    {followerCount ===
                    1
                      ? 'follower'
                      : 'followers'}
                  </span>
                ) : null}

                {profileHref ? (
                  <Link
                    href={
                      profileHref
                    }
                    className="font-medium text-cyan-300 transition hover:text-cyan-100"
                  >
                    View profile
                    <span
                      aria-hidden="true"
                      className="ml-1"
                    >
                      →
                    </span>
                  </Link>
                ) : (
                  <span className="text-neutral-600">
                    Public profile not
                    available
                  </span>
                )}
              </div>

              <div className="w-full sm:hidden">
                <UserAction
                  user={
                    user
                  }
                  isOwnProfile={
                    isOwnProfile
                  }
                  mobile
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

/* =========================================================
 * Identity presentation
 * ======================================================= */

function ProfileAvatar({
  href,
  avatarUrl,
  displayName,
}: {
  href:
    string | null

  avatarUrl:
    string | null

  displayName:
    string
}) {
  const avatar =
    (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl transition group-hover:border-cyan-500/30 sm:h-16 sm:w-16">
        {avatarUrl ? (
          <img
            src={
              avatarUrl
            }
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
          >
            🧭
          </span>
        )}
      </div>
    )

  if (!href) {
    return (
      <div
        aria-label={
          displayName
        }
      >
        {avatar}
      </div>
    )
  }

  return (
    <Link
      href={
        href
      }
      aria-label={`View ${displayName}'s profile`}
      className="shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      {avatar}
    </Link>
  )
}

function ProfileIdentityLink({
  href,
  displayName,
  username,
  homeNeighborhood,
}: {
  href:
    string | null

  displayName:
    string

  username:
    string | null

  homeNeighborhood:
    string | null
}) {
  const identity =
    (
      <>
        <h3 className="truncate text-base font-semibold text-white transition group-hover:text-cyan-200">
          {displayName}
        </h3>

        {username ||
        homeNeighborhood ? (
          <p className="mt-0.5 truncate text-sm text-neutral-500">
            {username
              ? `@${username}`
              : null}

            {username &&
            homeNeighborhood
              ? ' · '
              : null}

            {homeNeighborhood}
          </p>
        ) : null}
      </>
    )

  if (!href) {
    return (
      <div className="min-w-0">
        {identity}
      </div>
    )
  }

  return (
    <Link
      href={
        href
      }
      className="block min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
    >
      {identity}
    </Link>
  )
}

/* =========================================================
 * Actions
 * ======================================================= */

function UserAction({
  user,
  isOwnProfile,
  mobile = false,
}: {
  user:
    DiscoverUser

  isOwnProfile:
    boolean

  mobile?:
    boolean
}) {
  if (isOwnProfile) {
    return (
      <Link
        href="/profile"
        className={[
          'inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white',
          mobile
            ? 'w-full'
            : '',
        ]
          .filter(
            Boolean
          )
          .join(
            ' '
          )}
      >
        Your profile
      </Link>
    )
  }

  return (
    <div
      className={
        mobile
          ? 'w-full [&>button]:w-full'
          : ''
      }
    >
      <FollowButton
        userId={
          user.id
        }
        initialIsFollowing={
          Boolean(
            user.is_following
          )
        }
        initialFollowersCount={
          normalizeNonNegativeInteger(
            user.followers_count
          ) ??
          undefined
        }
      />
    </div>
  )
}

/* =========================================================
 * Discovery signals
 * ======================================================= */

type DiscoverySignalTone =
  | 'vibe'
  | 'interest'

type DiscoverySignalValue = {
  key: string
  label: string
  tone:
    DiscoverySignalTone
}

function buildDiscoverySignals(
  user:
    DiscoverUser
): DiscoverySignalValue[] {
  const signals:
    DiscoverySignalValue[] =
    []

  const seen =
    new Set<string>()

  const preferredVibes =
    normalizeStringArray(
      user.preferred_vibes
    )

  const interests =
    normalizeStringArray(
      user.interest_categories
    )

  for (
    const vibe of
      preferredVibes
  ) {
    const key =
      `vibe:${vibe}`

    if (
      seen.has(
        key
      )
    ) {
      continue
    }

    seen.add(
      key
    )

    signals.push({
      key,

      label:
        formatSignalLabel(
          vibe
        ),

      tone:
        'vibe',
    })

    if (
      signals.length >=
      2
    ) {
      break
    }
  }

  for (
    const interest of
      interests
  ) {
    const key =
      `interest:${interest}`

    if (
      seen.has(
        key
      )
    ) {
      continue
    }

    seen.add(
      key
    )

    signals.push({
      key,

      label:
        formatSignalLabel(
          interest
        ),

      tone:
        'interest',
    })

    if (
      signals.length >=
      4
    ) {
      break
    }
  }

  return signals
}

function DiscoverySignal({
  label,
  tone,
}: {
  label:
    string

  tone:
    DiscoverySignalTone
}) {
  const styles =
    tone ===
    'vibe'
      ? 'border-indigo-500/20 bg-indigo-500/[0.07] text-indigo-200'
      : 'border-neutral-800 bg-black/30 text-neutral-400'

  return (
    <span
      className={[
        'inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-medium',
        styles,
      ].join(
        ' '
      )}
    >
      <span className="truncate">
        {label}
      </span>
    </span>
  )
}

/* =========================================================
 * Reputation context
 * ======================================================= */

function buildReputationSignal(
  user:
    DiscoverUser
): string | null {
  const explicitLabel =
    normalizeNullableText(
      user.reputation_label
    )

  if (
    explicitLabel
  ) {
    return explicitLabel
  }

  const categoryLabel =
    normalizeNullableText(
      user
        .reputation_category_label
    )

  const scopeLabel =
    normalizeNullableText(
      user
        .reputation_scope_label
    )

  const topPercent =
    normalizePercentage(
      user.top_percent
    )

  if (
    topPercent !==
      null &&
    categoryLabel
  ) {
    return [
      `Top ${formatPercent(
        topPercent
      )}%`,
      scopeLabel,
      categoryLabel,
    ]
      .filter(
        Boolean
      )
      .join(
        ' · '
      )
  }

  if (
    categoryLabel
  ) {
    return [
      scopeLabel,
      categoryLabel,
    ]
      .filter(
        Boolean
      )
      .join(
        ' · '
      )
  }

  return null
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeNullableText(
  value:
    unknown
): string | null {
  if (
    typeof value !==
      'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeStringArray(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const normalized:
    string[] =
    []

  const seen =
    new Set<string>()

  for (
    const item of
      value
  ) {
    const text =
      normalizeNullableText(
        item
      )

    if (
      !text
    ) {
      continue
    }

    const key =
      text.toLocaleLowerCase(
        'en-US'
      )

    if (
      seen.has(
        key
      )
    ) {
      continue
    }

    seen.add(
      key
    )

    normalized.push(
      text
    )
  }

  return normalized
}

function normalizeNonNegativeInteger(
  value:
    unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <
      0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePercentage(
  value:
    unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <
      0
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function normalizeFiniteNumber(
  value:
    unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim()
      .length >
      0
  ) {
    const parsed =
      Number(
        value
      )

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function formatSignalLabel(
  value:
    string
): string {
  return value
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
    )
}

function formatPercent(
  value:
    number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        value <
        1
          ? 1
          : 0,
    }
  )
}