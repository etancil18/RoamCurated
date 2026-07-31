import { NextResponse } from 'next/server'

import {
  getSupabaseAdmin,
} from '@/lib/supabase/admin'

import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'

import {
  getPassportSnapshot,
} from '@/lib/passport/score'

import {
  SUPPORTED_CITIES,
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

/* =========================================================
 * Contracts
 * ======================================================= */

type LeaderboardScope =
  | 'global'
  | 'city'

type ReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

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
}

type ReputationStatsRow = {
  user_id: string
  category_id: string
  scope:
    LeaderboardScope
  city_key: string | null
  reputation_level:
    ReputationLevel
  reputation_score: number | string | null
  verified_venue_count: number | string | null
  weighted_venue_count: number | string | null
  completed_flow_count: number | string | null
  policy_version: number | string | null
}

type ReputationCategoryRow = {
  id: string
  label: string | null
  plural_label: string | null
  minimum_venues_for_status: number | string | null
  minimum_venues_for_ranking: number | string | null
  is_active: boolean | null
  sort_order: number | string | null
}

type NormalizedReputationCategory = {
  id: string
  label: string
  shortLabel: string
  minimumVenuesForStatus: number
  minimumVenuesForRanking: number
  sortOrder: number
}

type NormalizedReputationRow = {
  userId: string
  categoryId: string
  scope: LeaderboardScope
  cityKey: string | null
  reputationLevel: ReputationLevel
  reputationScore: number
  verifiedVenueCount: number
  weightedVenueCount: number
  completedFlowCount: number
  policyVersion: number
}

type RankedReputationRow = {
  userId: string
  categoryId: string
  categoryLabel: string
  categoryShortLabel: string
  scope: LeaderboardScope
  cityKey: string | null
  reputationLevel: ReputationLevel
  reputationScore: number
  verifiedVenueCount: number
  weightedVenueCount: number
  completedFlowCount: number

  reputationRank: number
  eligibleCreatorCount: number
  topPercent: number
  percentileStanding: number
  rankLabel: string
}

type LeaderboardUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null

  passport_level: number
  followers_count: number
  completed_flows_count: number
  venue_visits_count: number
  checkins_count: number

  is_following: boolean
  rank: number

  reputation_category_id: string | null
  reputation_category_label: string | null
  reputation_category_short_label: string | null
  reputation_scope: LeaderboardScope | null
  reputation_city_key: string | null
  reputation_level: ReputationLevel | null
  reputation_score: number | null
  reputation_rank: number | null
  reputation_population: number
  reputation_top_percent: number | null
  reputation_percentile_standing: number | null
  reputation_rank_label: string | null
  reputation_verified_venue_count: number
  reputation_weighted_venue_count: number
  reputation_completed_flow_count: number
}

type LeaderboardFilters = {
  scope: LeaderboardScope
  categoryId: string | null
  cityKey: string | null
}

type LeaderboardCityOption = {
  value: string
  label: string
}

type LeaderboardResponse = {
  users: LeaderboardUser[]
  currentUserId: string | null

  filters: {
    scope: LeaderboardScope
    categoryId: string | null
    cityKey: string | null
  }

  options: {
    categories: Array<{
      id: string
      label: string
      shortLabel: string
    }>

    cities: LeaderboardCityOption[]
  }

  reputationPolicyVersion:
    number | null
}

const LEADERBOARD_CITY_OPTIONS:
  LeaderboardCityOption[] =
  SUPPORTED_CITIES.map(
    (
      city
    ) => ({
      value:
        city.value,

      label:
        city.label,
    })
  )

/* =========================================================
 * Endpoint
 * ======================================================= */

export async function GET(
  request: Request
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
      await supabase
        .auth
        .getUser()

    const filters =
      parseLeaderboardFilters(
        request
      )

    const [
      profilesResult,
      currentProfileResult,
    ] =
      await Promise.all([
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
            is_public
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
          .returns<
            ProfileRow[]
          >(),

        user
          ? supabase
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
                is_public
              `)
              .eq(
                'id',
                user.id
              )
              .not(
                'username',
                'is',
                null
              )
              .maybeSingle<
                ProfileRow
              >()
          : Promise.resolve({
              data:
                null as
                  ProfileRow | null,

              error:
                null,
            }),
      ])

    const {
      data:
        profilesRaw,

      error:
        profilesError,
    } =
      profilesResult

    if (
      profilesError
    ) {
      console.error(
        'Leaderboard profiles lookup error:',
        profilesError
      )

      return NextResponse.json(
        {
          error:
            'Failed to load leaderboard profiles',

          details:
            profilesError.message,
        },
        {
          status:
            500,
        }
      )
    }

    if (
      currentProfileResult.error
    ) {
      console.error(
        'Leaderboard current profile lookup error:',
        currentProfileResult.error
      )
    }

    /**
     * Public users form the shared leaderboard population.
     *
     * The authenticated user is merged into their own response
     * when they have a username, even when their profile is
     * private. This allows a user to see their own standing
     * without exposing that private profile to other users.
     */
    const profilesById =
      new Map<
        string,
        ProfileRow
      >()

    for (
      const profile of
        profilesRaw ??
        []
    ) {
      profilesById.set(
        profile.id,
        profile
      )
    }

    if (
      currentProfileResult.data
    ) {
      profilesById.set(
        currentProfileResult
          .data
          .id,

        currentProfileResult
          .data
      )
    }

    const profiles =
      Array.from(
        profilesById.values()
      )

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
      const emptyResponse:
        LeaderboardResponse = {
        users:
          [],

        currentUserId:
          user?.id ??
          null,

        filters: {
          scope:
            filters.scope,

          categoryId:
            filters.categoryId,

          cityKey:
            filters.cityKey,
        },

        options: {
          categories:
            [],

          cities:
            LEADERBOARD_CITY_OPTIONS,
        },

        reputationPolicyVersion:
          null,
      }

      return NextResponse.json(
        emptyResponse,
        {
          status:
            200,
        }
      )
    }

    const today =
      new Date()

    today.setHours(
      0,
      0,
      0,
      0
    )

    const [
      {
        data:
          xpRows,
      },
      {
        data:
          followRows,
      },
      {
        data:
          followingRows,
      },
      {
        data:
          completedFlowRows,
      },
      {
        data:
          checkinRows,
      },
      {
        data:
          hostedRows,
      },
      {
        data:
          rsvpRows,
      },
      {
        data:
          savedPropertyRows,
      },
      {
        data:
          venueVisitRows,
      },
      {
        data:
          crawlProgressRows,
      },
      reputationStatsResult,
      reputationCategoriesResult,
    ] =
      await Promise.all([
        supabase
          .from(
            'event_xp_ledger'
          )
          .select(
            'user_id, xp_amount'
          )
          .in(
            'user_id',
            profileIds
          ),

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
            }),

        supabase
          .from(
            'active_flow_sessions'
          )
          .select(
            'user_id, venue_ids'
          )
          .eq(
            'status',
            'completed'
          )
          .in(
            'user_id',
            profileIds
          ),

        supabase
          .from(
            'event_checkins'
          )
          .select(
            'user_id'
          )
          .in(
            'user_id',
            profileIds
          ),

        supabase
          .from(
            'crawl_events'
          )
          .select(
            'id, creator_id'
          )
          .in(
            'creator_id',
            profileIds
          ),

        supabase
          .from(
            'crawl_rsvps'
          )
          .select(`
            user_id,
            crawl_id,
            crawl_events (
              id,
              datetime
            )
          `)
          .in(
            'user_id',
            profileIds
          ),

        supabase
          .from(
            'saved_properties'
          )
          .select(
            'user_id, property_id'
          )
          .in(
            'user_id',
            profileIds
          ),

        supabase
          .from(
            'venue_visits'
          )
          .select(
            'user_id'
          )
          .in(
            'user_id',
            profileIds
          ),

        supabase
          .from(
            'crawl_progress'
          )
          .select(
            'user_id, crawl_id'
          )
          .in(
            'user_id',
            profileIds
          ),

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
            completed_flow_count,
            policy_version
          `)
          .in(
            'user_id',
            profileIds
          )
          .returns<
            ReputationStatsRow[]
          >(),

        admin
          .from(
            'reputation_categories'
          )
          .select(`
            id,
            label,
            plural_label,
            minimum_venues_for_status,
            minimum_venues_for_ranking,
            is_active,
            sort_order
          `)
          .eq(
            'is_active',
            true
          )
          .order(
            'sort_order',
            {
              ascending:
                true,
            }
          )
          .returns<
            ReputationCategoryRow[]
          >(),
      ])

    if (
      reputationStatsResult.error
    ) {
      console.error(
        'Leaderboard reputation lookup error:',
        reputationStatsResult.error
      )
    }

    if (
      reputationCategoriesResult.error
    ) {
      console.error(
        'Leaderboard reputation category lookup error:',
        reputationCategoriesResult.error
      )
    }

    const xpByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        xpRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      const amount =
        Number(
          row.xp_amount ??
          0
        )

      xpByUserId.set(
        userId,
        (
          xpByUserId.get(
            userId
          ) ??
          0
        ) +
          amount
      )
    }

    const followersByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        followRows ??
        []
    ) {
      const followingId =
        row.following_id as
          string

      followersByUserId.set(
        followingId,
        (
          followersByUserId.get(
            followingId
          ) ??
          0
        ) +
          1
      )
    }

    const completedFlowsByUserId =
      new Map<
        string,
        number
      >()

    const completedFlowStopsByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        completedFlowRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      const stopCount =
        Array.isArray(
          row.venue_ids
        )
          ? row
              .venue_ids
              .length
          : 0

      completedFlowsByUserId.set(
        userId,
        (
          completedFlowsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )

      completedFlowStopsByUserId.set(
        userId,
        (
          completedFlowStopsByUserId.get(
            userId
          ) ??
          0
        ) +
          stopCount
      )
    }

    const checkinsByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        checkinRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      checkinsByUserId.set(
        userId,
        (
          checkinsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )
    }

    const hostedCrawlsByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        hostedRows ??
        []
    ) {
      const userId =
        row.creator_id as
          string

      hostedCrawlsByUserId.set(
        userId,
        (
          hostedCrawlsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )
    }

    const joinedCrawlsByUserId =
      new Map<
        string,
        number
      >()

    const pastCrawlsByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        rsvpRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      const crawl =
        (
          row as any
        ).crawl_events

      joinedCrawlsByUserId.set(
        userId,
        (
          joinedCrawlsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )

      if (
        crawl?.datetime &&
        new Date(
          crawl.datetime
        ) <
          today
      ) {
        pastCrawlsByUserId.set(
          userId,
          (
            pastCrawlsByUserId.get(
              userId
            ) ??
            0
          ) +
            1
        )
      }
    }

    const savedPropertiesByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        savedPropertyRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      savedPropertiesByUserId.set(
        userId,
        (
          savedPropertiesByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )
    }

    const venueVisitsByUserId =
      new Map<
        string,
        number
      >()

    for (
      const row of
        venueVisitRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      venueVisitsByUserId.set(
        userId,
        (
          venueVisitsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )
    }

    const hostedFlowStopsByUserId =
      new Map<
        string,
        number
      >()

    const crawlIds = [
      ...new Set(
        (
          crawlProgressRows ??
          []
        )
          .map(
            (
              row: any
            ) =>
              row.crawl_id
          )
          .filter(
            Boolean
          )
      ),
    ]

    for (
      const row of
        crawlProgressRows ??
        []
    ) {
      const userId =
        row.user_id as
          string

      hostedFlowStopsByUserId.set(
        userId,
        (
          hostedFlowStopsByUserId.get(
            userId
          ) ??
          0
        ) +
          1
      )
    }

    const completedHostedFlowsByUserId =
      new Map<
        string,
        number
      >()

    if (
      crawlIds.length >
      0
    ) {
      const {
        data:
          crawlEvents,
      } =
        await supabase
          .from(
            'crawl_events'
          )
          .select(
            'id, venue_ids'
          )
          .in(
            'id',
            crawlIds
          )

      for (
        const profileId of
          profileIds
      ) {
        const userProgressRows =
          crawlProgressRows
            ?.filter(
              (
                row: any
              ) =>
                row.user_id ===
                profileId
            ) ??
          []

        const userCrawlIds = [
          ...new Set(
            userProgressRows
              .map(
                (
                  row: any
                ) =>
                  row.crawl_id
              )
              .filter(
                Boolean
              )
          ),
        ]

        let completedHostedFlows =
          0

        for (
          const crawlId of
            userCrawlIds
        ) {
          const crawl =
            crawlEvents
              ?.find(
                (
                  row: any
                ) =>
                  row.id ===
                  crawlId
              )

          const requiredStops =
            Array.isArray(
              (
                crawl as any
              )?.venue_ids
            )
              ? (
                  crawl as any
                ).venue_ids
                  .length
              : 0

          const completedStops =
            userProgressRows.filter(
              (
                row: any
              ) =>
                row.crawl_id ===
                crawlId
            ).length ??
            0

          if (
            requiredStops >
              0 &&
            completedStops >=
              requiredStops
          ) {
            completedHostedFlows +=
              1
          }
        }

        completedHostedFlowsByUserId.set(
          profileId,
          completedHostedFlows
        )
      }
    }

    const followingIds =
      new Set(
        (
          followingRows ??
          []
        ).map(
          (
            row
          ) =>
            row.following_id as
              string
        )
      )

    const categories =
      normalizeReputationCategories(
        reputationCategoriesResult.error
          ? []
          : reputationCategoriesResult.data
      )

    const categoriesById =
      new Map(
        categories.map(
          (
            category
          ) => [
            category.id,
            category,
          ]
        )
      )

    const reputationRows =
      normalizeReputationRows(
        reputationStatsResult.error
          ? []
          : reputationStatsResult.data
      )

    const latestPolicyVersion =
      determineLatestPolicyVersion(
        reputationRows
      )

        const latestReputationRows =
      latestPolicyVersion ===
      null
        ? []
        : reputationRows.filter(
            (
              row
            ) =>
              row.policyVersion ===
              latestPolicyVersion
          )

    /**
     * When a city leaderboard is selected, only users with
     * recorded verified venue activity in that city may appear.
     *
     * Global leaderboards remain open to every discoverable user.
     */
    const cityParticipantUserIds =
      filters.scope ===
        'city' &&
      filters.cityKey
        ? new Set(
            latestReputationRows
              .filter(
                (
                  row
                ) =>
                  row.scope ===
                    'city' &&
                  row.cityKey ===
                    filters.cityKey &&
                  row.verifiedVenueCount >
                    0
              )
              .map(
                (
                  row
                ) =>
                  row.userId
              )
          )
        : null

    const reputationRankings =
      buildReputationRankings({
        rows:
          latestReputationRows,

        categoriesById,

        filters,
      })

    const reputationByUserId =
      new Map<
        string,
        RankedReputationRow
      >()

    for (
      const ranking of
        reputationRankings
    ) {
      if (
        !reputationByUserId.has(
          ranking.userId
        )
      ) {
        reputationByUserId.set(
          ranking.userId,
          ranking
        )
      }
    }

    const mappedUsers:
      LeaderboardUser[] =
      profiles.map(
        (
          profile
        ) => {
          const {
            level:
              passportLevel,
          } =
            getPassportSnapshot({
              hostedCrawls:
                hostedCrawlsByUserId.get(
                  profile.id
                ) ??
                0,

              joinedCrawls:
                joinedCrawlsByUserId.get(
                  profile.id
                ) ??
                0,

              pastCrawls:
                pastCrawlsByUserId.get(
                  profile.id
                ) ??
                0,

              savedProperties:
                savedPropertiesByUserId.get(
                  profile.id
                ) ??
                0,

              completedFlows:
                completedFlowsByUserId.get(
                  profile.id
                ) ??
                0,

              completedFlowStops:
                completedFlowStopsByUserId.get(
                  profile.id
                ) ??
                0,

              hostedFlowStops:
                hostedFlowStopsByUserId.get(
                  profile.id
                ) ??
                0,

              completedHostedFlows:
                completedHostedFlowsByUserId.get(
                  profile.id
                ) ??
                0,

              venueVisits:
                venueVisitsByUserId.get(
                  profile.id
                ) ??
                0,

              eventXp:
                xpByUserId.get(
                  profile.id
                ) ??
                0,

              eventCheckins:
                checkinsByUserId.get(
                  profile.id
                ) ??
                0,
            })

          const reputationRanking =
            reputationByUserId.get(
              profile.id
            ) ??
            null

          return {
            id:
              profile.id,

            username:
              profile.username,

            full_name:
              profile.full_name,

            avatar_url:
              profile.avatar_url,

            bio:
              profile.bio,

            home_neighborhood:
              profile.home_neighborhood,

            preferred_vibes:
              profile.preferred_vibes,

            interest_categories:
              profile.interest_categories,

            passport_level:
              passportLevel,

            followers_count:
              followersByUserId.get(
                profile.id
              ) ??
              0,

            completed_flows_count:
              completedFlowsByUserId.get(
                profile.id
              ) ??
              0,

            venue_visits_count:
              venueVisitsByUserId.get(
                profile.id
              ) ??
              0,

            checkins_count:
              checkinsByUserId.get(
                profile.id
              ) ??
              0,

            is_following:
              followingIds.has(
                profile.id
              ),

            rank:
              0,

            reputation_category_id:
              reputationRanking
                ?.categoryId ??
              filters.categoryId,

            reputation_category_label:
              reputationRanking
                ?.categoryLabel ??
              (
                filters.categoryId
                  ? categoriesById.get(
                      filters.categoryId
                    )
                      ?.label ??
                    null
                  : null
              ),

            reputation_category_short_label:
              reputationRanking
                ?.categoryShortLabel ??
              (
                filters.categoryId
                  ? categoriesById.get(
                      filters.categoryId
                    )
                      ?.shortLabel ??
                    null
                  : null
              ),

            reputation_scope:
              reputationRanking
                ?.scope ??
              (
                filters.categoryId
                  ? filters.scope
                  : null
              ),

            reputation_city_key:
              reputationRanking
                ?.cityKey ??
              (
                filters.scope ===
                  'city'
                  ? filters.cityKey
                  : null
              ),

            reputation_level:
              reputationRanking
                ?.reputationLevel ??
              null,

            reputation_score:
              reputationRanking
                ?.reputationScore ??
              null,

            reputation_rank:
              reputationRanking
                ?.reputationRank ??
              null,

            reputation_population:
              reputationRanking
                ?.eligibleCreatorCount ??
              0,

            reputation_top_percent:
              reputationRanking
                ?.topPercent ??
              null,

            reputation_percentile_standing:
              reputationRanking
                ?.percentileStanding ??
              null,

            reputation_rank_label:
              reputationRanking
                ?.rankLabel ??
              null,

            reputation_verified_venue_count:
              reputationRanking
                ?.verifiedVenueCount ??
              0,

            reputation_weighted_venue_count:
              reputationRanking
                ?.weightedVenueCount ??
              0,

            reputation_completed_flow_count:
              reputationRanking
                ?.completedFlowCount ??
              0,
          }
        }
      )

    /**
     * Global leaderboards include every discoverable user.
     *
     * City leaderboards include only users with verified venue
     * activity in the selected city. Within that city population,
     * users with qualifying category reputation appear first;
     * users still building the category use Passport fallback
     * ordering beneath them.
     */
    const rankedUsers =
      mappedUsers
        .filter(
          (
            profile
          ) =>
            cityParticipantUserIds ===
              null ||
            cityParticipantUserIds.has(
              profile.id
            )
        )
        .sort(
          (
            first,
            second
          ) =>
            compareLeaderboardUsers({
              first,
              second,

              useReputation:
                Boolean(
                  filters.categoryId
                ),
            })
        )
        .map(
          (
            profile,
            index
          ) => ({
            ...profile,

            rank:
              index +
              1,
          })
        )

    const response:
      LeaderboardResponse = {
      users:
        rankedUsers,

      currentUserId:
        user?.id ??
        null,

      filters: {
        scope:
          filters.scope,

        categoryId:
          filters.categoryId,

        cityKey:
          filters.cityKey,
      },

      options: {
        categories:
          categories.map(
            (
              category
            ) => ({
              id:
                category.id,

              label:
                category.label,

              shortLabel:
                category.shortLabel,
            })
          ),

        cities:
          LEADERBOARD_CITY_OPTIONS,
      },

      reputationPolicyVersion:
        latestPolicyVersion,
    }

    return NextResponse.json(
      response,
      {
        status:
          200,

        headers: {
          'Cache-Control':
            'private, no-store, max-age=0',

          Pragma:
            'no-cache',
        },
      }
    )
  } catch (
    error
  ) {
    console.error(
      'Unexpected discover leaderboard error:',
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
 * Filter parsing
 * ======================================================= */

function parseLeaderboardFilters(
  request: Request
): LeaderboardFilters {
  const url =
    new URL(
      request.url
    )

  const rawScope =
    normalizeNullableText(
      url.searchParams.get(
        'scope'
      )
    )

  const scope:
    LeaderboardScope =
    rawScope ===
    'city'
      ? 'city'
      : 'global'

  const categoryId =
    normalizeIdentifier(
      url.searchParams.get(
        'category'
      ) ??
      url.searchParams.get(
        'categoryId'
      )
    )

  const requestedCityKey =
    normalizeCityKey(
      url.searchParams.get(
        'city'
      ) ??
      url.searchParams.get(
        'cityKey'
      )
    )

  const defaultCityKey =
    SUPPORTED_CITIES[
      0
    ]?.value ??
    null

  /**
   * City rankings accept only canonical Roam cities.
   *
   * Human-readable aliases are normalized through the shared
   * city utility. Unsupported and partial values never become
   * ranking populations.
   */
  const cityKey =
    scope ===
    'city'
      ? isSupportedCityKey(
          requestedCityKey
        )
        ? requestedCityKey
        : defaultCityKey
      : null

  return {
    scope,
    categoryId,
    cityKey,
  }
}

/* =========================================================
 * Reputation normalization
 * ======================================================= */

function normalizeReputationCategories(
  value: unknown
): NormalizedReputationCategory[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const categories:
    NormalizedReputationCategory[] =
    []

  for (
    const item of
      value
  ) {
    if (
      !isRecord(
        item
      )
    ) {
      continue
    }

    const row =
      item as
        ReputationCategoryRow

    if (
      row.is_active ===
      false
    ) {
      continue
    }

    const id =
      normalizeIdentifier(
        row.id
      )

    if (!id) {
      continue
    }

    const label =
      normalizeNullableText(
        row.label
      ) ??
      formatIdentifier(
        id
      )

    categories.push({
      id,

      label,

      shortLabel:
        buildCategoryShortLabel(
          label
        ),

      minimumVenuesForStatus:
        normalizePositiveInteger(
          row.minimum_venues_for_status
        ) ??
        1,

      minimumVenuesForRanking:
        normalizePositiveInteger(
          row.minimum_venues_for_ranking
        ) ??
        1,

      sortOrder:
        normalizeNonNegativeInteger(
          row.sort_order
        ),
    })
  }

  return categories.sort(
    (
      first,
      second
    ) => {
      if (
        first.sortOrder !==
        second.sortOrder
      ) {
        return (
          first.sortOrder -
          second.sortOrder
        )
      }

      return first.label.localeCompare(
        second.label,
        'en-US',
        {
          sensitivity:
            'base',
        }
      )
    }
  )
}

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
    const item of
      value
  ) {
    if (
      !isRecord(
        item
      )
    ) {
      continue
    }

    const row =
      item as
        ReputationStatsRow

    const userId =
      normalizeIdentifier(
        row.user_id
      )

    const categoryId =
      normalizeIdentifier(
        row.category_id
      )

    const scope =
      normalizeScope(
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

      completedFlowCount:
        normalizeNonNegativeInteger(
          row.completed_flow_count
        ),

      policyVersion,
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

function buildReputationRankings({
  rows,
  categoriesById,
  filters,
}: {
  rows:
    NormalizedReputationRow[]

  categoriesById:
    Map<
      string,
      NormalizedReputationCategory
    >

  filters:
    LeaderboardFilters
}): RankedReputationRow[] {
  const qualifyingRows =
    rows.filter(
      (
        row
      ) => {
        if (
          row.scope !==
          filters.scope
        ) {
          return false
        }

        if (
          filters.categoryId &&
          row.categoryId !==
            filters.categoryId
        ) {
          return false
        }

        if (
          filters.scope ===
            'city' &&
          row.cityKey !==
            filters.cityKey
        ) {
          return false
        }

        if (
          row.reputationLevel ===
          'unranked'
        ) {
          return false
        }

        const category =
          categoriesById.get(
            row.categoryId
          )

        if (!category) {
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

  const groupedRows =
    new Map<
      string,
      NormalizedReputationRow[]
    >()

  for (
    const row of
      qualifyingRows
  ) {
    const key =
      buildRankingPopulationKey(
        row
      )

    const existing =
      groupedRows.get(
        key
      ) ??
      []

    existing.push(
      row
    )

    groupedRows.set(
      key,
      existing
    )
  }

  const rankedRows:
    RankedReputationRow[] =
    []

  for (
    const populationRows of
      groupedRows.values()
  ) {
    const sortedRows =
      populationRows
        .slice()
        .sort(
          compareReputationRows
        )

    const population =
      sortedRows.length

    for (
      let index =
        0;
      index <
      sortedRows.length;
      index +=
        1
    ) {
      const row =
        sortedRows[
          index
        ]

      const rank =
        calculateCompetitionRank({
          rows:
            sortedRows,

          index,
        })

      const category =
        categoriesById.get(
          row.categoryId
        )

      if (!category) {
        continue
      }

      const topPercent =
        calculateTopPercent({
          rank,

          population,
        })

      const percentileStanding =
        calculatePercentileStanding({
          rank,

          population,
        })

      rankedRows.push({
        userId:
          row.userId,

        categoryId:
          row.categoryId,

        categoryLabel:
          category.label,

        categoryShortLabel:
          category.shortLabel,

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

        completedFlowCount:
          row.completedFlowCount,

        reputationRank:
          rank,

        eligibleCreatorCount:
          population,

        topPercent,

        percentileStanding,

        rankLabel:
          buildReputationRankLabel({
            rank,

            population,

            topPercent,
          }),
      })
    }
  }

  return rankedRows.sort(
    (
      first,
      second
    ) => {
      if (
        first.reputationRank !==
        second.reputationRank
      ) {
        return (
          first.reputationRank -
          second.reputationRank
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

      return first.categoryLabel.localeCompare(
        second.categoryLabel,
        'en-US',
        {
          sensitivity:
            'base',
        }
      )
    }
  )
}

function buildRankingPopulationKey(
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

  if (
    first.completedFlowCount !==
    second.completedFlowCount
  ) {
    return (
      second.completedFlowCount -
      first.completedFlowCount
    )
  }

  return first.userId.localeCompare(
    second.userId
  )
}

function calculateCompetitionRank({
  rows,
  index,
}: {
  rows:
    NormalizedReputationRow[]

  index:
    number
}): number {
  if (
    index <=
    0
  ) {
    return 1
  }

  const current =
    rows[
      index
    ]

  const previous =
    rows[
      index -
      1
    ]

  if (
    haveEquivalentReputationStanding(
      current,
      previous
    )
  ) {
    return calculateCompetitionRank({
      rows,

      index:
        index -
        1,
    })
  }

  return index +
    1
}

function haveEquivalentReputationStanding(
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
      second.weightedVenueCount &&
    first.completedFlowCount ===
      second.completedFlowCount
  )
}

function calculateTopPercent({
  rank,
  population,
}: {
  rank:
    number

  population:
    number
}): number {
  if (
    population <=
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
          population
        ) *
          100
      )
    ),
    2
  )
}

function calculatePercentileStanding({
  rank,
  population,
}: {
  rank:
    number

  population:
    number
}): number {
  if (
    population <=
    1
  ) {
    return 0
  }

  const usersBelow =
    Math.max(
      0,
      population -
        rank
    )

  return roundToPrecision(
    (
      usersBelow /
      population
    ) *
      100,
    2
  )
}

function buildReputationRankLabel({
  rank,
  population,
  topPercent,
}: {
  rank:
    number

  population:
    number

  topPercent:
    number
}): string {
  if (
    population <=
    0
  ) {
    return 'No comparison available'
  }

  if (
    population ===
    1
  ) {
    return '#1 of 1'
  }

  return `Top ${formatPercent(
    topPercent
  )}% · #${rank.toLocaleString(
    'en-US'
  )} of ${population.toLocaleString(
    'en-US'
  )}`
}

/* =========================================================
 * Leaderboard ordering
 * ======================================================= */

function compareLeaderboardUsers({
  first,
  second,
  useReputation,
}: {
  first:
    LeaderboardUser

  second:
    LeaderboardUser

  useReputation:
    boolean
}): number {
  if (
    useReputation
  ) {
    if (
      first.reputation_rank !==
        null &&
      second.reputation_rank !==
        null &&
      first.reputation_rank !==
        second.reputation_rank
    ) {
      return (
        first.reputation_rank -
        second.reputation_rank
      )
    }

    if (
      first.reputation_rank !==
        null &&
      second.reputation_rank ===
        null
    ) {
      return -1
    }

    if (
      first.reputation_rank ===
        null &&
      second.reputation_rank !==
        null
    ) {
      return 1
    }

    if (
      first.reputation_score !==
        null &&
      second.reputation_score !==
        null &&
      first.reputation_score !==
        second.reputation_score
    ) {
      return (
        second.reputation_score -
        first.reputation_score
      )
    }
  }

  const levelDelta =
    second.passport_level -
    first.passport_level

  if (
    levelDelta !==
    0
  ) {
    return levelDelta
  }

  const followersDelta =
    second.followers_count -
    first.followers_count

  if (
    followersDelta !==
    0
  ) {
    return followersDelta
  }

  const flowsDelta =
    second.completed_flows_count -
    first.completed_flows_count

  if (
    flowsDelta !==
    0
  ) {
    return flowsDelta
  }

  const checkinsDelta =
    second.checkins_count -
    first.checkins_count

  if (
    checkinsDelta !==
    0
  ) {
    return checkinsDelta
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

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeScope(
  value: unknown
): LeaderboardScope | null {
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

function normalizeIdentifier(
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
      .toLowerCase()

  if (
    !normalized ||
    normalized.length >
      200 ||
    /[\r\n\t\0]/.test(
      normalized
    )
  ) {
    return null
  }

  return normalized
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

function buildCategoryShortLabel(
  label: string
): string {
  const normalized =
    label
      .replace(
        /\s+explorer$/i,
        ''
      )
      .trim()

  return normalized ||
    label
}

function formatIdentifier(
  value: string
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
  value: number
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

function roundToPrecision(
  value: number,
  decimalPlaces: number
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  const safeDecimalPlaces =
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
    safeDecimalPlaces

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