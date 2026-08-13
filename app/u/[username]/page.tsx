import Link from 'next/link'
import { notFound } from 'next/navigation'

import CreatorAuthorityCard from '@/components/public-profile/creator/CreatorAuthorityCard'
import CreatorCollaborationTags from '@/components/public-profile/creator/CreatorCollaborationTags'
import CreatorExplorationMapDynamic from '@/components/public-profile/creator/CreatorExplorationMapDynamic'
import CreatorFeaturedCollections from '@/components/public-profile/creator/CreatorFeaturedCollections'
import CreatorHero from '@/components/public-profile/creator/CreatorHero'
import FollowButton from '@/components/profile/FollowButton'
import ShareProfileButton from '@/components/profile/ShareProfileButton'
import PublicRoamCard from '@/components/public-profile/PublicRoamCard'

import {
  buildCreatorAuthority,
} from '@/lib/creator/buildCreatorAuthority'
import {
  getPublicCreatorProfile,
  PublicCreatorProfileLoadError,
} from '@/lib/creator/getPublicCreatorProfile'
import {
  safelyLoadPublicCreatorMap,
} from '@/lib/creator/safelyLoadPublicCreatorMap'
import {
  safelyLoadPublicCreatorReputation,
} from '@/lib/reputation/safelyLoadPublicCreatorReputation'
import { createServerClient } from '@/lib/supabase/server'

import type {
  CreatorAuthorityStats,
  PublicCreatorBundle,
} from '@/lib/creator/types'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{
    username: string
  }>
}

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
  show_xp: boolean | null
  show_completed_flows: boolean | null
  show_checkins: boolean | null
  show_saved_guides: boolean | null
  show_social_groups: boolean | null
  creator_mode_enabled: boolean | null
  creator_headline: string | null
  show_public_exploration_map: boolean
}

type ProfilePublicStatsRow = {
  hosted_crawls: number
  joined_crawls: number
  past_crawls: number
  saved_properties: number
  completed_flows: number
  completed_flow_stops: number
  hosted_flow_stops: number
  completed_hosted_flows: number
  venue_visits: number
  event_xp: number
  event_checkins: number
  passport_xp: number
  passport_level: number
  passport_progress: number
  passport_progress_percent: number
  updated_at: string
}

type PublicFlowSnapshotStop = {
  venueId: string
  stopIndex: number
  venue: {
    id: string
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
  }
}

type PublicFlowSnapshotRow = {
  id: string
  title: string | null
  city: string | null
  status: string | null
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  source_type: string | null
  source_id: string | null
  visibility: 'public'
  replayable: boolean
  created_at: string
  stops: PublicFlowSnapshotStop[]
}

type PublicCreatorReputationResult =
  Awaited<
    ReturnType<
      typeof safelyLoadPublicCreatorReputation
    >
  >

type CreatorProfileSectionId =
  | 'overview'
  | 'places'
  | 'reputation'
  | 'guides'
  | 'moments'
  | 'taste'

type CreatorProfileNavigationItem = {
  id: CreatorProfileSectionId
  label: string
  visible: boolean
}

/* =========================================================
 * Page
 * ======================================================= */

export default async function PublicUserProfilePage({
  params,
}: Props) {
  const { username } = await params

  const normalizedUsername = decodeURIComponent(
    username
  )
    .trim()
    .toLowerCase()

  if (!normalizedUsername) {
    notFound()
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const {
    data: profile,
    error,
  } = await supabase
    .from('profiles')
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
      show_xp,
      show_completed_flows,
      show_checkins,
      show_saved_guides,
      show_social_groups,
      creator_mode_enabled,
      creator_headline,
      show_public_exploration_map
    `)
    .ilike(
      'username',
      normalizedUsername
    )
    .maybeSingle<ProfileRow>()

  if (error || !profile) {
    notFound()
  }

  const isOwnProfile =
    user?.id === profile.id

  const isPublic =
    profile.is_public !== false

  if (!isPublic && !isOwnProfile) {
    notFound()
  }

  await logPublicProfileViewed({
    supabase,
    viewerUserId: user?.id ?? null,
    profileUserId: profile.id,
    username: profile.username,
    isOwnProfile,
    isPublic,
  })

  const creatorModeRequested =
    profile.creator_mode_enabled === true

  const publicMapRequested =
    creatorModeRequested &&
    profile.show_public_exploration_map ===
      true

  const creatorBundlePromise =
    creatorModeRequested
      ? safelyLoadPublicCreatorProfile({
          supabase,
          userId: profile.id,
        })
      : Promise.resolve(null)

  const creatorMapPromise =
    publicMapRequested
      ? safelyLoadPublicCreatorMap({
          userId: profile.id,
        })
      : Promise.resolve(null)

  const creatorReputationPromise =
    creatorModeRequested
      ? loadPublicCreatorReputationSafely({
          userId: profile.id,
        })
      : Promise.resolve(null)

  const publicCreatorCollectionCountPromise =
    creatorModeRequested
      ? supabase
          .from(
            'creator_collections'
          )
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq(
            'user_id',
            profile.id
          )
          .eq(
            'visibility',
            'public'
          )
      : Promise.resolve({
          count: 0,
          error: null,
        })

  const [
    followersResult,
    followingResult,
    existingFollowResult,
    publicStatsResult,
    socialGroupsResult,
    snapshotResult,
    creatorBundle,
    creatorMap,
    creatorReputationResult,
    publicCreatorCollectionCountResult,
  ] = await Promise.all([
    supabase
      .from('user_follows')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq(
        'following_id',
        profile.id
      ),

    supabase
      .from('user_follows')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq(
        'follower_id',
        profile.id
      ),

    user && !isOwnProfile
      ? supabase
          .from('user_follows')
          .select('id')
          .eq(
            'follower_id',
            user.id
          )
          .eq(
            'following_id',
            profile.id
          )
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
      .from(
        'profile_public_stats'
      )
      .select(`
        hosted_crawls,
        joined_crawls,
        past_crawls,
        saved_properties,
        completed_flows,
        completed_flow_stops,
        hosted_flow_stops,
        completed_hosted_flows,
        venue_visits,
        event_xp,
        event_checkins,
        passport_xp,
        passport_level,
        passport_progress,
        passport_progress_percent,
        updated_at
      `)
      .eq(
        'user_id',
        profile.id
      )
      .maybeSingle<ProfilePublicStatsRow>(),

    profile.show_social_groups === false
      ? Promise.resolve({
          count: 0,
          error: null,
        })
      : supabase
          .from(
            'social_group_members'
          )
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq(
            'user_id',
            profile.id
          ),

    supabase
      .from(
        'flow_snapshots' as any
      )
      .select(`
        id,
        title,
        city,
        status,
        cover_image_url,
        route_summary,
        checked_in_count,
        total_stops,
        source_type,
        source_id,
        visibility,
        replayable,
        created_at,
        flow_snapshot_stops (
          venue_id,
          stop_index,
          venues (
            id,
            name,
            city,
            lat,
            lon
          )
        )
      `)
      .eq(
        'user_id',
        profile.id
      )
      .eq(
        'visibility',
        'public'
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )
      .limit(9),

    creatorBundlePromise,

    creatorMapPromise,

    creatorReputationPromise,

    publicCreatorCollectionCountPromise,
  ])

  if (followersResult.error) {
    console.error(
      '[public profile] Failed to load follower count:',
      followersResult.error
    )
  }

  if (followingResult.error) {
    console.error(
      '[public profile] Failed to load following count:',
      followingResult.error
    )
  }

  if (existingFollowResult.error) {
    console.error(
      '[public profile] Failed to load follow status:',
      existingFollowResult.error
    )
  }

  if (publicStatsResult.error) {
    console.error(
      '[public profile] Failed to load canonical Passport stats:',
      publicStatsResult.error
    )
  }

  if (socialGroupsResult.error) {
    console.error(
      '[public profile] Failed to load social group count:',
      socialGroupsResult.error
    )
  }

  if (snapshotResult.error) {
    console.error(
      '[public profile] Failed to load public flow snapshots:',
      snapshotResult.error
    )
  }

  if (
    publicCreatorCollectionCountResult.error
  ) {
    console.error(
      '[public profile] Failed to load public creator collection count:',
      publicCreatorCollectionCountResult.error
    )
  }

  const followersCount =
    followersResult.count ?? 0

  const followingCount =
    followingResult.count ?? 0

  const existingFollow =
    existingFollowResult.data

  const publicStats =
    publicStatsResult.data

  const socialGroupsCount =
    socialGroupsResult.count ?? 0

  const passportLevel =
    publicStats?.passport_level ?? 1

  const completedFlowsCount =
    publicStats?.completed_flows ?? 0

  const venueVisitsCount =
    publicStats?.venue_visits ?? 0

  const eventCheckinsCount =
    publicStats?.event_checkins ?? 0

  const savedPropertiesCount =
    publicStats?.saved_properties ?? 0

  const snapshots =
    normalizePublicSnapshots(
      snapshotResult.data
    )

  const creatorUsername =
    creatorModeRequested &&
    creatorBundle !== null &&
    profile.username
      ? profile.username
      : null

  const isCreator =
    creatorUsername !== null &&
    creatorBundle !== null

  const creatorDisplayName =
    profile.full_name ??
    profile.username ??
    'Roam Creator'

  const creatorAuthority:
    | CreatorAuthorityStats
    | null = isCreator
    ? buildCreatorAuthority({
        primaryCity:
          creatorBundle.profile
            .primary_city,

        verifiedVisitCount:
          venueVisitsCount,

        completedFlowCount:
          completedFlowsCount,

        publicSnapshotCount:
          snapshots.length,

        publicCollectionCount:
          publicCreatorCollectionCountResult.count ??
          0,
      })
    : null

  const creatorReputation =
    creatorReputationResult?.found === true
      ? creatorReputationResult.reputation
      : null

  const hasTasteProfile =
    (
      profile.preferred_vibes
        ?.length ??
      0
    ) >
      0 ||
    (
      profile.interest_categories
        ?.length ??
      0
    ) >
      0

  const hasFeaturedCollections =
    isCreator &&
    creatorBundle.featuredCollections
      .length > 0

  const creatorNavigationItems:
    CreatorProfileNavigationItem[] =
    isCreator
      ? [
          {
            id: 'overview',
            label: 'Overview',
            visible: true,
          },
          {
            id: 'places',
            label: 'Places',
            visible:
              creatorMap !== null,
          },
          {
            id: 'reputation',
            label: 'Reputation',
            visible:
              creatorReputation !==
              null,
          },
          {
            id: 'guides',
            label: 'Guides',
            visible:
              hasFeaturedCollections,
          },
          {
            id: 'moments',
            label: 'Moments',
            visible:
              snapshots.length > 0,
          },
          {
            id: 'taste',
            label: 'Taste',
            visible:
              hasTasteProfile,
          },
        ]
      : []

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1.25rem)] text-white sm:px-6 sm:pb-28">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-[-22%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-400/[0.07] blur-[120px] sm:left-[-8%]" />

        <div className="absolute right-[-25%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.08] blur-[140px] sm:right-[-10%]" />

        <div className="absolute bottom-[-18%] left-[26%] h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/[0.035] blur-[140px]" />

        <div className="absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {isOwnProfile ? (
              <Link
                href="/profile"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/[0.045] px-4 py-2 text-sm font-semibold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.08] hover:text-white"
              >
                Edit profile
              </Link>
            ) : (
              <Link
                href="/discover"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-white/[0.045] px-4 py-2 text-sm font-semibold text-zinc-400 ring-1 ring-white/[0.07] transition hover:bg-white/[0.08] hover:text-white"
              >
                <span aria-hidden="true">
                  ←
                </span>

                Discover
              </Link>
            )}
          </div>

          <ShareProfileButton
            username={
              profile.username
            }
            fullName={
              profile.full_name
            }
          />
        </div>

        {isCreator ? (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-transparent shadow-[0_30px_100px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.075]">
              <CreatorHero
                displayName={
                  profile.full_name
                }
                username={
                  creatorUsername
                }
                avatarUrl={
                  profile.avatar_url
                }
                headline={
                  profile.creator_headline
                }
                bio={
                  creatorBundle.profile
                    .creator_bio
                }
                primaryCity={
                  creatorBundle.profile
                    .primary_city
                }
                acceptingCollaborations={
                  creatorBundle.profile
                    .accepting_collaborations
                }
                availableForTravel={
                  creatorBundle.profile
                    .available_for_travel
                }
                publicEmail={
                  creatorBundle.profile
                    .public_email
                }
                socialLinks={
                  creatorBundle.socialLinks
                }
                followersCount={
                  followersCount
                }
                followingCount={
                  followingCount
                }
                passportLevel={
                  profile.show_xp !== false
                    ? passportLevel
                    : null
                }
              />
            </div>

            {!isOwnProfile ? (
              <CreatorActionBar
                userId={profile.id}
                existingFollow={
                  Boolean(
                    existingFollow
                  )
                }
                followersCount={
                  followersCount
                }
                isAuthenticated={
                  Boolean(user)
                }
              />
            ) : null}

            <CreatorProfileNavigation
              items={
                creatorNavigationItems
              }
            />
          </div>
        ) : (
          <section className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-transparent p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.075] sm:p-7">
            <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-56 w-56 rounded-full bg-cyan-400/[0.08] blur-3xl" />

            <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.75rem] bg-white/[0.05] text-4xl ring-1 ring-white/[0.08]">
                {profile.avatar_url ? (
                  <img
                    src={
                      profile.avatar_url
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>⌖</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.045] px-3 py-1.5 ring-1 ring-white/[0.07]">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                    Roam Passport
                  </p>
                </div>

                <h1 className="mt-4 break-words text-3xl font-black tracking-[-0.04em] sm:text-4xl">
                  {profile.full_name ??
                    profile.username}
                </h1>

                <p className="mt-1.5 break-words text-sm text-zinc-500">
                  @{profile.username}

                  {profile.home_neighborhood
                    ? ` · ${profile.home_neighborhood}`
                    : ''}
                </p>

                {profile.bio ? (
                  <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-zinc-400">
                    {profile.bio}
                  </p>
                ) : null}
              </div>

              {!isOwnProfile ? (
                <FollowButton
                  userId={profile.id}
                  initialIsFollowing={
                    Boolean(
                      existingFollow
                    )
                  }
                  initialFollowersCount={
                    followersCount
                  }
                  disabled={!user}
                />
              ) : null}
            </div>
          </section>
        )}

        {!isCreator ? (
          <section
            aria-label="Profile stats"
            className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6"
          >
            <Stat
              label="Followers"
              value={
                followersCount
              }
            />

            <Stat
              label="Following"
              value={
                followingCount
              }
            />

            {profile.show_xp !== false ? (
              <Stat
                label="Passport level"
                value={passportLevel}
              />
            ) : null}

            {profile.show_completed_flows !==
            false ? (
              <Stat
                label="Flows"
                value={
                  completedFlowsCount
                }
              />
            ) : null}

            {profile.show_checkins !==
            false ? (
              <Stat
                label="Check-ins"
                value={
                  eventCheckinsCount
                }
              />
            ) : null}

            {profile.show_saved_guides !==
            false ? (
              <Stat
                label="Saved guides"
                value={
                  savedPropertiesCount
                }
              />
            ) : null}

            {profile.show_social_groups !==
            false ? (
              <Stat
                label="Groups"
                value={
                  socialGroupsCount
                }
              />
            ) : null}
          </section>
        ) : null}

        {isCreator ? (
          <div className="mt-10 space-y-20 sm:mt-14 sm:space-y-24">
            <section
              id="overview"
              aria-labelledby="creator-overview-title"
              className="scroll-mt-32 space-y-6"
            >
              <ProfileSectionHeading
                id="creator-overview-title"
                eyebrow="Point of view"
                title={`How ${creatorDisplayName} sees the city`}
                description="A look at the places they know, the experiences they complete, and the perspective they are building through real-world activity."
              />

              <CreatorAuthorityCard
                authority={
                  creatorAuthority
                }
              />

              {creatorMap ? (
                <section
                  id="places"
                  aria-labelledby="creator-exploration-map-title"
                  className="scroll-mt-32 space-y-6 pt-6"
                >
                  <ProfileSectionHeading
                    id="creator-exploration-map-title"
                    eyebrow="Their footprint"
                    title={`Places ${creatorDisplayName} actually knows`}
                    description="Geo-verified places this creator has visited and chosen to make part of their public city story."
                  />

                  <div className="overflow-hidden rounded-[2rem] bg-white/[0.025] shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]">
                    <CreatorExplorationMapDynamic
                      map={creatorMap}
                      creatorName={
                        creatorDisplayName
                      }
                      primaryCity={
                        creatorBundle.profile
                          .primary_city
                      }
                      scrollWheelZoom={
                        false
                      }
                    />
                  </div>
                </section>
              ) : null}

              {creatorReputation ? (
                <section
                  id="reputation"
                  aria-labelledby="creator-earned-reputation-heading"
                  className="scroll-mt-32 space-y-6 pt-6"
                >
                  <ProfileSectionHeading
                    id="creator-earned-reputation-heading"
                    eyebrow="What they know"
                    title="Reputation earned through real activity"
                    description="Category credibility built from relevant verified visits and completed Roam activity—not follower count."
                  />

                  <CreatorReputationSection
                    reputation={
                      creatorReputation
                    }
                  />
                </section>
              ) : null}

              {creatorBundle
                .collaborationTags
                .length > 0 ? (
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-transparent p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.065] sm:p-6">
                  <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-indigo-400/[0.06] blur-3xl" />

                  <div className="relative z-10 mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                      Open to
                    </p>

                    <h3 className="mt-2 text-xl font-black tracking-tight text-white">
                      Make something together
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                      The collaborations, projects, and experiences this creator is open to exploring.
                    </p>
                  </div>

                  <CreatorCollaborationTags
                    tags={
                      creatorBundle
                        .collaborationTags
                    }
                  />
                </div>
              ) : null}
            </section>

            {hasFeaturedCollections ? (
              <section
                id="guides"
                aria-labelledby="creator-guides-title"
                className="scroll-mt-32 space-y-6"
              >
                <ProfileSectionHeading
                  id="creator-guides-title"
                  eyebrow="Their picks"
                  title="Places worth knowing"
                  description={`Collections built by ${creatorDisplayName} around places, moods, and experiences they genuinely think are worth your time.`}
                />

                <CreatorFeaturedCollections
                  username={
                    creatorUsername
                  }
                  collections={
                    creatorBundle
                      .featuredCollections
                  }
                />
              </section>
            ) : null}

            {snapshots.length > 0 ? (
              <section
                id="moments"
                aria-labelledby="creator-roam-moments-title"
                className="scroll-mt-32"
              >
                <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-indigo-400/[0.04] shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]">
                  <div className="border-b border-white/[0.055] p-5 sm:p-6">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                          Recent moments
                        </p>

                        <h2
                          id="creator-roam-moments-title"
                          className="mt-2 text-2xl font-black tracking-[-0.035em] text-white"
                        >
                          Nights and routes worth remembering
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                          Completed Roams this creator chose to make public. Some can be replayed so you can experience the route yourself.
                        </p>
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-500 ring-1 ring-white/[0.06]">
                          Latest{' '}
                          {Math.min(
                            snapshots.length,
                            9
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5">
                    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                      {snapshots.map(
                        (snapshot) => (
                          <PublicRoamCard
                            key={
                              snapshot.id
                            }
                            snapshot={
                              snapshot
                            }
                          />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {hasTasteProfile ? (
              <section
                id="taste"
                aria-labelledby="creator-taste-profile-title"
                className="scroll-mt-32"
              >
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-cyan-300/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]">
                  <div className="pointer-events-none absolute right-[-5rem] top-[-5rem] h-44 w-44 rounded-full bg-cyan-300/[0.06] blur-3xl" />

                  <div className="relative z-10 border-b border-white/[0.055] p-5 sm:p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                      Taste
                    </p>

                    <h2
                      id="creator-taste-profile-title"
                      className="mt-2 text-2xl font-black tracking-[-0.035em] text-white"
                    >
                      Their kind of city
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                      The moods, scenes, and experiences they naturally gravitate toward.
                    </p>
                  </div>

                  <div className="relative z-10 grid gap-7 p-5 sm:grid-cols-2 sm:p-6">
                    <ChipGroup
                      title="Vibes"
                      values={
                        profile.preferred_vibes ??
                        []
                      }
                    />

                    <ChipGroup
                      title="Interests"
                      values={
                        profile.interest_categories ??
                        []
                      }
                    />
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <>
            {snapshots.length > 0 ? (
              <section className="mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.05] via-white/[0.025] to-indigo-400/[0.035] shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.065]">
                <div className="border-b border-white/[0.055] p-5">
                  <div className="flex min-w-0 items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                        Recent moments
                      </p>

                      <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                        Roams worth sharing
                      </h2>

                      <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                        Public moments from completed Roam flows.
                      </p>
                    </div>

                    <p className="shrink-0 text-xs text-zinc-600">
                      Latest{' '}
                      {Math.min(
                        snapshots.length,
                        9
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                    {snapshots.map(
                      (snapshot) => (
                        <PublicRoamCard
                          key={
                            snapshot.id
                          }
                          snapshot={
                            snapshot
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {hasTasteProfile ? (
              <section className="mt-8 rounded-[2rem] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5 ring-1 ring-white/[0.065] sm:p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                  Taste
                </p>

                <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                  Their kind of city
                </h2>

                <div className="mt-6 space-y-6">
                  <ChipGroup
                    title="Preferred vibes"
                    values={
                      profile.preferred_vibes ??
                      []
                    }
                  />

                  <ChipGroup
                    title="Interests"
                    values={
                      profile.interest_categories ??
                      []
                    }
                  />
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

/* =========================================================
 * Creator page navigation and structure
 * ======================================================= */

function CreatorActionBar({
  userId,
  existingFollow,
  followersCount,
  isAuthenticated,
}: {
  userId: string
  existingFollow: boolean
  followersCount: number
  isAuthenticated: boolean
}) {
  return (
    <section
      aria-label="Creator profile actions"
      className="flex flex-col gap-4 rounded-[1.75rem] bg-white/[0.035] p-4 ring-1 ring-white/[0.065] sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-white">
          Follow their point of view
        </p>

        <p className="mt-1 text-xs leading-5 text-zinc-500">
          New collections, completed Roams, and city discoveries will be easier to find.
        </p>
      </div>

      <div className="shrink-0">
        <FollowButton
          userId={userId}
          initialIsFollowing={
            existingFollow
          }
          initialFollowersCount={
            followersCount
          }
          disabled={
            !isAuthenticated
          }
        />
      </div>
    </section>
  )
}

function CreatorProfileNavigation({
  items,
}: {
  items:
    CreatorProfileNavigationItem[]
}) {
  const visibleItems =
    items.filter(
      (item) =>
        item.visible
    )

  if (
    visibleItems.length <= 1
  ) {
    return null
  }

  return (
    <nav
      aria-label="Creator profile sections"
      className="sticky top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-20 -mx-4 bg-[#070809]/90 px-4 py-2.5 backdrop-blur-2xl sm:mx-0 sm:rounded-full sm:bg-black/55 sm:px-2 sm:ring-1 sm:ring-white/[0.07]"
    >
      <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleItems.map(
          (item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {item.label}
            </a>
          )
        )}
      </div>
    </nav>
  )
}

function ProfileSectionHeading({
  id,
  eyebrow,
  title,
  description,
  trailing,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  trailing?: string
}) {
  return (
    <div className="flex min-w-0 items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-px w-5 bg-cyan-300/70" />

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            {eyebrow}
          </p>
        </div>

        <h2
          id={id}
          className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.035em] text-white sm:text-[2rem]"
        >
          {title}
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-[15px] sm:leading-7">
          {description}
        </p>
      </div>

      {trailing ? (
        <p className="hidden shrink-0 text-xs text-zinc-600 sm:block">
          {trailing}
        </p>
      ) : null}
    </div>
  )
}

/* =========================================================
 * Public creator reputation presentation
 * ======================================================= */

function CreatorReputationSection({
  reputation,
}: {
  reputation: unknown
}) {
  const normalized =
    normalizePublicCreatorReputation(
      reputation
    )

  if (!normalized) {
    return null
  }

  return (
    <section
      aria-labelledby="creator-reputation-title"
      className="relative min-w-0 overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-300/[0.055] via-white/[0.025] to-indigo-400/[0.05] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.07] sm:p-6"
    >
      <div className="pointer-events-none absolute right-[-5rem] top-[-6rem] h-52 w-52 rounded-full bg-cyan-300/[0.07] blur-[90px]" />

      <div className="relative z-10 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Earned identity
          </p>

          <h2
            id="creator-reputation-title"
            className="mt-2 text-2xl font-black tracking-[-0.035em] text-white"
          >
            {normalized.headline ??
              'What their city history supports'}
          </h2>

          {normalized.summary ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {normalized.summary}
            </p>
          ) : null}
        </div>

        {normalized.highestLevel ? (
          <span className="inline-flex w-fit shrink-0 rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-black text-black">
            {formatReputationLevel(
              normalized.highestLevel
            )}
          </span>
        ) : null}
      </div>

      {normalized.categories.length > 0 ? (
        <div className="relative z-10 mt-6 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {normalized.categories.map(
            (
              category,
              index
            ) => {
              const standing =
                buildPublicReputationStanding(
                  category
                )

              return (
                <article
                  key={
                    category.key ??
                    `${category.label}-${index}`
                  }
                  className="min-w-0 rounded-[1.5rem] bg-black/30 p-4 ring-1 ring-white/[0.055]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-white">
                        {category.label}
                      </p>

                      <p className="mt-1 text-[11px] text-zinc-600">
                        {buildPublicReputationScopeLabel(
                          category
                        )}
                      </p>
                    </div>

                    {category.level ? (
                      <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold text-zinc-400 ring-1 ring-white/[0.065]">
                        {formatReputationLevel(
                          category.level
                        )}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[1.25rem] bg-cyan-300/[0.055] p-3.5 ring-1 ring-cyan-300/10">
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                      Standing
                    </p>

                    <p
                      className={[
                        'mt-1 break-words font-black tracking-tight',
                        standing.available
                          ? 'text-xl text-cyan-200'
                          : 'text-sm text-zinc-400',
                      ].join(' ')}
                    >
                      {standing.primary}
                    </p>

                    {standing.secondary ? (
                      <p className="mt-1.5 text-[11px] leading-5 text-zinc-600">
                        {standing.secondary}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.055] pt-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-700">
                        Verified
                      </p>

                      <p className="mt-1 text-xs font-semibold text-zinc-400">
                        {category.verifiedVenueCount !==
                        null
                          ? `${category.verifiedVenueCount.toLocaleString(
                              'en-US'
                            )} ${
                              category.verifiedVenueCount ===
                              1
                                ? 'place'
                                : 'places'
                            }`
                          : 'Not published'}
                      </p>
                    </div>

                    {category.eligibleCreatorCount !==
                    null ? (
                      <div className="min-w-0 text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-700">
                          Compared with
                        </p>

                        <p className="mt-1 text-xs font-semibold text-zinc-400">
                          {category.eligibleCreatorCount.toLocaleString(
                            'en-US'
                          )}{' '}
                          {category.eligibleCreatorCount ===
                          1
                            ? 'creator'
                            : 'creators'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            }
          )}
        </div>
      ) : null}

      <p className="relative z-10 mt-4 text-[11px] leading-5 text-zinc-600">
        Reputation compares verified activity within the same category and geographic scope. City and global standings remain separate.
      </p>
    </section>
  )
}

type NormalizedPublicCreatorReputation = {
  headline: string | null
  summary: string | null
  highestLevel: string | null

  categories:
    NormalizedPublicCreatorReputationCategory[]
}

type NormalizedPublicCreatorReputationCategory = {
  key: string | null

  categoryId: string | null
  label: string

  scope:
    | 'global'
    | 'city'
    | null

  cityKey: string | null
  cityLabel: string | null

  level: string | null

  verifiedVenueCount:
    number | null

  rank:
    number | null

  eligibleCreatorCount:
    number | null

  topPercent:
    number | null

  percentileStanding:
    number | null

  rankLabel:
    string | null
}

type PublicReputationStanding = {
  available: boolean
  primary: string
  secondary: string | null
}

function normalizePublicCreatorReputation(
  value: unknown
): NormalizedPublicCreatorReputation | null {
  if (!isRecord(value)) {
    return null
  }

  const headline =
    nullableString(
      value.headline
    )

  const summary =
    nullableString(
      value.summary
    )

  const highestLevel =
    nullableString(
      value.highestLevel ??
        value.highest_level
    )

  const categories =
    normalizePublicCreatorReputationCategories(
      value.categories
    )

  if (
    !headline &&
    !summary &&
    !highestLevel &&
    categories.length === 0
  ) {
    return null
  }

  return {
    headline,
    summary,
    highestLevel,
    categories,
  }
}

function normalizePublicCreatorReputationCategories(
  value: unknown
): NormalizedPublicCreatorReputationCategory[] {
  if (!Array.isArray(value)) {
    return []
  }

  const categories:
    NormalizedPublicCreatorReputationCategory[] =
    []

  const seen =
    new Set<string>()

  for (const item of value) {
    if (!isRecord(item)) {
      continue
    }

    const nestedCategory =
      isRecord(
        item.category
      )
        ? item.category
        : null

    const nestedTier =
      isRecord(
        item.tier
      )
        ? item.tier
        : null

    const nestedLabels =
      isRecord(
        item.labels
      )
        ? item.labels
        : null

    const nestedEvidence =
      isRecord(
        item.evidence
      )
        ? item.evidence
        : null

    const nestedRanking =
      isRecord(
        item.ranking
      )
        ? item.ranking
        : null

    const categoryId =
      nullableString(
        item.categoryId ??
          item.category_id ??
          nestedCategory?.id
      )

    const label =
      nullableString(
        item.primaryLabel ??
          item.primary_label ??
          item.categoryLabel ??
          item.category_label ??
          item.label ??
          nestedCategory?.label ??
          nestedLabels?.primary
      )

    if (!label) {
      continue
    }

    const rawScope =
      nullableString(
        item.scope
      )

    const scope =
      rawScope === 'city'
        ? 'city'
        : rawScope === 'global'
          ? 'global'
          : null

    const cityKey =
      nullableString(
        item.cityKey ??
          item.city_key
      )

    const cityLabel =
      nullableString(
        item.cityLabel ??
          item.city_label ??
          nestedLabels?.city
      )

    const level =
      nullableString(
        item.reputationLevel ??
          item.reputation_level ??
          item.level ??
          nestedTier?.level ??
          nestedTier?.id
      )

    const verifiedVenueCount =
      nullableFiniteNumber(
        item.verifiedVenueCount ??
          item.verified_venue_count ??
          nestedEvidence
            ?.verifiedVenueCount ??
          nestedEvidence
            ?.verified_venue_count
      )

    const rank =
      nullablePositiveInteger(
        item.rank ??
          item.cityRank ??
          item.city_rank ??
          nestedRanking?.rank
      )

    const eligibleCreatorCount =
      nullableNonNegativeInteger(
        item.eligibleCreatorCount ??
          item.eligible_creator_count ??
          item.eligibleUserCount ??
          item.eligible_user_count ??
          nestedRanking
            ?.eligibleCreatorCount ??
          nestedRanking
            ?.eligible_creator_count ??
          nestedRanking
            ?.eligibleUserCount ??
          nestedRanking
            ?.eligible_user_count
      )

    const explicitTopPercent =
      nullablePercentage(
        item.topPercent ??
          item.top_percent ??
          nestedRanking
            ?.topPercent ??
          nestedRanking
            ?.top_percent
      )

    const explicitPercentileStanding =
      nullablePercentage(
        item.percentileStanding ??
          item.percentile_standing ??
          nestedRanking
            ?.percentileStanding ??
          nestedRanking
            ?.percentile_standing
      )

    const genericPercentile =
      nullablePercentage(
        item.percentile ??
          nestedRanking
            ?.percentile
      )

    const topPercent =
      explicitTopPercent ??
      (
        explicitPercentileStanding ===
        null
          ? genericPercentile
          : null
      ) ??
      calculateTopPercentFromRank({
        rank,
        eligibleCreatorCount,
      })

    const percentileStanding =
      explicitPercentileStanding

    const rankLabel =
      nullableString(
        item.rankLabel ??
          item.rank_label ??
          nestedRanking?.label ??
          nestedLabels?.rank
      )

    const keyParts = [
      categoryId ??
        label.toLocaleLowerCase(
          'en-US'
        ),
      scope ??
        'unknown',
      cityKey ??
        '__global__',
    ]

    const key =
      keyParts.join(':')

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    categories.push({
      key,

      categoryId,

      label,

      scope,

      cityKey,

      cityLabel,

      level,

      verifiedVenueCount,

      rank,

      eligibleCreatorCount,

      topPercent,

      percentileStanding,

      rankLabel,
    })

    if (
      categories.length >=
      6
    ) {
      break
    }
  }

  return categories.sort(
    comparePublicReputationCategories
  )
}

function comparePublicReputationCategories(
  first:
    NormalizedPublicCreatorReputationCategory,
  second:
    NormalizedPublicCreatorReputationCategory
): number {
  const firstHasStanding =
    hasPublishedStanding(
      first
    )

  const secondHasStanding =
    hasPublishedStanding(
      second
    )

  if (
    firstHasStanding !==
    secondHasStanding
  ) {
    return firstHasStanding
      ? -1
      : 1
  }

  if (
    first.topPercent !==
      null &&
    second.topPercent !==
      null &&
    first.topPercent !==
      second.topPercent
  ) {
    return (
      first.topPercent -
      second.topPercent
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
    first.scope !==
    second.scope
  ) {
    return first.scope ===
      'city'
      ? -1
      : 1
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

function hasPublishedStanding(
  category:
    NormalizedPublicCreatorReputationCategory
): boolean {
  return (
    category.topPercent !==
      null ||
    category.percentileStanding !==
      null ||
    category.rank !==
      null ||
    category.rankLabel !==
      null
  )
}

function buildPublicReputationStanding(
  category:
    NormalizedPublicCreatorReputationCategory
): PublicReputationStanding {
  const topPercent =
    category.topPercent ??
    calculateTopPercentFromRank({
      rank:
        category.rank,

      eligibleCreatorCount:
        category
          .eligibleCreatorCount,
    })

  if (
    topPercent !==
    null
  ) {
    const rankContext =
      buildRankContext(
        category
      )

    return {
      available:
        true,

      primary:
        `Top ${formatPublicPercentile(
          topPercent
        )}%`,

      secondary:
        rankContext ??
        category.rankLabel,
    }
  }

  if (
    category.percentileStanding !==
    null
  ) {
    const rankContext =
      buildRankContext(
        category
      )

    return {
      available:
        true,

      primary:
        `Ahead of ${formatPublicPercentile(
          category
            .percentileStanding
        )}%`,

      secondary:
        rankContext ??
        category.rankLabel,
    }
  }

  if (
    category.rank !== null
  ) {
    return {
      available:
        true,

      primary:
        category.eligibleCreatorCount !==
          null &&
        category.eligibleCreatorCount >
          0
          ? `#${category.rank.toLocaleString(
              'en-US'
            )} of ${category.eligibleCreatorCount.toLocaleString(
              'en-US'
            )}`
          : `Rank #${category.rank.toLocaleString(
              'en-US'
            )}`,

      secondary:
        category.rankLabel,
    }
  }

  if (category.rankLabel) {
    return {
      available:
        true,

      primary:
        category.rankLabel,

      secondary:
        null,
    }
  }

  return {
    available:
      false,

    primary:
      'Standing is building',

    secondary:
      category.level
        ? `${formatReputationLevel(
            category.level
          )} status earned; a comparison standing is not available yet.`
        : 'More eligible creators are needed before a comparison can be shown.',
  }
}

function buildRankContext(
  category:
    NormalizedPublicCreatorReputationCategory
): string | null {
  if (
    category.rank !==
      null &&
    category.eligibleCreatorCount !==
      null &&
    category.eligibleCreatorCount >
      0
  ) {
    return `#${category.rank.toLocaleString(
      'en-US'
    )} of ${category.eligibleCreatorCount.toLocaleString(
      'en-US'
    )} eligible creators`
  }

  if (
    category.rank !==
      null
  ) {
    return `Rank #${category.rank.toLocaleString(
      'en-US'
    )}`
  }

  if (
    category.eligibleCreatorCount !==
      null &&
    category.eligibleCreatorCount >
      0
  ) {
    return `Compared with ${category.eligibleCreatorCount.toLocaleString(
      'en-US'
    )} eligible ${
      category.eligibleCreatorCount ===
      1
        ? 'creator'
        : 'creators'
    }`
  }

  return null
}

function buildPublicReputationScopeLabel(
  category:
    NormalizedPublicCreatorReputationCategory
): string {
  if (
    category.scope ===
    'city'
  ) {
    const city =
      category.cityLabel ??
      (
        category.cityKey
          ? formatReputationLevel(
              category.cityKey
            )
          : null
      ) ??
      'City'

    return `${city} standing`
  }

  if (
    category.scope ===
    'global'
  ) {
    return 'Global standing'
  }

  return 'Category standing'
}

function calculateTopPercentFromRank({
  rank,
  eligibleCreatorCount,
}: {
  rank:
    number | null

  eligibleCreatorCount:
    number | null
}): number | null {
  if (
    rank === null ||
    eligibleCreatorCount ===
      null ||
    rank <= 0 ||
    eligibleCreatorCount <=
      0 ||
    rank >
      eligibleCreatorCount
  ) {
    return null
  }

  return roundPublicPercentage(
    Math.min(
      100,
      (
        rank /
        eligibleCreatorCount
      ) *
        100
    ),
    2
  )
}

function nullableFiniteNumber(
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

function nullablePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    nullableFiniteNumber(
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

function nullableNonNegativeInteger(
  value: unknown
): number | null {
  const normalized =
    nullableFiniteNumber(
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

function nullablePercentage(
  value: unknown
): number | null {
  const normalized =
    nullableFiniteNumber(
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

function roundPublicPercentage(
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

  const factor =
    10 **
    Math.max(
      0,
      Math.min(
        4,
        Math.trunc(
          decimalPlaces
        )
      )
    )

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

function formatPublicPercentile(
  value: number
): string {
  return value.toLocaleString(
    'en-US',
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        value < 1
          ? 2
          : value < 10
            ? 1
            : 0,
    }
  )
}

function formatReputationLevel(
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

/* =========================================================
 * Creator Mode loader protection
 * ======================================================= */

async function safelyLoadPublicCreatorProfile({
  supabase,
  userId,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  userId: string
}): Promise<PublicCreatorBundle | null> {
  try {
    return await getPublicCreatorProfile({
      supabase,
      userId,
      featuredCollectionLimit: 6,
    })
  } catch (error) {
    if (
      error instanceof
      PublicCreatorProfileLoadError
    ) {
      console.error(
        '[public profile] Creator Mode data could not be loaded:',
        {
          userId,
          code: error.code,
          message: error.message,
        }
      )

      return null
    }

    throw error
  }
}

async function loadPublicCreatorReputationSafely({
  userId,
}: {
  userId: string
}): Promise<PublicCreatorReputationResult | null> {
  try {
    return await safelyLoadPublicCreatorReputation(
      userId,
      {
        includeUnranked: false,
        includeGlobal: true,
        includeCity: true,
      }
    )
  } catch (error) {
    console.error(
      '[public profile] Creator reputation could not be loaded:',
      {
        userId,
        error:
          serializeUnknownError(
            error
          ),
      }
    )

    return null
  }
}

async function logPublicProfileViewed({
  supabase,
  viewerUserId,
  profileUserId,
  username,
  isOwnProfile,
  isPublic,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >
  viewerUserId: string | null
  profileUserId: string
  username: string | null
  isOwnProfile: boolean
  isPublic: boolean
}): Promise<void> {
  try {
    await supabase
      .from(
        'user_impressions'
      )
      .insert(
        [
          {
            impression_type:
              'public_profile_viewed',

            user_id:
              viewerUserId,

            venue_id:
              null,

            crawl_id:
              null,

            metadata: {
              profile_user_id:
                profileUserId,

              username,

              is_own_profile:
                isOwnProfile,

              is_public:
                isPublic,
            },

            created_at:
              new Date()
                .toISOString(),
          },
        ],
        {
          returning:
            'minimal',
        } as any
      )
  } catch (error) {
    console.warn(
      'Failed to log public_profile_viewed:',
      error
    )
  }
}

/* =========================================================
 * Snapshot normalization
 * ======================================================= */

function normalizePublicSnapshots(
  value: unknown
): PublicFlowSnapshotRow[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(
      (
        snapshot
      ): PublicFlowSnapshotRow | null => {
        if (
          !snapshot ||
          typeof snapshot !==
            'object'
        ) {
          return null
        }

        const row =
          snapshot as Record<
            string,
            unknown
          >

        if (
          typeof row.id !==
            'string' ||
          typeof row.created_at !==
            'string'
        ) {
          return null
        }

        return {
          id:
            row.id,

          title:
            nullableString(
              row.title
            ),

          city:
            nullableString(
              row.city
            ),

          status:
            nullableString(
              row.status
            ),

          cover_image_url:
            nullableString(
              row.cover_image_url
            ),

          route_summary:
            nullableString(
              row.route_summary
            ),

          checked_in_count:
            nullableNumber(
              row.checked_in_count
            ),

          total_stops:
            nullableNumber(
              row.total_stops
            ),

          source_type:
            nullableString(
              row.source_type
            ),

          source_id:
            nullableString(
              row.source_id
            ),

          visibility:
            'public',

          replayable:
            row.replayable ===
            true,

          created_at:
            row.created_at,

          stops:
            normalizePublicSnapshotStops(
              row.flow_snapshot_stops
            ),
        }
      }
    )
    .filter(
      (
        snapshot
      ): snapshot is PublicFlowSnapshotRow =>
        snapshot !== null
    )
}

function normalizePublicSnapshotStops(
  value: unknown
): PublicFlowSnapshotStop[] {
  if (!Array.isArray(value)) {
    return []
  }

  const stops:
    PublicFlowSnapshotStop[] =
    []

  for (const rawStop of value) {
    if (!isRecord(rawStop)) {
      continue
    }

    const venueId =
      nullableString(
        rawStop.venue_id
      )

    const stopIndex =
      nullableNonNegativeInteger(
        rawStop.stop_index
      )

    if (
      !venueId ||
      stopIndex === null
    ) {
      continue
    }

    const rawVenue =
      Array.isArray(
        rawStop.venues
      )
        ? rawStop.venues[0]
        : rawStop.venues

    if (
      !isRecord(
        rawVenue
      )
    ) {
      continue
    }

    const canonicalVenueId =
      nullableString(
        rawVenue.id
      )

    if (
      !canonicalVenueId ||
      canonicalVenueId !==
        venueId
    ) {
      continue
    }

    stops.push({
      venueId,

      stopIndex,

      venue: {
        id:
          canonicalVenueId,

        name:
          nullableString(
            rawVenue.name
          ),

        city:
          nullableString(
            rawVenue.city
          ),

        lat:
          nullableCoordinate(
            rawVenue.lat,
            -90,
            90
          ),

        lon:
          nullableCoordinate(
            rawVenue.lon,
            -180,
            180
          ),
      },
    })
  }

  return stops
    .sort(
      (
        first,
        second
      ) =>
        first.stopIndex -
        second.stopIndex
    )
    .filter(
      (
        stop,
        index,
        orderedStops
      ) => {
        if (
          stop.stopIndex !==
          index
        ) {
          return false
        }

        return (
          orderedStops.findIndex(
            (
              candidate
            ) =>
              candidate.venueId ===
              stop.venueId
          ) === index
        )
      }
    )
}

function nullableString(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

  return trimmed.length >
    0
    ? trimmed
    : null
}

function nullableNumber(
  value: unknown
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  )
    ? value
    : null
}

function nullableCoordinate(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < minimum ||
    value > maximum
  ) {
    return null
  }

  return value
}

/* =========================================================
 * Standard profile presentation
 * ======================================================= */

function Stat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex min-h-[92px] min-w-0 flex-col justify-between rounded-[1.4rem] bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
      <p className="text-2xl font-black leading-none tracking-[-0.04em] text-white">
        {value.toLocaleString(
          'en-US'
        )}
      </p>

      <p className="mt-3 text-[10px] font-bold uppercase leading-tight tracking-[0.12em] text-zinc-600">
        {label}
      </p>
    </div>
  )
}

const CHIP_LABELS: Record<
  string,
  string
> = {
  chill:
    'Chill',

  romantic:
    'Romantic',

  upbeat:
    'Upbeat',

  trendy:
    'Trendy',

  social:
    'Social',

  cozy:
    'Cozy',

  high_energy:
    'High Energy',

  art:
    'Art',

  hidden_gems:
    'Hidden Gems',

  live_events:
    'Live Events',

  music:
    'Music',

  dancing:
    'Dancing',

  foodie_spots:
    'Foodie Spots',
}

function formatChipLabel(
  value: string
) {
  return (
    CHIP_LABELS[value] ??
    value
      .replace(
        /_/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
      .replace(
        /\b\w/g,
        (char) =>
          char.toUpperCase()
      )
  )
}

function ChipGroup({
  title,
  values,
}: {
  title: string
  values: string[]
}) {
  return (
    <div className="min-w-0">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
        {title}
      </p>

      {values.length === 0 ? (
        <p className="text-sm text-zinc-600">
          Nothing shared yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map(
            (value) => (
              <span
                key={value}
                className="rounded-full bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-white/[0.065] transition hover:bg-cyan-300/[0.08] hover:text-white hover:ring-cyan-300/15"
              >
                {formatChipLabel(
                  value
                )}
              </span>
            )
          )}
        </div>
      )}
    </div>
  )
}

/* =========================================================
 * Error serialization
 * ======================================================= */

function serializeUnknownError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,
    }
  }

  if (isRecord(error)) {
    return {
      code:
        error.code ??
        null,

      message:
        error.message ??
        null,

      details:
        error.details ??
        null,

      hint:
        error.hint ??
        null,
    }
  }

  return {
    value:
      String(error),
  }
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