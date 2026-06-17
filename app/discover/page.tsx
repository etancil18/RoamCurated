import UserSearch from '@/components/discover/UserSearch'
import SuggestedRoamers from '@/components/discover/SuggestedRoamers'
import RoamLeaderboard from '@/components/discover/RoamLeaderboard'

export const dynamic = 'force-dynamic'

export default function DiscoverPage() {
  return (
    <main className="min-h-screen bg-black px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-neutral-950 via-black to-indigo-950/30 p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
            Discover
          </p>

          <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                Find people who move through the city like you.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base">
                Search Roamers by username, follow people whose taste you trust,
                and start building your city graph around real movement.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <p className="text-sm font-semibold text-white">
                Roam is better with signal.
              </p>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Profiles are built from vibes, interests, check-ins, flows,
                events, and the places people actually choose.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <UserSearch />
          <SuggestedRoamers />
        </div>

        <RoamLeaderboard />
      </div>
    </main>
  )
}