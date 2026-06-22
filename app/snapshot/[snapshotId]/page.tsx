import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{
    snapshotId: string
  }>
}

type SnapshotRow = {
  id: string
  user_id: string
  source_type: string
  source_id: string
  title: string | null
  city: string | null
  status: string | null
  cover_image_url: string
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  visibility: string | null
  created_at: string | null
}

type ProfileRow = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
}

export default async function SnapshotDetailPage({ params }: Props) {
  const { snapshotId } = await params

  if (!snapshotId) {
    notFound()
  }

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: snapshot, error: snapshotError } = await supabase
    .from('flow_snapshots' as any)
    .select(
      'id, user_id, source_type, source_id, title, city, status, cover_image_url, route_summary, checked_in_count, total_stops, visibility, created_at'
    )
    .eq('id', snapshotId)
    .maybeSingle<SnapshotRow>()

  if (snapshotError || !snapshot) {
    notFound()
  }

  const isOwner = user?.id === snapshot.user_id
  const isPublic = snapshot.visibility === 'public'

  if (!isPublic && !isOwner) {
    notFound()
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .eq('id', snapshot.user_id)
    .maybeSingle<ProfileRow>()

  const profileHref = profile?.username
    ? `/u/${encodeURIComponent(profile.username)}`
    : '/discover'

  const routeStops =
    snapshot.route_summary
      ?.split('→')
      .map((stop) => stop.trim())
      .filter(Boolean) ?? []

  return (
    <main className="min-h-screen bg-black px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={profileHref}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-cyan-400/50 hover:text-white"
        >
          ← Back to Profile
        </Link>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-hidden rounded-[2rem] border border-neutral-800 bg-neutral-950">
            <img
              src={snapshot.cover_image_url}
              alt={snapshot.title ?? 'Roam snapshot'}
              className="h-full w-full object-cover"
            />
          </div>

          <aside className="space-y-5 rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-xl">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>🧭</span>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold">
                  {profile?.full_name ?? profile?.username ?? 'Roam Explorer'}
                </p>

                {profile?.username && (
                  <p className="text-xs text-neutral-500">
                    @{profile.username}
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
                Flow Snapshot
              </p>

              <h1 className="mt-3 text-2xl font-bold">
                {snapshot.title ?? 'Roam Flow'}
              </h1>

              <p className="mt-2 text-sm text-neutral-400">
                {snapshot.city ?? 'City'} · {snapshot.status ?? 'completed'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Stops"
                value={`${snapshot.checked_in_count ?? 0}/${snapshot.total_stops ?? 0}`}
              />

              <Stat
                label="Type"
                value={snapshot.source_type === 'hosted_flow' ? 'Hosted' : 'Flow'}
              />
            </div>

            {snapshot.created_at && (
              <p className="text-xs text-neutral-500">
                Saved{' '}
                {new Date(snapshot.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}

            {routeStops.length > 0 && (
              <div className="rounded-2xl border border-neutral-800 bg-black p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Route
                </h2>

                <ol className="mt-4 space-y-3">
                  {routeStops.map((stop, index) => (
                    <li key={`${stop}-${index}`} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-black">
                        {index + 1}
                      </span>

                      <span className="text-sm text-neutral-300">
                        {stop}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
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
  value: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-black p-4">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  )
}