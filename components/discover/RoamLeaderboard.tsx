'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import FollowButton from '@/components/profile/FollowButton'

type LeaderboardUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  home_neighborhood: string | null
  preferred_vibes: string[] | null
  interest_categories: string[] | null
  passport_level: number
  followers_count: number
  completed_flows_count: number
  checkins_count: number
  is_following: boolean
  rank: number
}

type LeaderboardResponse = {
  users?: LeaderboardUser[]
  currentUserId?: string | null
  error?: string
  details?: string
}

export default function RoamLeaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadLeaderboard() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch('/api/discover/leaderboard', {
          method: 'GET',
          credentials: 'include',
        })

        const json = (await res.json().catch(() => null)) as
          | LeaderboardResponse
          | null

        if (!res.ok) {
          throw new Error(
            json?.details || json?.error || 'Failed to load leaderboard'
          )
        }

        if (cancelled) return

        setUsers(json?.users ?? [])
        setCurrentUserId(json?.currentUserId ?? null)
      } catch (err) {
        if (cancelled) return

        setUsers([])
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadLeaderboard()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-[2rem] border border-neutral-800 bg-neutral-950 p-5 sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">
          Leaderboard
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Top Roamers
        </h2>

        <p className="mt-2 text-sm text-neutral-400">
          Ranked by Passport level, followers, completed flows, and check-ins.
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
            Loading leaderboard…
          </p>
        )}

        {!loading && users.length === 0 && !error && (
          <p className="text-sm text-neutral-500">
            No leaderboard data yet.
          </p>
        )}

        {!loading &&
          users.map((user) => {
            const isOwnProfile = currentUserId === user.id
            const username = user.username ?? ''
            const profileHref = username ? `/u/${username}` : '#'

            return (
              <div
                key={user.id}
                className="rounded-2xl border border-neutral-800 bg-black p-4 transition hover:border-amber-400/40"
              >
                <div className="flex items-start gap-4">
                  <div className="flex w-8 shrink-0 justify-center pt-3 text-sm font-bold text-amber-300">
                    #{user.rank}
                  </div>

                  <Link
                    href={profileHref}
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-2xl"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>🧭</span>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={profileHref} className="group">
                      <h3 className="truncate text-base font-semibold text-white group-hover:text-amber-300">
                        {user.full_name ?? user.username ?? 'Roam User'}
                      </h3>

                      {user.username && (
                        <p className="mt-0.5 truncate text-sm text-neutral-500">
                          @{user.username}
                          {user.home_neighborhood
                            ? ` · ${user.home_neighborhood}`
                            : ''}
                        </p>
                      )}
                    </Link>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-200">
                        Level {user.passport_level}
                      </span>

                      <span className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-neutral-300">
                        {user.followers_count.toLocaleString()} followers
                      </span>

                      <span className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-neutral-300">
                        {user.completed_flows_count.toLocaleString()} flows
                      </span>

                      <span className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-neutral-300">
                        {user.checkins_count.toLocaleString()} check-ins
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isOwnProfile ? (
                      <Link
                        href="/profile"
                        className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-300 hover:bg-neutral-800"
                      >
                        You
                      </Link>
                    ) : (
                      <FollowButton
                        userId={user.id}
                        initialIsFollowing={Boolean(user.is_following)}
                        initialFollowersCount={user.followers_count}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </section>
  )
}