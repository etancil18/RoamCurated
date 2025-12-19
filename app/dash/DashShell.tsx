'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Props = {
  venueName: string
  children: ReactNode
}

export default function DashShell({ venueName, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-white dark:bg-gray-900 text-black dark:text-white">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setOpen(true)}
          className="text-xl font-bold"
        >
          ☰
        </button>
        <span className="text-sm font-semibold truncate">{venueName}</span>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col justify-between transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0 md:static'
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
            {[
              ['/dash/dashboard', 'Dashboard'],
              ['/dash/live', 'Live Status'],
              ['/dash/crawls', 'Upcoming Crawls'],
              ['/dash/messages', 'Messages'],
              ['/dash/profile', 'Edit Profile'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
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
              className="w-full text-left text-sm text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
