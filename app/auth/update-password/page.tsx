'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    let cancelled = false

    async function validateRecoverySession() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (cancelled) return

        if (userError || !user) {
          setHasValidSession(false)
          setError(
            'This password reset link is invalid or has expired. Request a new reset link from the login page.'
          )
          return
        }

        setHasValidSession(true)
      } catch (err) {
        if (cancelled) return

        console.error(
          '[UpdatePasswordPage] Failed to validate recovery session:',
          err
        )

        setHasValidSession(false)
        setError(
          'This password reset link could not be verified. Request a new reset link from the login page.'
        )
      } finally {
        if (!cancelled) {
          setCheckingSession(false)
        }
      }
    }

    void validateRecoverySession()

    return () => {
      cancelled = true
    }
  }, [])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!hasValidSession) {
      setError(
        'This password reset link is invalid or has expired. Request a new reset link from the login page.'
      )
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    await supabase.auth.signOut()

    setTimeout(() => {
      router.replace('/login?passwordUpdated=true')
    }, 2000)
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-md dark:border-zinc-700 dark:bg-zinc-800">
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            Verifying your password reset link...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-md dark:border-zinc-700 dark:bg-zinc-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-white">
          Set New Password
        </h1>

        {success ? (
          <p
            role="status"
            className="text-center text-green-600 dark:text-green-400"
          >
            ✅ Password updated! Redirecting you to login...
          </p>
        ) : hasValidSession ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
              >
                New Password
              </label>

              <input
                id="new-password"
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-400"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300"
              >
                Confirm New Password
              </label>

              <input
                id="confirm-password"
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white dark:placeholder-zinc-400"
              />
            </div>

            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Use at least 8 characters.
            </p>

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg px-4 py-2 text-white transition-colors ${
                loading
                  ? 'cursor-not-allowed bg-gray-400 dark:bg-zinc-600'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            Return to Login
          </button>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 text-center text-red-600 dark:text-red-400"
          >
            ⚠️ {error}
          </p>
        )}
      </div>
    </main>
  )
}