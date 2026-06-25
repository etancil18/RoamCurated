import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import FollowButton from '@/components/profile/FollowButton'
import ShareProfileButton from '@/components/profile/ShareProfileButton'
import { getPassportSnapshot } from '@/lib/passport/score'

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
}

export default async function PublicUserProfilePage({ params }: Props) {
  const { username } = await params
  const normalizedUsername = decodeURIComponent(username).trim().toLowerCase()

  if (!normalizedUsername) {
    notFound()
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile, error } = await supabase
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
      show_social_groups
    `)
    .ilike('username', normalizedUsername)
    .maybeSingle<ProfileRow>()

  if (error || !profile) {
    notFound()
  }

  const isOwnProfile = user?.id === profile.id
  const isPublic = profile.is_public !== false

  if (!isPublic && !isOwnProfile) {
    notFound()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { count: followersCount },
    { count: followingCount },
    { data: existingFollow },
    { data: hosted },
    { data: rsvps },
    { data: savedProperties },
    { data: completedFlows },
    { data: venueVisits },
    { data: crawlProgress },
    { data: xpRows },
    { count: checkinsCount },
    { count: socialGroupsCount },
    { data: snapshots },
  ] = await Promise.all([
    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', profile.id),

    supabase
      .from('user_follows')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', profile.id),

    user && !isOwnProfile
      ? supabase
          .from('user_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    supabase
      .from('crawl_events')
      .select('id')
      .eq('creator_id', profile.id),

    supabase
      .from('crawl_rsvps')
      .select(`
        crawl_id,
        crawl_events (
          id,
          datetime
        )
      `)
      .eq('user_id', profile.id),

    profile.show_saved_guides === false
      ? Promise.resolve({ data: [] })
      : supabase
          .from('saved_properties')
          .select('property_id')
          .eq('user_id', profile.id),

    profile.show_completed_flows === false
      ? Promise.resolve({ data: [] })
      : supabase
          .from('active_flow_sessions')
          .select('id, venue_ids')
          .eq('user_id', profile.id)
          .eq('status', 'completed'),

    supabase
      .from('venue_visits')
      .select('id')
      .eq('user_id', profile.id),

    supabase
      .from('crawl_progress')
      .select('crawl_id')
      .eq('user_id', profile.id),

    profile.show_xp === false
      ? Promise.resolve({ data: [] })
      : supabase
          .from('event_xp_ledger')
          .select('xp_amount')
          .eq('user_id', profile.id),

    profile.show_checkins === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('event_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),

    profile.show_social_groups === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('social_group_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),

    supabase
      .from('flow_snapshots' as any)
      .select(
        'id, title, city, cover_image_url, route_summary, checked_in_count, total_stops, created_at'
      )
      .eq('user_id', profile.id)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(9),
  ])

  const joined = rsvps ?? []

  const pastCrawls = joined.filter((r: any) => {
    const crawl = r.crawl_events
    if (!crawl?.datetime) return false
    return new Date(crawl.datetime) < today
  })

  const completedFlowStops =
    completedFlows?.reduce((sum: number, flow: any) => {
      return sum + (Array.isArray(flow.venue_ids) ? flow.venue_ids.length : 0)
    }, 0) ?? 0

  const hostedFlowStops = crawlProgress?.length ?? 0

  const eventXp =
    xpRows?.reduce((sum: number, row: any) => {
      return sum + (typeof row.xp_amount === 'number' ? row.xp_amount : 0)
    }, 0) ?? 0

  const crawlIds = [
    ...new Set(
      (crawlProgress ?? [])
        .map((row: any) => row.crawl_id)
        .filter(Boolean)
    ),
  ]

  let completedHostedFlows = 0

  if (crawlIds.length > 0) {
    const { data: crawlEvents } = await supabase
      .from('crawl_events')
      .select('id, venue_ids')
      .in('id', crawlIds)

    completedHostedFlows =
      crawlEvents?.filter((crawl: any) => {
        const requiredStops = Array.isArray(crawl.venue_ids)
          ? crawl.venue_ids.length
          : 0

        const completedStops =
          crawlProgress?.filter(
            (progressRow: any) => progressRow.crawl_id === crawl.id
          ).length ?? 0

        return requiredStops > 0 && completedStops >= requiredStops
      }).length ?? 0
  }

  const { level: passportLevel } = getPassportSnapshot({
    hostedCrawls: hosted?.length ?? 0,
    joinedCrawls: joined.length,
    pastCrawls: pastCrawls.length,
    savedProperties: savedProperties?.length ?? 0,
    completedFlows: completedFlows?.length ?? 0,
    completedFlowStops,
    hostedFlowStops,
    completedHostedFlows,
    venueVisits: venueVisits?.length ?? 0,
    eventXp,
    eventCheckins: checkinsCount ?? 0,
  })

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
            fullName={profile.full_name}
          />
        </div>

        <section className="rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-neutral-950 to-black p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900 text-4xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
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
                {profile.full_name ?? profile.username}
              </h1>

              <p className="mt-1 text-sm text-neutral-400">
                @{profile.username}
                {profile.home_neighborhood ? ` · ${profile.home_neighborhood}` : ''}
              </p>

              {profile.bio && (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">
                  {profile.bio}
                </p>
              )}
            </div>

            {!isOwnProfile && (
              <FollowButton
                userId={profile.id}
                initialIsFollowing={Boolean(existingFollow)}
                initialFollowersCount={followersCount ?? 0}
                disabled={!user}
              />
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Followers" value={followersCount ?? 0} />
          <Stat label="Following" value={followingCount ?? 0} />
          {profile.show_xp !== false && (
            <Stat label="Passport Level" value={passportLevel} />
          )}
          {profile.show_completed_flows !== false && (
            <Stat label="Flows" value={completedFlows?.length ?? 0} />
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {profile.show_checkins !== false && (
            <Stat label="Event Check-ins" value={checkinsCount ?? 0} />
          )}

          {profile.show_saved_guides !== false && (
            <Stat label="Saved Guides" value={savedProperties?.length ?? 0} />
          )}

          {profile.show_social_groups !== false && (
            <Stat label="Social Groups" value={socialGroupsCount ?? 0} />
          )}
        </section>

        {snapshots && snapshots.length > 0 && (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Flow Snapshots
              </h2>

              <p className="text-xs text-neutral-500">
                Latest 9
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {snapshots.map((snapshot: any) => (
                <div
                  key={snapshot.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-neutral-800 bg-black"
                >
                  <img
                    src={snapshot.cover_image_url}
                    alt={snapshot.title ?? 'Roam flow snapshot'}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100">
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs font-semibold text-white">
                        {snapshot.title ?? 'Roam Flow'}
                      </p>

                      <p className="mt-0.5 text-[10px] text-neutral-300">
                        {snapshot.checked_in_count ?? 0}/{snapshot.total_stops ?? 0} stops
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Taste Profile
          </h2>

          <div className="mt-4 space-y-4">
            <ChipGroup title="Preferred Vibes" values={profile.preferred_vibes ?? []} />
            <ChipGroup title="Interests" values={profile.interest_categories ?? []} />
          </div>
        </section>
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
      <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
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
      <p className="mb-2 text-sm text-neutral-500">{title}</p>

      {values.length === 0 ? (
        <p className="text-sm text-neutral-600">Nothing shared yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="rounded-full border border-neutral-800 bg-black px-3 py-1 text-sm text-neutral-300"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}