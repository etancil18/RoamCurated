'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type OnboardingStatusResponse = {
  hasSeenRoamIntro?: boolean
  nextPath?: string
  error?: string
}

export default function WelcomePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkOnboardingStatus() {
      try {
        const res = await fetch('/api/user/onboarding', {
          method: 'GET',
          credentials: 'include',
        })

        const data = (await res.json().catch(() => null)) as
          | OnboardingStatusResponse
          | null

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load onboarding status')
        }

        if (cancelled) return

        if (data?.hasSeenRoamIntro) {
          router.replace('/')
          return
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return

        console.error('[WelcomePage] Failed to check onboarding:', err)
        setError(
          err instanceof Error
            ? err.message
            : 'Something went wrong loading Roam.'
        )
        setLoading(false)
      }
    }

    checkOnboardingStatus()

    return () => {
      cancelled = true
    }
  }, [router])

  const startRoaming = async () => {
    setStarting(true)
    setError(null)

    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        credentials: 'include',
      })

      const data = (await response.json().catch(() => null)) as
        | OnboardingStatusResponse
        | null

      if (!response.ok) {
        throw new Error(
          data?.error || 'Something went wrong starting onboarding.'
        )
      }

      router.replace(data?.nextPath || '/onboarding')
    } catch (err) {
      console.error('[WelcomePage] Failed to start onboarding:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong starting onboarding.'
      )

      setStarting(false)
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#05060a] text-white">
        <p className="text-sm text-neutral-400">Preparing your city…</p>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.34),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.24),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_45%,_#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 opacity-80 blur-2xl" />
            <div className="absolute h-28 w-28 rounded-[2rem] border border-white/15 bg-white/10 shadow-2xl backdrop-blur-xl" />
            <div className="absolute h-40 w-40 rounded-full border border-cyan-300/20" />
            <div className="absolute h-52 w-52 rounded-full border border-indigo-300/10" />

            <svg
              className="absolute h-48 w-48 text-white/30"
              viewBox="0 0 200 200"
              aria-hidden="true"
            >
              <path
                d="M34 116 C 58 48, 105 157, 164 78"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="7 9"
              />
            </svg>

            <div className="absolute left-4 top-8 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.95)]" />
            <div className="absolute right-7 top-5 h-3 w-3 rounded-full bg-indigo-300 shadow-[0_0_18px_rgba(129,140,248,0.95)]" />
            <div className="absolute bottom-6 right-4 h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.95)]" />

            <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.5rem] border border-white/20 bg-black/40 shadow-2xl backdrop-blur-xl">
              <img
                src="/favicon-new.ico"
                alt="Roam logo"
                className="h-11 w-11 rounded-lg"
              />
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Welcome to your city’s new game board
          </p>

          <h1 className="mt-5 text-5xl font-black leading-[0.94] tracking-tight sm:text-7xl">
            Your city just became playable.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-neutral-300 sm:text-lg">
            Build a date night in under 60 seconds, host flows with friends,
            check in as you move, earn XP, and share your route like a story.
          </p>
        </div>

        <div className="mx-auto mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3">
          <FeatureCard
            eyebrow="Generate"
            title="Build a Flow"
            description="Pick a city, vibe, and travel mode. Roam turns nearby places into a ready-to-follow itinerary."
            accent="from-cyan-400 to-indigo-500"
          />

          <FeatureCard
            eyebrow="Play"
            title="Check in & level up"
            description="Move stop by stop, complete the route, rate the places you visit, and grow your Passport."
            accent="from-indigo-400 to-fuchsia-500"
          />

          <FeatureCard
            eyebrow="Share"
            title="Post the Snapshot"
            description="Save your completed route as a story-style card and show friends how you curate the city."
            accent="from-emerald-400 to-cyan-500"
          />
        </div>

        <div className="mx-auto mt-12 w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                First move
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Open the map and start roaming.
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Tap around, find a spot, generate a Flow, or host one for your
                friends. The city is now yours to play.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void startRoaming()}
              disabled={starting}
              className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {starting ? 'Starting…' : 'Start Roaming'}
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  )
}

function FeatureCard({
  eyebrow,
  title,
  description,
  accent,
}: {
  eyebrow: string
  title: string
  description: string
  accent: string
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-xl backdrop-blur-xl">
      <div
        className={`mb-5 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`}
      />

      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
        {eyebrow}
      </p>

      <h3 className="mt-3 text-xl font-bold text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-6 text-neutral-400">
        {description}
      </p>
    </div>
  )
}