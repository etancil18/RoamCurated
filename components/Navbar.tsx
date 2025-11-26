'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import type { Database } from '@/types/supabase'
import { useState } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const user = useUser()
  const [loading, setLoading] = useState(false)

  const navLinks = [
    { href: '/', label: 'Map' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/events', label: 'Events' },
  ]

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const linkClass = (path: string) =>
    `underline transition-opacity ${
      pathname === path ? 'font-bold' : 'opacity-70 hover:opacity-100'
    }`

  return (
    <nav className="w-full flex justify-between items-center p-4 bg-blue-600 text-white">
      <div className="space-x-4">
        {navLinks.map(({ href, label }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {user?.email && (
          <span className="text-sm text-white opacity-80 hidden sm:inline">
            👤 {user.email}
          </span>
        )}
        {user ? (
          <button
            onClick={handleLogout}
            className="underline disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Logging out...' : 'Logout'}
          </button>
        ) : (
          <Link href="/login" className={linkClass('/login')}>
            Login
          </Link>
        )}
      </div>
    </nav>
  )
}
