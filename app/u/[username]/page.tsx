import Link from 'next/link'
import { notFound } from 'next/navigation'

import CreatorAuthorityCard from '@/components/public-profile/creator/CreatorAuthorityCard'
import CreatorCollaborationTags from '@/components/public-profile/creator/CreatorCollaborationTags'
import CreatorFeaturedCollections from '@/components/public-profile/creator/CreatorFeaturedCollections'
import CreatorHero from '@/components/public-profile/creator/CreatorHero'
import CreatorSocialLinks from '@/components/public-profile/creator/CreatorSocialLinks'
import FollowButton from '@/components/profile/FollowButton'
import ShareProfileButton from '@/components/profile/ShareProfileButton'

import {
  buildCreatorAuthority,
} from '@/lib/creator/buildCreatorAuthority'
import {
  getPublicCreatorProfile,
  PublicCreatorProfileLoadError,
} from '@/lib/creator/getPublicCreatorProfile'
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
  created_at: string
}

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
      creator_headline
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

  const creatorBundlePromise =
    creatorModeRequested
      ? safelyLoadPublicCreatorProfile({
          supabase,
          userId: profile.id,
        })
      : Promise.resolve(null)

  const publicCreatorCollectionCountPromise =
    creatorModeRequested
      ? supabase
          .from('creator_collections')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('user_id', profile.id)
          .eq('visibility', 'public')
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
    publicCreatorCollectionCountResult,
  ] = await Promise.all([
    supabase
      .from('user_follows')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('following_id', profile.id),

    supabase
      .from('user_follows')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('follower_id', profile.id),

    user && !isOwnProfile
      ? supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
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
      .from('profile_public_stats')
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
      .eq('user_id', profile.id)
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
          .eq('user_id', profile.id),

    supabase
      .from('flow_snapshots' as any)
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
        created_at
      `)
      .eq('user_id', profile.id)
      .eq('visibility', 'public')
      .order('created_at', {
        ascending: false,
      })
      .limit(9),

    creatorBundlePromise,

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

  return (
    <main className="min-h-screen bg-black px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap gap-2">
          {isOwnProfile ? (
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/50 hover:text-white"
            >
              Edit Profile
            </Link>
          ) : (
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/50 hover:text-white"
            >
              ← Back to Discover
            </Link>
          )}

          <ShareProfileButton
            username={profile.username}
            fullName={
              profile.full_name
            }
          />
        </div>

        {isCreator ? (
          <>
            <CreatorHero
              displayName={profile.full_name}
              username={creatorUsername}
              avatarUrl={profile.avatar_url}
              headline={profile.creator_headline}
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

            {!isOwnProfile ? (
              <section
                aria-label="Creator profile actions"
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
              >
                <FollowButton
                  userId={profile.id}
                  initialIsFollowing={Boolean(
                    existingFollow
                  )}
                  initialFollowersCount={
                    followersCount
                  }
                  disabled={!user}
                />
              </section>
            ) : null}
          </>
        ) : (
          <section className="rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-neutral-950 to-black p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 text-4xl">
                {profile.avatar_url ? (
                  <img
                    src={
                      profile.avatar_url
                    }
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>🧭</span>
                )}
              </div>

              <div className="flex-1">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
                  Roam Passport
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  {profile.full_name ??
                    profile.username}
                </h1>

                <p className="mt-1 text-sm text-neutral-400">
                  @{profile.username}
                  {profile.home_neighborhood
                    ? ` · ${profile.home_neighborhood}`
                    : ''}
                </p>

                {profile.bio ? (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
                    {profile.bio}
                  </p>
                ) : null}
              </div>

              {!isOwnProfile ? (
                <FollowButton
                  userId={profile.id}
                  initialIsFollowing={Boolean(
                    existingFollow
                  )}
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
          <section className="flex flex-wrap gap-2">
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
                label="Passport Level"
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
                label="Event Check-ins"
                value={
                  eventCheckinsCount
                }
              />
            ) : null}

            {profile.show_saved_guides !==
            false ? (
              <Stat
                label="Saved Guides"
                value={
                  savedPropertiesCount
                }
              />
            ) : null}

            {profile.show_social_groups !==
            false ? (
              <Stat
                label="Social Groups"
                value={
                  socialGroupsCount
                }
              />
            ) : null}
          </section>
        ) : null}

        {isCreator ? (
          <>
            <CreatorSocialLinks
              links={
                creatorBundle.socialLinks
              }
            />

            <CreatorCollaborationTags
              tags={
                creatorBundle.collaborationTags
              }
            />

            <CreatorAuthorityCard
              authority={
                creatorAuthority
              }
            />

            <CreatorFeaturedCollections
              username={creatorUsername}
              collections={
                creatorBundle.featuredCollections
              }
            />
          </>
        ) : null}

        {snapshots.length > 0 ? (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Flow Snapshots
                </h2>

                <p className="mt-1 text-xs text-neutral-500">
                  Public moments from
                  completed Roam flows.
                </p>
              </div>

              <p className="shrink-0 text-xs text-neutral-500">
                Latest{' '}
                {Math.min(
                  snapshots.length,
                  9
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {snapshots.map(
                (snapshot) => (
                  <article
                    key={
                      snapshot.id
                    }
                    className="group overflow-hidden rounded-2xl border border-neutral-800 bg-black"
                  >
                    <div className="relative aspect-square overflow-hidden bg-neutral-900">
                      {snapshot.cover_image_url ? (
                        <img
                          src={
                            snapshot.cover_image_url
                          }
                          alt={
                            snapshot.title ??
                            'Roam flow snapshot'
                          }
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.28),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.22),transparent_42%),#09090b] text-4xl">
                          🗺️
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-transparent" />

                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">
                          {snapshot.title ??
                            'Roam Flow'}
                        </p>

                        <p className="mt-1 text-[11px] text-neutral-300">
                          {buildSnapshotMetadata(
                            snapshot
                          )}
                        </p>
                      </div>
                    </div>

                    {snapshot.route_summary ? (
                      <div className="border-t border-neutral-800 px-3 py-3">
                        <p className="line-clamp-2 text-xs leading-5 text-neutral-500">
                          {
                            snapshot.route_summary
                          }
                        </p>
                      </div>
                    ) : null}
                  </article>
                )
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Taste Profile
          </h2>

          <div className="mt-4 space-y-4">
            <ChipGroup
              title="Preferred Vibes"
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
      </div>
    </main>
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
      .from('user_impressions')
      .insert(
        [
          {
            impression_type:
              'public_profile_viewed',
            user_id:
              viewerUserId,
            venue_id: null,
            crawl_id: null,
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
              new Date().toISOString(),
          },
        ],
        {
          returning: 'minimal',
        } as any
      )
  } catch (error) {
    console.warn(
      'Failed to log public_profile_viewed:',
      error
    )
  }
}

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
          id: row.id,

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

          visibility: 'public',

          created_at:
            row.created_at,
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

function nullableString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function nullableNumber(
  value: unknown
): number | null {
  return (
    typeof value === 'number' &&
    Number.isFinite(value)
  )
    ? value
    : null
}

function buildSnapshotMetadata(
  snapshot: PublicFlowSnapshotRow
): string {
  const parts: string[] = []

  if (snapshot.city) {
    parts.push(snapshot.city)
  }

  const checkedInCount =
    snapshot.checked_in_count ??
    0

  const totalStops =
    snapshot.total_stops ?? 0

  parts.push(
    `${checkedInCount}/${totalStops} ${
      totalStops === 1
        ? 'stop'
        : 'stops'
    }`
  )

  return parts.join(' · ')
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="inline-flex min-w-[104px] flex-col rounded-2xl border border-neutral-800 bg-neutral-950 px-4 py-3">
      <p className="text-lg font-semibold leading-none">
        {value.toLocaleString()}
      </p>

      <p className="mt-1.5 text-[11px] leading-tight text-neutral-500">
        {label}
      </p>
    </div>
  )
}

const CHIP_LABELS: Record<
  string,
  string
> = {
  chill: 'Chill',
  romantic: 'Romantic',
  upbeat: 'Upbeat',
  trendy: 'Trendy',
  social: 'Social',
  cozy: 'Cozy',
  high_energy: 'High Energy',
  art: 'Art',
  hidden_gems: 'Hidden Gems',
  live_events: 'Live Events',
  music: 'Music',
  dancing: 'Dancing',
  foodie_spots: 'Foodie Spots',
}

function formatChipLabel(
  value: string
) {
  return (
    CHIP_LABELS[value] ??
    value
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
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
    <div>
      <p className="mb-2 text-sm text-neutral-500">
        {title}
      </p>

      {values.length === 0 ? (
        <p className="text-sm text-neutral-600">
          Nothing shared yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-cyan-500/15 bg-gradient-to-b from-neutral-900 to-black px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-cyan-400/40 hover:text-white"
            >
              {formatChipLabel(
                value
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}