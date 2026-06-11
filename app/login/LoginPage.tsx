'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)

    if (!email || !password) {
      setError('Please enter both email and password.')
      setLoading(false)
      return
    }

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (!signInError) {
      await supabase.auth.getSession()
      setLoading(false)
      window.location.href = '/welcome'
      return
    }

    const { error: signUpError } =
      await supabase.auth.signUp({
        email,
        password,
      })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    await supabase.auth.getSession()

    setLoading(false)

    window.location.href = '/welcome'
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first.')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://roam-curated.vercel.app/auth/update-password',
    })

    if (error) {
      setError(error.message)
    } else {
      setSuccessMessage('✅ Reset link sent. Check your email to set a password.')
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.20),_transparent_34%),linear-gradient(135deg,_#05060a_0%,_#09090f_45%,_#020617_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden border-r border-white/10 px-10 py-16 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0">
            <svg
              className="absolute inset-0 h-full w-full text-white/20"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              <path
                d="M110 260 C 240 170, 350 230, 430 340 S 600 520, 760 390 860 310, 930 370"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="10 12"
              />
              <path
                d="M130 700 C 260 620, 420 610, 530 690 S 760 840, 900 690"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="10 12"
              />
            </svg>

            <div className="absolute left-[14%] top-[23%] h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.9)]" />
            <div className="absolute left-[42%] top-[34%] h-4 w-4 rounded-full bg-indigo-300 shadow-[0_0_24px_rgba(129,140,248,0.9)]" />
            <div className="absolute left-[73%] top-[42%] h-4 w-4 rounded-full bg-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.9)]" />
            <div className="absolute left-[31%] top-[68%] h-4 w-4 rounded-full bg-fuchsia-300 shadow-[0_0_24px_rgba(217,70,239,0.9)]" />
            <div className="absolute left-[67%] top-[78%] h-4 w-4 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.9)]" />
          </div>

          <div className="relative z-10">
            <div className="max-w-xl space-y-6">
              <h1 className="text-5xl font-black leading-[0.98] tracking-tight text-white xl:text-6xl">
                Turn your city into a playable itinerary.
              </h1>

              <p className="max-w-lg text-lg leading-8 text-neutral-300">
                Build flows around your mood, check in as you move, earn
                Passport progress, and share the route when the night is worth
                remembering.
              </p>

              <div className="relative mt-10 h-[360px] max-w-xl">
                <div className="absolute left-0 top-8 w-72 rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                      Active Flow
                    </p>
                    <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-200">
                      60%
                    </span>
                  </div>

                  <p className="mt-4 text-2xl font-bold">Night Mode</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    3 of 5 stops checked in
                  </p>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-3/5 rounded-full bg-cyan-400" />
                  </div>

                  <div className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-xs font-black">
                        1
                      </span>
                      <span className="text-neutral-200">Coffee</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-black">
                        2
                      </span>
                      <span className="text-neutral-200">Gallery</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black">
                        3
                      </span>
                      <span className="text-neutral-200">Cocktails</span>
                    </div>
                  </div>
                </div>

                <div className="absolute right-0 top-0 w-64 rounded-[2rem] border border-white/10 bg-black/35 p-5 shadow-2xl backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
                    Passport
                  </p>
                  <p className="mt-4 text-4xl font-black">+175 XP</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Flow Finisher badge unlocked
                  </p>
                </div>

                <div className="absolute bottom-0 right-8 w-72 rounded-[2rem] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
                    Snapshot ready
                  </p>
                  <p className="mt-3 text-xl font-bold">
                    Coffee → Gallery → Cocktails
                  </p>
                  <p className="mt-2 text-sm text-neutral-400">
                    Save and share the route after the night.
                  </p>
                </div>
              </div>

              <div className="grid max-w-xl grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">
                    Generate a Flow
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Pick a city, vibe, and travel mode.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">
                    Check In & Complete
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Track progress, XP, and badges.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
                  <p className="text-sm font-semibold text-white">
                    Share the Snapshot
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Turn the route into a story card.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-sm text-neutral-400">
              Thoughtful local discovery for people who want more than random pins
              on a map.
            </p>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="absolute inset-x-6 top-8 flex justify-center lg:hidden">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 shadow-sm backdrop-blur">
              <img
                src="/favicon-new.ico"
                alt="Roam logo"
                className="h-6 w-6 rounded-sm"
              />
              <span className="text-sm font-semibold tracking-wide text-white">
                ROAM
              </span>
            </div>
          </div>

          <div className="w-full max-w-md pt-16 lg:pt-0">
            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.08] p-1 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <div className="rounded-[28px] bg-white/95 p-8 text-zinc-900 dark:bg-zinc-950/90 dark:text-white sm:p-10">
                <div className="mb-8 space-y-3 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20">
                    <img
                      src="/favicon-new.ico"
                      alt="Roam logo"
                      className="h-8 w-8 rounded-sm"
                    />
                  </div>

                  <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
                    Welcome to Roam
                  </h2>

                  <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Sign in to save your Passport, resume active flows, host crawls,
                    and keep your city history.
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-black placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-black placeholder:text-zinc-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all ${
                      loading
                        ? 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-600 shadow-cyan-500/20 hover:-translate-y-0.5 hover:from-cyan-400 hover:to-indigo-500'
                    }`}
                  >
                    {loading ? 'Processing...' : 'Continue to Roam'}
                  </button>
                </form>

                <div className="mt-5 grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                  <p>✓ Save active flows</p>
                  <p>✓ Track XP and badges</p>
                  <p>✓ Host and share city crawls</p>
                </div>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="mt-5 block w-full text-center text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
                >
                  Forgot password?
                </button>

                {error && (
                  <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    <span className="font-medium">Something went wrong:</span> {error}
                  </div>
                )}

                {successMessage && (
                  <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
                    {successMessage}
                  </div>
                )}

                <div className="mt-8 border-t border-zinc-200 pt-5 dark:border-zinc-800">
                  <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    Your saved spots, flows, Passport progress, and city snapshots live here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}