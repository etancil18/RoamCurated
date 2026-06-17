'use client'

import { useEffect, useMemo, useState } from 'react'
import UserResultCard, { type DiscoverUser } from './UserResultCard'

type DiscoverUsersResponse = {
  users?: DiscoverUser[]
  currentUserId?: string | null
  error?: string
  details?: string
}

export default function UserSearch() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [users, setUsers] = useState<DiscoverUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedQuery = useMemo(() => debouncedQuery.trim(), [debouncedQuery])
  const hasSearch = trimmedQuery.length >= 2

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    let cancelled = false

    async function searchUsers() {
      if (!hasSearch) {
        setUsers([])
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/discover/users?q=${encodeURIComponent(trimmedQuery)}`,
          {
            method: 'GET',
            credentials: 'include',
          }
        )

        const json = (await res.json().catch(() => null)) as
          | DiscoverUsersResponse
          | null

        if (!res.ok) {
          throw new Error(json?.details || json?.error || 'Failed to search users')
        }

        if (cancelled) return

        setUsers(json?.users ?? [])
        setCurrentUserId(json?.currentUserId ?? null)
      } catch (err) {
        if (cancelled) return

        setUsers([])
        setError(err instanceof Error ? err.message : 'Failed to search users')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    searchUsers()

    return () => {
      cancelled = true
    }
  }, [hasSearch, trimmedQuery])

  return (
    <section className="rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
          People Search
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Find Roamers
        </h2>

        <p className="mt-2 text-sm text-neutral-400">
          Search by username or name.
        </p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
          @
        </span>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username or name..."
          className="w-full rounded-2xl border border-neutral-800 bg-black py-3 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-400/10"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading && (
          <p className="text-sm text-neutral-500">
            Searching…
          </p>
        )}

        {!loading && !hasSearch && (
          <p className="text-sm text-neutral-500">
            Type at least 2 characters to search.
          </p>
        )}

        {!loading && hasSearch && users.length === 0 && !error && (
          <p className="text-sm text-neutral-500">
            No Roamers found.
          </p>
        )}

        {!loading &&
          users.map((user) => (
            <UserResultCard
              key={user.id}
              user={user}
              currentUserId={currentUserId}
            />
          ))}
      </div>
    </section>
  )
}