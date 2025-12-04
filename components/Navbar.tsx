'use client'

import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

export default function Navbar() {
  const { user } = useUser()
  const router = useRouter()
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shadow-sm z-50">
      <Link href="/" className="text-lg font-bold tracking-tight">
        🧭 Roam
      </Link>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <Link href="/events" className="text-sm text-gray-700 hover:text-black">
              Events
            </Link>
            <Link href="/favorites" className="text-sm text-gray-700 hover:text-black">
              Favorites
            </Link>
            <Link href="/profile" className="text-sm text-gray-700 hover:text-black">
              Profile
            </Link>
            <Link href="/venue-admin" className="text-sm text-gray-700 hover:text-black">
              Admin
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-500"
            >
              Logout
            </button>
          </>
        ) : (
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
