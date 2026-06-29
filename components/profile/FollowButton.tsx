'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logEvent } from '@/lib/logEvent'

type FollowButtonProps = {
  userId: string
  initialIsFollowing?: boolean
  initialFollowersCount?: number
  disabled?: boolean
}

type FollowResponse = {
  isFollowing?: boolean
  followersCount?: number
  error?: string
  details?: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn('logEvent failed:', eventName, error)
  }
}

export default function FollowButton({
  userId,
  initialIsFollowing = false,
  initialFollowersCount,
  disabled = false,
}: FollowButtonProps) {
  const router = useRouter()

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleFollow() {
    if (loading || disabled) return

    const action = isFollowing ? 'unfollow' : 'follow'

    safeLogEvent('profile_follow_button_clicked', {
      profile_user_id: userId,
      action,
      initial_is_following: isFollowing,
      followers_count: followersCount ?? null,
    })

    setLoading(true)
    setError(null)

    const previousIsFollowing = isFollowing
    const previousFollowersCount = followersCount

    setIsFollowing(!previousIsFollowing)

    if (typeof followersCount === 'number') {
      setFollowersCount(
        previousIsFollowing
          ? Math.max(0, followersCount - 1)
          : followersCount + 1
      )
    }

    try {
      const res = await fetch(`/api/users/${userId}/${previousIsFollowing ? 'unfollow' : 'follow'}`, {
        method: 'POST',
        credentials: 'include',
      })

      const json = (await res.json().catch(() => null)) as FollowResponse | null

      if (!res.ok) {
        throw new Error(json?.details || json?.error || 'Failed to update follow')
      }

      if (typeof json?.isFollowing === 'boolean') {
        setIsFollowing(json.isFollowing)
      }

      if (typeof json?.followersCount === 'number') {
        setFollowersCount(json.followersCount)
      }

      safeLogEvent('profile_follow_updated', {
        profile_user_id: userId,
        action,
        is_following: json?.isFollowing ?? !previousIsFollowing,
        followers_count: json?.followersCount ?? null,
      })

      router.refresh()
    } catch (err) {
      setIsFollowing(previousIsFollowing)
      setFollowersCount(previousFollowersCount)

      safeLogEvent('profile_follow_update_failed', {
        profile_user_id: userId,
        action,
        message: err instanceof Error ? err.message : 'Failed to update follow',
      })

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update follow'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggleFollow}
        disabled={loading || disabled}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isFollowing
            ? 'border border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800'
            : 'bg-white text-black hover:bg-neutral-200'
        }`}
      >
        {loading
          ? isFollowing
            ? 'Unfollowing…'
            : 'Following…'
          : isFollowing
            ? 'Following'
            : 'Follow'}
      </button>

      {typeof followersCount === 'number' && (
        <p className="text-xs text-neutral-500">
          {followersCount.toLocaleString()} follower{followersCount === 1 ? '' : 's'}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}