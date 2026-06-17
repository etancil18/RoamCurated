import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import FollowButton from '@/components/profile/FollowButton'

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

  const [
    { count: followersCount },
    { count: followingCount },
    { data: existingFollow },
    { data: xpRows },
    { count: completedFlowsCount },
    { count: checkinsCount },
    { count: savedGuidesCount },
    { count: socialGroupsCount },
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

    profile.show_xp === false
      ? Promise.resolve({ data: [] })
      : supabase
          .from('event_xp_ledger')
          .select('xp_amount')
          .eq('user_id', profile.id),

    profile.show_completed_flows === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('active_flow_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('status', 'completed'),

    profile.show_checkins === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('event_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),

    profile.show_saved_guides === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('saved_properties')
          .select('property_id', { count: 'exact', head: true })
          .eq('user_id', profile.id),

    profile.show_social_groups === false
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('social_group_members')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id),
  ])

  const hiddenXp = (xpRows ?? []).reduce((sum, row: any) => {
    return sum + (row.xp_amount ?? 0)
  }, 0)

  const passportLevel = Math.max(1, Math.floor(hiddenXp / 250) + 1)

  return (
    <main className="min-h-screen bg-black px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white">
      <div className="mx-auto max-w-4xl space-y-6">
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
            <Stat label="Flows" value={completedFlowsCount ?? 0} />
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {profile.show_checkins !== false && (
            <Stat label="Event Check-ins" value={checkinsCount ?? 0} />
          )}

          {profile.show_saved_guides !== false && (
            <Stat label="Saved Guides" value={savedGuidesCount ?? 0} />
          )}

          {profile.show_social_groups !== false && (
            <Stat label="Social Groups" value={socialGroupsCount ?? 0} />
          )}
        </section>

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