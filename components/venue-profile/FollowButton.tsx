'use client'

import { useEffect, useState } from 'react'

type FollowButtonProps = {
  venueId: string
}

export default function FollowButton({ venueId }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch follow status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/venue-profile/${venueId}/follow`, {
          method: 'GET',
        })

        if (res.ok) {
          const json = await res.json()
          setIsFollowing(json.following)
        } else {
          console.error('Failed to fetch follow status')
        }
      } catch (err) {
        console.error('Error checking follow status', err)
      } finally {
        setLoading(false)
      }
    }

    checkStatus()
  }, [venueId])

  const toggleFollow = async () => {
    setLoading(true)

    try {
      const res = await fetch(`/api/venue-profile/${venueId}/follow`, {
        method: isFollowing ? 'DELETE' : 'POST',
      })

      if (res.ok) {
        setIsFollowing(!isFollowing)
      } else {
        console.error('Follow/unfollow failed')
      }
    } catch (err) {
      console.error('Follow/unfollow error', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || isFollowing === null) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-gray-400 text-white text-sm rounded opacity-50"
      >
        Loading…
      </button>
    )
  }

  return (
    <button
      onClick={toggleFollow}
      className={`px-4 py-2 text-sm rounded transition ${
        isFollowing
          ? 'bg-gray-200 text-black hover:bg-gray-300'
          : 'bg-black text-white hover:bg-gray-900'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
