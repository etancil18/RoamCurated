// app/dash/layout.tsx

import { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function DashLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/dash/login')
  }

  const { data: venueUser, error: venueUserError } = await supabase
    .from('venue_users')
    .select('venue_id')
    .eq('email', user.email ?? '')
    .single()

  if (!venueUser || venueUserError) {
    redirect('/dash/login')
  }

  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('name')
    .eq('id', venueUser.venue_id)
    .single()

  const venueName = venue?.name ?? ''

  return (
    <div className="min-h-screen flex bg-white text-black dark:bg-gray-900 dark:text-white">
      <aside className="hidden md:flex md:w-64 flex-col justify-between bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700">
        <div>
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/dash/dashboard" className="block text-xl font-bold">
              Roam Dash
            </Link>
            {venueName && (
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                {venueName}
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-1 px-4 py-2 text-sm">
            <Link href="/dash/dashboard" className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              Dashboard
            </Link>
            <Link href="/dash/live" className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              Live Status
            </Link>
            <Link href="/dash/crawls" className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              Upcoming Crawls
            </Link>
            <Link href="/dash/messages" className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              Messages
            </Link>
            <Link href="/dash/profile" className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              Edit Profile
            </Link>
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
