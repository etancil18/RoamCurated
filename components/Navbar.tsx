'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/hooks/useUser'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { logEvent } from '@/lib/logEvent'

const allowedAdminEmails = [
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
]

export default function Navbar() {
  const { user } = useUser()
  const router = useRouter()
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const canSeeAdmin = user?.email
    ? allowedAdminEmails.includes(user.email.toLowerCase())
    : false

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  async function handleLogout() {
    logEvent('logout_clicked', {
      metadata: {
        user_id: user?.id ?? null,
      },
    })

    setMenuOpen(false)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function handleNavClick(link: string) {
    logEvent('navbar_click', {
      metadata: {
        link,
      },
    })

    setMenuOpen(false)
  }

  return (
   <nav className="fixed top-0 left-0 right-0 z-[5000] h-16 border-b border-gray-200 bg-white/95 px-4 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/95 sm:px-6">
      <div className="flex h-full items-center justify-between">
        <Link
          href="/"
          onClick={() => handleNavClick('home')}
          className="flex items-center space-x-2 rounded-md hover:opacity-80 transition-opacity duration-200"
          aria-label="Go to home"
        >
          <img
            src="/img/favicon-32x32.png"
            alt="Roam Logo"
            className="h-8 w-auto"
          />
        </Link>

        <div className="relative z-[5001]" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Open navigation menu"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-200 dark:hover:bg-zinc-800"
          >
            <span>Menu</span>
            <svg
              className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-[5002] mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="py-2">
                {user ? (
                  <>
                  <Link
                    href="/how-it-works"
                    onClick={() => handleNavClick('how-it-works')}
                    className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    How It Works
                  </Link>
                  <Link
                      href="/"
                      onClick={() => handleNavClick('maps')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Maps
                    </Link>
                   <Link
                      href="/events"
                      onClick={() => handleNavClick('events')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Events
                   </Link>
                   <Link
                      href="/sponsor-crawl"
                      onClick={() => handleNavClick('sponsor-crawl')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Host a Flow
                    </Link>
                   <Link
                      href="/hosts"
                      onClick={() => handleNavClick('hosts')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Build a Guide
                    </Link>
                    <Link
                      href="/discover"
                      onClick={() => handleNavClick('discover')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Discover
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => handleNavClick('profile')}
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    >
                      Profile
                    </Link>
                    {canSeeAdmin && (
                      <Link
                        href="/venue-admin"
                        onClick={() => handleNavClick('venue-admin')}
                        className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 hover:text-black dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                      >
                        Admin
                      </Link>
                    )}

                    <div className="my-2 border-t border-gray-100 dark:border-zinc-800" />

                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-600 transition hover:bg-gray-50 hover:text-red-500 dark:text-gray-400 dark:hover:bg-zinc-800"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => handleNavClick('login')}
                    className="block px-4 py-2 text-sm text-blue-600 transition hover:bg-gray-50 hover:underline dark:hover:bg-zinc-800"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}