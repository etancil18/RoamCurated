
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

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#070809] px-4 pb-20 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] text-white sm:px-6 sm:pt-[calc(4rem+env(safe-area-inset-top)+2rem)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-28%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[120px] sm:left-[-10%]" />

        <div className="absolute right-[-30%] top-[14%] h-[34rem] w-[34rem] rounded-full bg-indigo-400/[0.07] blur-[135px] sm:right-[-12%]" />

        <div className="absolute bottom-[-18%] left-[32%] h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.035] blur-[130px]" />

        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.02] to-transparent" />
      </div>

      <div className="relative mx-auto w-full min-w-0 max-w-6xl">
        <section
          id="find-roamers"
          aria-labelledby="discover-people-title"
          className="relative scroll-mt-32 overflow-hidden rounded-[2rem] bg-gradient-to-br from-white/[0.06] via-white/[0.028] to-indigo-400/[0.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.28)] ring-1 ring-white/[0.07] sm:p-8"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

            <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.055] blur-[100px]" />

            <div className="absolute -bottom-28 right-[-4rem] h-72 w-72 rounded-full bg-indigo-400/[0.05] blur-[110px]" />
          </div>

          <div className="relative z-10 min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-300/60" />

              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300 sm:text-xs">
                Discover
              </p>
            </div>

            <h1
              id="discover-people-title"
              className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl sm:leading-[1.03]"
            >
              Find your people.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base sm:leading-7">
              Discover Roamers who share your interests,
              explore the places you care about, and
              know your city.
            </p>

            <div className="mt-6 max-w-3xl">
              <UserSearch />
            </div>

            <div className="mt-5 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.065] pt-4 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-amber-300/80"
                />

                Passport XP reflects exploration
                and participation.
              </span>

              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-cyan-300/80"
                />

                Reputation reflects verified
                category expertise.
              </span>
            </div>
          </div>
        </section>

        <div className="mt-9 space-y-12 sm:mt-11 sm:space-y-14">
          <section
            id="suggested-roamers"
            aria-labelledby="suggested-roamers-title"
            className="scroll-mt-32"
          >
            <DiscoverSectionHeading
              id="suggested-roamers-title"
              eyebrow="Discover"
              title="People to discover"
              description="A focused selection of up to six Roamers, recommended through shared interests, local connections, and earned reputation."
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
            <DiscoverSectionHeading
              id="roam-leaderboard-title"
              eyebrow="Creator reputation"
              title="Who knows these places best?"
              description="Explore five leading verified creators by category and city, with your own reputation standing available separately."
            />

            <div className="mt-5">
              <RoamLeaderboard />
            </div>
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
  description?: string
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

      {description ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
          {description}
        </p>
      ) : null}
    </div>
  )
}
