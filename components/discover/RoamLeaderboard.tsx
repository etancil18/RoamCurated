'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import FollowButton from '@/components/profile/FollowButton'

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
  checkins_count?: number

  is_following: boolean
  rank: number

  reputation_category_id?: string | null
  reputation_category_label?: string | null
  reputation_category_short_label?: string | null

  reputation_scope?: LeaderboardScope | null
  reputation_city_key?: string | null

  reputation_level?: ReputationLevel | null
  reputation_score?: number | null

  reputation_rank?: number | null
  reputation_population?: number | null
  reputation_top_percent?: number | null
  reputation_percentile_standing?: number | null
  reputation_rank_label?: string | null

  reputation_verified_venue_count?: number | null
  reputation_weighted_venue_count?: number | null
  reputation_completed_flow_count?: number | null

  /**
   * Compatibility aliases retained while every discover surface
   * migrates to the canonical reputation-prefixed response.
   */
  category_id?: string | null
  category_label?: string | null

  reputationLevel?: ReputationLevel | null

  eligible_creator_count?: number | null
  eligible_user_count?: number | null

  top_percent?: number | null
  percentile_standing?: number | null

  rank_label?: string | null

  scope?: LeaderboardScope | null

  city_key?: string | null
  city_label?: string | null

  verified_venue_count?: number | null
}

type LeaderboardCategoryOption = {
  id: string
  label: string
  shortLabel?: string | null
}

type LeaderboardCityOption = {
  value: string
  label: string
}

type LeaderboardResponse = {
  users?: LeaderboardUser[]
  currentUserId?: string | null

  filters?: {
    categoryId?: string | null
    categoryLabel?: string | null
    scope?: LeaderboardScope | null
    cityKey?: string | null
    cityLabel?: string | null
  }

  options?: {
    categories?: Array<{
      id?: string | null
      label?: string | null
      shortLabel?: string | null
    }>

    cities?: Array<{
      value?: string | null
      key?: string | null
      label?: string | null
    }>
  }

  /**
   * Compatibility fields for an earlier endpoint shape.
   */
  population?: {
    eligibleCreatorCount?: number | null
    calculatedAt?: string | null
  }

  categories?: LeaderboardCategoryOption[]

  cities?: Array<{
    value?: string | null
    key?: string | null
    label?: string | null
  }>

  reputationPolicyVersion?: number | null

  error?: string
  details?: string
}

/* =========================================================
 * Canonical category options
 * ======================================================= */

const DEFAULT_CATEGORY_OPTIONS:
  LeaderboardCategoryOption[] = [
    {
      id:
        'restaurants',
      label:
        'Restaurants',
    },
    {
      id:
        'coffee',
      label:
        'Coffee',
    },
    {
      id:
        'bars_pubs',
      label:
        'Bars & Pubs',
    },
    {
      id:
        'cocktail_bars',
      label:
        'Cocktail Bars',
    },
    {
      id:
        'nightlife',
      label:
        'Nightlife',
    },
    {
      id:
        'arts_culture',
      label:
        'Arts & Culture',
    },
    {
      id:
        'outdoors',
      label:
        'Outdoors',
    },
    {
      id:
        'activities_entertainment',
      label:
        'Activities',
    },
    {
      id:
        'music_venues',
      label:
        'Live Music',
    },
    {
      id:
        'bakeries_desserts',
      label:
        'Bakeries & Desserts',
    },
    {
      id:
        'wellness_fitness',
      label:
        'Wellness & Fitness',
    },
    {
      id:
        'markets_shopping',
      label:
        'Markets & Shopping',
    },
  ]

const REPUTATION_LEVEL_LABELS = {
  unranked:
    'Building',
  emerging:
    'Emerging',
  established:
    'Established',
  expert:
    'Expert',
  elite:
    'Elite',
} as const satisfies Record<
  ReputationLevel,
  string
>

/* =========================================================
 * Component
 * ======================================================= */

export default function RoamLeaderboard() {
  const [
    users,
    setUsers,
  ] =
    useState<
      LeaderboardUser[]
    >([])

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)

  const [
    selectedCategoryId,
    setSelectedCategoryId,
  ] =
    useState(
      'restaurants'
    )

  const [
    selectedScope,
    setSelectedScope,
  ] =
    useState<
      LeaderboardScope
    >(
      'global'
    )

  const [
    selectedCityKey,
    setSelectedCityKey,
  ] =
    useState('')

  const [
    availableCategories,
    setAvailableCategories,
  ] =
    useState<
      LeaderboardCategoryOption[]
    >(
      DEFAULT_CATEGORY_OPTIONS
    )

  const [
    availableCities,
    setAvailableCities,
  ] =
    useState<
      LeaderboardCityOption[]
    >([])

  const [
    responseFilters,
    setResponseFilters,
  ] =
    useState<
      LeaderboardResponse[
        'filters'
      ] | null
    >(
      null
    )

  const [
    eligiblePopulation,
    setEligiblePopulation,
  ] =
    useState<
      number | null
    >(
      null
    )

  useEffect(
    () => {
      let cancelled =
        false

      async function loadLeaderboard() {
        setLoading(
          true
        )

        setError(
          null
        )

        try {
          const params =
            new URLSearchParams({
              category:
                selectedCategoryId,

              scope:
                selectedScope,
            })

          if (
            selectedScope ===
              'city' &&
            selectedCityKey
          ) {
            params.set(
              'city',
              selectedCityKey
            )
          }

          const response =
            await fetch(
              `/api/discover/leaderboard?${params.toString()}`,
              {
                method:
                  'GET',

                credentials:
                  'include',

                cache:
                  'no-store',

                headers: {
                  Accept:
                    'application/json',
                },
              }
            )

          const payload =
            (
              await response
                .json()
                .catch(
                  () =>
                    null
                )
            ) as
              | LeaderboardResponse
              | null

          if (
            !response.ok
          ) {
            throw new Error(
              payload
                ?.details ??
              payload
                ?.error ??
              'Failed to load leaderboard'
            )
          }

          if (cancelled) {
            return
          }

          const normalizedUsers =
            Array.isArray(
              payload
                ?.users
            )
              ? payload
                  ?.users ??
                  []
              : []

          const normalizedCategories =
            normalizeCategoryOptions(
              payload
                ?.options
                ?.categories ??
              payload
                ?.categories
            )

          const normalizedCities =
            normalizeCityOptions(
              payload
                ?.options
                ?.cities ??
              payload
                ?.cities
            )

          const returnedCityKey =
            normalizeNullableText(
              payload
                ?.filters
                ?.cityKey
            )

          setUsers(
            normalizedUsers
          )

          setCurrentUserId(
            payload
              ?.currentUserId ??
              null
          )

          setResponseFilters(
            payload
              ?.filters ??
              null
          )

          setEligiblePopulation(
            deriveEligiblePopulation({
              users:
                normalizedUsers,

              explicitPopulation:
                payload
                  ?.population
                  ?.eligibleCreatorCount,
            })
          )

          if (
            normalizedCategories
              .length >
            0
          ) {
            setAvailableCategories(
              normalizedCategories
            )
          }

          setAvailableCities(
            normalizedCities
          )

          /**
           * The API selects a canonical default city whenever a
           * city scope is requested without a supported city.
           *
           * Mirror that canonical selection in the control so
           * the UI and returned ranking population never diverge.
           */
          if (
            selectedScope ===
              'city' &&
            returnedCityKey &&
            returnedCityKey !==
              selectedCityKey
          ) {
            setSelectedCityKey(
              returnedCityKey
            )
          } else if (
            selectedScope ===
              'city' &&
            !selectedCityKey &&
            normalizedCities
              .length >
              0
          ) {
            setSelectedCityKey(
              normalizedCities[
                0
              ].value
            )
          }
        } catch (
          error
        ) {
          if (cancelled) {
            return
          }

          setUsers(
            []
          )

          setEligiblePopulation(
            null
          )

          setError(
            error instanceof
              Error
              ? error.message
              : 'Failed to load leaderboard'
          )
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            )
          }
        }
      }

      void loadLeaderboard()

      return () => {
        cancelled =
          true
      }
    },
    [
      selectedCategoryId,
      selectedScope,
      selectedCityKey,
    ]
  )

  const selectedCategoryLabel =
    useMemo(
      () =>
        responseFilters
          ?.categoryLabel ??
        availableCategories
          .find(
            (
              category
            ) =>
              category.id ===
              selectedCategoryId
          )
          ?.label ??
        formatIdentifier(
          selectedCategoryId
        ),
      [
        responseFilters,
        availableCategories,
        selectedCategoryId,
      ]
    )

  const selectedGeographyLabel =
    useMemo(
      () => {
        if (
          selectedScope ===
          'global'
        ) {
          return 'Global'
        }

        const canonicalCityKey =
          responseFilters
            ?.cityKey ??
          selectedCityKey

        return (
          responseFilters
            ?.cityLabel ??
          availableCities
            .find(
              (
                city
              ) =>
                city.value ===
                canonicalCityKey
            )
            ?.label ??
          (
            canonicalCityKey
              ? formatIdentifier(
                  canonicalCityKey
                )
              : 'City'
          )
        )
      },
      [
        selectedScope,
        selectedCityKey,
        responseFilters,
        availableCities,
      ]
    )

  const leaderboardTitle =
    selectedScope ===
    'global'
      ? `Top Global ${selectedCategoryLabel} Explorers`
      : `Top ${selectedCategoryLabel} Explorers in ${selectedGeographyLabel}`

  const isCitySelectionMissing =
    selectedScope ===
      'city' &&
    !selectedCityKey

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950 p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
      />

      <div className="relative z-10">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400 sm:text-xs">
              Discover top Roamers
            </p>

            <h2 className="mt-2 break-words text-xl font-bold text-white sm:text-2xl">
              {leaderboardTitle}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              See how Roamers compare
              globally or within cities
              that are live on Roam.
              Everyone stays discoverable,
              while qualifying reputation
              leaders rise to the top.
            </p>

            {eligiblePopulation !==
            null ? (
              <p className="mt-2 text-xs text-neutral-600">
                Reputation percentiles
                compare{' '}
                {eligiblePopulation.toLocaleString(
                  'en-US'
                )}{' '}
                eligible{' '}
                {eligiblePopulation ===
                1
                  ? 'Roamer'
                  : 'Roamers'}{' '}
                in this category and area.
              </p>
            ) : null}
          </div>

          <LeaderboardFilters
            categories={
              availableCategories
            }
            cities={
              availableCities
            }
            selectedCategoryId={
              selectedCategoryId
            }
            selectedScope={
              selectedScope
            }
            selectedCityKey={
              selectedCityKey
            }
            onCategoryChange={
              setSelectedCategoryId
            }
            onScopeChange={
              (
                scope
              ) => {
                setSelectedScope(
                  scope
                )

                if (
                  scope ===
                    'global'
                ) {
                  setSelectedCityKey(
                    ''
                  )
                } else if (
                  !selectedCityKey &&
                  availableCities
                    .length >
                    0
                ) {
                  setSelectedCityKey(
                    availableCities[
                      0
                    ].value
                  )
                }
              }
            }
            onCityChange={
              setSelectedCityKey
            }
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 space-y-2.5">
          {loading ? (
            <LeaderboardSkeleton />
          ) : null}

          {!loading &&
          isCitySelectionMissing &&
          !error ? (
            <EmptyLeaderboardState
              message="Choose a city to see its Roam leaderboard."
            />
          ) : null}

          {!loading &&
          !isCitySelectionMissing &&
          users.length ===
            0 &&
          !error ? (
            <EmptyLeaderboardState
              message="No Roamers are available here yet. Check another category or city."
            />
          ) : null}

          {!loading &&
            !isCitySelectionMissing &&
            users.map(
              (
                user
              ) => {
                const isOwnProfile =
                  currentUserId ===
                  user.id

                const username =
                  user.username ??
                  ''

                const profileHref =
                  username
                    ? `/u/${encodeURIComponent(
                        username
                      )}`
                    : '#'

                const reputationSummary =
                  buildReputationSummary({
                    user,

                    fallbackCategoryLabel:
                      selectedCategoryLabel,

                    fallbackScope:
                      selectedScope,

                    fallbackGeographyLabel:
                      selectedGeographyLabel,
                  })

                const supportingMetrics =
                  buildSupportingMetrics(
                    user
                  )

                return (
                  <article
                    key={
                      user.id
                    }
                    aria-label={`${user.full_name ?? user.username ?? 'Roam User'} leaderboard position`}
                    className={[
                      'group min-w-0 rounded-2xl border bg-black/70 p-3 transition sm:p-4',

                      isOwnProfile
                        ? 'border-cyan-500/35 ring-1 ring-cyan-500/10'
                        : 'border-neutral-800 hover:border-amber-400/35 hover:bg-black',
                    ].join(
                      ' '
                    )}
                  >
                    <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] gap-3 sm:grid-cols-[44px_56px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                      <div
                        className={[
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold sm:h-11 sm:w-11',

                          isOwnProfile
                            ? 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200'
                            : 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300',
                        ].join(
                          ' '
                        )}
                      >
                        #{user.rank}
                      </div>

                      <Link
                        href={
                          profileHref
                        }
                        aria-label={`View ${user.full_name ?? user.username ?? 'Roam User'} public profile`}
                        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-xl transition group-hover:border-neutral-700 sm:h-14 sm:w-14 sm:text-2xl"
                      >
                        {user.avatar_url ? (
                          <img
                            src={
                              user.avatar_url
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
                      </Link>

                      <div className="min-w-0">
                        <Link
                          href={
                            profileHref
                          }
                          className="block min-w-0"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-white transition group-hover:text-amber-200 sm:text-base">
                              {user.full_name ??
                                user.username ??
                                'Roam User'}
                            </h3>

                            {isOwnProfile ? (
                              <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                                You
                              </span>
                            ) : null}
                          </div>

                          {user.username ? (
                            <p className="mt-0.5 truncate text-xs text-neutral-500 sm:text-sm">
                              @{user.username}

                              {user.home_neighborhood
                                ? ` · ${user.home_neighborhood}`
                                : ''}
                            </p>
                          ) : null}
                        </Link>

                        {reputationSummary ? (
                          <div className="mt-2 min-w-0">
                            <p className="break-words text-xs font-semibold leading-5 text-cyan-300 sm:text-sm">
                              {
                                reputationSummary.primary
                              }
                            </p>

                            {reputationSummary.secondary ? (
                              <p className="mt-0.5 break-words text-[11px] leading-4 text-neutral-500">
                                {
                                  reputationSummary.secondary
                                }
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-2 min-w-0">
                            <p className="text-xs font-medium leading-5 text-neutral-400">
                              Building{' '}
                              {
                                selectedCategoryLabel
                              }{' '}
                              reputation
                            </p>

                            <p className="mt-0.5 text-[11px] leading-4 text-neutral-600">
                              Not yet eligible
                              for a category
                              percentile.
                            </p>
                          </div>
                        )}

                        {supportingMetrics.length >
                        0 ? (
                          <div className="mt-2.5 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
                            {supportingMetrics.map(
                              (
                                metric
                              ) => (
                                <span
                                  key={
                                    metric.label
                                  }
                                  className="whitespace-nowrap"
                                >
                                  <span className="font-medium text-neutral-400">
                                    {
                                      metric.value
                                    }
                                  </span>{' '}
                                  {
                                    metric.label
                                  }
                                </span>
                              )
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="col-span-3 mt-1 flex min-w-0 items-center justify-end gap-2 sm:col-span-1 sm:mt-0 sm:justify-start">
                        {isOwnProfile ? (
                          <>
                            

                            <Link
                              href={
                                profileHref
                              }
                              aria-label={`View ${user.full_name ?? user.username ?? 'your'} public profile`}
                              className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-cyan-400/40 hover:bg-neutral-800 hover:text-white"
                            >
                              View profile
                            </Link>
                          </>
                        ) : (
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
                              user.followers_count
                            }
                          />
                        )}
                      </div>
                    </div>
                  </article>
                )
              }
            )}
        </div>
      </div>
    </section>
  )
}

/* =========================================================
 * Filters
 * ======================================================= */

function LeaderboardFilters({
  categories,
  cities,
  selectedCategoryId,
  selectedScope,
  selectedCityKey,
  onCategoryChange,
  onScopeChange,
  onCityChange,
}: {
  categories:
    LeaderboardCategoryOption[]

  cities:
    LeaderboardCityOption[]

  selectedCategoryId:
    string

  selectedScope:
    LeaderboardScope

  selectedCityKey:
    string

  onCategoryChange:
    (
      value:
        string
    ) => void

  onScopeChange:
    (
      value:
        LeaderboardScope
    ) => void

  onCityChange:
    (
      value:
        string
    ) => void
}) {
  return (
    <div className="grid w-full min-w-0 gap-3 rounded-2xl border border-neutral-800 bg-black/30 p-3 sm:grid-cols-2 lg:w-auto lg:min-w-[360px]">
      <label className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600">
          Category
        </span>

        <select
          value={
            selectedCategoryId
          }
          onChange={
            (
              event
            ) =>
              onCategoryChange(
                event.target
                  .value
              )
          }
          className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm font-medium text-neutral-200 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
        >
          {categories.map(
            (
              category
            ) => (
              <option
                key={
                  category.id
                }
                value={
                  category.id
                }
              >
                {
                  category.label
                }
              </option>
            )
          )}
        </select>
      </label>

      <label className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600">
          Area
        </span>

        <select
          value={
            selectedScope
          }
          onChange={
            (
              event
            ) =>
              onScopeChange(
                event.target
                  .value as
                  LeaderboardScope
              )
          }
          className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm font-medium text-neutral-200 outline-none transition focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
        >
          <option value="global">
            Global
          </option>

          <option value="city">
            City
          </option>
        </select>
      </label>

      {selectedScope ===
      'city' ? (
        <label className="min-w-0 sm:col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600">
            City
          </span>

          <select
            value={
              selectedCityKey
            }
            onChange={
              (
                event
              ) =>
                onCityChange(
                  event.target
                    .value
                )
            }
            disabled={
              cities.length ===
              0
            }
            className="mt-1.5 min-h-11 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm font-medium text-neutral-200 outline-none transition disabled:cursor-not-allowed disabled:text-neutral-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10"
          >
            {cities.length ===
            0 ? (
              <option value="">
                No live cities available
              </option>
            ) : null}

            {cities.map(
              (
                city
              ) => (
                <option
                  key={
                    city.value
                  }
                  value={
                    city.value
                  }
                >
                  {
                    city.label
                  }
                </option>
              )
            )}
          </select>
        </label>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Reputation presentation
 * ======================================================= */

function buildReputationSummary({
  user,
  fallbackCategoryLabel,
  fallbackScope,
  fallbackGeographyLabel,
}: {
  user:
    LeaderboardUser

  fallbackCategoryLabel:
    string

  fallbackScope:
    LeaderboardScope

  fallbackGeographyLabel:
    string
}): {
  primary: string
  secondary: string | null
} | null {
  const eligibleCreatorCount =
    normalizeNonNegativeInteger(
      user
        .reputation_population ??
      user
        .eligible_creator_count ??
      user
        .eligible_user_count
    )

  /**
   * The general `rank` field is the user's displayed position
   * among everyone returned by the leaderboard.
   *
   * Reputation claims must use the separate category-specific
   * reputation rank.
   */
  const reputationRank =
    normalizePositiveInteger(
      user
        .reputation_rank
    )

  const topPercent =
    normalizePercentage(
      user
        .reputation_top_percent ??
      user
        .top_percent ??
      (
        reputationRank !==
          null &&
        eligibleCreatorCount !==
          null &&
        eligibleCreatorCount >
          0
          ? (
              reputationRank /
              eligibleCreatorCount
            ) *
              100
          : null
      )
    )

  const categoryLabel =
    normalizeNullableText(
      user
        .reputation_category_short_label ??
      user
        .reputation_category_label ??
      user
        .category_label
    ) ??
    fallbackCategoryLabel

  const scope =
    user
      .reputation_scope ??
    user
      .scope ??
    fallbackScope

  const cityKey =
    normalizeNullableText(
      user
        .reputation_city_key ??
      user
        .city_key
    )

  const cityLabel =
    normalizeNullableText(
      user
        .city_label
    )

  const geographyLabel =
    scope ===
    'global'
      ? 'globally'
      : cityLabel ??
        (
          cityKey
            ? formatIdentifier(
                cityKey
              )
            : fallbackGeographyLabel
        )

  const level =
    normalizeReputationLevel(
      user
        .reputation_level ??
      user
        .reputationLevel
    )

  const explicitRankLabel =
    normalizeNullableText(
      user
        .reputation_rank_label ??
      user
        .rank_label
    )

  let primary:
    string | null =
    null

  if (
    explicitRankLabel
  ) {
    primary =
      explicitRankLabel
  } else if (
    topPercent !==
    null
  ) {
    primary =
      `Top ${formatTopPercent(
        topPercent
      )} ${scope === 'global' ? 'globally' : `in ${geographyLabel}`}`
  } else if (
    reputationRank !==
      null &&
    eligibleCreatorCount !==
      null &&
    eligibleCreatorCount >
      0
  ) {
    primary =
      `#${reputationRank.toLocaleString(
        'en-US'
      )} of ${eligibleCreatorCount.toLocaleString(
        'en-US'
      )} ${scope === 'global' ? 'globally' : `in ${geographyLabel}`}`
  } else if (
    reputationRank !==
      null
  ) {
    primary =
      `#${reputationRank.toLocaleString(
        'en-US'
      )} ${scope === 'global' ? 'globally' : `in ${geographyLabel}`}`
  } else if (
    level !==
    null &&
    level !==
    'unranked'
  ) {
    primary =
      `${REPUTATION_LEVEL_LABELS[level]} ${categoryLabel} Explorer`
  }

  if (!primary) {
    return null
  }

  const secondaryParts:
    string[] = []

  secondaryParts.push(
    categoryLabel
  )

  if (
    level &&
    level !==
      'unranked'
  ) {
    secondaryParts.push(
      REPUTATION_LEVEL_LABELS[
        level
      ]
    )
  }

  if (
    reputationRank !==
      null &&
    eligibleCreatorCount !==
      null &&
    eligibleCreatorCount >
      0 &&
    !explicitRankLabel
  ) {
    secondaryParts.push(
      `#${reputationRank.toLocaleString(
        'en-US'
      )} of ${eligibleCreatorCount.toLocaleString(
        'en-US'
      )}`
    )
  }

  return {
    primary,

    secondary:
      secondaryParts.length >
      0
        ? secondaryParts.join(
            ' · '
          )
        : null,
  }
}

function buildSupportingMetrics(
  user:
    LeaderboardUser
): Array<{
  label: string
  value: string
}> {
  const metrics: Array<{
    label: string
    value: string
  }> = []

  const verifiedVenueCount =
    normalizeNonNegativeInteger(
      user
        .reputation_verified_venue_count ??
      user
        .verified_venue_count
    )

  if (
    verifiedVenueCount !==
      null &&
    verifiedVenueCount >
      0
  ) {
    metrics.push({
      label:
        verifiedVenueCount ===
        1
          ? 'verified venue'
          : 'verified venues',

      value:
        verifiedVenueCount.toLocaleString(
          'en-US'
        ),
    })
  }

  if (
    user.followers_count >
    0
  ) {
    metrics.push({
      label:
        user.followers_count ===
        1
          ? 'follower'
          : 'followers',

      value:
        user.followers_count.toLocaleString(
          'en-US'
        ),
    })
  }

  if (
    user.completed_flows_count >
    0
  ) {
    metrics.push({
      label:
        user.completed_flows_count ===
        1
          ? 'completed flow'
          : 'completed flows',

      value:
        user.completed_flows_count.toLocaleString(
          'en-US'
        ),
    })
  }

  return metrics.slice(
    0,
    3
  )
}

/* =========================================================
 * Response normalization
 * ======================================================= */

function normalizeCategoryOptions(
  value:
    unknown
): LeaderboardCategoryOption[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const options:
    LeaderboardCategoryOption[] =
    []

  const seen =
    new Set<string>()

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

    const id =
      normalizeIdentifier(
        item.id
      )

    if (
      !id ||
      seen.has(
        id
      )
    ) {
      continue
    }

    seen.add(
      id
    )

    options.push({
      id,

      label:
        normalizeNullableText(
          item.label
        ) ??
        formatIdentifier(
          id
        ),

      shortLabel:
        normalizeNullableText(
          item.shortLabel
        ),
    })
  }

  return options
}

function normalizeCityOptions(
  value:
    unknown
): LeaderboardCityOption[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const options:
    LeaderboardCityOption[] =
    []

  const seen =
    new Set<string>()

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

    const cityValue =
      normalizeIdentifier(
        item.value ??
        item.key
      )

    if (
      !cityValue ||
      seen.has(
        cityValue
      )
    ) {
      continue
    }

    seen.add(
      cityValue
    )

    options.push({
      value:
        cityValue,

      label:
        normalizeNullableText(
          item.label
        ) ??
        formatIdentifier(
          cityValue
        ),
    })
  }

  return options
}

function deriveEligiblePopulation({
  users,
  explicitPopulation,
}: {
  users:
    LeaderboardUser[]

  explicitPopulation:
    unknown
}): number | null {
  const normalizedExplicitPopulation =
    normalizeNonNegativeInteger(
      explicitPopulation
    )

  if (
    normalizedExplicitPopulation !==
    null
  ) {
    return normalizedExplicitPopulation
  }

  let maximumPopulation:
    number | null =
    null

  for (
    const user of
      users
  ) {
    const population =
      normalizeNonNegativeInteger(
        user
          .reputation_population ??
        user
          .eligible_creator_count ??
        user
          .eligible_user_count
      )

    if (
      population ===
      null
    ) {
      continue
    }

    if (
      maximumPopulation ===
        null ||
      population >
        maximumPopulation
    ) {
      maximumPopulation =
        population
    }
  }

  return maximumPopulation
}

/* =========================================================
 * Loading and empty states
 * ======================================================= */

function LeaderboardSkeleton() {
  return (
    <div
      aria-label="Loading leaderboard"
      className="space-y-2.5"
    >
      {[
        0,
        1,
        2,
      ].map(
        (
          item
        ) => (
          <div
            key={
              item
            }
            className="animate-pulse rounded-2xl border border-neutral-800 bg-black/60 p-4"
          >
            <div className="grid grid-cols-[40px_48px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[44px_56px_minmax(0,1fr)_96px]">
              <div className="h-10 w-10 rounded-xl bg-neutral-800" />

              <div className="h-12 w-12 rounded-2xl bg-neutral-800 sm:h-14 sm:w-14" />

              <div className="min-w-0">
                <div className="h-4 w-32 max-w-full rounded bg-neutral-800" />

                <div className="mt-2 h-3 w-24 max-w-full rounded bg-neutral-900" />

                <div className="mt-3 h-3 w-48 max-w-full rounded bg-neutral-800" />
              </div>

              <div className="hidden h-10 rounded-full bg-neutral-800 sm:block" />
            </div>
          </div>
        )
      )}
    </div>
  )
}

function EmptyLeaderboardState({
  message,
}: {
  message:
    string
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black/30 px-4 py-8 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 text-xl"
      >
        🧭
      </div>

      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">
        {message}
      </p>
    </div>
  )
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

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

function normalizePositiveInteger(
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
    normalized <=
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

  return normalized ||
    null
}

function normalizeIdentifier(
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
      .toLocaleLowerCase(
        'en-US'
      )

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

function normalizeReputationLevel(
  value:
    unknown
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

function formatTopPercent(
  value:
    number
): string {
  const normalized =
    Math.min(
      100,
      Math.max(
        0.1,
        value
      )
    )

  const rounded =
    normalized <
    1
      ? Math.round(
          normalized *
            10
        ) /
        10
      : Math.max(
          1,
          Math.ceil(
            normalized
          )
        )

  return `${rounded.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        rounded <
        1
          ? 1
          : 0,
    }
  )}%`
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
  value:
    unknown
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