'use client'

import Link from 'next/link'
import FollowButton from '@/components/profile/FollowButton'

export type DiscoverUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio?: string | null
  home_neighborhood?: string | null
  preferred_vibes?: string[] | null
  interest_categories?: string[] | null
  followers_count?: number | null
  is_following?: boolean | null
}

type UserResultCardProps = {
  user: DiscoverUser
  currentUserId?: string | null
}

export default function UserResultCard({
  user,
  currentUserId = null,
}: UserResultCardProps) {
  const isOwnProfile = currentUserId === user.id
  const username = user.username ?? ''
  const profileHref = username ? `/u/${username}` : '#'

  const chips = [
    ...(user.preferred_vibes ?? []),
    ...(user.interest_categories ?? []),
  ].filter(Boolean).slice(0, 5)

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 transition hover:border-cyan-500/40">
      <div className="flex items-start gap-4">
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
            <h3 className="truncate text-base font-semibold text-white group-hover:text-cyan-300">
              {user.full_name ?? user.username ?? 'Roam User'}
            </h3>

            {user.username && (
              <p className="mt-0.5 truncate text-sm text-neutral-500">
                @{user.username}
                {user.home_neighborhood ? ` · ${user.home_neighborhood}` : ''}
              </p>
            )}
          </Link>

          {user.bio && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-neutral-400">
              {user.bio}
            </p>
          )}

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-neutral-800 bg-black px-3 py-1 text-xs text-neutral-300"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
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
              initialFollowersCount={user.followers_count ?? undefined}
            />
          )}
        </div>
      </div>
    </div>
  )
}