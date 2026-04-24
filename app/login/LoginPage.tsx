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

    // 🔹 Try existing user login first
    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    // 🔹 If login succeeds → proceed exactly as before
    if (!signInError) {
      await supabase.auth.getSession()
      setLoading(false)
      window.location.href = '/'
      return
    }

    // 🔹 If login fails → attempt instant signup
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

    // 🔥 Force cookie/session write for new user
    await supabase.auth.getSession()

    setLoading(false)

    // 🔥 Hard redirect so middleware immediately sees auth
    window.location.href = '/'
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.10),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.10),_transparent_24%)] bg-stone-50 text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        <section className="relative hidden overflow-hidden border-r border-black/5 px-10 py-16 lg:flex lg:flex-col lg:justify-between dark:border-white/10">
          <div className="absolute inset-0 opacity-[0.07] dark:opacity-[0.10]">
            <div className="absolute left-[10%] top-[12%] h-40 w-40 rounded-full border border-zinc-900 dark:border-white" />
            <div className="absolute left-[22%] top-[24%] h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            <div className="absolute left-[40%] top-[34%] h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            <div className="absolute left-[58%] top-[28%] h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            <div className="absolute left-[30%] top-[58%] h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            <div className="absolute left-[66%] top-[62%] h-2 w-2 rounded-full bg-zinc-900 dark:bg-white" />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              <path
                d="M160 190 C 280 230, 350 300, 410 340 S 560 430, 660 360 820 250, 900 290"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 10"
                className="text-zinc-900 dark:text-white"
              />
              <path
                d="M240 600 C 320 540, 400 520, 520 560 S 720 660, 840 610"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 10"
                className="text-zinc-900 dark:text-white"
              />
            </svg>
          </div>

          <div className="relative z-10">
            <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-zinc-200/80 bg-white/80 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
              <img
                src="/favicon-new.ico"
                alt="Roam logo"
                className="h-6 w-6 rounded-sm"
              />
              <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
                ROAM
              </span>
            </div>

            <div className="max-w-xl space-y-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Editorial travel-tech
              </p>

              <h1 className="text-4xl font-semibold leading-tight text-zinc-900 dark:text-white xl:text-5xl">
                Roam your city better
              </h1>

              <p className="max-w-lg text-lg leading-8 text-zinc-600 dark:text-zinc-300">
                From coffee to cocktails to full neighborhood flows, we’ll help
                you move with intent.
              </p>

              <div className="grid max-w-xl grid-cols-1 gap-3 pt-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    Save favorite spots
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Keep the places worth returning to.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    Build better routes
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Explore neighborhoods with more intention.
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    Unlock curated guides
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Get smarter local recommendations.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Thoughtful local discovery for people who want more than random pins
              on a map.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-center lg:hidden">
              <div className="inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <img
                  src="/favicon-new.ico"
                  alt="Roam logo"
                  className="h-6 w-6 rounded-sm"
                />
                <span className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-white">
                  ROAM
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white/90 p-8 shadow-[0_10px_40px_rgba(0,0,0,0.08)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85 dark:shadow-[0_14px_50px_rgba(0,0,0,0.35)] sm:p-10">
              <div className="mb-8 space-y-3 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Welcome to Roam
                </h2>

                <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  Enter your email and password to sign in or create your account.
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
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:ring-white/15 dark:focus:border-zinc-500"
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
                    className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-black placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:focus:ring-white/15 dark:focus:border-zinc-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full rounded-xl px-4 py-3 text-sm font-medium text-white transition-all ${
                    loading
                      ? 'cursor-not-allowed bg-zinc-400 dark:bg-zinc-600'
                      : 'bg-zinc-900 hover:-translate-y-0.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                  }`}
                >
                  {loading ? 'Processing...' : 'Sign In / Sign Up'}
                </button>
              </form>

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
                  Your saved spots, routes, and neighborhood guides live here.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}