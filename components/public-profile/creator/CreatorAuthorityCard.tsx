import {
  BadgeCheck,
  Building2,
  Compass,
  FolderHeart,
  Footprints,
  Layers3,
  MapPin,
  Route,
} from 'lucide-react'

import CreatorReputationIdentity from '@/components/reputation/CreatorReputationIdentity'

import {
  buildCreatorAuthoritySummary,
  getCreatorAuthorityMetrics,
  hasCreatorAuthority,
} from '@/lib/creator/buildCreatorAuthority'

import type {
  CreatorAuthorityStats,
  ExtendedCreatorAuthorityStats,
} from '@/lib/creator/types'

import type {
  PublicCreatorReputationSnapshot,
} from '@/lib/reputation/publicTypes'

/* =========================================================
 * Public component contract
 * ======================================================= */

export type CreatorAuthorityCardProps = {
  /**
   * Canonical authority data assembled from verified Roam
   * activity.
   *
   * Pass `null` when authority data was not loaded.
   */
  authority:
    | CreatorAuthorityStats
    | ExtendedCreatorAuthorityStats
    | null
    | undefined

  /**
   * Public creator reputation interpretation.
   *
   * Reputation presents the creator's earned status first.
   * Authority remains the underlying evidence supporting it.
   */
  reputation?:
    | PublicCreatorReputationSnapshot
    | null
    | undefined

  /**
   * Optional section title.
   */
  title?: string

  /**
   * Optional supporting description.
   */
  description?: string

  /**
   * Controls whether the section heading is rendered.
   *
   * Disable this when the component is nested inside an
   * existing public-profile panel that already supplies a
   * heading.
   */
  showHeading?: boolean

  /**
   * Controls whether zero-value metrics remain visible.
   *
   * Defaults to false so public profiles do not display empty
   * activity claims.
   */
  includeZeroValues?: boolean

  /**
   * Maximum number of base activity metrics rendered.
   */
  metricLimit?: number

  /**
   * Renders the concise generated authority summary.
   */
  showSummary?: boolean

  /**
   * Renders optional extended geographic and category data when
   * it is present and defensible.
   */
  showExtendedDetails?: boolean

  /**
   * Optional wrapper classes.
   */
  className?: string
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function CreatorAuthorityCard({
  authority,
  reputation,
  title = 'Roam activity',
  description =
    'Verified activity and public contributions recorded through this creator’s use of Roam.',
  showHeading = true,
  includeZeroValues = false,
  metricLimit = 4,
  showSummary = true,
  showExtendedDetails = true,
  className = '',
}: CreatorAuthorityCardProps) {
  const hasReputation =
    reputation !== null &&
    reputation !== undefined

  const hasAuthority =
    authority !== null &&
    authority !== undefined &&
    hasCreatorAuthority(authority)

  if (!hasReputation && !hasAuthority) {
    return null
  }

  const normalizedMetricLimit =
    normalizeMetricLimit(metricLimit)

  const metrics = hasAuthority
    ? getCreatorAuthorityMetrics({
        stats: authority,
        includeZeroValues,
      }).slice(
        0,
        normalizedMetricLimit
      )
    : []

  const summary =
    hasAuthority &&
    showSummary
      ? buildCreatorAuthoritySummary(
          authority
        )
      : null

  const extendedDetails =
    hasAuthority &&
    showExtendedDetails
      ? normalizeExtendedAuthority(
          authority
        )
      : null

  const hasPrimaryCity =
    hasAuthority &&
    normalizeNullableText(
      authority.primaryCity
    ) !== null

  const hasMetricContent =
    metrics.length > 0

  const hasExtendedContent =
    extendedDetails !== null &&
    (
      extendedDetails.cityCount !== null ||
      extendedDetails.neighborhoodCount !== null ||
      extendedDetails.topCategories.length > 0
    )

  if (
    !hasReputation &&
    !hasPrimaryCity &&
    !hasMetricContent &&
    !hasExtendedContent
  ) {
    return null
  }

  const headingId =
    'creator-authority-card-title'

  return (
    <section
      aria-labelledby={
        showHeading
          ? headingId
          : undefined
      }
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-cyan-300/[0.025] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.07] sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AuthorityCardBackground />

      <div className="relative z-10 min-w-0">
        {hasReputation ? (
          <div className="mb-6 min-w-0">
            <CreatorReputationIdentity
              reputation={
                reputation
              }
              categoryLimit={3}
            />
          </div>
        ) : null}

        {hasAuthority ? (
          <>
            {showHeading ? (
              <AuthorityHeading
                id={headingId}
                title={title}
                description={
                  description
                }
                summary={summary}
              />
            ) : summary ? (
              <p className="break-words text-sm leading-6 text-zinc-500">
                {summary}
              </p>
            ) : null}

            {hasPrimaryCity ? (
              <PrimaryCityCard
                primaryCity={
                  authority.primaryCity
                }
                className={
                  showHeading ||
                  summary
                    ? 'mt-6'
                    : ''
                }
              />
            ) : null}

            {hasMetricContent ? (
              <AuthorityMetricsGrid
                metrics={metrics}
                className={
                  hasPrimaryCity ||
                  showHeading ||
                  summary
                    ? 'mt-5'
                    : ''
                }
              />
            ) : null}

            {hasExtendedContent &&
            extendedDetails ? (
              <ExtendedAuthorityDetails
                details={
                  extendedDetails
                }
                className={
                  hasPrimaryCity ||
                  hasMetricContent ||
                  showHeading ||
                  summary
                    ? 'mt-6'
                    : ''
                }
              />
            ) : null}

            <AuthorityDisclosure />
          </>
        ) : null}
      </div>
    </section>
  )
}

/* =========================================================
 * Decorative background
 * ======================================================= */

function AuthorityCardBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(103,232,249,0.06),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.05),_transparent_36%)]" />

      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.06] blur-[100px]" />

      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
    </div>
  )
}

/* =========================================================
 * Heading
 * ======================================================= */

function AuthorityHeading({
  id,
  title,
  description,
  summary,
}: {
  id: string
  title: string
  description: string
  summary: string | null
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.08] text-cyan-200 ring-1 ring-cyan-300/15">
            <BadgeCheck
              aria-hidden="true"
              className="h-4 w-4"
            />
          </span>

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Earned local knowledge
          </p>
        </div>

        <h2
          id={id}
          className="mt-3 break-words text-2xl font-black tracking-[-0.035em] text-white"
        >
          {title}
        </h2>

        {description ? (
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-zinc-500">
            {description}
          </p>
        ) : null}

        {summary ? (
          <p className="mt-3 max-w-2xl break-words text-sm font-medium leading-6 text-zinc-300">
            {summary}
          </p>
        ) : null}
      </div>

      <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 ring-1 ring-white/[0.06]">
        <Compass
          aria-hidden="true"
          className="h-3.5 w-3.5 text-cyan-300"
        />

        Roam verified
      </span>
    </div>
  )
}

/* =========================================================
 * Primary city
 * ======================================================= */

function PrimaryCityCard({
  primaryCity,
  className = '',
}: {
  primaryCity: string | null
  className?: string
}) {
  const normalizedCity =
    normalizeNullableText(primaryCity)

  if (!normalizedCity) {
    return null
  }

  return (
    <div
      className={[
        'flex min-w-0 items-start gap-3 rounded-[1.5rem] bg-cyan-300/[0.055] p-4 ring-1 ring-cyan-300/12',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.08] text-cyan-200 ring-1 ring-cyan-300/15">
        <MapPin
          aria-hidden="true"
          className="h-5 w-5"
        />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
          Home base
        </p>

        <p className="mt-1 break-words text-lg font-black tracking-tight text-white">
          {normalizedCity}
        </p>

        <p className="mt-1 text-xs leading-5 text-zinc-600">
          The city most closely associated with this creator’s public Roam activity.
        </p>
      </div>
    </div>
  )
}

/* =========================================================
 * Base metrics
 * ======================================================= */

type AuthorityMetric = ReturnType<
  typeof getCreatorAuthorityMetrics
>[number]

function AuthorityMetricsGrid({
  metrics,
  className = '',
}: {
  metrics: AuthorityMetric[]
  className?: string
}) {
  return (
    <dl
      aria-label="Creator Roam activity metrics"
      className={[
        'grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {metrics.map((metric) => (
        <AuthorityMetricCard
          key={metric.key}
          metric={metric}
        />
      ))}
    </dl>
  )
}

function AuthorityMetricCard({
  metric,
}: {
  metric: AuthorityMetric
}) {
  return (
    <div className="min-w-0 rounded-[1.5rem] bg-black/25 p-4 ring-1 ring-white/[0.055]">
      <div className="flex items-start justify-between gap-2">
        <AuthorityMetricIcon
          metricKey={metric.key}
        />

        <span
          aria-hidden="true"
          className={[
            'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
            metric.value > 0
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]'
              : 'bg-zinc-700',
          ].join(' ')}
        />
      </div>

      <dd className="mt-5 break-words text-[2rem] font-black leading-none tracking-[-0.045em] text-white">
        {formatCount(metric.value)}
      </dd>

      <dt className="mt-2 break-words text-xs font-black uppercase leading-5 tracking-[0.08em] text-zinc-400">
        {metric.shortLabel}
      </dt>

      <p className="mt-2 text-[11px] leading-5 text-zinc-600">
        {metric.description}
      </p>
    </div>
  )
}

function AuthorityMetricIcon({
  metricKey,
}: {
  metricKey: AuthorityMetric['key']
}) {
  const wrapperClassName =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.06]'

  switch (metricKey) {
    case 'verifiedVisitCount':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <Footprints className="h-4 w-4" />
        </span>
      )

    case 'completedFlowCount':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <Route className="h-4 w-4" />
        </span>
      )

    case 'publicSnapshotCount':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <Layers3 className="h-4 w-4" />
        </span>
      )

    case 'publicCollectionCount':
      return (
        <span
          aria-hidden="true"
          className={wrapperClassName}
        >
          <FolderHeart className="h-4 w-4" />
        </span>
      )
  }
}

/* =========================================================
 * Extended authority
 * ======================================================= */

type NormalizedExtendedAuthority = {
  cityCount: number | null
  neighborhoodCount: number | null
  topCategories: string[]
}

function ExtendedAuthorityDetails({
  details,
  className = '',
}: {
  details: NormalizedExtendedAuthority
  className?: string
}) {
  const hasGeography =
    details.cityCount !== null ||
    details.neighborhoodCount !== null

  const hasCategories =
    details.topCategories.length > 0

  if (!hasGeography && !hasCategories) {
    return null
  }

  return (
    <div
      className={[
        'min-w-0 border-t border-white/[0.055] pt-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
        Wider footprint
      </p>

      {hasGeography ? (
        <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
          {details.cityCount !== null ? (
            <ExtendedMetric
              icon={
                <MapPin className="h-4 w-4" />
              }
              label="Cities explored"
              value={details.cityCount}
              description="Distinct cities supported by recorded Roam activity."
            />
          ) : null}

          {details.neighborhoodCount !== null ? (
            <ExtendedMetric
              icon={
                <Building2 className="h-4 w-4" />
              }
              label="Neighborhoods explored"
              value={
                details.neighborhoodCount
              }
              description="Distinct neighborhoods supported by recorded Roam activity."
            />
          ) : null}
        </dl>
      ) : null}

      {hasCategories ? (
        <div
          className={
            hasGeography
              ? 'mt-5'
              : 'mt-3'
          }
        >
          <p className="text-xs font-bold text-zinc-400">
            Categories they keep showing up in
          </p>

          <ul
            aria-label="Most represented activity categories"
            className="mt-2.5 flex min-w-0 flex-wrap gap-2"
          >
            {details.topCategories.map(
              (category) => (
                <li
                  key={category.toLocaleLowerCase()}
                  className="max-w-full"
                >
                  <span className="inline-flex max-w-full rounded-full bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-zinc-400 ring-1 ring-white/[0.06]">
                    <span className="break-words">
                      {category}
                    </span>
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ExtendedMetric({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: number
  description: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-[1.5rem] bg-black/20 p-4 ring-1 ring-white/[0.05]">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.06]"
      >
        {icon}
      </span>

      <div className="min-w-0">
        <dt className="text-xs font-bold text-zinc-400">
          {label}
        </dt>

        <dd className="mt-1 text-xl font-black tracking-tight text-white">
          {formatCount(value)}
        </dd>

        <p className="mt-1 text-[11px] leading-5 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  )
}

/* =========================================================
 * Disclosure
 * ======================================================= */

function AuthorityDisclosure() {
  return (
    <div className="mt-6 flex min-w-0 items-start gap-2 border-t border-white/[0.05] pt-4">
      <BadgeCheck
        aria-hidden="true"
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-700"
      />

      <p className="text-[11px] leading-5 text-zinc-600">
        These figures come from recorded Roam activity. Reputation turns that evidence into public standing; the underlying activity remains visible on its own.
      </p>
    </div>
  )
}

/* =========================================================
 * Extended-data normalization
 * ======================================================= */

function normalizeExtendedAuthority(
  authority:
    | CreatorAuthorityStats
    | ExtendedCreatorAuthorityStats
): NormalizedExtendedAuthority | null {
  const record =
    authority as Partial<
      ExtendedCreatorAuthorityStats
    >

  const cityCount =
    normalizeOptionalCount(
      record.cityCount
    )

  const neighborhoodCount =
    normalizeOptionalCount(
      record.neighborhoodCount
    )

  const topCategories =
    normalizeTopCategories(
      record.topCategories
    )

  if (
    cityCount === null &&
    neighborhoodCount === null &&
    topCategories.length === 0
  ) {
    return null
  }

  return {
    cityCount,
    neighborhoodCount,
    topCategories,
  }
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeMetricLimit(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return 4
  }

  return Math.min(
    4,
    Math.max(0, value)
  )
}

function normalizeOptionalCount(
  value: unknown
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizeTopCategories(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const category = item
      .trim()
      .replace(/\s+/g, ' ')

    if (
      !category ||
      category.length > 80
    ) {
      continue
    }

    const comparisonKey =
      category.toLocaleLowerCase()

    if (seen.has(comparisonKey)) {
      continue
    }

    seen.add(comparisonKey)
    normalized.push(category)

    if (normalized.length >= 5) {
      break
    }
  }

  return normalized
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function formatCount(
  value: number
): string {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    return '0'
  }

  return Math.trunc(
    value
  ).toLocaleString(
    'en-US'
  )
}