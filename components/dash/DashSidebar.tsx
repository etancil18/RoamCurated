'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const links = [
  { href: '/dash/dashboard', label: 'Dashboard' },
  { href: '/dash/live', label: 'Live Status' },
  { href: '/dash/crawls', label: 'Upcoming Crawls' },
  { href: '/dash/profile', label: 'Edit Profile' },
  { href: '/dash/messages', label: 'Messages' },
]

export default async function DashSidebar({ currentPath }: { currentPath: string }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let venueName: string | null = null

  if (user?.email) {
    const { data: vuData, error: vuError } = await supabase
      .from('venue_users')
      .select('venue_id')
      .eq('email', user.email)
      .single()

    if (!vuError && vuData?.venue_id) {
      const { data: vData, error: vError } = await supabase
        .from('venues')
        .select('name')
        .eq('id', vuData.venue_id)
        .single()

      if (!vError && vData?.name) {
        venueName = vData.name
      }
    }
  }

  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden p-4">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-700 dark:text-white text-xl"
        >
          ☰ Menu
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-40 w-64 transform bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 transition-transform duration-200 ease-in-out flex-col justify-between',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0 md:flex'
        )}
      >
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
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-2 rounded transition-colors',
                  currentPath === href
                    ? 'bg-gray-300 dark:bg-gray-700 font-medium'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <form action="/logout" method="POST">
            <button
              type="submit"
              className="w-full px-3 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700 transition"
            >
              Log Out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
