import type {
  PublicCreatorCategoryReputation,
  PublicCreatorReputationCategorySummary,
} from '@/lib/reputation/publicTypes'

/* =========================================================
 * Public contract
 * ======================================================= */

export type CreatorReputationCardProps = {
  reputation:
    | PublicCreatorCategoryReputation
    | PublicCreatorReputationCategorySummary
    | null
    | undefined

  compact?: boolean
  showEvidence?: boolean
  showScore?: boolean
  className?: string
}

/* =========================================================
 * Internal contracts
 * ======================================================= */

type ReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type NormalizedReputationCard = {
  key: string
  categoryId: string | null
  categoryLabel: string
  categoryShortLabel: string
  primaryLabel: string
  secondaryLabel: string | null
  cityLabel: string | null
  scope: 'global' | 'city' | null
  level: ReputationLevel
  score: number | null
  rank: number | null
  eligibleCreatorCount: number | null
  topPercent: number | null
  rankLabel: string | null
  verifiedVenueCount: number | null
  weightedVenueCount: number | null
  publicCollectionCount: number | null
  curatedVenueCount: number | null
  publicSnapshotCount: number | null
  completedFlowCount: number | null
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

const LEVEL_STYLES = {
  unranked:
    'bg-white/[0.035] text-zinc-500 ring-1 ring-white/[0.065]',

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

const LEVEL_ACCENT_STYLES = {
  unranked:
    'from-white/[0.025]',

  emerging:
    'from-cyan-300/[0.055]',

  established:
    'from-indigo-400/[0.055]',

  expert:
    'from-violet-400/[0.055]',

  elite:
    'from-amber-300/[0.06]',
} as const satisfies Record<
  ReputationLevel,
  string
>

/* =========================================================
 * Component
 * ======================================================= */

export default function CreatorReputationCard({
  reputation,
  compact = false,
  showEvidence = true,
  showScore = true,
  className,
}: CreatorReputationCardProps) {
  const normalized =
    normalizeReputationCard(
      reputation
    )

  if (!normalized) {
    return null
  }

  const evidenceMetrics =
    buildEvidenceMetrics(
      normalized
    )

  const rankingSummary =
    buildRankingSummary(
      normalized
    )

  const scopeLabel =
    buildScopeLabel(
      normalized
    )

  const qualificationMessage =
    buildQualificationMessage(
      normalized
    )

  return (
    <article
      aria-label={`${normalized.primaryLabel} reputation`}
      className={[
        'relative w-full min-w-0 overflow-hidden rounded-[1.75rem]',
        'bg-gradient-to-br via-white/[0.025] to-transparent shadow-[0_22px_70px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]',
        LEVEL_ACCENT_STYLES[
          normalized.level
        ],
        compact
          ? 'p-4'
          : 'p-5 sm:p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-cyan-300/[0.04] blur-[80px]" />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      </div>

      <div className="relative min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                What they know
              </p>
            </div>

            <h3
              className={[
                'mt-3 break-words font-black tracking-[-0.03em] text-white',
                compact
                  ? 'text-lg'
                  : 'text-xl sm:text-[1.35rem]',
              ].join(' ')}
            >
              {
                normalized.primaryLabel
              }
            </h3>

            {normalized.secondaryLabel ? (
              <p className="mt-2 max-w-2xl break-words text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">
                {
                  normalized.secondaryLabel
                }
              </p>
            ) : null}
          </div>

          <ReputationLevelBadge
            level={normalized.level}
          />
        </div>

        <div className="mt-5 flex min-w-0 items-start gap-3 rounded-[1.4rem] bg-black/25 px-4 py-3.5 ring-1 ring-white/[0.055]">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.07] text-sm text-cyan-200 ring-1 ring-cyan-300/12"
          >
            ◎
          </span>

          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
              This reputation is for
            </p>

            <p className="mt-1 break-words text-sm font-black text-white">
              {scopeLabel}
            </p>

            <p className="mt-1 text-[11px] leading-5 text-zinc-600">
              Only activity relevant to this exact category and location contributes here.
            </p>
          </div>
        </div>

        {showScore &&
        normalized.score !==
          null ? (
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-[1.4rem] bg-black/25 px-4 py-4 ring-1 ring-white/[0.055]">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
                Reputation score
              </p>

              <p className="mt-2 truncate text-[2rem] font-black leading-none tracking-[-0.045em] text-white">
                {formatNumber(
                  normalized.score,
                  1
                )}
              </p>

              <p className="mt-2 text-[11px] leading-5 text-zinc-600">
                Strength of the verified evidence behind this reputation.
              </p>
            </div>

            <RankingStatus
              rankingSummary={
                rankingSummary
              }
              qualificationMessage={
                qualificationMessage
              }
              level={
                normalized.level
              }
            />
          </div>
        ) : (
          <RankingStatus
            rankingSummary={
              rankingSummary
            }
            qualificationMessage={
              qualificationMessage
            }
            level={
              normalized.level
            }
            className="mt-4"
          />
        )}

        {showEvidence &&
        evidenceMetrics.length >
          0 ? (
          <div className="mt-5 border-t border-white/[0.055] pt-5">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
                  Why they earned it
                </p>

                <p className="mt-1 text-[11px] leading-5 text-zinc-600">
                  The verified activity supporting this specific reputation.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white/[0.035] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600 ring-1 ring-white/[0.055]">
                {normalized.scope ===
                'city'
                  ? 'City · category'
                  : 'Global · category'}
              </span>
            </div>

            <div
              className={[
                'mt-3 grid min-w-0 gap-2.5',
                compact
                  ? 'grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3',
              ].join(' ')}
            >
              {evidenceMetrics.map(
                (metric) => (
                  <EvidenceMetric
                    key={metric.label}
                    label={
                      metric.label
                    }
                    value={
                      metric.value
                    }
                  />
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
        'inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.11em]',
        LEVEL_STYLES[level],
      ].join(' ')}
    >
      {LEVEL_LABELS[level]}
    </span>
  )
}

function RankingStatus({
  rankingSummary,
  qualificationMessage,
  level,
  className,
}: {
  rankingSummary: string | null
  qualificationMessage: string
  level: ReputationLevel
  className?: string
}) {
  const hasPublishedRanking =
    rankingSummary !== null

  return (
    <div
      className={[
        'min-w-0 rounded-[1.4rem] px-4 py-4 ring-1',
        hasPublishedRanking
          ? 'bg-cyan-300/[0.055] ring-cyan-300/12'
          : 'bg-black/25 ring-white/[0.055]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">
        Standing
      </p>

      <p
        className={[
          'mt-2 break-words font-black leading-5 tracking-tight',
          hasPublishedRanking
            ? 'text-lg text-cyan-200'
            : level ===
                'unranked'
              ? 'text-sm text-zinc-500'
              : 'text-sm text-zinc-300',
        ].join(' ')}
      >
        {rankingSummary ??
          qualificationMessage}
      </p>

      <p className="mt-2 text-[11px] leading-5 text-zinc-600">
        {hasPublishedRanking
          ? 'Published once enough comparable creators exist for the result to mean something.'
          : 'A public comparison appears only when both the activity and comparison population are strong enough.'}
      </p>
    </div>
  )
}

function EvidenceMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="min-w-0 rounded-[1.15rem] bg-black/20 px-3 py-3 ring-1 ring-white/[0.05]">
      <p className="truncate text-lg font-black leading-none tracking-[-0.03em] text-white">
        {value.toLocaleString(
          'en-US'
        )}
      </p>

      <p className="mt-2 text-[10px] font-medium leading-4 text-zinc-600">
        {label}
      </p>
    </div>
  )
}

/* =========================================================
 * Derived display values
 * ======================================================= */

function buildScopeLabel(
  reputation:
    NormalizedReputationCard
): string {
  if (
    reputation.scope ===
    'city'
  ) {
    const city =
      reputation.cityLabel ??
      'City'

    return `${city} · ${reputation.categoryShortLabel}`
  }

  if (
    reputation.scope ===
    'global'
  ) {
    return `Global · ${reputation.categoryShortLabel}`
  }

  return reputation.categoryShortLabel
}

function buildQualificationMessage(
  reputation:
    NormalizedReputationCard
): string {
  if (
    reputation.level ===
    'unranked'
  ) {
    if (
      reputation.verifiedVenueCount !==
        null &&
      reputation.verifiedVenueCount >
        0
    ) {
      const location =
        reputation.scope ===
          'city' &&
        reputation.cityLabel
          ? ` ${reputation.cityLabel}`
          : ''

      return `${reputation.verifiedVenueCount.toLocaleString(
        'en-US'
      )} verified${location} ${
        reputation.categoryShortLabel
      } ${
        reputation.verifiedVenueCount ===
        1
          ? 'venue'
          : 'venues'
      } recorded — reputation status is still building.`
    }

    return 'Build this reputation through verified activity in the category.'
  }

  if (
    reputation.eligibleCreatorCount !==
      null &&
    reputation.eligibleCreatorCount >
      0
  ) {
    return `Status earned · ${reputation.eligibleCreatorCount.toLocaleString(
      'en-US'
    )} ${
      reputation.eligibleCreatorCount ===
      1
        ? 'eligible creator'
        : 'eligible creators'
    } currently in this population.`
  }

  return 'Status earned · The eligible ranking population is not yet large enough for a public rank.'
}

function buildEvidenceMetrics(
  reputation:
    NormalizedReputationCard
): Array<{
  label: string
  value: number
}> {
  const metrics: Array<{
    label: string
    value: number
  }> = []

  pushEvidenceMetric({
    metrics,
    label:
      reputation.scope ===
        'city' &&
      reputation.cityLabel
        ? `Verified ${reputation.cityLabel} venues`
        : 'Verified venues',

    value:
      reputation.verifiedVenueCount,
  })

  pushEvidenceMetric({
    metrics,
    label: 'Weighted category venues',
    value:
      reputation.weightedVenueCount,
  })

  pushEvidenceMetric({
    metrics,
    label: 'Curated category venues',
    value:
      reputation.curatedVenueCount,
  })

  pushEvidenceMetric({
    metrics,
    label: 'Qualifying collections',
    value:
      reputation.publicCollectionCount,
  })

  pushEvidenceMetric({
    metrics,
    label: 'Qualifying snapshots',
    value:
      reputation.publicSnapshotCount,
  })

  pushEvidenceMetric({
    metrics,
    label: 'Qualifying flows',
    value:
      reputation.completedFlowCount,
  })

  return metrics
}

function pushEvidenceMetric({
  metrics,
  label,
  value,
}: {
  metrics: Array<{
    label: string
    value: number
  }>
  label: string
  value: number | null
}) {
  if (
    value === null ||
    value <= 0
  ) {
    return
  }

  metrics.push({
    label,
    value,
  })
}

function buildRankingSummary(
  reputation:
    NormalizedReputationCard
): string | null {
  if (
    reputation.rankLabel
  ) {
    return reputation.rankLabel
  }

  const parts: string[] = []

  if (
    reputation.rank !== null
  ) {
    parts.push(
      `#${reputation.rank.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    reputation.eligibleCreatorCount !==
      null &&
    reputation.rank !== null
  ) {
    parts.push(
      `of ${reputation.eligibleCreatorCount.toLocaleString(
        'en-US'
      )}`
    )
  }

  if (
    reputation.topPercent !==
    null
  ) {
    parts.push(
      `Top ${formatNumber(
        reputation.topPercent,
        reputation.topPercent <
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
 * Normalization
 * ======================================================= */

function normalizeReputationCard(
  value: unknown
): NormalizedReputationCard | null {
  if (!isRecord(value)) {
    return null
  }

  const category =
    isRecord(value.category)
      ? value.category
      : null

  const tier =
    isRecord(value.tier)
      ? value.tier
      : null

  const evidence =
    isRecord(value.evidence)
      ? value.evidence
      : null

  const ranking =
    isRecord(value.ranking)
      ? value.ranking
      : null

  const labels =
    isRecord(value.labels)
      ? value.labels
      : null

  const categoryId =
    normalizeNullableText(
      firstDefined(
        value.categoryId,
        value.category_id,
        category?.id
      )
    )

  const categoryLabel =
    normalizeNullableText(
      firstDefined(
        value.categoryLabel,
        value.category_label,
        category?.label,
        value.label
      )
    )

  const categoryShortLabel =
    normalizeNullableText(
      firstDefined(
        value.categoryShortLabel,
        value.category_short_label,
        category?.shortLabel,
        category?.short_label
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
        value.primaryLabel,
        value.primary_label,
        labels?.primary,
        categoryLabel
      )
    )

  if (
    !categoryLabel ||
    !categoryShortLabel ||
    !primaryLabel
  ) {
    return null
  }

  const scope =
    normalizeScope(
      value.scope
    )

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
        value.city_label,
        labels?.city
      )
    )

  const level =
    normalizeLevel(
      firstDefined(
        value.reputationLevel,
        value.reputation_level,
        value.level,
        tier?.level,
        tier?.id
      )
    )

  const key = [
    categoryId ??
      categoryLabel.toLowerCase(),
    scope,
    cityKey,
  ]
    .filter(Boolean)
    .join(':')

  return {
    key,

    categoryId,

    categoryLabel,

    categoryShortLabel,

    primaryLabel,

    secondaryLabel:
      normalizeNullableText(
        firstDefined(
          value.secondaryLabel,
          value.secondary_label,
          labels?.secondary,
          value.description
        )
      ),

    cityLabel,

    scope,

    level,

    score:
      normalizeNonNegativeNumber(
        firstDefined(
          value.reputationScore,
          value.reputation_score,
          value.score
        )
      ),

    rank:
      normalizePositiveInteger(
        firstDefined(
          value.rank,
          value.cityRank,
          value.city_rank,
          ranking?.rank
        )
      ),

    eligibleCreatorCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.eligibleCreatorCount,
          value.eligible_creator_count,
          ranking
            ?.eligibleCreatorCount,
          ranking
            ?.eligible_creator_count
        )
      ),

    topPercent:
      normalizePercentage(
        firstDefined(
          value.topPercent,
          value.top_percent,
          value.percentile,
          ranking?.topPercent,
          ranking?.top_percent,
          ranking?.percentile
        )
      ),

    rankLabel:
      normalizeNullableText(
        firstDefined(
          value.rankLabel,
          value.rank_label,
          ranking?.label,
          labels?.ranking,
          labels?.rank
        )
      ),

    verifiedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.verifiedVenueCount,
          value.verified_venue_count,
          evidence
            ?.verifiedVenueCount,
          evidence
            ?.verified_venue_count
        )
      ),

    weightedVenueCount:
      normalizeNonNegativeNumber(
        firstDefined(
          value.weightedVenueCount,
          value.weighted_venue_count,
          evidence
            ?.weightedVenueCount,
          evidence
            ?.weighted_venue_count
        )
      ),

    publicCollectionCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.publicCollectionCount,
          value.public_collection_count,
          evidence
            ?.publicCollectionCount,
          evidence
            ?.public_collection_count
        )
      ),

    curatedVenueCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.curatedVenueCount,
          value.curated_venue_count,
          evidence
            ?.curatedVenueCount,
          evidence
            ?.curated_venue_count
        )
      ),

    publicSnapshotCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.publicSnapshotCount,
          value.public_snapshot_count,
          evidence
            ?.publicSnapshotCount,
          evidence
            ?.public_snapshot_count
        )
      ),

    completedFlowCount:
      normalizeNonNegativeInteger(
        firstDefined(
          value.completedFlowCount,
          value.completed_flow_count,
          evidence
            ?.completedFlowCount,
          evidence
            ?.completed_flow_count
        )
      ),
  }
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
): 'global' | 'city' | null {
  return value === 'global' ||
    value === 'city'
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
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim().length > 0
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

function firstDefined(
  ...values: unknown[]
): unknown {
  for (
    const value of values
  ) {
    if (
      value !== null &&
      value !== undefined
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