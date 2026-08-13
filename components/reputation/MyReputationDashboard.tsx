'use client'

import CreatorReputationIdentity from '@/components/reputation/CreatorReputationIdentity'

import type {
  PublicCreatorReputationSnapshot,
} from '@/lib/reputation/publicTypes'

/* =========================================================
 * Canonical derived contracts
 * ======================================================= */

/**
 * Derive the creator-specific category status directly from the
 * canonical public snapshot contract.
 *
 * Do not replace this with PublicReputationCategory. That type
 * describes category taxonomy metadata, not a creator's earned
 * status within a category.
 */
type PublicCreatorReputationCategorySummary =
  PublicCreatorReputationSnapshot['categories'][number]

/* =========================================================
 * Public contracts
 * ======================================================= */

export type MyReputationDashboardProps = {
  reputation:
    | PublicCreatorReputationSnapshot
    | null
    | undefined

  /**
   * Owner-only rows returned by the authenticated reputation
   * endpoint.
   *
   * These may contain internal evidence, ranking populations,
   * policy versions, and calculation timestamps that are not
   * exposed by the public reputation snapshot.
   */
  details?: readonly unknown[] | null

  loading?: boolean
  error?: string | null
  warning?: string | null
  className?: string
}

/* =========================================================
 * Internal normalized contracts
 * ======================================================= */

type ReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type ReputationScope =
  | 'global'
  | 'city'

type NormalizedPublicCategorySummary = {
  key: string
  categoryId: string
  categoryLabel: string
  categoryShortLabel: string | null
  scope: ReputationScope
  cityKey: string | null
  cityLabel: string | null
  reputationLevel: ReputationLevel
  reputationScore: number
  rank: number | null
  eligibleCreatorCount: number | null
  topPercent: number | null
  rankLabel: string | null
  verifiedVenueCount: number
  weightedVenueCount: number
  curatedVenueCount: number
  publicCollectionCount: number
  publicSnapshotCount: number
  completedFlowCount: number
}

type NormalizedOwnerReputationDetail = {
  key: string
  categoryId: string
  categoryLabel: string
  scope: ReputationScope
  cityKey: string | null
  cityLabel: string | null
  reputationLevel: ReputationLevel
  reputationScore: number
  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  cityCount: number
  rank: number | null
  eligibleCreatorCount: number
  topPercent: number | null
  rankLabel: string | null
  policyVersion: number | null
  calculatedAt: string | null
  rankingCalculatedAt: string | null
}

type DashboardSummary = {
  highestLevel: ReputationLevel | null
  highestScore: number | null
  rankedCategoryCount: number
  eligibleCategoryCount: number
  verifiedVenueCount: number
  curatedVenueCount: number
  completedFlowCount: number
  publicCollectionCount: number
  publicSnapshotCount: number
}

type DashboardRankingState = {
  label: string
  description: string
  published: boolean
}

/* =========================================================
 * Display definitions
 * ======================================================= */

const LEVEL_LABELS = {
  unranked: 'Building',
  emerging: 'Emerging',
  established: 'Established',
  expert: 'Expert',
  elite: 'Elite',
} as const satisfies Record<
  ReputationLevel,
  string
>

const LEVEL_RANK = {
  unranked: 0,
  emerging: 1,
  established: 2,
  expert: 3,
  elite: 4,
} as const satisfies Record<
  ReputationLevel,
  number
>

const LEVEL_STYLES = {
  unranked:
    'bg-white/[0.035] text-zinc-500 ring-1 ring-white/[0.06]',

  emerging:
    'bg-cyan-300/[0.09] text-cyan-200 ring-1 ring-cyan-300/15',

  established:
    'bg-indigo-400/[0.09] text-indigo-200 ring-1 ring-indigo-300/15',

  expert:
    'bg-violet-400/[0.1] text-violet-200 ring-1 ring-violet-300/15',

  elite:
    'bg-amber-300/[0.1] text-amber-200 ring-1 ring-amber-300/15',
} as const satisfies Record<
  ReputationLevel,
  string
>

/* =========================================================
 * Component
 * ======================================================= */

export default function MyReputationDashboard({
  reputation,
  details,
  loading = false,
  error,
  warning,
  className,
}: MyReputationDashboardProps) {
  if (loading) {
    return (
      <MyReputationDashboardSkeleton
        className={className}
      />
    )
  }

  const normalizedError =
    normalizeNullableText(
      error
    )

  const normalizedWarning =
    normalizeNullableText(
      warning
    )

  const normalizedDetails =
    normalizeOwnerReputationDetails(
      details
    )

  const publicCategories =
    normalizePublicCategories(
      reputation
    )

  const summary =
    buildDashboardSummary(
      normalizedDetails
    )

  const hasPublicReputation =
    hasMeaningfulPublicReputation(
      reputation
    )

  const hasInternalReputation =
    normalizedDetails.length > 0

  if (
    !hasPublicReputation &&
    !hasInternalReputation
  ) {
    return (
      <EmptyReputationDashboard
        error={normalizedError}
        warning={normalizedWarning}
        className={className}
      />
    )
  }

  return (
    <section
      aria-labelledby="my-reputation-dashboard-title"
      className={[
        'w-full min-w-0 space-y-9',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2
        id="my-reputation-dashboard-title"
        className="sr-only"
      >
        My reputation dashboard
      </h2>

      <DashboardContextHeader
        summary={summary}
        publicCategoryCount={
          publicCategories.length
        }
        hasPublicReputation={
          hasPublicReputation
        }
      />

      {hasPublicReputation ? (
        <CreatorReputationIdentity
          reputation={reputation}
          categoryLimit={3}
        />
      ) : null}

      {hasInternalReputation ? (
        <DashboardSummaryGrid
          summary={summary}
        />
      ) : null}

      {normalizedError ? (
        <DashboardNotice
          tone="error"
          title="Some reputation data could not be loaded"
          message={normalizedError}
        />
      ) : null}

      {normalizedWarning ? (
        <DashboardNotice
          tone="warning"
          title="Reputation data may be incomplete"
          message={normalizedWarning}
        />
      ) : null}

      {publicCategories.length > 0 ? (
        <section
          aria-labelledby="my-public-reputation-title"
          className="w-full min-w-0"
        >
          <SectionHeading
            eyebrow="What people can see"
            title="Your earned reputations"
            description="These are the category-and-location reputations that can become part of your public creator identity."
            id="my-public-reputation-title"
          />

          <PublicStatusExplanation />

          <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
            {publicCategories.map(
              (category) => (
                <PublicReputationCategoryCard
                  key={category.key}
                  category={category}
                />
              )
            )}
          </div>
        </section>
      ) : null}

      {normalizedDetails.length > 0 ? (
        <section
          aria-labelledby="my-reputation-details-title"
          className="w-full min-w-0"
        >
          <SectionHeading
            eyebrow="Behind the scenes"
            title="How your reputation is being calculated"
            description="Owner-only evidence, ranking populations, policy versions, and calculation timestamps. These details help you understand the system without turning every internal metric into a public claim."
            id="my-reputation-details-title"
          />

          <OwnerDetailDisclosure />

          <div className="mt-5 space-y-4">
            {normalizedDetails.map(
              (detail) => (
                <OwnerReputationDetailCard
                  key={detail.key}
                  detail={detail}
                />
              )
            )}
          </div>
        </section>
      ) : null}
    </section>
  )
}

/* =========================================================
 * Dashboard context
 * ======================================================= */

function DashboardContextHeader({
  summary,
  publicCategoryCount,
  hasPublicReputation,
}: {
  summary: DashboardSummary
  publicCategoryCount: number
  hasPublicReputation: boolean
}) {
  const highestLevel =
    summary.highestLevel ??
    'unranked'

  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.055] via-white/[0.025] to-cyan-300/[0.025] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.07] sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

        <div className="absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-indigo-400/[0.04] blur-[110px]" />
      </div>

      <div className="relative z-10 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-cyan-300/60" />

            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              Your reputation
            </p>
          </div>

          <h2 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.035em] text-white sm:text-[1.85rem]">
            What your real-world activity says about your taste
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            Reputation is earned from verified activity in specific categories and places. Rankings come later, only when there is enough evidence and a meaningful group to compare against.
          </p>
        </div>

        <span
          className={[
            'inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]',
            LEVEL_STYLES[
              highestLevel
            ],
          ].join(' ')}
        >
          {
            LEVEL_LABELS[
              highestLevel
            ]
          }
        </span>
      </div>

      <div className="relative z-10 mt-6 grid min-w-0 gap-3 sm:grid-cols-3">
        <DashboardContextMetric
          label="Earned reputations"
          value={
            publicCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description={
            hasPublicReputation
              ? 'Category statuses currently available for your public identity.'
              : 'No earned public category status yet.'
          }
        />

        <DashboardContextMetric
          label="Status-qualified"
          value={
            summary.eligibleCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description="Scoped reputation rows that have moved beyond Building."
        />

        <DashboardContextMetric
          label="Published ranks"
          value={
            summary.rankedCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description="Exact ranking positions currently available in your owner data."
        />
      </div>
    </header>
  )
}

function DashboardContextMetric({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className="min-w-0 rounded-[1.45rem] bg-black/25 px-4 py-4 ring-1 ring-white/[0.055]">
      <p className="text-2xl font-black leading-none tracking-[-0.04em] text-white">
        {value}
      </p>

      <p className="mt-3 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>

      <p className="mt-1.5 text-[10px] leading-4 text-zinc-600">
        {description}
      </p>
    </div>
  )
}

function PublicStatusExplanation() {
  return (
    <div className="mt-5 grid min-w-0 gap-3 rounded-[1.6rem] bg-cyan-300/[0.04] p-4 ring-1 ring-cyan-300/10 sm:grid-cols-3">
      <StatusStage
        step="1"
        label="Earn status"
        description="Build enough verified category evidence to move beyond Building."
      />

      <StatusStage
        step="2"
        label="Become rankable"
        description="Reach the stronger evidence threshold required for leaderboard comparison."
      />

      <StatusStage
        step="3"
        label="Publish standing"
        description="A rank appears only when enough eligible creators exist for the comparison to mean something."
      />
    </div>
  )
}

function StatusStage({
  step,
  label,
  description,
}: {
  step: string
  label: string
  description: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/[0.08] text-[10px] font-black text-cyan-200 ring-1 ring-cyan-300/15">
        {step}
      </span>

      <div className="min-w-0">
        <p className="text-xs font-black text-white">
          {label}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  )
}

function OwnerDetailDisclosure() {
  return (
    <div className="mt-5 rounded-[1.5rem] bg-white/[0.025] px-4 py-3.5 ring-1 ring-white/[0.055]">
      <p className="text-xs font-bold text-zinc-300">
        Why the same activity can appear in more than one row
      </p>

      <p className="mt-1.5 text-[11px] leading-5 text-zinc-600">
        One verified venue or completed Flow can support multiple categories, and a category can have separate city and global reputations. These rows overlap, so they should never be added together as your total footprint.
      </p>
    </div>
  )
}

/* =========================================================
 * Public category presentation
 * ======================================================= */

function PublicReputationCategoryCard({
  category,
}: {
  category: NormalizedPublicCategorySummary
}) {
  const rankingState =
    buildPublicRankingState(
      category
    )

  const evidence = [
    {
      label:
        'Verified venues',
      value:
        category.verifiedVenueCount,
    },
    {
      label:
        'Weighted venues',
      value:
        category.weightedVenueCount,
    },
    {
      label:
        'Curated venues',
      value:
        category.curatedVenueCount,
    },
    {
      label:
        'Public collections',
      value:
        category.publicCollectionCount,
    },
    {
      label:
        'Public snapshots',
      value:
        category.publicSnapshotCount,
    },
    {
      label:
        'Completed flows',
      value:
        category.completedFlowCount,
    },
  ].filter(
    (metric) =>
      metric.value > 0
  )

  const scopeLabel =
    category.scope ===
      'city'
      ? category.cityLabel ??
        category.cityKey ??
        'City'
      : 'Global'

  return (
    <article
      aria-label={`${category.categoryLabel} reputation`}
      className="relative w-full min-w-0 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-cyan-300/[0.05] via-white/[0.025] to-transparent p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.065]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/[0.04] blur-[80px]" />
      </div>

      <div className="relative z-10">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
                {scopeLabel}
              </p>

              <span className="rounded-full bg-white/[0.035] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600 ring-1 ring-white/[0.055]">
                {category.scope}
              </span>
            </div>

            <h3 className="mt-3 break-words text-xl font-black tracking-[-0.03em] text-white">
              {
                category.categoryLabel
              }
            </h3>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Reputation earned within this exact category and scope.
            </p>
          </div>

          <span
            className={[
              'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]',
              LEVEL_STYLES[
                category.reputationLevel
              ],
            ].join(' ')}
          >
            {
              LEVEL_LABELS[
                category.reputationLevel
              ]
            }
          </span>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-[1.4rem] bg-black/25 px-4 py-4 ring-1 ring-white/[0.055]">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Reputation score
            </p>

            <p className="mt-2 truncate text-[2rem] font-black leading-none tracking-[-0.045em] text-white">
              {formatNumber(
                category.reputationScore,
                1
              )}
            </p>

            <p className="mt-2 text-[10px] leading-4 text-zinc-600">
              Strength of the evidence in this exact reputation.
            </p>
          </div>

          <div
            className={[
              'min-w-0 rounded-[1.4rem] px-4 py-4 ring-1',
              rankingState.published
                ? 'bg-cyan-300/[0.055] ring-cyan-300/12'
                : 'bg-black/25 ring-white/[0.055]',
            ].join(' ')}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Public standing
            </p>

            <p
              className={[
                'mt-2 break-words font-black leading-5 tracking-tight',
                rankingState.published
                  ? 'text-base text-cyan-200'
                  : 'text-sm text-zinc-400',
              ].join(' ')}
            >
              {
                rankingState.label
              }
            </p>

            <p className="mt-1.5 text-[10px] leading-4 text-zinc-600">
              {
                rankingState.description
              }
            </p>
          </div>
        </div>

        {evidence.length > 0 ? (
          <div className="mt-5 border-t border-white/[0.055] pt-4">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                Why you earned it
              </p>

              <p className="text-[9px] text-zinc-700">
                Scoped evidence only
              </p>
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              {evidence.map(
                (metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-[1.05rem] bg-black/20 px-3 py-3 ring-1 ring-white/[0.05]"
                  >
                    <p className="truncate text-base font-black leading-none tracking-[-0.02em] text-white">
                      {metric.value.toLocaleString(
                        'en-US'
                      )}
                    </p>

                    <p className="mt-2 truncate text-[9px] font-medium leading-4 text-zinc-600">
                      {metric.label}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

/* =========================================================
 * Dashboard summary
 * ======================================================= */

function DashboardSummaryGrid({
  summary,
}: {
  summary: DashboardSummary
}) {
  const metrics = [
    {
      label:
        'Highest earned status',

      value:
        summary.highestLevel
          ? LEVEL_LABELS[
              summary.highestLevel
            ]
          : 'Building',

      detail:
        'Strongest level across all scoped rows.',
    },
    {
      label:
        'Highest category score',

      value:
        summary.highestScore !==
        null
          ? formatNumber(
              summary.highestScore,
              1
            )
          : '—',

      detail:
        'Strongest single category-and-scope score.',
    },
    {
      label:
        'Rows with ranks',

      value:
        summary.rankedCategoryCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Scoped rows containing an exact rank.',
    },
    {
      label:
        'Earned status rows',

      value:
        summary.eligibleCategoryCount.toLocaleString(
          'en-US'
        ),

      detail:
        'City and global rows above unranked.',
    },
    {
      label:
        'Verified venues',

      value:
        summary.verifiedVenueCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Largest creator-wide value represented.',
    },
    {
      label:
        'Curated venues',

      value:
        summary.curatedVenueCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Largest creator-wide curation value.',
    },
    {
      label:
        'Completed flows',

      value:
        summary.completedFlowCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Largest creator-wide completed Flow value.',
    },
    {
      label:
        'Public collections',

      value:
        summary.publicCollectionCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Largest creator-wide public collection value.',
    },
    {
      label:
        'Public snapshots',

      value:
        summary.publicSnapshotCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Largest creator-wide public snapshot value.',
    },
  ]

  return (
    <section
      aria-label="Reputation summary"
      className="min-w-0"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-px w-5 bg-white/15" />

            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Your evidence
            </p>
          </div>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-600">
            These summary values avoid double-counting overlapping category and geographic rows.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map(
          (metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-[1.35rem] bg-white/[0.025] px-4 py-4 ring-1 ring-white/[0.05]"
            >
              <dd className="truncate text-xl font-black leading-none tracking-[-0.035em] text-white">
                {metric.value}
              </dd>

              <dt className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                {metric.label}
              </dt>

              <p className="mt-1.5 text-[9px] leading-4 text-zinc-700">
                {metric.detail}
              </p>
            </div>
          )
        )}
      </dl>
    </section>
  )
}

/* =========================================================
 * Owner detail card
 * ======================================================= */

function OwnerReputationDetailCard({
  detail,
}: {
  detail:
    NormalizedOwnerReputationDetail
}) {
  const rankingState =
    buildOwnerRankingState(
      detail
    )

  const evidence = [
    {
      label:
        'Verified venues',

      value:
        detail.verifiedVenueCount,
    },
    {
      label:
        'Weighted venues',

      value:
        detail.weightedVenueCount,
    },
    {
      label:
        'Curated venues',

      value:
        detail.curatedVenueCount,
    },
    {
      label:
        'Public collections',

      value:
        detail.publicCollectionCount,
    },
    {
      label:
        'Public snapshots',

      value:
        detail.publicSnapshotCount,
    },
    {
      label:
        'Completed flows',

      value:
        detail.completedFlowCount,
    },
    {
      label:
        'Cities',

      value:
        detail.cityCount,
    },
  ]

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[1.75rem] bg-white/[0.025] ring-1 ring-white/[0.06]">
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/[0.055] p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">
              {detail.scope ===
              'city'
                ? detail.cityLabel ??
                  detail.cityKey ??
                  'City'
                : 'Global'}
            </p>

            <span className="rounded-full bg-white/[0.035] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600 ring-1 ring-white/[0.055]">
              {detail.scope}
            </span>

            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[9px] font-medium text-zinc-700 ring-1 ring-white/[0.045]">
              Owner only
            </span>
          </div>

          <h3 className="mt-3 break-words text-lg font-black tracking-[-0.025em] text-white">
            {
              detail.categoryLabel
            }
          </h3>

          <p className="mt-1 text-[10px] text-zinc-700">
            Category ID:{' '}
            <span className="font-mono text-zinc-600">
              {
                detail.categoryId
              }
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full bg-cyan-300/[0.07] px-3 py-1.5 text-[10px] font-black text-cyan-200 ring-1 ring-cyan-300/12">
            {formatNumber(
              detail.reputationScore,
              1
            )}{' '}
            score
          </span>

          <span
            className={[
              'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em]',
              LEVEL_STYLES[
                detail.reputationLevel
              ],
            ].join(' ')}
          >
            {
              LEVEL_LABELS[
                detail.reputationLevel
              ]
            }
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              Evidence in this row
            </p>

            <p className="text-[9px] text-zinc-700">
              Category + scope specific
            </p>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {evidence.map(
              (metric) => (
                <div
                  key={metric.label}
                  className="min-w-0 rounded-[1.05rem] bg-black/20 px-3 py-3 ring-1 ring-white/[0.05]"
                >
                  <p className="truncate text-base font-black leading-none tracking-[-0.02em] text-white">
                    {metric.value.toLocaleString(
                      'en-US'
                    )}
                  </p>

                  <p className="mt-2 truncate text-[9px] text-zinc-600">
                    {metric.label}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        <div
          className={[
            'min-w-0 rounded-[1.4rem] p-4 ring-1',
            rankingState.published
              ? 'bg-cyan-300/[0.045] ring-cyan-300/10'
              : 'bg-black/20 ring-white/[0.05]',
          ].join(' ')}
        >
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
            Ranking state
          </p>

          <p
            className={[
              'mt-2 break-words font-black leading-5 tracking-tight',
              rankingState.published
                ? 'text-sm text-cyan-200'
                : 'text-sm text-zinc-400',
            ].join(' ')}
          >
            {rankingState.label}
          </p>

          <p className="mt-1.5 text-[10px] leading-4 text-zinc-600">
            {
              rankingState.description
            }
          </p>

          <dl className="mt-4 space-y-2.5 border-t border-white/[0.055] pt-4">
            <DetailRow
              label="Exact rank"
              value={
                detail.rank !==
                null
                  ? `#${detail.rank.toLocaleString(
                      'en-US'
                    )}`
                  : 'Not published'
              }
            />

            <DetailRow
              label="Eligible creators"
              value={
                detail.eligibleCreatorCount.toLocaleString(
                  'en-US'
                )
              }
            />

            <DetailRow
              label="Top standing"
              value={
                detail.topPercent !==
                null
                  ? `Top ${formatNumber(
                      detail.topPercent,
                      detail.topPercent <
                        1
                        ? 1
                        : 0
                    )}%`
                  : 'Not published'
              }
            />

            <DetailRow
              label="Policy version"
              value={
                detail.policyVersion !==
                null
                  ? detail.policyVersion.toLocaleString(
                      'en-US'
                    )
                  : '—'
              }
            />
          </dl>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 border-t border-white/[0.055] px-4 py-3 text-[10px] text-zinc-700 sm:grid-cols-2 sm:px-5">
        <p>
          Score calculated:{' '}
          <span className="text-zinc-600">
            {formatTimestamp(
              detail.calculatedAt
            )}
          </span>
        </p>

        <p>
          Population calculated:{' '}
          <span className="text-zinc-600">
            {formatTimestamp(
              detail.rankingCalculatedAt
            )}
          </span>
        </p>
      </div>
    </article>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <dt className="text-[10px] text-zinc-700">
        {label}
      </dt>

      <dd className="truncate text-[10px] font-semibold text-zinc-400">
        {value}
      </dd>
    </div>
  )
}

/* =========================================================
 * Empty, error, and loading states
 * ======================================================= */

function EmptyReputationDashboard({
  error,
  warning,
  className,
}: {
  error: string | null
  warning: string | null
  className?: string
}) {
  return (
    <section
      aria-labelledby="empty-reputation-dashboard-title"
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-cyan-300/[0.025] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065] sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-300/[0.05] blur-[100px]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-cyan-300/60" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Your reputation
          </p>
        </div>

        <h2
          id="empty-reputation-dashboard-title"
          className="mt-3 text-2xl font-black tracking-[-0.035em] text-white"
        >
          Start becoming known for something
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
          Verified visits are the foundation of your Roam reputation. Completed Flows, strong public collections, and snapshots can deepen the evidence, but genuine venue breadth comes first.
        </p>

        <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-3">
          <EmptyProgressStage
            number="1"
            title="Explore for real"
            description="Check in at qualifying venues through genuine geo-verified activity."
          />

          <EmptyProgressStage
            number="2"
            title="Build a point of view"
            description="Create enough relevant evidence to earn a reputation in a category."
          />

          <EmptyProgressStage
            number="3"
            title="Earn a standing"
            description="Meet ranking requirements and enter a meaningful creator comparison population."
          />
        </div>

        <div className="mt-4 rounded-[1.5rem] bg-black/20 p-4 ring-1 ring-white/[0.05]">
          <p className="text-sm font-black text-white">
            Your next move
          </p>

          <p className="mt-1.5 text-xs leading-5 text-zinc-600">
            Complete a verified visit at a qualifying venue. Your progress will appear here after the reputation snapshot is rebuilt.
          </p>
        </div>

        {error ? (
          <DashboardNotice
            tone="error"
            title="Reputation unavailable"
            message={error}
          />
        ) : null}

        {warning ? (
          <DashboardNotice
            tone="warning"
            title="Reputation data may be incomplete"
            message={warning}
          />
        ) : null}
      </div>
    </section>
  )
}

function EmptyProgressStage({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-[1.5rem] bg-black/20 p-4 ring-1 ring-white/[0.05]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/[0.08] text-xs font-black text-cyan-200 ring-1 ring-cyan-300/15">
        {number}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-black text-white">
          {title}
        </p>

        <p className="mt-1 text-[11px] leading-5 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  )
}

function MyReputationDashboardSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <section
      aria-label="Loading reputation dashboard"
      className={[
        'w-full min-w-0 space-y-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="animate-pulse rounded-[2rem] bg-white/[0.025] p-5 ring-1 ring-white/[0.055]">
        <div className="h-3 w-32 rounded bg-white/[0.07]" />
        <div className="mt-3 h-7 w-64 max-w-full rounded bg-white/[0.07]" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-white/[0.035]" />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(
            (item) => (
              <div
                key={item}
                className="h-24 rounded-[1.4rem] bg-black/20 ring-1 ring-white/[0.05]"
              />
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          0,
          1,
          2,
          3,
          4,
        ].map(
          (item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-[1.35rem] bg-white/[0.025] ring-1 ring-white/[0.05]"
            />
          )
        )}
      </div>
    </section>
  )
}

function DashboardNotice({
  tone,
  title,
  message,
}: {
  tone:
    | 'error'
    | 'warning'
  title: string
  message: string
}) {
  const styles =
    tone === 'error'
      ? 'bg-red-500/[0.07] text-red-200 ring-1 ring-red-400/15'
      : 'bg-amber-300/[0.07] text-amber-200 ring-1 ring-amber-300/15'

  return (
    <div
      role={
        tone === 'error'
          ? 'alert'
          : 'status'
      }
      className={[
        'mt-4 rounded-[1.4rem] px-4 py-3.5',
        styles,
      ].join(' ')}
    >
      <p className="text-sm font-black">
        {title}
      </p>

      <p className="mt-1 break-words text-xs leading-5 opacity-80">
        {message}
      </p>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string
  title: string
  description: string
  id: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          {eyebrow}
        </p>
      </div>

      <h2
        id={id}
        className="mt-3 text-2xl font-black tracking-[-0.035em] text-white"
      >
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
        {description}
      </p>
    </div>
  )
}

/* =========================================================
 * Summary derivation
 * ======================================================= */

function buildDashboardSummary(
  details:
    NormalizedOwnerReputationDetail[]
): DashboardSummary {
  let highestLevel:
    ReputationLevel | null =
    null

  let highestScore:
    number | null =
    null

  let rankedCategoryCount = 0
  let eligibleCategoryCount = 0
  let verifiedVenueCount = 0
  let curatedVenueCount = 0
  let completedFlowCount = 0
  let publicCollectionCount = 0
  let publicSnapshotCount = 0

  for (const detail of details) {
    if (
      highestLevel === null ||
      LEVEL_RANK[
        detail.reputationLevel
      ] >
        LEVEL_RANK[
          highestLevel
        ]
    ) {
      highestLevel =
        detail.reputationLevel
    }

    if (
      highestScore === null ||
      detail.reputationScore >
        highestScore
    ) {
      highestScore =
        detail.reputationScore
    }

    if (
      detail.reputationLevel !==
      'unranked'
    ) {
      eligibleCategoryCount +=
        1
    }

    if (
      detail.rank !== null
    ) {
      rankedCategoryCount += 1
    }

    verifiedVenueCount =
      Math.max(
        verifiedVenueCount,
        detail.verifiedVenueCount
      )

    curatedVenueCount =
      Math.max(
        curatedVenueCount,
        detail.curatedVenueCount
      )

    completedFlowCount =
      Math.max(
        completedFlowCount,
        detail.completedFlowCount
      )

    publicCollectionCount =
      Math.max(
        publicCollectionCount,
        detail.publicCollectionCount
      )

    publicSnapshotCount =
      Math.max(
        publicSnapshotCount,
        detail.publicSnapshotCount
      )
  }

  return {
    highestLevel,
    highestScore,
    rankedCategoryCount,
    eligibleCategoryCount,
    verifiedVenueCount,
    curatedVenueCount,
    completedFlowCount,
    publicCollectionCount,
    publicSnapshotCount,
  }
}

/* =========================================================
 * Public snapshot helpers
 * ======================================================= */

function normalizePublicCategories(
  reputation:
    | PublicCreatorReputationSnapshot
    | null
    | undefined
): NormalizedPublicCategorySummary[] {
  if (
    !reputation ||
    !Array.isArray(
      reputation.categories
    )
  ) {
    return []
  }

  const categories:
    NormalizedPublicCategorySummary[] =
    []

  const seen =
    new Set<string>()

  for (
    const rawCategory of
      reputation.categories
  ) {
    const category =
      normalizePublicCategory(
        rawCategory
      )

    if (
      !category ||
      seen.has(category.key)
    ) {
      continue
    }

    seen.add(category.key)
    categories.push(category)
  }

  return categories.sort(
    comparePublicCategories
  )
}

function normalizePublicCategory(
  value:
    PublicCreatorReputationCategorySummary
): NormalizedPublicCategorySummary | null {
  const raw =
    value as unknown

  if (!isRecord(raw)) {
    return null
  }

  const categoryId =
    normalizeNullableText(
      firstDefined(
        raw.categoryId,
        raw.category_id
      )
    )

  if (!categoryId) {
    return null
  }

  const categoryLabel =
    normalizeNullableText(
      firstDefined(
        raw.categoryLabel,
        raw.category_label,
        raw.label
      )
    ) ??
    formatIdentifier(
      categoryId
    )

  const categoryShortLabel =
    normalizeNullableText(
      firstDefined(
        raw.categoryShortLabel,
        raw.category_short_label,
        raw.shortLabel,
        raw.short_label
      )
    )

  const scope =
    normalizeScope(
      raw.scope
    )

  if (!scope) {
    return null
  }

  const cityKey =
    normalizeNullableText(
      firstDefined(
        raw.cityKey,
        raw.city_key
      )
    )

  const cityLabel =
    normalizeNullableText(
      firstDefined(
        raw.cityLabel,
        raw.city_label
      )
    )

  const reputationLevel =
    normalizeLevel(
      firstDefined(
        raw.reputationLevel,
        raw.reputation_level,
        raw.level
      )
    )

  const reputationScore =
    normalizeNonNegativeNumber(
      firstDefined(
        raw.reputationScore,
        raw.reputation_score,
        raw.score
      )
    ) ?? 0

  const evidence =
    isRecord(raw.evidence)
      ? raw.evidence
      : null

  const ranking =
    isRecord(raw.ranking)
      ? raw.ranking
      : null

  const key = [
    categoryId,
    scope,
    cityKey ??
      '__global__',
  ].join(':')

  return {
    key,
    categoryId,
    categoryLabel,
    categoryShortLabel,
    scope,
    cityKey,
    cityLabel,
    reputationLevel,
    reputationScore,

    rank:
      normalizePositiveInteger(
        firstDefined(
          raw.rank,
          raw.cityRank,
          raw.city_rank,
          ranking?.rank
        )
      ),

    eligibleCreatorCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.eligibleCreatorCount,
          raw.eligible_creator_count,
          raw.eligibleUserCount,
          raw.eligible_user_count,
          ranking?.eligibleCreatorCount,
          ranking?.eligible_creator_count,
          ranking?.eligibleUserCount,
          ranking?.eligible_user_count
        )
      ),

    topPercent:
      normalizePercentage(
        firstDefined(
          raw.topPercent,
          raw.top_percent,
          raw.percentile,
          ranking?.topPercent,
          ranking?.top_percent,
          ranking?.percentile
        )
      ),

    rankLabel:
      normalizeNullableText(
        firstDefined(
          raw.rankLabel,
          raw.rank_label,
          ranking?.label
        )
      ),

    verifiedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.verifiedVenueCount,
          raw.verified_venue_count,
          evidence?.verifiedVenueCount,
          evidence?.verified_venue_count
        )
      ) ?? 0,

    weightedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.weightedVenueCount,
          raw.weighted_venue_count,
          evidence?.weightedVenueCount,
          evidence?.weighted_venue_count
        )
      ) ?? 0,

    curatedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.curatedVenueCount,
          raw.curated_venue_count,
          evidence?.curatedVenueCount,
          evidence?.curated_venue_count
        )
      ) ?? 0,

    publicCollectionCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.publicCollectionCount,
          raw.public_collection_count,
          evidence?.publicCollectionCount,
          evidence?.public_collection_count
        )
      ) ?? 0,

    publicSnapshotCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.publicSnapshotCount,
          raw.public_snapshot_count,
          evidence?.publicSnapshotCount,
          evidence?.public_snapshot_count
        )
      ) ?? 0,

    completedFlowCount:
      normalizeNonNegativeInteger(
        firstDefined(
          raw.completedFlowCount,
          raw.completed_flow_count,
          evidence?.completedFlowCount,
          evidence?.completed_flow_count
        )
      ) ?? 0,
  }
}

function comparePublicCategories(
  first:
    NormalizedPublicCategorySummary,
  second:
    NormalizedPublicCategorySummary
): number {
  const levelDifference =
    LEVEL_RANK[
      second.reputationLevel
    ] -
    LEVEL_RANK[
      first.reputationLevel
    ]

  if (levelDifference !== 0) {
    return levelDifference
  }

  if (
    first.reputationScore !==
    second.reputationScore
  ) {
    return (
      second.reputationScore -
      first.reputationScore
    )
  }

  if (
    first.rank !== null &&
    second.rank !== null &&
    first.rank !==
      second.rank
  ) {
    return (
      first.rank -
      second.rank
    )
  }

  return first.categoryLabel.localeCompare(
    second.categoryLabel,
    'en-US',
    {
      sensitivity:
        'base',
    }
  )
}

function hasMeaningfulPublicReputation(
  reputation:
    | PublicCreatorReputationSnapshot
    | null
    | undefined
): boolean {
  if (!reputation) {
    return false
  }

  if (
    normalizeNullableText(
      reputation.headline
    )
  ) {
    return true
  }

  if (
    normalizeNullableText(
      reputation.summary
    )
  ) {
    return true
  }

  return (
    Array.isArray(
      reputation.categories
    ) &&
    reputation.categories.length >
      0
  )
}

/* =========================================================
 * Owner detail normalization
 * ======================================================= */

function normalizeOwnerReputationDetails(
  value:
    | readonly unknown[]
    | null
    | undefined
): NormalizedOwnerReputationDetail[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized:
    NormalizedOwnerReputationDetail[] =
    []

  const seen =
    new Set<string>()

  for (const item of value) {
    const detail =
      normalizeOwnerReputationDetail(
        item
      )

    if (
      !detail ||
      seen.has(detail.key)
    ) {
      continue
    }

    seen.add(detail.key)
    normalized.push(detail)
  }

  return normalized.sort(
    compareOwnerDetails
  )
}

function normalizeOwnerReputationDetail(
  value: unknown
): NormalizedOwnerReputationDetail | null {
  if (!isRecord(value)) {
    return null
  }

  const categoryId =
    normalizeNullableText(
      firstDefined(
        value.categoryId,
        value.category_id
      )
    )

  if (!categoryId) {
    return null
  }

  const categoryLabel =
    normalizeNullableText(
      firstDefined(
        value.categoryLabel,
        value.category_label,
        value.label
      )
    ) ??
    formatIdentifier(
      categoryId
    )

  const scope =
    normalizeScope(
      value.scope
    )

  if (!scope) {
    return null
  }

  const cityKey =
    normalizeNullableText(
      firstDefined(
        value.cityKey,
        value.city_key
      )
    )

  const cityLabel =
    normalizeNullableText(
      firstDefined(
        value.cityLabel,
        value.city_label
      )
    )

  const reputationLevel =
    normalizeLevel(
      firstDefined(
        value.reputationLevel,
        value.reputation_level,
        value.level
      )
    )

  const reputationScore =
    normalizeNonNegativeNumber(
      firstDefined(
        value.reputationScore,
        value.reputation_score,
        value.score
      )
    ) ?? 0

  const key = [
    categoryId,
    scope,
    cityKey ??
      '__global__',
  ].join(':')

  return {
    key,
    categoryId,
    categoryLabel,
    scope,
    cityKey,
    cityLabel,
    reputationLevel,
    reputationScore,

    verifiedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.verifiedVenueCount,
          value.verified_venue_count
        )
      ) ?? 0,

    weightedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.weightedVenueCount,
          value.weighted_venue_count
        )
      ) ?? 0,

    publicCollectionCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.publicCollectionCount,
          value.public_collection_count
        )
      ) ?? 0,

    curatedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.curatedVenueCount,
          value.curated_venue_count
        )
      ) ?? 0,

    publicSnapshotCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.publicSnapshotCount,
          value.public_snapshot_count
        )
      ) ?? 0,

    completedFlowCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.completedFlowCount,
          value.completed_flow_count
        )
      ) ?? 0,

    cityCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.cityCount,
          value.city_count
        )
      ) ?? 0,

    rank:
      normalizePositiveInteger(
        value.rank
      ),

    eligibleCreatorCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.eligibleCreatorCount,
          value.eligible_creator_count,
          value.eligibleUserCount,
          value.eligible_user_count
        )
      ) ?? 0,

    topPercent:
      normalizePercentage(
        firstDefined(
          value.topPercent,
          value.top_percent,
          value.percentile
        )
      ),

    rankLabel:
      normalizeNullableText(
        firstDefined(
          value.rankLabel,
          value.rank_label
        )
      ),

    policyVersion:
      normalizeNonNegativeInteger(
        firstDefined(
          value.policyVersion,
          value.policy_version
        )
      ),

    calculatedAt:
      normalizeIsoTimestamp(
        firstDefined(
          value.calculatedAt,
          value.calculated_at
        )
      ),

    rankingCalculatedAt:
      normalizeIsoTimestamp(
        firstDefined(
          value.rankingCalculatedAt,
          value.ranking_calculated_at
        )
      ),
  }
}

function compareOwnerDetails(
  first:
    NormalizedOwnerReputationDetail,
  second:
    NormalizedOwnerReputationDetail
): number {
  const levelDifference =
    LEVEL_RANK[
      second.reputationLevel
    ] -
    LEVEL_RANK[
      first.reputationLevel
    ]

  if (levelDifference !== 0) {
    return levelDifference
  }

  if (
    first.reputationScore !==
    second.reputationScore
  ) {
    return (
      second.reputationScore -
      first.reputationScore
    )
  }

  if (
    first.rank !== null &&
    second.rank !== null &&
    first.rank !==
      second.rank
  ) {
    return (
      first.rank -
      second.rank
    )
  }

  if (
    first.rank !== null &&
    second.rank === null
  ) {
    return -1
  }

  if (
    first.rank === null &&
    second.rank !== null
  ) {
    return 1
  }

  if (
    first.scope !==
    second.scope
  ) {
    return first.scope ===
      'city'
      ? -1
      : 1
  }

  return first.categoryLabel.localeCompare(
    second.categoryLabel,
    'en-US',
    {
      sensitivity:
        'base',
    }
  )
}

/* =========================================================
 * Ranking formatting
 * ======================================================= */

function buildPublicRankingState(
  category:
    NormalizedPublicCategorySummary
): DashboardRankingState {
  const summary =
    buildPublicRankingSummary(
      category
    )

  if (summary) {
    return {
      label:
        summary,

      description:
        'Published against the eligible creator population for this exact category and scope.',

      published:
        true,
    }
  }

  if (
    category.reputationLevel !==
    'unranked'
  ) {
    if (
      category.eligibleCreatorCount !==
        null &&
      category.eligibleCreatorCount >
        0
    ) {
      return {
        label:
          'Status earned · Public rank withheld',

        description:
          `${category.eligibleCreatorCount.toLocaleString(
            'en-US'
          )} eligible ${
            category.eligibleCreatorCount ===
            1
              ? 'creator is'
              : 'creators are'
          } currently represented. The population is still too small for a defensible public rank.`,

        published:
          false,
      }
    }

    return {
      label:
        'Status earned · Ranking population building',

      description:
        'You have earned this category status, but there is not yet a sufficiently large eligible comparison population.',

      published:
        false,
    }
  }

  if (
    category.verifiedVenueCount >
    0
  ) {
    return {
      label:
        'Building toward category status',

      description:
        `${category.verifiedVenueCount.toLocaleString(
          'en-US'
        )} verified ${
          category.verifiedVenueCount ===
          1
            ? 'venue contributes'
            : 'venues contribute'
        } to this scoped category.`,

      published:
        false,
    }
  }

  return {
    label:
      'No qualifying category evidence yet',

    description:
      'Record verified activity at venues attributed to this category and scope.',

    published:
      false,
  }
}

function buildOwnerRankingState(
  detail:
    NormalizedOwnerReputationDetail
): DashboardRankingState {
  const summary =
    buildRankingSummary(
      detail
    )

  if (summary) {
    return {
      label:
        summary,

      description:
        'This row contains a calculated ranking result for its exact category and scope.',

      published:
        true,
    }
  }

  if (
    detail.reputationLevel ===
    'unranked'
  ) {
    return {
      label:
        'Not yet eligible for ranking',

      description:
        'This scoped category has not yet earned the minimum public reputation status required before ranking.',

      published:
        false,
    }
  }

  if (
    detail.eligibleCreatorCount <=
    0
  ) {
    return {
      label:
        'Status earned · No eligible ranking population yet',

      description:
        'The category status is valid, but no qualifying comparison population is currently available for this scope.',

      published:
        false,
    }
  }

  if (
    detail.eligibleCreatorCount <
    10
  ) {
    return {
      label:
        'Eligible · Ranking population still too small',

      description:
        `${detail.eligibleCreatorCount.toLocaleString(
          'en-US'
        )} eligible ${
          detail.eligibleCreatorCount ===
          1
            ? 'creator is'
            : 'creators are'
        } currently represented. Exact ranks require a larger population.`,

      published:
        false,
    }
  }

  return {
    label:
      'Eligible · Public ranking not currently exposed',

    description:
      'The row is eligible, but no defensible public rank or percentile is present in the current snapshot.',

    published:
      false,
  }
}

function buildPublicRankingSummary(
  category:
    NormalizedPublicCategorySummary
): string | null {
  if (category.rankLabel) {
    return category.rankLabel
  }

  const parts: string[] = []

  if (category.rank !== null) {
    parts.push(
      `#${category.rank.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    category.rank !== null &&
    category.eligibleCreatorCount !==
      null &&
    category.eligibleCreatorCount >
      0
  ) {
    parts.push(
      `of ${category.eligibleCreatorCount.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    category.topPercent !==
    null
  ) {
    parts.push(
      `Top ${formatNumber(
        category.topPercent,
        category.topPercent <
          1
          ? 1
          : 0
      )}%`
    )
  }

  return parts.length > 0
    ? parts.join(' · ')
    : null
}

function buildRankingSummary(
  detail:
    NormalizedOwnerReputationDetail
): string | null {
  if (detail.rankLabel) {
    return detail.rankLabel
  }

  const parts: string[] = []

  if (detail.rank !== null) {
    parts.push(
      `#${detail.rank.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    detail.rank !== null &&
    detail.eligibleCreatorCount >
      0
  ) {
    parts.push(
      `of ${detail.eligibleCreatorCount.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    detail.topPercent !==
    null
  ) {
    parts.push(
      `Top ${formatNumber(
        detail.topPercent,
        detail.topPercent <
          1
          ? 1
          : 0
      )}%`
    )
  }

  return parts.length > 0
    ? parts.join(' · ')
    : null
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeLevel(
  value: unknown
): ReputationLevel {
  if (
    typeof value !==
    'string'
  ) {
    return 'unranked'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        '_'
      )

  if (
    normalized ===
      'emerging' ||
    normalized ===
      'established' ||
    normalized ===
      'expert' ||
    normalized ===
      'elite'
  ) {
    return normalized
  }

  return 'unranked'
}

function normalizeScope(
  value: unknown
): ReputationScope | null {
  return value ===
      'global' ||
    value ===
      'city'
    ? value
    : null
}

function normalizeNullableText(
  value: unknown
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

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeFiniteNumber(
  value: unknown
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
    value.trim().length >
      0
  ) {
    const parsed =
      Number(value)

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return normalized
}

function normalizeNonNegativeInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePercentage(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function normalizeIsoTimestamp(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

function firstDefined(
  ...values: unknown[]
): unknown {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
}

function formatIdentifier(
  value: string
): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    )
}

function formatNumber(
  value: number,
  maximumFractionDigits: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits,
    }
  )
}

function formatTimestamp(
  value: string | null
): string {
  if (!value) {
    return 'Not available'
  }

  const timestamp =
    Date.parse(value)

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    }
  ).format(
    new Date(timestamp)
  )
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}