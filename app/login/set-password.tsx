'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/hooks/useUser'
import type { Database } from '@/types/supabase'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    void supabase.auth.getUser()
  }, [supabase])

  useEffect(() => {
    if (userLoading) return

    if (!user) {
      router.replace('/login') // redirect unauthenticated users
    }
  }, [user, userLoading, router])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
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

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccessMessage('✅ Password updated successfully.')
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors">
      <div className="w-full max-w-md p-8 bg-white dark:bg-zinc-800 rounded-2xl shadow-md border border-gray-200 dark:border-zinc-700">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-800 dark:text-white">
          Set Your Password
        </h1>

        <form onSubmit={handleSetPassword} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-black dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-center mt-4">
            ⚠️ {error}
          </p>
        )}

        {successMessage && (
          <p className="text-green-600 dark:text-green-400 text-center mt-4">
            {successMessage}
          </p>
        )}

        <p className="text-center text-gray-500 dark:text-zinc-400 text-sm mt-6">
          Already set a password? You can now log in using your email and password.
        </p>
      </div>
    </main>
  )
}