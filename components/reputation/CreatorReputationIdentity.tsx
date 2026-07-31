import type {
  PublicCreatorReputationSnapshot,
} from '@/lib/reputation/publicTypes'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CreatorReputationIdentityProps = {
  reputation:
    | PublicCreatorReputationSnapshot
    | null
    | undefined

  /**
   * Optional creator name used only for accessible labels.
   */
  creatorName?: string | null

  /**
   * Limits the number of category statuses shown.
   *
   * Defaults to 3 to keep the identity treatment concise.
   */
  categoryLimit?: number

  /**
   * Use the compact treatment on constrained profile surfaces.
   */
  compact?: boolean

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
  | null

type NormalizedReputationIdentity = {
  headline: string | null
  summary: string | null
  highestLevel: ReputationLevel | null

  primaryCityLabel: string | null
  primaryCategoryLabel: string | null
  primaryCategoryScore: number | null

  verifiedVenueCount: number
  publicCollectionCount: number
  publicSnapshotCount: number
  completedFlowCount: number

  primaryCityRank: number | null
  primaryCityPercentile: number | null
  primaryCityEligibleCreatorCount: number | null

  categories: NormalizedReputationCategory[]
}

type NormalizedReputationCategory = {
  key: string
  categoryId: string | null
  categoryLabel: string
  categoryShortLabel: string
  primaryLabel: string
  scope: ReputationScope
  level: ReputationLevel | null
  score: number | null
  rank: number | null
  eligibleCreatorCount: number | null
  percentile: number | null
  rankLabel: string | null
  cityLabel: string | null
  verifiedVenueCount: number | null
  weightedVenueCount: number | null
}

/* =========================================================
 * Canonical display definitions
 * ======================================================= */

const REPUTATION_LEVEL_LABELS = {
  unranked: 'Building',
  emerging: 'Emerging',
  established: 'Established',
  expert: 'Expert',
  elite: 'Elite',
} as const satisfies Record<
  ReputationLevel,
  string
>

const REPUTATION_LEVEL_STYLES = {
  unranked:
    'border-neutral-700 bg-neutral-900 text-neutral-400',

  emerging:
    'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',

  established:
    'border-indigo-500/25 bg-indigo-500/10 text-indigo-200',

  expert:
    'border-violet-500/30 bg-violet-500/10 text-violet-200',

  elite:
    'border-amber-400/30 bg-amber-400/10 text-amber-200',
} as const satisfies Record<
  ReputationLevel,
  string
>

const REPUTATION_LEVEL_ACCENTS = {
  unranked:
    'from-neutral-500/[0.05]',

  emerging:
    'from-cyan-500/[0.08]',

  established:
    'from-indigo-500/[0.08]',

  expert:
    'from-violet-500/[0.08]',

  elite:
    'from-amber-400/[0.08]',
} as const satisfies Record<
  ReputationLevel,
  string
>

/* =========================================================
 * Component
 * ======================================================= */

export default function CreatorReputationIdentity({
  reputation,
  creatorName,
  categoryLimit = 3,
  compact = false,
  className,
}: CreatorReputationIdentityProps) {
  const normalized =
    normalizeReputationIdentity(
      reputation
    )

  if (!normalized) {
    return null
  }

  const normalizedCreatorName =
    normalizeNullableText(
      creatorName
    )

  const visibleCategories =
    normalized.categories.slice(
      0,
      normalizeCategoryLimit(
        categoryLimit
      )
    )

  const identityLabel =
    normalizedCreatorName
      ? `${normalizedCreatorName}'s earned Roam reputation`
      : 'Creator earned Roam reputation'

  const identityMetrics =
    buildIdentityMetrics(
      normalized
    )

  const rankingStatus =
    buildIdentityRankingStatus(
      normalized
    )

  const highestLevel =
    normalized.highestLevel ??
    'unranked'

  return (
    <section
      aria-label={identityLabel}
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-cyan-500/20',
        'bg-gradient-to-br via-neutral-950/95 to-indigo-500/[0.07]',
        REPUTATION_LEVEL_ACCENTS[
          highestLevel
        ],
        'shadow-xl shadow-black/20',
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <IdentityBackground />

      <div className="relative z-10 min-w-0">
        <div
          className={[
            'flex min-w-0 gap-4',
            compact
              ? 'flex-col'
              : 'flex-col sm:flex-row sm:items-start sm:justify-between',
          ].join(' ')}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
              Public reputation identity
            </p>

            <h2
              className={[
                'mt-2 break-words font-semibold tracking-tight text-white',
                compact
                  ? 'text-lg'
                  : 'text-xl sm:text-2xl',
              ].join(' ')}
            >
              {normalized.headline ??
                buildFallbackHeadline(
                  normalized
                )}
            </h2>

            {normalized.summary ? (
              <p
                className={[
                  'mt-2 max-w-2xl break-words text-neutral-400',
                  compact
                    ? 'text-xs leading-5'
                    : 'text-sm leading-6',
                ].join(' ')}
              >
                {normalized.summary}
              </p>
            ) : (
              <p
                className={[
                  'mt-2 max-w-2xl text-neutral-500',
                  compact
                    ? 'text-xs leading-5'
                    : 'text-sm leading-6',
                ].join(' ')}
              >
                Earned status based on
                category-specific,
                verified Roam activity.
              </p>
            )}
          </div>

          <ReputationLevelBadge
            level={highestLevel}
          />
        </div>

        {identityMetrics.length >
        0 ? (
          <dl
            aria-label="Creator-wide reputation evidence"
            className={[
              'mt-5 grid min-w-0 gap-3',
              compact
                ? 'grid-cols-2'
                : 'grid-cols-2 lg:grid-cols-4',
            ].join(' ')}
          >
            {identityMetrics.map(
              (metric) => (
                <IdentityMetric
                  key={metric.label}
                  label={
                    metric.label
                  }
                  value={
                    metric.value
                  }
                  detail={
                    metric.detail
                  }
                />
              )
            )}
          </dl>
        ) : null}

        <IdentityScopeDisclosure
          primaryCityLabel={
            normalized.primaryCityLabel
          }
          primaryCategoryLabel={
            normalized.primaryCategoryLabel
          }
          compact={compact}
        />

        <IdentityRankingStatus
          status={rankingStatus}
          compact={compact}
        />

        {visibleCategories.length >
        0 ? (
          <div className="mt-5 border-t border-neutral-800/80 pt-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Strongest scoped
                  statuses
                </p>

                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-neutral-600">
                  Each status below
                  represents one specific
                  category and geographic
                  scope. Its venue count
                  is not the creator’s
                  total footprint.
                </p>
              </div>

              {normalized.categories
                .length >
              visibleCategories.length ? (
                <p className="shrink-0 rounded-full border border-neutral-800 bg-black/25 px-2.5 py-1 text-[10px] font-medium text-neutral-500">
                  Showing{' '}
                  {
                    visibleCategories.length
                  }{' '}
                  of{' '}
                  {
                    normalized.categories
                      .length
                  }
                </p>
              ) : null}
            </div>

            <div
              className={[
                'mt-3 grid min-w-0 gap-3',
                compact
                  ? 'grid-cols-1'
                  : 'sm:grid-cols-2 lg:grid-cols-3',
              ].join(' ')}
            >
              {visibleCategories.map(
                (category) => (
                  <ReputationCategoryCard
                    key={
                      category.key
                    }
                    category={
                      category
                    }
                  />
                )
              )}
            </div>
          </div>
        ) : null}

        <IdentityDisclosure />
      </div>
    </section>
  )
}

/* =========================================================
 * Decorative background
 * ======================================================= */

function IdentityBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-500/[0.06] blur-3xl" />

      <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-indigo-500/[0.05] blur-3xl" />
    </div>
  )
}

/* =========================================================
 * Presentation helpers
 * ======================================================= */

function ReputationLevelBadge({
  level,
}: {
  level: ReputationLevel
}) {
  return (
    <span
      className={[
        'inline-flex w-fit shrink-0 items-center rounded-full border',
        'px-3 py-1.5 text-xs font-semibold',
        REPUTATION_LEVEL_STYLES[
          level
        ],
      ].join(' ')}
    >
      {
        REPUTATION_LEVEL_LABELS[
          level
        ]
      }
    </span>
  )
}

function IdentityMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-neutral-800 bg-black/30 px-4 py-3">
      <dd className="truncate text-lg font-semibold text-white">
        {value}
      </dd>

      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
        {label}
      </dt>

      <p className="mt-1 text-[10px] leading-4 text-neutral-600">
        {detail}
      </p>
    </div>
  )
}

function IdentityScopeDisclosure({
  primaryCityLabel,
  primaryCategoryLabel,
  compact,
}: {
  primaryCityLabel: string | null
  primaryCategoryLabel: string | null
  compact: boolean
}) {
  if (
    !primaryCityLabel &&
    !primaryCategoryLabel
  ) {
    return null
  }

  return (
    <div
      className={[
        'mt-4 grid min-w-0 gap-3 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04]',
        compact
          ? 'p-3'
          : 'p-4 sm:grid-cols-2',
      ].join(' ')}
    >
      {primaryCityLabel ? (
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
            Primary reputation city
          </p>

          <p className="mt-1 break-words text-sm font-semibold text-white">
            {primaryCityLabel}
          </p>

          <p className="mt-1 text-[11px] leading-5 text-neutral-600">
            The strongest city scope
            represented in this
            reputation snapshot.
          </p>
        </div>
      ) : null}

      {primaryCategoryLabel ? (
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
            Strongest category
          </p>

          <p className="mt-1 break-words text-sm font-semibold text-white">
            {primaryCategoryLabel}
          </p>

          <p className="mt-1 text-[11px] leading-5 text-neutral-600">
            The highest-performing
            qualifying category, not a
            creator-wide activity total.
          </p>
        </div>
      ) : null}
    </div>
  )
}

type IdentityRankingStatus = {
  headline: string
  detail: string
  published: boolean
}

function IdentityRankingStatus({
  status,
  compact,
}: {
  status: IdentityRankingStatus
  compact: boolean
}) {
  return (
    <div
      className={[
        'mt-4 flex min-w-0 gap-3 rounded-2xl border',
        status.published
          ? 'border-cyan-500/20 bg-cyan-500/[0.05]'
          : 'border-neutral-800 bg-black/25',
        compact
          ? 'p-3'
          : 'p-4',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm',
          status.published
            ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
            : 'border-neutral-800 bg-neutral-900 text-neutral-500',
        ].join(' ')}
      >
        {status.published
          ? '↗'
          : '◎'}
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
          Public ranking
        </p>

        <p
          className={[
            'mt-1 break-words text-sm font-semibold',
            status.published
              ? 'text-cyan-300'
              : 'text-neutral-300',
          ].join(' ')}
        >
          {status.headline}
        </p>

        <p className="mt-1 text-[11px] leading-5 text-neutral-600">
          {status.detail}
        </p>
      </div>
    </div>
  )
}

function ReputationCategoryCard({
  category,
}: {
  category:
    NormalizedReputationCategory
}) {
  const rankingStatus =
    buildCategoryRankingStatus(
      category
    )

  const scopeLabel =
    buildCategoryScopeLabel(
      category
    )

  return (
    <article className="relative min-w-0 overflow-hidden rounded-2xl border border-neutral-800 bg-black/30 p-4">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
      />

      <div className="relative min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
              {scopeLabel}
            </p>

            <h3 className="mt-2 break-words text-sm font-semibold leading-5 text-white">
              {category.primaryLabel}
            </h3>
          </div>

          {category.level ? (
            <span
              className={[
                'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                REPUTATION_LEVEL_STYLES[
                  category.level
                ],
              ].join(' ')}
            >
              {
                REPUTATION_LEVEL_LABELS[
                  category.level
                ]
              }
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid min-w-0 grid-cols-2 gap-2">
          {category.verifiedVenueCount !==
          null ? (
            <CategoryMetric
              label="Scoped venues"
              value={formatNumber(
                category.verifiedVenueCount,
                0
              )}
            />
          ) : null}

          {category.score !==
          null ? (
            <CategoryMetric
              label="Category score"
              value={formatNumber(
                category.score,
                1
              )}
              accent
            />
          ) : null}
        </dl>

        <div
          className={[
            'mt-3 rounded-xl border px-3 py-2.5',
            rankingStatus.published
              ? 'border-cyan-500/15 bg-cyan-500/[0.04]'
              : 'border-neutral-800 bg-black/20',
          ].join(' ')}
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
            Standing
          </p>

          <p
            className={[
              'mt-1 break-words text-xs font-medium leading-5',
              rankingStatus.published
                ? 'text-cyan-300'
                : 'text-neutral-500',
            ].join(' ')}
          >
            {
              rankingStatus.label
            }
          </p>
        </div>
      </div>
    </article>
  )
}

function CategoryMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-800 bg-black/25 px-3 py-2.5">
      <dd
        className={[
          'truncate text-sm font-semibold',
          accent
            ? 'text-cyan-300'
            : 'text-white',
        ].join(' ')}
      >
        {value}
      </dd>

      <dt className="mt-1 text-[9px] uppercase tracking-[0.1em] text-neutral-600">
        {label}
      </dt>
    </div>
  )
}

function IdentityDisclosure() {
  return (
    <p className="mt-5 border-t border-neutral-800/70 pt-4 text-[10px] leading-5 text-neutral-600">
      Creator-wide evidence summarizes
      total qualifying activity. Category
      cards show only the evidence
      attributed to that exact category
      and scope. Published ranking claims
      require a sufficiently large
      eligible comparison population.
    </p>
  )
}

/* =========================================================
 * Identity summaries
 * ======================================================= */

function buildIdentityMetrics(
  reputation:
    NormalizedReputationIdentity
): Array<{
  label: string
  value: string
  detail: string
}> {
  const metrics: Array<{
    label: string
    value: string
    detail: string
  }> = []

  if (
    reputation.verifiedVenueCount >
    0
  ) {
    metrics.push({
      label:
        'Verified venues',

      value:
        reputation.verifiedVenueCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Creator-wide qualifying venue evidence.',
    })
  }

  if (
    reputation.completedFlowCount >
    0
  ) {
    metrics.push({
      label:
        'Completed Flows',

      value:
        reputation.completedFlowCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Creator-wide qualifying completed activity.',
    })
  }

  if (
    reputation.publicCollectionCount >
    0
  ) {
    metrics.push({
      label:
        'Public collections',

      value:
        reputation.publicCollectionCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Qualifying public curation across categories.',
    })
  }

  if (
    reputation.publicSnapshotCount >
    0
  ) {
    metrics.push({
      label:
        'Public snapshots',

      value:
        reputation.publicSnapshotCount.toLocaleString(
          'en-US'
        ),

      detail:
        'Qualifying publicly shared Flow records.',
    })
  }

  return metrics
}

function buildIdentityRankingStatus(
  reputation:
    NormalizedReputationIdentity
): IdentityRankingStatus {
  if (
    reputation.primaryCityRank !==
      null &&
    reputation.primaryCityEligibleCreatorCount !==
      null &&
    reputation.primaryCityEligibleCreatorCount >
      0
  ) {
    const citySuffix =
      reputation.primaryCityLabel
        ? ` in ${reputation.primaryCityLabel}`
        : ''

    return {
      headline:
        `#${reputation.primaryCityRank.toLocaleString(
          'en-US'
        )} of ${reputation.primaryCityEligibleCreatorCount.toLocaleString(
          'en-US'
        )}${citySuffix}`,

      detail:
        'This ranking is published against an eligible creator comparison population.',

      published:
        true,
    }
  }

  if (
    reputation.primaryCityRank !==
    null
  ) {
    const citySuffix =
      reputation.primaryCityLabel
        ? ` in ${reputation.primaryCityLabel}`
        : ''

    return {
      headline:
        `#${reputation.primaryCityRank.toLocaleString(
          'en-US'
        )}${citySuffix}`,

      detail:
        'This is the creator’s strongest published city ranking.',

      published:
        true,
    }
  }

  if (
    reputation.primaryCityPercentile !==
      null
  ) {
    const citySuffix =
      reputation.primaryCityLabel
        ? ` in ${reputation.primaryCityLabel}`
        : ''

    return {
      headline:
        `${formatPercentileStanding(
          reputation.primaryCityPercentile
        )}${citySuffix}`,

      detail:
        'This percentile is published only after population safeguards are satisfied.',

      published:
        true,
    }
  }

  const earnedCategory =
    reputation.categories.find(
      (category) =>
        category.level !==
          null &&
        category.level !==
          'unranked'
    )

  if (earnedCategory) {
    return {
      headline:
        'Status earned · Public rank not yet available',

      detail:
        'The creator has earned category status, but the eligible comparison population is still too small for a defensible public rank.',

      published:
        false,
    }
  }

  return {
    headline:
      'Reputation is still building',

    detail:
      'Verified category activity is required before a public status or ranking can be displayed.',

    published:
      false,
  }
}

function buildFallbackHeadline(
  reputation:
    NormalizedReputationIdentity
): string {
  if (
    reputation.primaryCityLabel &&
    reputation.primaryCategoryLabel &&
    reputation.highestLevel
  ) {
    return [
      reputation.primaryCityLabel,
      reputation.primaryCategoryLabel,
      REPUTATION_LEVEL_LABELS[
        reputation.highestLevel
      ],
    ].join(' ')
  }

  if (
    reputation.primaryCategoryLabel &&
    reputation.highestLevel
  ) {
    return [
      reputation.primaryCategoryLabel,
      REPUTATION_LEVEL_LABELS[
        reputation.highestLevel
      ],
    ].join(' ')
  }

  if (
    reputation.highestLevel
  ) {
    return `${REPUTATION_LEVEL_LABELS[
      reputation.highestLevel
    ]} Explorer`
  }

  return 'Roam creator reputation'
}

function buildCategoryScopeLabel(
  category:
    NormalizedReputationCategory
): string {
  if (
    category.scope ===
    'city'
  ) {
    return [
      category.cityLabel ??
        'City',
      category.categoryShortLabel,
    ].join(' · ')
  }

  if (
    category.scope ===
    'global'
  ) {
    return `Global · ${category.categoryShortLabel}`
  }

  return category.categoryShortLabel
}

function buildCategoryRankingStatus(
  category:
    NormalizedReputationCategory
): {
  label: string
  published: boolean
} {
  if (category.rankLabel) {
    return {
      label:
        category.rankLabel,

      published:
        true,
    }
  }

  if (
    category.rank !== null &&
    category.eligibleCreatorCount !==
      null &&
    category.eligibleCreatorCount >
      0
  ) {
    return {
      label:
        `#${category.rank.toLocaleString(
          'en-US'
        )} of ${category.eligibleCreatorCount.toLocaleString(
          'en-US'
        )}`,

      published:
        true,
    }
  }

  if (
    category.rank !== null
  ) {
    return {
      label:
        `Rank #${category.rank.toLocaleString(
          'en-US'
        )}`,

      published:
        true,
    }
  }

  if (
    category.percentile !==
    null
  ) {
    return {
      label:
        formatPercentileStanding(
          category.percentile
        ),

      published:
        true,
    }
  }

  if (
    category.level &&
    category.level !==
      'unranked'
  ) {
    return {
      label:
        'Status earned · Ranking population still building',

      published:
        false,
    }
  }

  if (
    category.verifiedVenueCount !==
      null &&
    category.verifiedVenueCount >
      0
  ) {
    return {
      label:
        `${category.verifiedVenueCount.toLocaleString(
          'en-US'
        )} scoped ${
          category.verifiedVenueCount ===
          1
            ? 'venue'
            : 'venues'
        } recorded · Status still building`,

      published:
        false,
    }
  }

  return {
    label:
      'Verified category activity is still building',

    published:
      false,
  }
}

/* =========================================================
 * Reputation normalization
 * ======================================================= */

function normalizeReputationIdentity(
  value: unknown
): NormalizedReputationIdentity | null {
  if (!isRecord(value)) {
    return null
  }

  const evidence =
    isRecord(
      value.evidence
    )
      ? value.evidence
      : null

  const primaryCategory =
    isRecord(
      value.primaryCategory
    )
      ? value.primaryCategory
      : isRecord(
          value.primary_category
        )
        ? value.primary_category
        : null

  const headline =
    normalizeNullableText(
      firstDefined(
        value.headline,
        value.primaryLabel,
        value.primary_label,
        primaryCategory
          ?.primaryLabel,
        primaryCategory
          ?.primary_label
      )
    )

  const summary =
    normalizeNullableText(
      firstDefined(
        value.summary,
        value.description
      )
    )

  const highestLevel =
    normalizeReputationLevel(
      firstDefined(
        value.highestLevel,
        value.highest_level,
        value.reputationTier,
        value.reputation_tier,
        value.reputationLevel,
        value.reputation_level,
        primaryCategory
          ?.reputationLevel,
        primaryCategory
          ?.reputation_level
      )
    )

  const primaryCityLabel =
    normalizeNullableText(
      firstDefined(
        value.primaryCityLabel,
        value.primary_city_label,
        primaryCategory
          ?.cityLabel,
        primaryCategory
          ?.city_label
      )
    )

  const primaryCategoryLabel =
    normalizeNullableText(
      firstDefined(
        primaryCategory
          ?.categoryShortLabel,
        primaryCategory
          ?.category_short_label,
        primaryCategory
          ?.categoryLabel,
        primaryCategory
          ?.category_label
      )
    )

  const primaryCategoryScore =
    normalizeNonNegativeNumber(
      firstDefined(
        primaryCategory
          ?.reputationScore,
        primaryCategory
          ?.reputation_score,
        primaryCategory
          ?.score,
        value.reputationScore,
        value.reputation_score,
        value.score
      )
    )

  const primaryCityRank =
    normalizePositiveInteger(
      firstDefined(
        primaryCategory?.rank,
        value.primaryCityRank,
        value.primary_city_rank,
        value.cityRank,
        value.city_rank
      )
    )

  const primaryCityPercentile =
    normalizePercentage(
      firstDefined(
        primaryCategory
          ?.topPercent,
        primaryCategory
          ?.top_percent,
        primaryCategory
          ?.percentile,
        value.primaryCityPercentile,
        value.primary_city_percentile,
        value.cityPercentile,
        value.city_percentile
      )
    )

  const primaryCityEligibleCreatorCount =
    normalizeNonNegativeInteger(
      firstDefined(
        primaryCategory
          ?.eligibleCreatorCount,
        primaryCategory
          ?.eligible_creator_count,
        primaryCategory
          ?.eligibleUserCount,
        primaryCategory
          ?.eligible_user_count,
        value.primaryCityEligibleCreatorCount,
        value.primary_city_eligible_creator_count
      )
    )

  const verifiedVenueCount =
    normalizeNonNegativeInteger(
      firstDefined(
        evidence
          ?.verifiedVenueCount,
        evidence
          ?.verified_venue_count,
        value.verifiedVenueCount,
        value.verified_venue_count
      )
    ) ?? 0

  const publicCollectionCount =
    normalizeNonNegativeInteger(
      firstDefined(
        evidence
          ?.publicCollectionCount,
        evidence
          ?.public_collection_count,
        value.publicCollectionCount,
        value.public_collection_count
      )
    ) ?? 0

  const publicSnapshotCount =
    normalizeNonNegativeInteger(
      firstDefined(
        evidence
          ?.publicSnapshotCount,
        evidence
          ?.public_snapshot_count,
        value.publicSnapshotCount,
        value.public_snapshot_count
      )
    ) ?? 0

  const completedFlowCount =
    normalizeNonNegativeInteger(
      firstDefined(
        evidence
          ?.completedFlowCount,
        evidence
          ?.completed_flow_count,
        value.completedFlowCount,
        value.completed_flow_count
      )
    ) ?? 0

  const categories =
    normalizeCategories(
      firstDefined(
        value.categories,
        value.topCategoryStatuses,
        value.top_category_statuses
      )
    )

  if (
    !headline &&
    !summary &&
    !highestLevel &&
    !primaryCityLabel &&
    !primaryCategoryLabel &&
    primaryCategoryScore ===
      null &&
    verifiedVenueCount ===
      0 &&
    publicCollectionCount ===
      0 &&
    publicSnapshotCount ===
      0 &&
    completedFlowCount ===
      0 &&
    categories.length === 0
  ) {
    return null
  }

  return {
    headline,
    summary,
    highestLevel,

    primaryCityLabel,
    primaryCategoryLabel,
    primaryCategoryScore,

    verifiedVenueCount,
    publicCollectionCount,
    publicSnapshotCount,
    completedFlowCount,

    primaryCityRank,
    primaryCityPercentile,
    primaryCityEligibleCreatorCount,

    categories,
  }
}

function normalizeCategories(
  value: unknown
): NormalizedReputationCategory[] {
  if (!Array.isArray(value)) {
    return []
  }

  const categories:
    NormalizedReputationCategory[] =
    []

  const seen =
    new Set<string>()

  for (
    const rawCategory of
      value
  ) {
    if (
      !isRecord(
        rawCategory
      )
    ) {
      continue
    }

    const nestedCategory =
      isRecord(
        rawCategory.category
      )
        ? rawCategory.category
        : null

    const nestedTier =
      isRecord(
        rawCategory.tier
      )
        ? rawCategory.tier
        : null

    const nestedRanking =
      isRecord(
        rawCategory.ranking
      )
        ? rawCategory.ranking
        : null

    const nestedLabels =
      isRecord(
        rawCategory.labels
      )
        ? rawCategory.labels
        : null

    const categoryId =
      normalizeNullableText(
        firstDefined(
          rawCategory.categoryId,
          rawCategory.category_id,
          nestedCategory?.id
        )
      )

    const categoryLabel =
      normalizeNullableText(
        firstDefined(
          rawCategory.categoryLabel,
          rawCategory.category_label,
          nestedCategory?.label,
          rawCategory.label
        )
      )

    const categoryShortLabel =
      normalizeNullableText(
        firstDefined(
          rawCategory.categoryShortLabel,
          rawCategory.category_short_label,
          nestedCategory?.shortLabel,
          nestedCategory?.short_label
        )
      ) ??
      (
        categoryLabel
          ? removeExplorerSuffix(
              categoryLabel
            )
          : null
      )

    const primaryLabel =
      normalizeNullableText(
        firstDefined(
          rawCategory.primaryLabel,
          rawCategory.primary_label,
          nestedLabels?.primary,
          categoryLabel
        )
      )

    if (
      !categoryLabel ||
      !categoryShortLabel ||
      !primaryLabel
    ) {
      continue
    }

    const scope =
      normalizeScope(
        rawCategory.scope
      )

    const cityKey =
      normalizeNullableText(
        firstDefined(
          rawCategory.cityKey,
          rawCategory.city_key
        )
      )

    const cityLabel =
      normalizeNullableText(
        firstDefined(
          rawCategory.cityLabel,
          rawCategory.city_label,
          nestedLabels?.city
        )
      )

    const comparisonKey = [
      categoryId ??
        categoryLabel.toLocaleLowerCase(
          'en-US'
        ),
      scope,
      cityKey,
    ]
      .filter(Boolean)
      .join(':')

    if (
      seen.has(
        comparisonKey
      )
    ) {
      continue
    }

    seen.add(
      comparisonKey
    )

    categories.push({
      key:
        comparisonKey,

      categoryId,

      categoryLabel,

      categoryShortLabel,

      primaryLabel,

      scope,

      level:
        normalizeReputationLevel(
          firstDefined(
            rawCategory.reputationLevel,
            rawCategory.reputation_level,
            rawCategory.level,
            nestedTier?.level,
            nestedTier?.id
          )
        ),

      score:
        normalizeNonNegativeNumber(
          firstDefined(
            rawCategory.reputationScore,
            rawCategory.reputation_score,
            rawCategory.score
          )
        ),

      rank:
        normalizePositiveInteger(
          firstDefined(
            rawCategory.rank,
            rawCategory.cityRank,
            rawCategory.city_rank,
            nestedRanking?.rank
          )
        ),

      eligibleCreatorCount:
        normalizeNonNegativeInteger(
          firstDefined(
            rawCategory.eligibleCreatorCount,
            rawCategory.eligible_creator_count,
            rawCategory.eligibleUserCount,
            rawCategory.eligible_user_count,
            nestedRanking
              ?.eligibleCreatorCount,
            nestedRanking
              ?.eligible_creator_count,
            nestedRanking
              ?.eligibleUserCount,
            nestedRanking
              ?.eligible_user_count
          )
        ),

      percentile:
        normalizePercentage(
          firstDefined(
            rawCategory.percentile,
            rawCategory.topPercent,
            rawCategory.top_percent,
            nestedRanking?.percentile,
            nestedRanking?.topPercent,
            nestedRanking?.top_percent
          )
        ),

      rankLabel:
        normalizeNullableText(
          firstDefined(
            rawCategory.rankLabel,
            rawCategory.rank_label,
            nestedRanking?.label,
            nestedLabels?.ranking,
            nestedLabels?.rank
          )
        ),

      cityLabel,

      verifiedVenueCount:
        normalizeNonNegativeInteger(
          firstDefined(
            rawCategory.verifiedVenueCount,
            rawCategory.verified_venue_count,
            isRecord(
              rawCategory.evidence
            )
              ? rawCategory
                  .evidence
                  .verifiedVenueCount
              : null,
            isRecord(
              rawCategory.evidence
            )
              ? rawCategory
                  .evidence
                  .verified_venue_count
              : null
          )
        ),

      weightedVenueCount:
        normalizeNonNegativeNumber(
          firstDefined(
            rawCategory.weightedVenueCount,
            rawCategory.weighted_venue_count,
            isRecord(
              rawCategory.evidence
            )
              ? rawCategory
                  .evidence
                  .weightedVenueCount
              : null,
            isRecord(
              rawCategory.evidence
            )
              ? rawCategory
                  .evidence
                  .weighted_venue_count
              : null
          )
        ),
    })
  }

  return categories.sort(
    compareCategories
  )
}

function compareCategories(
  first:
    NormalizedReputationCategory,
  second:
    NormalizedReputationCategory
): number {
  const firstLevelRank =
    getLevelRank(
      first.level
    )

  const secondLevelRank =
    getLevelRank(
      second.level
    )

  if (
    firstLevelRank !==
    secondLevelRank
  ) {
    return (
      secondLevelRank -
      firstLevelRank
    )
  }

  if (
    first.score !== null &&
    second.score !== null &&
    first.score !==
      second.score
  ) {
    return (
      second.score -
      first.score
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

  return first.primaryLabel.localeCompare(
    second.primaryLabel,
    'en-US',
    {
      sensitivity:
        'base',
    }
  )
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeReputationLevel(
  value: unknown
): ReputationLevel | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
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
      'unranked' ||
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

  return null
}

function normalizeScope(
  value: unknown
): ReputationScope {
  if (
    value === 'global' ||
    value === 'city'
  ) {
    return value
  }

  return null
}

function getLevelRank(
  level:
    ReputationLevel | null
): number {
  if (level === 'elite') {
    return 4
  }

  if (level === 'expert') {
    return 3
  }

  if (
    level ===
    'established'
  ) {
    return 2
  }

  if (
    level ===
    'emerging'
  ) {
    return 1
  }

  return 0
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

  return normalized.length >
    0
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

function normalizeCategoryLimit(
  value: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 3
  }

  return Math.min(
    10,
    Math.max(
      1,
      Math.trunc(value)
    )
  )
}

function firstDefined(
  ...values: unknown[]
): unknown {
  for (
    const value of values
  ) {
    if (
      value !==
        undefined &&
      value !== null
    ) {
      return value
    }
  }

  return null
}

function removeExplorerSuffix(
  value: string
): string {
  const normalized =
    value
      .replace(
        /\s+explorer$/i,
        ''
      )
      .trim()

  return normalized ||
    value
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
    !Array.isArray(
      value
    )
  )
}

/* =========================================================
 * Formatting
 * ======================================================= */

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

function formatPercentileStanding(
  value: number
): string {
  const normalized =
    Math.min(
      100,
      Math.max(
        0,
        value
      )
    )

  return `Top ${formatNumber(
    normalized,
    normalized < 1
      ? 1
      : 0
  )}%`
}