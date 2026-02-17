'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/hooks/useUser'
import type { Database } from '@/types/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const { user } = useUser()

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // ✅ Single redirect source: derived user state
  useEffect(() => {
    if (user) {
      router.replace('/')
    }
  }, [user, router])

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

    const { error: signInError, data } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // ✅ Explicit redirect on success
    if (data.session) {
      router.replace('/')
    }

    setLoading(false)
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
    <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors">
      <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-gray-200 dark:border-zinc-700">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          Login to Roam
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 rounded-lg text-white transition-colors ${
              loading
                ? 'bg-gray-400 dark:bg-zinc-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-sm text-blue-600 hover:underline mt-4 block mx-auto"
        >
          Forgot / Set Password
        </button>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-center mt-4">⚠️ {error}</p>
        )}

        {successMessage && (
          <p className="text-green-600 dark:text-green-400 text-center mt-4">
            {successMessage}
          </p>
        )}
      </div>
    </main>
  )
}
