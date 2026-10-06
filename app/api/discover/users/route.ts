import { NextResponse } from 'next/server'
import { supabaseServerApi } from '@/lib/supabase/server-api'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import {
  REPUTATION_LEVEL_RANK,
} from '@/lib/reputation/discovery-primitives'

import {
  buildPublicReputationClaim,
  REPUTATION_POLICY_VERSION,
} from '@/lib/reputation/policy'

import {
  SUPPORTED_CITIES,
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

import {
  rankReputationCandidates,
  type ReputationRankingCandidate,
} from '@/lib/reputation/rebuildReputationRankings'

import {
  isReputationCategoryId,
  isReputationLevel,
  isReputationScope,
  type ReputationCategoryId,
  type ReputationLevel,
  type ReputationScope,
  type UserCategoryReputation,
  type UserReputationRank,
} from '@/lib/reputation/types'

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

type RecommendationViewerProfile = {
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null
}

type RecommendationViewerContext = {
  homeNeighborhood: string | null
  preferredVibes: Set<string>
  interestCategories: Set<string>
}

type DiscoverRecommendationPrimaryReason =
  | 'shared_interest'
  | 'shared_vibe'
  | 'same_neighborhood'
  | 'reputation'

export type DiscoverRecommendationContext = {
  sharedInterests: string[]
  sharedVibes: string[]
  sharesHomeNeighborhood: boolean
  primaryReason:
    DiscoverRecommendationPrimaryReason | null
}

type ReputationCategoryRow = {
  id: string
  label: string | null
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

  city_count:
    number | string | null

  public_collection_count:
    number | string | null

  curated_venue_count:
    number | string | null

  public_snapshot_count:
    number | string | null

  completed_flow_count:
    number | string | null

  recency_score:
    number | string | null

  quality_score:
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

    /**
     * Grounded explanation for suggested-user discovery.
     *
     * This is populated only for suggested results and is derived
     * from the same viewer/candidate signals used by recommendation
     * ranking. Direct-search results do not receive recommendation
     * semantics.
     */
    recommendation:
      DiscoverRecommendationContext | null
  }

type NormalizedReputationCategory = {
  id: string
  label: string
}

type NormalizedReputationRow = {
  userId: string
  categoryId: ReputationCategoryId
  scope: ReputationScope
  cityKey: string | null

  reputationLevel: ReputationLevel
  reputationScore: number

  verifiedVenueCount: number
  weightedVenueCount: number
  cityCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  recencyScore: number
  qualityScore: number

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
  }

const DISCOVER_RESULT_LIMIT =
  12

const SUGGESTED_CANDIDATE_LIMIT =
  100

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

    let recommendationViewerContext:
      RecommendationViewerContext | null =
      null

    if (
      suggested &&
      user
    ) {
      const {
        data:
          viewerProfileRaw,

        error:
          viewerProfileError,
      } =
        await supabase
          .from(
            'profiles'
          )
          .select(`
            home_neighborhood,
            preferred_vibes,
            interest_categories
          `)
          .eq(
            'id',
            user.id
          )
          .maybeSingle<
            RecommendationViewerProfile
          >()

      if (
        viewerProfileError
      ) {
        console.error(
          'Discover recommendation viewer-profile lookup error:',
          viewerProfileError
        )
      } else if (
        viewerProfileRaw
      ) {
        recommendationViewerContext =
          buildRecommendationViewerContext(
            viewerProfileRaw
          )
      }
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
        .eq(
          'is_discoverable',
          true
        )
        .not(
          'username',
          'is',
          null
        )
        .limit(
          suggested
            ? SUGGESTED_CANDIDATE_LIMIT
            : DISCOVER_RESULT_LIMIT
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
  discoverableProfilesResult,
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
        city_count,
        public_collection_count,
        curated_venue_count,
        public_snapshot_count,
        completed_flow_count,
        recency_score,
        quality_score,
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

    admin
      .from(
        'profiles'
      )
      .select(
        'id'
      )
      .eq(
        'is_public',
        true
      )
      .eq(
        'is_discoverable',
        true
      )
      .not(
        'username',
        'is',
        null
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

    if (
  discoverableProfilesResult.error
) {
  console.error(
    'Discover reputation-population profile lookup error:',
    discoverableProfilesResult.error
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

const discoverableProfileIds =
  new Set(
    discoverableProfilesResult.error
      ? []
      : (
          discoverableProfilesResult.data ??
          []
        )
          .map(
            (
              profile
            ) =>
              normalizeRequiredText(
                profile.id
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

const currentPolicyRows =
  normalizedReputationRows.filter(
    (
      row
    ) =>
      row.policyVersion ===
        REPUTATION_POLICY_VERSION &&
      discoverableProfileIds.has(
        row.userId
      )
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
          ) => {
            const reputation =
              reputationByUserId.get(
                profile.id
              ) ??
              null

            return {
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

              reputation,

              recommendation:
                suggested
                  ? buildDiscoverRecommendationContext({
                      profile,
                      viewerContext:
                        recommendationViewerContext,
                      reputation,
                    })
                  : null,
            }
          }
        )
        .sort(
          (
            first,
            second
          ) => {
            if (
              suggested
            ) {
              const recommendationDifference =
                compareSuggestedUsers(
                  first,
                  second,
                  recommendationViewerContext
                )

              if (
                recommendationDifference !==
                0
              ) {
                return recommendationDifference
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
        .slice(
          0,
          DISCOVER_RESULT_LIMIT
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
 * Suggested-user recommendation context
 * ======================================================= */

function buildRecommendationViewerContext(
  profile:
    RecommendationViewerProfile
): RecommendationViewerContext {
  return {
    homeNeighborhood:
      normalizeRecommendationValue(
        profile.home_neighborhood
      ),

    preferredVibes:
      normalizeRecommendationValues(
        profile.preferred_vibes
      ),

    interestCategories:
      normalizeRecommendationValues(
        profile.interest_categories
      ),
  }
}

function buildDiscoverRecommendationContext({
  profile,
  viewerContext,
  reputation,
}: {
  profile:
    ProfileRow

  viewerContext:
    RecommendationViewerContext | null

  reputation:
    DiscoverReputationSummary | null
}): DiscoverRecommendationContext {
  const sharedInterests =
    viewerContext
      ? findRecommendationOverlapValues(
          viewerContext.interestCategories,
          profile.interest_categories
        )
      : []

  const sharedVibes =
    viewerContext
      ? findRecommendationOverlapValues(
          viewerContext.preferredVibes,
          profile.preferred_vibes
        )
      : []

  const sharesHomeNeighborhood =
    viewerContext
      ? sharesRecommendationHomeNeighborhood(
          viewerContext.homeNeighborhood,
          profile.home_neighborhood
        )
      : false

  let primaryReason:
    DiscoverRecommendationPrimaryReason | null =
    null

  if (
    sharedInterests.length >
    0
  ) {
    primaryReason =
      'shared_interest'
  } else if (
    sharedVibes.length >
    0
  ) {
    primaryReason =
      'shared_vibe'
  } else if (
    sharesHomeNeighborhood
  ) {
    primaryReason =
      'same_neighborhood'
  } else if (
    reputation
  ) {
    primaryReason =
      'reputation'
  }

  return {
    sharedInterests,

    sharedVibes,

    sharesHomeNeighborhood,

    primaryReason,
  }
}

function findRecommendationOverlapValues(
  viewerValues:
    Set<string>,
  candidateValues:
    string[] | null
): string[] {
  if (
    viewerValues.size ===
      0 ||
    !Array.isArray(
      candidateValues
    )
  ) {
    return []
  }

  const matchedValues:
    string[] =
    []

  const seenNormalizedValues =
    new Set<string>()

  for (
    const candidateValue of
      candidateValues
  ) {
    const normalized =
      normalizeRecommendationValue(
        candidateValue
      )

    if (
      !normalized ||
      seenNormalizedValues.has(
        normalized
      ) ||
      !viewerValues.has(
        normalized
      )
    ) {
      continue
    }

    const displayValue =
      normalizeRequiredText(
        candidateValue
      )

    if (
      !displayValue
    ) {
      continue
    }

    seenNormalizedValues.add(
      normalized
    )

    matchedValues.push(
      displayValue
    )
  }

  return matchedValues
}

function compareSuggestedUsers(
  first:
    DiscoverUser,
  second:
    DiscoverUser,
  viewerContext:
    RecommendationViewerContext | null
): number {
  if (
    viewerContext
  ) {
    const firstSharedInterestCount =
      countRecommendationOverlap(
        viewerContext.interestCategories,
        first.interest_categories
      )

    const secondSharedInterestCount =
      countRecommendationOverlap(
        viewerContext.interestCategories,
        second.interest_categories
      )

    if (
      firstSharedInterestCount !==
      secondSharedInterestCount
    ) {
      return (
        secondSharedInterestCount -
        firstSharedInterestCount
      )
    }

    const firstSharedVibeCount =
      countRecommendationOverlap(
        viewerContext.preferredVibes,
        first.preferred_vibes
      )

    const secondSharedVibeCount =
      countRecommendationOverlap(
        viewerContext.preferredVibes,
        second.preferred_vibes
      )

    if (
      firstSharedVibeCount !==
      secondSharedVibeCount
    ) {
      return (
        secondSharedVibeCount -
        firstSharedVibeCount
      )
    }

    const firstSharesHomeNeighborhood =
      sharesRecommendationHomeNeighborhood(
        viewerContext.homeNeighborhood,
        first.home_neighborhood
      )

    const secondSharesHomeNeighborhood =
      sharesRecommendationHomeNeighborhood(
        viewerContext.homeNeighborhood,
        second.home_neighborhood
      )

    if (
      firstSharesHomeNeighborhood !==
      secondSharesHomeNeighborhood
    ) {
      return firstSharesHomeNeighborhood
        ? -1
        : 1
    }
  }

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

  return 0
}

function countRecommendationOverlap(
  viewerValues:
    Set<string>,
  candidateValues:
    string[] | null
): number {
  if (
    viewerValues.size ===
      0 ||
    !Array.isArray(
      candidateValues
    )
  ) {
    return 0
  }

  const candidateSet =
    normalizeRecommendationValues(
      candidateValues
    )

  let overlapCount =
    0

  for (
    const value of
      candidateSet
  ) {
    if (
      viewerValues.has(
        value
      )
    ) {
      overlapCount +=
        1
    }
  }

  return overlapCount
}

function sharesRecommendationHomeNeighborhood(
  viewerHomeNeighborhood:
    string | null,
  candidateHomeNeighborhood:
    string | null
): boolean {
  if (
    !viewerHomeNeighborhood
  ) {
    return false
  }

  const normalizedCandidateHomeNeighborhood =
    normalizeRecommendationValue(
      candidateHomeNeighborhood
    )

  return (
    normalizedCandidateHomeNeighborhood !==
      null &&
    normalizedCandidateHomeNeighborhood ===
      viewerHomeNeighborhood
  )
}

function normalizeRecommendationValues(
  values:
    string[] | null
): Set<string> {
  const normalizedValues =
    new Set<string>()

  if (
    !Array.isArray(
      values
    )
  ) {
    return normalizedValues
  }

  for (
    const value of
      values
  ) {
    const normalized =
      normalizeRecommendationValue(
        value
      )

    if (
      normalized
    ) {
      normalizedValues.add(
        normalized
      )
    }
  }

  return normalizedValues
}

function normalizeRecommendationValue(
  value: unknown
): string | null {
  const normalized =
    normalizeRequiredText(
      value
    )

  return normalized
    ? normalized.toLocaleLowerCase(
        'en-US'
      )
    : null
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
  isReputationScope(
    row.scope
  )
    ? row.scope
    : null

const reputationLevel =
  isReputationLevel(
    row.reputation_level
  )
    ? row.reputation_level
    : null

const policyVersion =
  normalizePositiveInteger(
    row.policy_version
  )

        if (
          !userId ||
          !isReputationCategoryId(
            categoryId
          ) ||
          !scope ||
          !reputationLevel ||
          policyVersion ===
            null
        ) {
          continue
        }

    const normalizedCityKey =
      normalizeCityKey(
        row.city_key
      )

    const cityKey =
      scope ===
        'city' &&
      isSupportedCityKey(
        normalizedCityKey
      )
        ? normalizedCityKey
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

    cityCount:
      normalizeNonNegativeInteger(
        row.city_count
      ),

    publicCollectionCount:
      normalizeNonNegativeInteger(
        row.public_collection_count
      ),

    curatedVenueCount:
      normalizeNonNegativeInteger(
        row.curated_venue_count
      ),

    publicSnapshotCount:
      normalizeNonNegativeInteger(
        row.public_snapshot_count
      ),

    completedFlowCount:
      normalizeNonNegativeInteger(
        row.completed_flow_count
      ),

    recencyScore:
      normalizeNonNegativeNumber(
        row.recency_score
      ),

    qualityScore:
      normalizeNonNegativeNumber(
        row.quality_score
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
  /**
   * Discover owns construction of category/scope/city/policy
   * populations.
   *
   * Canonical reputation eligibility, ordering, ordinal rank,
   * and percentile calculation are delegated to
   * rankReputationCandidates().
   */
  const populations =
    new Map<
      string,
      NormalizedReputationRow[]
    >()

  for (
    const row of
      rows
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
    const populationRows of
      populations.values()
  ) {
    const calculatedAt =
      populationRows.reduce<
        string | null
      >(
        (
          latest,
          row
        ) => {
          if (
            !row.calculatedAt
          ) {
            return latest
          }

          if (
            !latest ||
            row.calculatedAt >
              latest
          ) {
            return row.calculatedAt
          }

          return latest
        },
        null
      ) ??
      new Date(
        0
      ).toISOString()

    const candidates:
      ReputationRankingCandidate[] =
      populationRows.map(
        (
          row
        ) => ({
          userId:
            row.userId,

          categoryId:
            row.categoryId,

          scope:
            row.scope,

          cityKey:
            row.cityKey,

          verifiedVenueCount:
            row.verifiedVenueCount,

          weightedVenueCount:
            row.weightedVenueCount,

          cityCount:
            row.cityCount,

          publicCollectionCount:
            row.publicCollectionCount,

          curatedVenueCount:
            row.curatedVenueCount,

          publicSnapshotCount:
            row.publicSnapshotCount,

          completedFlowCount:
            row.completedFlowCount,

          recencyScore:
            row.recencyScore,

          qualityScore:
            row.qualityScore,

          reputationScore:
            row.reputationScore,

          reputationLevel:
            row.reputationLevel,

          policyVersion:
            row.policyVersion,

          calculatedAt:
            row.calculatedAt,
        })
      )

    const {
      rankings,
    } =
      rankReputationCandidates({
        candidates,

        calculatedAt,
      })

    const rowsByUserId =
      new Map(
        populationRows.map(
          (
            row
          ) => [
            row.userId,
            row,
          ] as const
        )
      )

    for (
      const ranking of
        rankings
    ) {
      const row =
        rowsByUserId.get(
          ranking.userId
        )

      if (!row) {
        continue
      }

      const category =
        categoriesById.get(
          row.categoryId
        )

      const categoryLabel =
        category?.label ??
        formatIdentifier(
          row.categoryId
        )

      const reputation:
  UserCategoryReputation = {
  userId:
    row.userId,

  categoryId:
    row.categoryId,

  scope:
    row.scope,

  cityKey:
    row.cityKey,

  score:
    row.reputationScore,

  level:
    row.reputationLevel,

  components: {
    verifiedVenueCount:
      row.verifiedVenueCount,

    weightedVenueCount:
      row.weightedVenueCount,

    cityCount:
      row.cityCount,

    publicCollectionCount:
      row.publicCollectionCount,

    curatedVenueCount:
      row.curatedVenueCount,

    publicSnapshotCount:
      row.publicSnapshotCount,

    completedFlowCount:
      row.completedFlowCount,

    recencyScore:
      row.recencyScore,

    qualityScore:
      row.qualityScore,
  },

  latestEvidenceAt:
    null,

  calculatedAt:
    row.calculatedAt ??
    calculatedAt,
}

const publicClaim =
  buildPublicReputationClaim({
    reputation,

    ranking,

    categoryLabel,

    cityLabel:
      row.scope ===
        'city' &&
      row.cityKey
        ? formatIdentifier(
            row.cityKey
          )
        : null,
  })

if (
  !publicClaim ||
  publicClaim.rank ===
    null ||
  publicClaim.percentile ===
    null
) {
  continue
}

rankedRows.push({
  ...row,

  categoryLabel,

  rank:
    publicClaim.rank,

  eligibleCreatorCount:
    publicClaim.eligibleUserCount,

  topPercent:
    publicClaim.percentile,

  rankLabel:
    publicClaim.label,
})
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