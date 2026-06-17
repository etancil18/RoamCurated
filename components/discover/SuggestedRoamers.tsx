'use client'

import { useEffect, useState } from 'react'
import UserResultCard, { type DiscoverUser } from './UserResultCard'

type DiscoverUsersResponse = {
  users?: DiscoverUser[]
  currentUserId?: string | null
  error?: string
  details?: string
}

export default function SuggestedRoamers() {
  const [users, setUsers] = useState<DiscoverUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSuggestedRoamers() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/discover/users?suggested=true', {
          method: 'GET',
          credentials: 'include',
        })

        const json = (await res.json().catch(() => null)) as
          | DiscoverUsersResponse
          | null

        if (!res.ok) {
          throw new Error(
            json?.details || json?.error || 'Failed to load suggested Roamers'
          )
        }

        if (cancelled) return

        setUsers(json?.users ?? [])
        setCurrentUserId(json?.currentUserId ?? null)
      } catch (err) {
        if (cancelled) return

        setUsers([])
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load suggested Roamers'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSuggestedRoamers()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-400">
          Suggested Roamers
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          People to discover
        </h2>

        <p className="mt-2 text-sm text-neutral-400">
          Find public Roamers based on recent activity, shared interests, and city energy.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {loading && (
          <p className="text-sm text-neutral-500">
            Loading suggested Roamers…
          </p>
        )}

        {!loading && users.length === 0 && !error && (
          <p className="text-sm text-neutral-500">
            No suggested Roamers yet.
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