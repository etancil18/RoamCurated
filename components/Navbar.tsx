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
    <nav className="w-full flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-sm z-50">
      <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity duration-200">
        {/* Light mode logo */}
        <img src="/img/logo-dark.png" alt="Roam Logo" className="h-8 w-auto dark:hidden" />
        {/* Dark mode logo */}
        <img src="/img/logo-light.png" alt="Roam Logo" className="h-8 w-auto hidden dark:block" />
      </Link>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <Link href="/events" className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white">
              Events
            </Link>
            <Link href="/favorites" className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white">
              Favorites
            </Link>
            <Link href="/sponsor-crawl" className="text-sm text-amber-600 hover:text-black dark:hover:text-white">
              Host Crawl
            </Link>
            <Link href="/profile" className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white">
              Profile
            </Link>
            <Link href="/venue-admin" className="text-sm text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white">
              Admin
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-red-500"
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
