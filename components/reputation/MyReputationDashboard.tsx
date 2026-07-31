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
    'border-neutral-700 bg-neutral-900 text-neutral-400',

  emerging:
    'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',

  established:
    'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',

  expert:
    'border-violet-500/30 bg-violet-500/10 text-violet-200',

  elite:
    'border-amber-400/30 bg-amber-400/10 text-amber-200',
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
        'w-full min-w-0 space-y-7',
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
            eyebrow="Public identity"
            title="Earned category statuses"
            description="These are category-and-scope-specific statuses that may appear on your public creator profile. Their evidence counts are not your creator-wide totals."
            id="my-public-reputation-title"
          />

          <PublicStatusExplanation />

          <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
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
            eyebrow="Private diagnostics"
            title="Full reputation breakdown"
            description="Owner-only category evidence, scores, eligibility populations, policy versions, and calculation timestamps. These diagnostic rows are not all public claims."
            id="my-reputation-details-title"
          />

          <OwnerDetailDisclosure />

          <div className="mt-4 space-y-4">
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
    <header className="relative overflow-hidden rounded-[1.75rem] border border-neutral-800 bg-gradient-to-br from-neutral-950 via-black to-cyan-950/20 p-5 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-500/[0.06] blur-3xl" />
      </div>

      <div className="relative z-10 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
            Reputation control center
          </p>

          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Your earned identity and
            qualification progress
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            Status is earned from
            verified, category-specific
            activity. Ranking is a
            separate claim that appears
            only when both your evidence
            and the comparison population
            are large enough.
          </p>
        </div>

        <span
          className={[
            'inline-flex w-fit shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold',
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

      <div className="relative z-10 mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
        <DashboardContextMetric
          label="Public statuses"
          value={
            publicCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description={
            hasPublicReputation
              ? 'Earned category statuses available for public identity.'
              : 'No earned public category status yet.'
          }
        />

        <DashboardContextMetric
          label="Ranking eligible"
          value={
            summary.eligibleCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description="Scoped rows that have earned status. Publication still depends on population size."
        />

        <DashboardContextMetric
          label="Published ranks"
          value={
            summary.rankedCategoryCount.toLocaleString(
              'en-US'
            )
          }
          description="Exact ranking positions currently present in owner data."
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
    <div className="min-w-0 rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
      <p className="text-xl font-semibold text-white">
        {value}
      </p>

      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>

      <p className="mt-2 text-[10px] leading-4 text-neutral-600">
        {description}
      </p>
    </div>
  )
}

function PublicStatusExplanation() {
  return (
    <div className="mt-4 grid min-w-0 gap-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4 sm:grid-cols-3">
      <StatusStage
        step="1"
        label="Status"
        description="Earned after the category’s minimum verified evidence is satisfied."
      />

      <StatusStage
        step="2"
        label="Eligibility"
        description="Reached after the stricter leaderboard evidence requirement is satisfied."
      />

      <StatusStage
        step="3"
        label="Published rank"
        description="Displayed only after enough eligible creators exist for a defensible comparison."
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
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-[10px] font-bold text-cyan-300">
        {step}
      </span>

      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">
          {label}
        </p>

        <p className="mt-1 text-[10px] leading-4 text-neutral-600">
          {description}
        </p>
      </div>
    </div>
  )
}

function OwnerDetailDisclosure() {
  return (
    <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3">
      <p className="text-xs font-medium text-neutral-300">
        Why several rows can represent
        the same activity
      </p>

      <p className="mt-1 text-[11px] leading-5 text-neutral-600">
        One verified venue or completed
        Flow may support several
        categories, and the same category
        may have separate city and global
        rows. Do not add these rows
        together to calculate your total
        footprint.
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
      className="relative w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-neutral-800 bg-gradient-to-br from-cyan-500/[0.06] via-neutral-950 to-black p-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent"
      />

      <div className="relative z-10">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                {scopeLabel}
              </p>

              <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                {category.scope}
              </span>
            </div>

            <h3 className="mt-2 break-words text-lg font-semibold tracking-tight text-white">
              {
                category.categoryLabel
              }
            </h3>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Category-specific earned
              reputation
            </p>
          </div>

          <span
            className={[
              'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold',
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

        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
              Category score
            </p>

            <p className="mt-1 truncate text-2xl font-semibold text-white">
              {formatNumber(
                category.reputationScore,
                1
              )}
            </p>

            <p className="mt-1 text-[10px] leading-4 text-neutral-600">
              Applies only to this
              category and scope.
            </p>
          </div>

          <div
            className={[
              'min-w-0 rounded-2xl border px-4 py-3',
              rankingState.published
                ? 'border-cyan-500/20 bg-cyan-500/[0.05]'
                : 'border-neutral-800 bg-black/30',
            ].join(' ')}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
              Public standing
            </p>

            <p
              className={[
                'mt-1 break-words text-sm font-semibold leading-5',
                rankingState.published
                  ? 'text-cyan-300'
                  : 'text-neutral-300',
              ].join(' ')}
            >
              {
                rankingState.label
              }
            </p>

            <p className="mt-1 text-[10px] leading-4 text-neutral-600">
              {
                rankingState.description
              }
            </p>
          </div>
        </div>

        {evidence.length > 0 ? (
          <div className="mt-4 border-t border-neutral-800/80 pt-4">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
                Scoped supporting
                evidence
              </p>

              <p className="text-[9px] text-neutral-600">
                Not creator-wide totals
              </p>
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
              {evidence.map(
                (metric) => (
                  <div
                    key={metric.label}
                    className="min-w-0 rounded-xl border border-neutral-800 bg-black/25 px-3 py-2.5"
                  >
                    <p className="truncate text-sm font-semibold text-white">
                      {metric.value.toLocaleString(
                        'en-US'
                      )}
                    </p>

                    <p className="mt-1 truncate text-[10px] leading-4 text-neutral-500">
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            Owner summary
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Summary values avoid adding
            overlapping category and
            geographic rows together.
          </p>
        </div>
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map(
          (metric) => (
            <div
              key={metric.label}
              className="min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3"
            >
              <dd className="truncate text-lg font-semibold text-white">
                {metric.value}
              </dd>

              <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                {metric.label}
              </dt>

              <p className="mt-2 text-[9px] leading-4 text-neutral-600">
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
    <article className="w-full min-w-0 overflow-hidden rounded-[1.5rem] border border-neutral-800 bg-neutral-950/80">
      <div className="flex min-w-0 flex-col gap-4 border-b border-neutral-800/80 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
              {detail.scope ===
              'city'
                ? detail.cityLabel ??
                  detail.cityKey ??
                  'City'
                : 'Global'}
            </p>

            <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              {detail.scope}
            </span>

            <span className="rounded-full border border-neutral-800 bg-black/30 px-2 py-0.5 text-[9px] font-medium text-neutral-600">
              Owner only
            </span>
          </div>

          <h3 className="mt-2 break-words text-lg font-semibold text-white">
            {
              detail.categoryLabel
            }
          </h3>

          <p className="mt-1 text-xs text-neutral-500">
            Category ID:{' '}
            <span className="font-mono text-neutral-400">
              {
                detail.categoryId
              }
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
            {formatNumber(
              detail.reputationScore,
              1
            )}{' '}
            score
          </span>

          <span
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-semibold',
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
              Scoped evidence
            </p>

            <p className="text-[9px] text-neutral-600">
              Category and scope
              specific
            </p>
          </div>

          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
            {evidence.map(
              (metric) => (
                <div
                  key={metric.label}
                  className="min-w-0 rounded-xl border border-neutral-800 bg-black/25 px-3 py-2.5"
                >
                  <p className="truncate text-sm font-semibold text-white">
                    {metric.value.toLocaleString(
                      'en-US'
                    )}
                  </p>

                  <p className="mt-1 truncate text-[10px] text-neutral-500">
                    {metric.label}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        <div
          className={[
            'min-w-0 rounded-2xl border p-4',
            rankingState.published
              ? 'border-cyan-500/20 bg-cyan-500/[0.04]'
              : 'border-neutral-800 bg-black/25',
          ].join(' ')}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
            Ranking state
          </p>

          <p
            className={[
              'mt-2 break-words text-sm font-semibold leading-5',
              rankingState.published
                ? 'text-cyan-300'
                : 'text-neutral-300',
            ].join(' ')}
          >
            {rankingState.label}
          </p>

          <p className="mt-1 text-[10px] leading-4 text-neutral-600">
            {
              rankingState.description
            }
          </p>

          <dl className="mt-4 space-y-2 border-t border-neutral-800/80 pt-4">
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

      <div className="grid min-w-0 gap-3 border-t border-neutral-800/80 px-4 py-3 text-[11px] text-neutral-600 sm:grid-cols-2 sm:px-5">
        <p>
          Score calculated:{' '}
          <span className="text-neutral-500">
            {formatTimestamp(
              detail.calculatedAt
            )}
          </span>
        </p>

        <p>
          Population calculated:{' '}
          <span className="text-neutral-500">
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
      <dt className="text-xs text-neutral-600">
        {label}
      </dt>

      <dd className="truncate text-xs font-medium text-neutral-300">
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
        'relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-neutral-800 bg-gradient-to-br from-neutral-950 via-black to-cyan-950/20 p-5 sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
      />

      <div className="relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
          My reputation
        </p>

        <h2
          id="empty-reputation-dashboard-title"
          className="mt-2 text-xl font-semibold text-white"
        >
          No reputation yet
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
          Build your Roam reputation by
          recording verified venue
          visits. Completed Flows,
          useful public collections, and
          public snapshots can strengthen
          category evidence, but they do
          not replace verified venue
          breadth.
        </p>

        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
          <EmptyProgressStage
            number="1"
            title="Build local expertise"
            description="Record genuine geo-verified visits across relevant venues."
          />

          <EmptyProgressStage
            number="2"
            title="Earn category status"
            description="Meet the verified and weighted evidence minimum for a category."
          />

          <EmptyProgressStage
            number="3"
            title="Enter rankings"
            description="Meet ranking evidence requirements and wait for a defensible creator population."
          />
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/25 p-4">
          <p className="text-sm font-medium text-neutral-300">
            Your next step
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Complete a verified visit at
            a qualifying venue. Progress
            will appear here after the
            reputation snapshot is
            rebuilt.
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
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-neutral-800 bg-black/25 p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-xs font-bold text-cyan-300">
        {number}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">
          {title}
        </p>

        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
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
      <div className="animate-pulse rounded-[1.75rem] border border-neutral-800 bg-neutral-950/80 p-5">
        <div className="h-3 w-32 rounded bg-neutral-800" />
        <div className="mt-3 h-7 w-64 max-w-full rounded bg-neutral-800" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-neutral-900" />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map(
            (item) => (
              <div
                key={item}
                className="h-24 rounded-2xl border border-neutral-800 bg-black/25"
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
              className="h-24 animate-pulse rounded-2xl border border-neutral-800 bg-neutral-950/80"
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
      ? 'border-red-900/50 bg-red-950/20 text-red-200'
      : 'border-amber-500/20 bg-amber-500/[0.06] text-amber-200'

  return (
    <div
      role={
        tone === 'error'
          ? 'alert'
          : 'status'
      }
      className={[
        'mt-4 rounded-2xl border px-4 py-3',
        styles,
      ].join(' ')}
    >
      <p className="text-sm font-semibold">
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
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-400">
        {eyebrow}
      </p>

      <h2
        id={id}
        className="mt-2 text-xl font-semibold tracking-tight text-white"
      >
        {title}
      </h2>

      <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-400">
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