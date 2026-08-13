'use client'

import { useEffect, useRef } from 'react'

import UserSearch from '@/components/discover/UserSearch'
import SuggestedRoamers from '@/components/discover/SuggestedRoamers'
import RoamLeaderboard from '@/components/discover/RoamLeaderboard'

import { logEvent } from '@/lib/logEvent'

export const dynamic = 'force-dynamic'

/* =========================================================
 * Analytics
 * ======================================================= */

type DiscoverNavigationTarget =
  | 'find_people'
  | 'suggested_roamers'
  | 'roam_leaderboard'

type DiscoverClickSurface =
  | 'hero_cta'
  | 'section_navigation'

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn(
      '[DiscoverPage] Analytics logging failed:',
      error
    )
  }
}

export default function DiscoverPage() {
  const pageViewLoggedRef = useRef(false)

  useEffect(() => {
    if (pageViewLoggedRef.current) {
      return
    }

    pageViewLoggedRef.current = true

    safeLogEvent('discover_page_viewed', {
      page: 'discover',
      pathname: '/discover',
    })
  }, [])

  function handleDiscoverNavigation({
    target,
    surface,
  }: {
    target: DiscoverNavigationTarget
    surface: DiscoverClickSurface
  }) {
    safeLogEvent('discover_navigation_clicked', {
      page: 'discover',
      pathname: '/discover',
      target,
      surface,
    })
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

            <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />
          </div>

          <div className="relative z-10 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-px w-5 bg-cyan-300/60" />

                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 sm:text-xs">
                  Discover people
                </p>
              </div>

              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]">
                Find the people with
                taste worth following.
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base sm:leading-7">
                Search friends,
                creators, and local
                tastemakers. Follow the
                people whose places,
                guides, and city instincts
                actually match yours.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  href="#find-roamers"
                  onClick={() =>
                    handleDiscoverNavigation({
                      target: 'find_people',
                      surface: 'hero_cta',
                    })
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2.5 text-xs font-black text-black transition hover:bg-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  Find people
                </a>

                <a
                  href="#roam-leaderboard"
                  onClick={() =>
                    handleDiscoverNavigation({
                      target: 'roam_leaderboard',
                      surface: 'hero_cta',
                    })
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-white/[0.035] px-5 py-2.5 text-xs font-bold text-zinc-300 ring-1 ring-white/[0.07] transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  See who stands out
                </a>
              </div>
            </div>

            <div className="min-w-0 rounded-[1.6rem] bg-black/25 p-4 ring-1 ring-white/[0.055] sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-300/[0.08] text-lg text-indigo-200 ring-1 ring-indigo-300/15"
                >
                  ✦
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-black tracking-tight text-white">
                    Find people with real signal
                  </p>

                  <p className="mt-1.5 text-xs leading-5 text-zinc-600 sm:text-sm sm:leading-6">
                    Reputation helps surface
                    who has actually built
                    experience in a city,
                    category, or scene—not
                    just who posts the most.
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
          className="sticky top-[calc(4rem+env(safe-area-inset-top)+0.5rem)] z-30 -mx-4 mt-5 bg-[#070809]/90 px-4 py-2.5 backdrop-blur-2xl sm:mx-0 sm:rounded-full sm:bg-black/55 sm:px-2 sm:ring-1 sm:ring-white/[0.07]"
        >
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <a
              href="#find-roamers"
              onClick={() =>
                handleDiscoverNavigation({
                  target: 'find_people',
                  surface: 'section_navigation',
                })
              }
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-white/[0.045] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              Search
            </a>

            <a
              href="#suggested-roamers"
              onClick={() =>
                handleDiscoverNavigation({
                  target: 'suggested_roamers',
                  surface: 'section_navigation',
                })
              }
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-white/[0.045] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/50"
            >
              Suggested
            </a>

            <a
              href="#roam-leaderboard"
              onClick={() =>
                handleDiscoverNavigation({
                  target: 'roam_leaderboard',
                  surface: 'section_navigation',
                })
              }
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-white/[0.045] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
            >
              Leaderboard
            </a>
          </div>
        </nav>

        <div className="mt-10 space-y-16 sm:mt-14 sm:space-y-20">
          <section
            id="find-roamers"
            aria-labelledby="discover-people-title"
            className="scroll-mt-32"
          >
            <DiscoverSectionHeading
              id="discover-people-title"
              eyebrow="Search"
              title="Know who you’re looking for?"
              description="Search by name or username and add the people you want in your city orbit."
            />

            <div className="mt-5">
              <UserSearch />
            </div>
          </section>

          <section
            id="suggested-roamers"
            aria-labelledby="suggested-roamers-title"
            className="scroll-mt-32"
          >
            <DiscoverSectionHeading
              id="suggested-roamers-title"
              eyebrow="For your orbit"
              title="People you might actually vibe with"
              description="Active Roamers, local creators, and people with enough city signal to be worth a follow."
            />

            <div className="mt-5">
              <SuggestedRoamers />
            </div>
          </section>

          <section
            id="roam-leaderboard"
            aria-labelledby="roam-leaderboard-title"
            className="scroll-mt-32"
          >
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <DiscoverSectionHeading
                id="roam-leaderboard-title"
                eyebrow="Reputation"
                title="Who really knows the city?"
                description="See which eligible Roamers stand out globally, locally, and inside the categories they’ve actually earned credibility in."
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

            <p className="mt-3 max-w-3xl text-[11px] leading-5 text-zinc-700">
              Rankings and percentiles
              compare only eligible
              Roamers within the selected
              scope and category.
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
      <div className="flex items-center gap-2">
        <span className="h-px w-5 bg-cyan-300/60" />

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

      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
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
    <div className="min-w-0 rounded-[1.1rem] bg-white/[0.025] px-3 py-3 ring-1 ring-white/[0.05]">
      <p className="truncate text-xs font-black text-white">
        {label}
      </p>

      <p className="mt-1 truncate text-[9px] text-zinc-700">
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
      'bg-cyan-300/[0.07] text-cyan-200 ring-1 ring-cyan-300/12',

    indigo:
      'bg-indigo-300/[0.07] text-indigo-200 ring-1 ring-indigo-300/12',

    amber:
      'bg-amber-300/[0.07] text-amber-200 ring-1 ring-amber-300/12',
  } as const

  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em]',
        styles[tone],
      ].join(' ')}
    >
      {label}
    </span>
  )
}