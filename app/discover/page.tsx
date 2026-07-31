import UserSearch from '@/components/discover/UserSearch'
import SuggestedRoamers from '@/components/discover/SuggestedRoamers'
import RoamLeaderboard from '@/components/discover/RoamLeaderboard'

export const dynamic = 'force-dynamic'

export default function DiscoverPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-black px-4 pb-16 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-8%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[18%] h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl sm:right-[-12%]" />

        <div className="absolute bottom-[-16%] left-[35%] h-72 w-72 rounded-full bg-amber-400/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-neutral-800 bg-gradient-to-br from-cyan-500/[0.08] via-neutral-950 to-indigo-500/[0.08] p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
          />

          <div className="relative z-10 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400 sm:text-xs">
                Discover Roam
              </p>

              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-[1.05]">
                Find the people shaping
                your city.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base sm:leading-7">
                Search for friends,
                creators, and local
                tastemakers. Follow the
                people whose places,
                guides, and city point of
                view you trust.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="#find-roamers"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Find people
                </a>

                <a
                  href="#roam-leaderboard"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-neutral-700 bg-black/30 px-4 py-2 text-xs font-semibold text-neutral-300 transition hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  Explore rankings
                </a>
              </div>
            </div>

            <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-black/30 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 text-lg"
                >
                  ✦
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Discover with real
                    signal
                  </p>

                  <p className="mt-1 text-xs leading-5 text-neutral-400 sm:text-sm sm:leading-6">
                    Reputation highlights
                    how eligible Roamers
                    compare globally,
                    within a state, and
                    across the categories
                    they know best.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <DiscoverySignal
                  label="Global"
                  detail="Across Roam"
                />

                <DiscoverySignal
                  label="State"
                  detail="Closer to home"
                />

                <DiscoverySignal
                  label="Category"
                  detail="By expertise"
                />
              </div>
            </div>
          </div>
        </section>

        <nav
          aria-label="Discover sections"
          className="sticky top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-30 -mx-4 mt-5 border-y border-neutral-800/80 bg-black/85 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border"
        >
          <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <a
              href="#find-roamers"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs font-semibold text-neutral-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              Search
            </a>

            <a
              href="#suggested-roamers"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs font-semibold text-neutral-400 transition hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Suggested
            </a>

            <a
              href="#roam-leaderboard"
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2 text-xs font-semibold text-neutral-400 transition hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Leaderboard
            </a>
          </div>
        </nav>

        <div className="mt-8 space-y-12 sm:mt-10 sm:space-y-16">
          <section
            id="find-roamers"
            aria-labelledby="discover-people-title"
            className="scroll-mt-28"
          >
            <DiscoverSectionHeading
              id="discover-people-title"
              eyebrow="Find people"
              title="Search the Roam community"
              description="Look up a person by name or username, open their profile, and follow the people you want in your city graph."
            />

            <div className="mt-5">
              <UserSearch />
            </div>
          </section>

          <section
            id="suggested-roamers"
            aria-labelledby="suggested-roamers-title"
            className="scroll-mt-28"
          >
            <DiscoverSectionHeading
              id="suggested-roamers-title"
              eyebrow="People to meet"
              title="Roamers worth discovering"
              description="A lighter way to meet active people, local creators, and city personalities you may want to follow."
            />

            <div className="mt-5">
              <SuggestedRoamers />
            </div>
          </section>

          <section
            id="roam-leaderboard"
            aria-labelledby="roam-leaderboard-title"
            className="scroll-mt-28"
          >
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <DiscoverSectionHeading
                id="roam-leaderboard-title"
                eyebrow="Reputation leaderboards"
                title="See who stands out"
                description="Explore how eligible Roamers compare globally, within states, and in the categories they have earned a reputation for."
              />

              <div className="flex shrink-0 flex-wrap gap-2">
                <RankingScopeBadge
                  label="Global"
                  tone="cyan"
                />

                <RankingScopeBadge
                  label="State"
                  tone="indigo"
                />

                <RankingScopeBadge
                  label="Category"
                  tone="amber"
                />
              </div>
            </div>

            <div className="mt-5">
              <RoamLeaderboard />
            </div>

            <p className="mt-3 text-xs leading-5 text-neutral-600">
              Percentiles and ranks are
              based on eligible comparison
              populations within each
              selected scope and category.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

/* =========================================================
 * Supporting presentation
 * ======================================================= */

function DiscoverSectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">
        {eyebrow}
      </p>

      <h2
        id={id}
        className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl"
      >
        {title}
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </div>
  )
}

function DiscoverySignal({
  label,
  detail,
}: {
  label: string
  detail: string
}) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2.5">
      <p className="truncate text-xs font-semibold text-white">
        {label}
      </p>

      <p className="mt-1 truncate text-[9px] text-neutral-600">
        {detail}
      </p>
    </div>
  )
}

function RankingScopeBadge({
  label,
  tone,
}: {
  label: string
  tone:
    | 'cyan'
    | 'indigo'
    | 'amber'
}) {
  const styles = {
    cyan:
      'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',

    indigo:
      'border-indigo-500/25 bg-indigo-500/10 text-indigo-200',

    amber:
      'border-amber-400/25 bg-amber-400/10 text-amber-200',
  } as const

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
        styles[tone],
      ].join(' ')}
    >
      {label}
    </span>
  )
}