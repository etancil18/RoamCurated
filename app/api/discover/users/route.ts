import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

type ProfileRow = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null
  is_public: boolean | null
  created_at?: string | null
}

type ReputationScope =
  | 'global'
  | 'city'

type ReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type ReputationCategoryRow = {
  id: string
  label: string | null
  minimum_venues_for_ranking:
    number | string | null
  is_active: boolean | null
}

type CreatorReputationStatsRow = {
  user_id: string
  category_id: string
  scope: string
  city_key: string | null
  reputation_level: string
  reputation_score:
    number | string | null
  verified_venue_count:
    number | string | null
  weighted_venue_count:
    number | string | null
  policy_version:
    number | string | null
  calculated_at: string | null
}

export type DiscoverReputationStanding = {
  categoryId: string
  categoryLabel: string

  scope: ReputationScope
  cityKey: string | null

  reputationLevel: ReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number

  rank: number
  eligibleCreatorCount: number

  /**
   * Rank-position percentage.
   *
   * Examples:
   *
   * - rank 1 of 100 = Top 1%
   * - rank 1 of 2 = Top 50%
   * - rank 3 of 10 = Top 30%
   */
  topPercent: number

  rankLabel: string

  /**
   * Small comparison groups are still returned, but marked
   * provisional so the UI can avoid presenting them as mature
   * platform-wide authority claims.
   */
  isProvisional: boolean
}

export type DiscoverReputationSummary = {
  highestLevel:
    ReputationLevel | null

  strongestCategory:
    DiscoverReputationStanding | null

  strongestGlobal:
    DiscoverReputationStanding | null

  strongestLocal:
    DiscoverReputationStanding | null
}

type DiscoverUser =
  ProfileRow & {
    followers_count:
      number

    is_following:
      boolean

    /**
     * Canonical reputation context appended for Discover cards.
     *
     * Existing consumers may ignore this field without changing
     * any existing behavior.
     */
    reputation:
      DiscoverReputationSummary | null
  }

type NormalizedReputationCategory = {
  id: string
  label: string
  minimumVenuesForRanking: number
}

type NormalizedReputationRow = {
  userId: string
  categoryId: string
  scope: ReputationScope
  cityKey: string | null

  reputationLevel: ReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number

  policyVersion: number
  calculatedAt: string | null
}

type RankedReputationRow =
  NormalizedReputationRow & {
    categoryLabel: string
    rank: number
    eligibleCreatorCount: number
    topPercent: number
    rankLabel: string
    isProvisional: boolean
  }

const REPUTATION_LEVEL_RANK = {
  unranked:
    0,

  emerging:
    1,

  established:
    2,

  expert:
    3,

  elite:
    4,
} as const satisfies Record<
  ReputationLevel,
  number
>

const MINIMUM_STABLE_RANKING_POPULATION =
  10

export async function GET(
  req: Request
) {
  try {
    const supabase =
      await supabaseServerApi()

    const admin =
      getSupabaseAdmin()

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser()

    const {
      searchParams,
    } =
      new URL(
        req.url
      )

    const rawQuery =
      searchParams.get(
        'q'
      )

    const suggested =
      searchParams.get(
        'suggested'
      ) ===
      'true'

    const query =
      cleanQuery(
        rawQuery
      )

    if (
      !suggested &&
      (
        !query ||
        query.length <
          2
      )
    ) {
      return NextResponse.json(
        {
          users: [],

          currentUserId:
            user?.id ??
            null,
        },
        {
          status:
            200,
        }
      )
    }

    let profilesQuery =
      supabase
        .from(
          'profiles'
        )
        .select(`
          id,
          username,
          full_name,
          avatar_url,
          bio,
          home_neighborhood,
          preferred_vibes,
          interest_categories,
          is_public,
          created_at
        `)
        .eq(
          'is_public',
          true
        )
        .not(
          'username',
          'is',
          null
        )
        .limit(
          12
        )

    if (query) {
      profilesQuery =
        profilesQuery.or(
          `username.ilike.%${escapeIlike(
            query
          )}%,full_name.ilike.%${escapeIlike(
            query
          )}%`
        )
    } else {
      profilesQuery =
        profilesQuery.order(
          'created_at',
          {
            ascending:
              false,
          }
        )
    }

    const {
      data:
        profilesRaw,

      error:
        profilesError,
    } =
      await profilesQuery
        .returns<
          ProfileRow[]
        >()

    if (
      profilesError
    ) {
      console.error(
        'Discover users lookup error:',
        profilesError
      )

      return NextResponse.json(
        {
          error:
            'Failed to load users',

          details:
            profilesError.message,
        },
        {
          status:
            500,
        }
      )
    }

    const profiles =
      profilesRaw ??
      []

    const profileIds =
      profiles.map(
        (
          profile
        ) =>
          profile.id
      )

    if (
      profileIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          users: [],

          currentUserId:
            user?.id ??
            null,
        },
        {
          status:
            200,
        }
      )
    }

    const [
      followResult,
      followingResult,
      categoriesResult,
      reputationRowsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'user_follows'
          )
          .select(
            'following_id'
          )
          .in(
            'following_id',
            profileIds
          ),

        user
          ? supabase
              .from(
                'user_follows'
              )
              .select(
                'following_id'
              )
              .eq(
                'follower_id',
                user.id
              )
              .in(
                'following_id',
                profileIds
              )
          : Promise.resolve({
              data:
                [] as Array<{
                  following_id:
                    string
                }>,

              error:
                null,
            }),

        admin
          .from(
            'reputation_categories'
          )
          .select(`
            id,
            label,
            minimum_venues_for_ranking,
            is_active
          `)
          .eq(
            'is_active',
            true
          ),

        /**
         * All current reputation rows are loaded so ranks and
         * percentiles are calculated against the full eligible
         * comparison population rather than only the users in
         * the current search response.
         */
        admin
          .from(
            'creator_reputation_stats'
          )
          .select(`
            user_id,
            category_id,
            scope,
            city_key,
            reputation_level,
            reputation_score,
            verified_venue_count,
            weighted_venue_count,
            policy_version,
            calculated_at
          `)
          .order(
            'policy_version',
            {
              ascending:
                false,
            }
          )
          .limit(
            10000
          ),
      ])

    if (
      followResult.error
    ) {
      console.error(
        'Discover follower-count lookup error:',
        followResult.error
      )
    }

    if (
      followingResult.error
    ) {
      console.error(
        'Discover following-status lookup error:',
        followingResult.error
      )
    }

    if (
      categoriesResult.error
    ) {
      console.error(
        'Discover reputation-category lookup error:',
        categoriesResult.error
      )
    }

    if (
      reputationRowsResult.error
    ) {
      console.error(
        'Discover reputation lookup error:',
        reputationRowsResult.error
      )
    }

    const followRows =
      followResult.data ??
      []

    const followingRows =
      followingResult.data ??
      []

    const followerCountByProfileId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        followRows
    ) {
      const followingId =
        normalizeRequiredText(
          row.following_id
        )

      if (
        !followingId
      ) {
        continue
      }

      followerCountByProfileId.set(
        followingId,
        (
          followerCountByProfileId.get(
            followingId
          ) ??
          0
        ) +
          1
      )
    }

    const followingIds =
      new Set(
        followingRows
          .map(
            (
              row
            ) =>
              normalizeRequiredText(
                row.following_id
              )
          )
          .filter(
            (
              value
            ): value is string =>
              value !==
              null
          )
      )

    const categoriesById =
      normalizeReputationCategories(
        categoriesResult.error
          ? []
          : categoriesResult.data
      )

    const normalizedReputationRows =
      normalizeReputationRows(
        reputationRowsResult.error
          ? []
          : reputationRowsResult.data
      )

    const latestPolicyVersion =
      determineLatestPolicyVersion(
        normalizedReputationRows
      )

    const currentPolicyRows =
      latestPolicyVersion ===
      null
        ? []
        : normalizedReputationRows.filter(
            (
              row
            ) =>
              row.policyVersion ===
              latestPolicyVersion
          )

    const rankedReputationRows =
      rankEligibleReputationRows({
        rows:
          currentPolicyRows,

        categoriesById,
      })

    const reputationByUserId =
      buildReputationSummariesByUserId(
        rankedReputationRows
      )

    const users:
      DiscoverUser[] =
      profiles
        .filter(
          (
            profile
          ) =>
            profile.id !==
            user?.id
        )
        .map(
          (
            profile
          ) => ({
            ...profile,

            followers_count:
              followerCountByProfileId.get(
                profile.id
              ) ??
              0,

            is_following:
              followingIds.has(
                profile.id
              ),

            reputation:
              reputationByUserId.get(
                profile.id
              ) ??
              null,
          })
        )
        .sort(
          (
            first,
            second
          ) => {
            if (
              suggested
            ) {
              const reputationDifference =
                compareReputationSummaries(
                  first.reputation,
                  second.reputation
                )

              if (
                reputationDifference !==
                0
              ) {
                return reputationDifference
              }

              const followerDelta =
                second.followers_count -
                first.followers_count

              if (
                followerDelta !==
                0
              ) {
                return followerDelta
              }
            }

            return (
              first.full_name ??
              first.username ??
              ''
            ).localeCompare(
              second.full_name ??
                second.username ??
                '',
              'en-US',
              {
                sensitivity:
                  'base',
              }
            )
          }
        )

    return NextResponse.json(
      {
        users,

        currentUserId:
          user?.id ??
          null,
      },
      {
        status:
          200,
      }
    )
  } catch (
    error
  ) {
    console.error(
      'Unexpected discover users error:',
      error
    )

    return NextResponse.json(
      {
        error:
          'Unexpected server error',

        details:
          error instanceof
            Error
            ? error.message
            : 'Unknown error',
      },
      {
        status:
          500,
      }
    )
  }
}

/* =========================================================
 * Reputation category normalization
 * ======================================================= */

function normalizeReputationCategories(
  value: unknown
): Map<
  string,
  NormalizedReputationCategory
> {
  const categories =
    new Map<
      string,
      NormalizedReputationCategory
    >()

  if (
    !Array.isArray(
      value
    )
  ) {
    return categories
  }

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

    const category =
      rawCategory as
        unknown as
        ReputationCategoryRow

    if (
      category.is_active ===
      false
    ) {
      continue
    }

    const id =
      normalizeRequiredText(
        category.id
      )

    if (
      !id
    ) {
      continue
    }

    const label =
      normalizeRequiredText(
        category.label
      ) ??
      formatIdentifier(
        id
      )

    categories.set(
      id,
      {
        id,

        label,

        minimumVenuesForRanking:
          normalizePositiveInteger(
            category.minimum_venues_for_ranking
          ) ??
          5,
      }
    )
  }

  return categories
}

/* =========================================================
 * Reputation row normalization
 * ======================================================= */

function normalizeReputationRows(
  value: unknown
): NormalizedReputationRow[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const rows:
    NormalizedReputationRow[] =
    []

  for (
    const rawRow of
      value
  ) {
    if (
      !isRecord(
        rawRow
      )
    ) {
      continue
    }

    const row =
      rawRow as
        unknown as
        CreatorReputationStatsRow

    const userId =
      normalizeRequiredText(
        row.user_id
      )

    const categoryId =
      normalizeRequiredText(
        row.category_id
      )

    const scope =
      normalizeReputationScope(
        row.scope
      )

    const reputationLevel =
      normalizeReputationLevel(
        row.reputation_level
      )

    const policyVersion =
      normalizePositiveInteger(
        row.policy_version
      )

    if (
      !userId ||
      !categoryId ||
      !scope ||
      !reputationLevel ||
      policyVersion ===
        null
    ) {
      continue
    }

    const cityKey =
      scope ===
      'city'
        ? normalizeRequiredText(
            row.city_key
          )
        : null

    if (
      scope ===
        'city' &&
      !cityKey
    ) {
      continue
    }

    rows.push({
      userId,

      categoryId,

      scope,

      cityKey,

      reputationLevel,

      reputationScore:
        normalizeNonNegativeNumber(
          row.reputation_score
        ),

      verifiedVenueCount:
        normalizeNonNegativeInteger(
          row.verified_venue_count
        ),

      weightedVenueCount:
        normalizeNonNegativeNumber(
          row.weighted_venue_count
        ),

      policyVersion,

      calculatedAt:
        normalizeIsoTimestamp(
          row.calculated_at
        ),
    })
  }

  return rows
}

function determineLatestPolicyVersion(
  rows:
    NormalizedReputationRow[]
): number | null {
  let latest:
    number | null =
    null

  for (
    const row of
      rows
  ) {
    if (
      latest ===
        null ||
      row.policyVersion >
        latest
    ) {
      latest =
        row.policyVersion
    }
  }

  return latest
}

/* =========================================================
 * Reputation ranking
 * ======================================================= */

function rankEligibleReputationRows({
  rows,
  categoriesById,
}: {
  rows:
    NormalizedReputationRow[]

  categoriesById:
    Map<
      string,
      NormalizedReputationCategory
    >
}): RankedReputationRow[] {
  const eligibleRows =
    rows.filter(
      (
        row
      ) => {
        const category =
          categoriesById.get(
            row.categoryId
          )

        if (
          !category ||
          row.reputationLevel ===
            'unranked'
        ) {
          return false
        }

        return (
          row.verifiedVenueCount >=
            category.minimumVenuesForRanking &&
          row.weightedVenueCount >=
            4
        )
      }
    )

  const populations =
    new Map<
      string,
      NormalizedReputationRow[]
    >()

  for (
    const row of
      eligibleRows
  ) {
    const populationKey =
      buildReputationPopulationKey(
        row
      )

    const population =
      populations.get(
        populationKey
      ) ??
      []

    population.push(
      row
    )

    populations.set(
      populationKey,
      population
    )
  }

  const rankedRows:
    RankedReputationRow[] =
    []

  for (
    const population of
      populations.values()
  ) {
    const sortedPopulation =
      population
        .slice()
        .sort(
          compareReputationRows
        )

    const eligibleCreatorCount =
      sortedPopulation.length

    let previousRow:
      NormalizedReputationRow | null =
      null

    let previousRank =
      0

    for (
      let index =
        0;
      index <
      sortedPopulation.length;
      index +=
        1
    ) {
      const row =
        sortedPopulation[
          index
        ]

      const rank =
        previousRow &&
        reputationRowsAreTied(
          previousRow,
          row
        )
          ? previousRank
          : index +
            1

      const topPercent =
        calculateTopPercent({
          rank,

          eligibleCreatorCount,
        })

      const category =
        categoriesById.get(
          row.categoryId
        )

      const categoryLabel =
        category?.label ??
        formatIdentifier(
          row.categoryId
        )

      rankedRows.push({
        ...row,

        categoryLabel,

        rank,

        eligibleCreatorCount,

        topPercent,

        rankLabel:
          buildReputationRankLabel({
            row,

            categoryLabel,

            rank,

            eligibleCreatorCount,

            topPercent,
          }),

        isProvisional:
          eligibleCreatorCount <
          MINIMUM_STABLE_RANKING_POPULATION,
      })

      previousRow =
        row

      previousRank =
        rank
    }
  }

  return rankedRows
}

function buildReputationPopulationKey(
  row:
    NormalizedReputationRow
): string {
  return [
    row.categoryId,

    row.scope,

    row.scope ===
      'city'
      ? row.cityKey ??
        ''
      : '__global__',

    row.policyVersion.toString(),
  ].join(
    ':'
  )
}

function compareReputationRows(
  first:
    NormalizedReputationRow,
  second:
    NormalizedReputationRow
): number {
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
    first.verifiedVenueCount !==
    second.verifiedVenueCount
  ) {
    return (
      second.verifiedVenueCount -
      first.verifiedVenueCount
    )
  }

  if (
    first.weightedVenueCount !==
    second.weightedVenueCount
  ) {
    return (
      second.weightedVenueCount -
      first.weightedVenueCount
    )
  }

  return first.userId.localeCompare(
    second.userId
  )
}

function reputationRowsAreTied(
  first:
    NormalizedReputationRow,
  second:
    NormalizedReputationRow
): boolean {
  return (
    first.reputationScore ===
      second.reputationScore &&
    first.verifiedVenueCount ===
      second.verifiedVenueCount &&
    first.weightedVenueCount ===
      second.weightedVenueCount
  )
}

function calculateTopPercent({
  rank,
  eligibleCreatorCount,
}: {
  rank:
    number

  eligibleCreatorCount:
    number
}): number {
  if (
    eligibleCreatorCount <=
    0
  ) {
    return 100
  }

  return roundToPrecision(
    Math.min(
      100,
      Math.max(
        0,
        (
          rank /
          eligibleCreatorCount
        ) *
          100
      )
    ),
    2
  )
}

function buildReputationRankLabel({
  row,
  categoryLabel,
  rank,
  eligibleCreatorCount,
  topPercent,
}: {
  row:
    NormalizedReputationRow

  categoryLabel:
    string

  rank:
    number

  eligibleCreatorCount:
    number

  topPercent:
    number
}): string {
  const scopeLabel =
    row.scope ===
      'city' &&
    row.cityKey
      ? formatIdentifier(
          row.cityKey
        )
      : 'Global'

  return [
    `Top ${formatPercent(
      topPercent
    )}%`,

    scopeLabel,

    categoryLabel,

    `#${rank.toLocaleString(
      'en-US'
    )} of ${eligibleCreatorCount.toLocaleString(
      'en-US'
    )}`,
  ].join(
    ' · '
  )
}

/* =========================================================
 * Reputation summaries
 * ======================================================= */

function buildReputationSummariesByUserId(
  rows:
    RankedReputationRow[]
): Map<
  string,
  DiscoverReputationSummary
> {
  const rowsByUserId =
    new Map<
      string,
      RankedReputationRow[]
    >()

  for (
    const row of
      rows
  ) {
    const userRows =
      rowsByUserId.get(
        row.userId
      ) ??
      []

    userRows.push(
      row
    )

    rowsByUserId.set(
      row.userId,
      userRows
    )
  }

  const summaries =
    new Map<
      string,
      DiscoverReputationSummary
    >()

  for (
    const [
      userId,
      userRows,
    ] of
      rowsByUserId
  ) {
    const sortedRows =
      userRows
        .slice()
        .sort(
          compareRankedReputationRows
        )

    const strongestCategory =
      sortedRows[
        0
      ] ??
      null

    const strongestGlobal =
      sortedRows.find(
        (
          row
        ) =>
          row.scope ===
          'global'
      ) ??
      null

    const strongestLocal =
      sortedRows.find(
        (
          row
        ) =>
          row.scope ===
          'city'
      ) ??
      null

    const highestLevel =
      sortedRows.reduce<
        ReputationLevel | null
      >(
        (
          current,
          row
        ) => {
          if (
            current ===
              null ||
            REPUTATION_LEVEL_RANK[
              row.reputationLevel
            ] >
              REPUTATION_LEVEL_RANK[
                current
              ]
          ) {
            return row.reputationLevel
          }

          return current
        },
        null
      )

    summaries.set(
      userId,
      {
        highestLevel,

        strongestCategory:
          strongestCategory
            ? toPublicReputationStanding(
                strongestCategory
              )
            : null,

        strongestGlobal:
          strongestGlobal
            ? toPublicReputationStanding(
                strongestGlobal
              )
            : null,

        strongestLocal:
          strongestLocal
            ? toPublicReputationStanding(
                strongestLocal
              )
            : null,
      }
    )
  }

  return summaries
}

function compareRankedReputationRows(
  first:
    RankedReputationRow,
  second:
    RankedReputationRow
): number {
  const levelDifference =
    REPUTATION_LEVEL_RANK[
      second.reputationLevel
    ] -
    REPUTATION_LEVEL_RANK[
      first.reputationLevel
    ]

  if (
    levelDifference !==
    0
  ) {
    return levelDifference
  }

  if (
    first.topPercent !==
    second.topPercent
  ) {
    return (
      first.topPercent -
      second.topPercent
    )
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

function toPublicReputationStanding(
  row:
    RankedReputationRow
): DiscoverReputationStanding {
  return {
    categoryId:
      row.categoryId,

    categoryLabel:
      row.categoryLabel,

    scope:
      row.scope,

    cityKey:
      row.cityKey,

    reputationLevel:
      row.reputationLevel,

    reputationScore:
      row.reputationScore,

    verifiedVenueCount:
      row.verifiedVenueCount,

    weightedVenueCount:
      row.weightedVenueCount,

    rank:
      row.rank,

    eligibleCreatorCount:
      row.eligibleCreatorCount,

    topPercent:
      row.topPercent,

    rankLabel:
      row.rankLabel,

    isProvisional:
      row.isProvisional,
  }
}

function compareReputationSummaries(
  first:
    DiscoverReputationSummary | null,
  second:
    DiscoverReputationSummary | null
): number {
  if (
    first &&
    !second
  ) {
    return -1
  }

  if (
    !first &&
    second
  ) {
    return 1
  }

  if (
    !first ||
    !second
  ) {
    return 0
  }

  const firstLevel =
    first.highestLevel
      ? REPUTATION_LEVEL_RANK[
          first.highestLevel
        ]
      : 0

  const secondLevel =
    second.highestLevel
      ? REPUTATION_LEVEL_RANK[
          second.highestLevel
        ]
      : 0

  if (
    firstLevel !==
    secondLevel
  ) {
    return (
      secondLevel -
      firstLevel
    )
  }

  const firstPercent =
    first.strongestCategory
      ?.topPercent ??
    Number.POSITIVE_INFINITY

  const secondPercent =
    second.strongestCategory
      ?.topPercent ??
    Number.POSITIVE_INFINITY

  if (
    firstPercent !==
    secondPercent
  ) {
    return (
      firstPercent -
      secondPercent
    )
  }

  return 0
}

/* =========================================================
 * Existing query helpers
 * ======================================================= */

function cleanQuery(
  value:
    string | null
): string | null {
  if (
    !value
  ) {
    return null
  }

  const cleaned =
    value
      .trim()
      .replace(
        /^@+/,
        ''
      )

  return cleaned.length >
    0
    ? cleaned
    : null
}

function escapeIlike(
  value:
    string
): string {
  return value.replace(
    /[%_]/g,
    '\\$&'
  )
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeReputationScope(
  value: unknown
): ReputationScope | null {
  if (
    value ===
      'global' ||
    value ===
      'city'
  ) {
    return value
  }

  return null
}

function normalizeReputationLevel(
  value: unknown
): ReputationLevel | null {
  if (
    value ===
      'unranked' ||
    value ===
      'emerging' ||
    value ===
      'established' ||
    value ===
      'expert' ||
    value ===
      'elite'
  ) {
    return value
  }

  return null
}

function normalizeRequiredText(
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

  return normalized ||
    null
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

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <=
      0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizeNonNegativeInteger(
  value: unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <=
      0
  ) {
    return 0
  }

  return Math.trunc(
    normalized
  )
}

function normalizeNonNegativeNumber(
  value: unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized ===
      null ||
    normalized <=
      0
  ) {
    return 0
  }

  return normalized
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
    Date.parse(
      value
    )

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

function roundToPrecision(
  value:
    number,
  decimalPlaces:
    number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  const normalizedDecimalPlaces =
    Math.min(
      8,
      Math.max(
        0,
        Math.trunc(
          decimalPlaces
        )
      )
    )

  const factor =
    10 **
    normalizedDecimalPlaces

  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        factor
    ) /
    factor
  )
}

function formatPercent(
  value:
    number
): string {
  return value.toLocaleString(
    'en-US',
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        value <
        1
          ? 1
          : 0,
    }
  )
}

function formatIdentifier(
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

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  )
}