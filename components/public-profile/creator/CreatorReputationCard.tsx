
'use client'

import {
  useId,
  useState,
} from 'react'

import {
  ChevronDown,
  MapPin,
  ShieldCheck,
} from 'lucide-react'

/* =========================================================
 * CREATOR REPUTATION CARD
 *
 * Compact, progressive-disclosure presentation for
 * the existing public creator reputation system.
 *
 * Responsibilities:
 * - Display the creator's earned identity
 * - Highlight the strongest available standing
 * - Preview additional specialties
 * - Expand to show all existing reputation details
 *
 * Does NOT:
 * - Fetch reputation data
 * - Calculate rankings or percentiles
 * - Determine verification eligibility
 * - Modify reputation scoring
 * - Infer missing rankings
 *
 * All reputation values are prepared server-side by
 * app/u/[username]/page.tsx.
 * ======================================================= */

export type CreatorReputationSpecialty = {
  key: string

  /**
   * Human-friendly category name.
   * Example: "Cocktail Bars"
   */
  label: string

  /**
   * Existing scope label.
   * Examples: "In Atlanta", "Worldwide"
   */
  scope: string

  /**
   * Existing calculated standing.
   * Examples: "Top 5%", "#3 of 200".
   *
   * Null when no standing has been established.
   */
  standing: string | null

  /**
   * Existing contextual explanation of the standing.
   */
  standingContext: string | null

  /**
   * Number of verified places, when available.
   */
  verifiedPlaceCount: number | null

  /**
   * Existing human-friendly reputation level.
   */
  level: string | null
}

export type CreatorReputationCardProps = {
  /**
   * Existing, normalized reputation headline.
   */
  headline: string | null

  /**
   * Existing, normalized reputation summary.
   */
  summary: string | null

  /**
   * Existing, formatted highest reputation level.
   *
   * Retained for compatibility with the existing
   * server-side reputation adapter.
   */
  highestLevel: string | null

  /**
   * Already normalized, sorted and formatted
   * reputation categories.
   */
  specialties:
    readonly CreatorReputationSpecialty[]

  className?: string
}

/* =========================================================
 * PRESENTATION HELPERS
 * ======================================================= */

function formatVerifiedPlaces(
  count: number,
): string {
  const normalizedCount = Math.max(
    0,
    Math.trunc(count),
  )

  return `${normalizedCount.toLocaleString('en-US')} verified ${
    normalizedCount === 1
      ? 'place'
      : 'places'
  }`
}

/* =========================================================
 * MAIN COMPONENT
 * ======================================================= */

export default function CreatorReputationCard({
  headline,
  summary,
  specialties,
  className = '',
}: CreatorReputationCardProps) {
  const [expanded, setExpanded] =
    useState(false)

  const detailsId = useId()

  const featuredSpecialty =
    specialties.find(
      (specialty) =>
        specialty.standing !== null,
    ) ??
    specialties[0] ??
    null

  const displayHeadline =
    headline?.trim() ||
    featuredSpecialty?.label ||
    'Real places, real experience'

  const featuredStanding =
    featuredSpecialty?.standing ?? null

  const additionalSpecialties =
    specialties
      .filter(
        (specialty) =>
          specialty !== featuredSpecialty,
      )
      .slice(0, 3)

  const remainingSpecialtiesCount =
    Math.max(
      0,
      specialties.length -
        (featuredSpecialty ? 1 : 0) -
        additionalSpecialties.length,
    )

  const hasDetails =
    specialties.length > 0 ||
    Boolean(summary)

  return (
    <div
      className={[
        'relative isolate min-w-0 overflow-hidden',
        'rounded-[1.75rem]',
        'border border-white/[0.075]',
        'bg-[#0d1117]',
        'text-white',
        'shadow-[0_18px_55px_rgba(0,0,0,0.18)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* =====================================================
          SUBTLE AMBIENT ACCENTS
          ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.045] blur-[85px]" />

        <div className="absolute -bottom-24 left-[-5rem] h-48 w-48 rounded-full bg-indigo-400/[0.035] blur-[75px]" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      </div>

      <div className="relative z-10">
        {/* ===================================================
            FEATURED IDENTITY AND EARNED STANDING
            =================================================== */}

        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                Best known for
              </p>

              <h3 className="mt-1.5 break-words text-[clamp(1.4rem,3vw,2rem)] font-black leading-[1.12] tracking-[-0.045em] text-white">
                {displayHeadline}
              </h3>
            </div>

            {featuredStanding && (
              <div className="min-w-0 sm:max-w-[200px] sm:border-l sm:border-white/[0.075] sm:pl-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                  Earned standing
                </p>

                <p className="mt-1.5 break-words text-[clamp(1.5rem,3vw,2rem)] font-black leading-tight tracking-[-0.045em] text-cyan-200">
                  {featuredStanding}
                </p>

                {featuredSpecialty
                  ?.standingContext && (
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                    {
                      featuredSpecialty
                        .standingContext
                    }
                  </p>
                )}
              </div>
            )}
          </div>

          {/* =================================================
              SPECIALTY PREVIEW
              ================================================= */}

          {additionalSpecialties.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {additionalSpecialties.map(
                (specialty) => (
                  <span
                    key={specialty.key}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/[0.085] bg-white/[0.035] px-3 py-1.5 text-[11px] font-medium text-zinc-300"
                    title={[
                      specialty.label,
                      specialty.scope,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/60" />

                    <span className="truncate">
                      {specialty.label}
                    </span>
                  </span>
                ),
              )}

              {remainingSpecialtiesCount > 0 && (
                <span className="inline-flex items-center px-1 text-[11px] font-medium text-zinc-500">
                  +{remainingSpecialtiesCount} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* ===================================================
            EXPAND / COLLAPSE CONTROL
            =================================================== */}

        {hasDetails && (
          <div className="border-t border-white/[0.07]">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() =>
                setExpanded((current) => !current)
              }
              className={[
                'group flex min-h-12 w-full',
                'items-center justify-between gap-4',
                'px-5 py-3 text-left sm:px-6',
                'transition-colors duration-200',
                'hover:bg-white/[0.035]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-inset',
                'focus-visible:ring-cyan-300/70',
              ].join(' ')}
            >
              <span className="text-xs font-bold tracking-[0.01em] text-cyan-200 transition group-hover:text-cyan-100">
                {expanded
                  ? 'Hide reputation details'
                  : 'View full reputation'}
              </span>

              <ChevronDown
                aria-hidden="true"
                className={[
                  'h-4 w-4 shrink-0 text-cyan-200/75',
                  'transition-transform duration-200',
                  'motion-reduce:transition-none',
                  expanded ? 'rotate-180' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </button>
          </div>
        )}

        {/* ===================================================
            EXPANDED DETAIL REGION
            =================================================== */}

        {hasDetails && (
          <div
            id={detailsId}
            hidden={!expanded}
            className="border-t border-white/[0.075] px-5 pb-6 pt-5 sm:px-6"
          >
            {summary && (
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Their reputation
                </p>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                  {summary}
                </p>
              </div>
            )}

            {specialties.length > 0 && (
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold tracking-tight text-white">
                      Their specialties
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Where their real-world
                      experience stands out.
                    </p>
                  </div>

                  <span className="text-[11px] font-medium tabular-nums text-zinc-500">
                    {specialties.length}{' '}
                    {specialties.length === 1
                      ? 'specialty'
                      : 'specialties'}
                  </span>
                </div>

                <div className="grid min-w-0 gap-2.5 sm:grid-cols-2">
                  {specialties.map(
                    (specialty) => (
                      <SpecialtyDetail
                        key={specialty.key}
                        specialty={specialty}
                      />
                    ),
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-start gap-2.5 border-t border-white/[0.07] pt-4">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
                strokeWidth={1.7}
              />

              <p className="max-w-3xl text-[11px] leading-[1.7] text-zinc-500">
                These highlights come from real,
                verified visits. Rankings compare
                people exploring the same kinds
                of places in the same city.
                Worldwide rankings are kept
                separate.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================
 * EXPANDED SPECIALTY DETAIL
 *
 * Uses existing, precomputed display values.
 * Never calculates or invents a ranking.
 * ======================================================= */

function SpecialtyDetail({
  specialty,
}: {
  specialty: CreatorReputationSpecialty
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[1.1rem] border border-white/[0.075] bg-white/[0.025] p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-bold leading-5 text-white">
            {specialty.label}
          </p>

          <p className="mt-1 text-[11px] text-zinc-500">
            {specialty.scope}
          </p>
        </div>

        {specialty.level && (
          <span className="inline-flex shrink-0 items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-zinc-400">
            {specialty.level}
          </span>
        )}
      </div>

      <div className="mt-4 flex-1">
        {specialty.standing ? (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
              Their standing
            </p>

            <p className="mt-1 break-words text-xl font-black leading-tight tracking-[-0.035em] text-cyan-200">
              {specialty.standing}
            </p>

            {specialty.standingContext && (
              <p className="mt-1.5 text-[11px] leading-5 text-zinc-400">
                {specialty.standingContext}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
              Their journey
            </p>

            <p className="mt-1.5 text-sm font-semibold text-zinc-300">
              Still exploring
            </p>

            <p className="mt-1 text-[11px] leading-5 text-zinc-500">
              A comparison standing is not
              available yet.
            </p>
          </>
        )}
      </div>

      {specialty.verifiedPlaceCount !== null && (
        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.065] pt-3">
          <MapPin
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-cyan-300/70"
          />

          <p className="text-[11px] text-zinc-400">
            {formatVerifiedPlaces(
              specialty.verifiedPlaceCount,
            )}
          </p>
        </div>
      )}
    </div>
  )
}
