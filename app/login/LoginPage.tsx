// app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useUser } from '@/hooks/useUser'
import type { Database } from '@/types/supabase'


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { user } = useUser()

  const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


  // 🚀 Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/')
    }
  }, [user, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitted(false)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`, // ✅ fixed redirect
      },
    })

    setLoading(false)

    if (error) {
      console.error(error)
      setError(error.message)
    } else {
      setSubmitted(true)
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-md border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-6">Login</h1>

        {submitted ? (
          <p className="text-green-600 text-center">
            ✅ Magic link sent! Check your email to continue.
          </p>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg text-white transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
            </button>
          </form>
        )}

        {error && (
          <p className="text-red-600 text-center mt-4">⚠️ {error}</p>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          No password required. Just check your inbox.
        </p>
      </div>
    </main>
  )
}
