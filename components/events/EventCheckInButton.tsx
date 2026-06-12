'use client'

import { useState } from 'react'

type EventCheckInButtonProps = {
  eventId: string
  xpReward?: number | null
  socialGroupId?: string | null
  disabled?: boolean
  onCheckedIn?: (payload: {
    eventId: string
    xpAwarded: number
    alreadyCheckedIn: boolean
    socialGroupId: string | null
  }) => void
}

export default function EventCheckInButton({
  eventId,
  xpReward = 25,
  socialGroupId = null,
  disabled = false,
  onCheckedIn,
}: EventCheckInButtonProps) {
  const [loading, setLoading] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleCheckIn = async () => {
    if (loading || checkedIn || disabled) return

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/events/${eventId}/check-in`, {
        method: 'POST',
      })

      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        setMessage(payload?.error ?? 'Check-in failed')
        return
      }

      const xpAwarded =
        typeof payload?.xpAwarded === 'number'
          ? payload.xpAwarded
          : 0

      const alreadyCheckedIn = Boolean(payload?.alreadyCheckedIn)

      setCheckedIn(true)

      setMessage(
        alreadyCheckedIn
          ? 'Already checked in'
          : `Checked in +${xpAwarded || xpReward || 25} XP`
      )

      onCheckedIn?.({
        eventId,
        xpAwarded,
        alreadyCheckedIn,
        socialGroupId,
      })
    } catch (error) {
      console.error('Event check-in error:', error)
      setMessage('Check-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={loading || checkedIn || disabled}
        className={`text-sm px-4 py-2 rounded font-medium text-white transition ${
          checkedIn
            ? 'bg-neutral-600 cursor-default'
            : disabled
            ? 'bg-neutral-700 cursor-not-allowed'
            : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        {loading ? 'Checking in…' : checkedIn ? '✅ Checked In' : `✅ Check In +${xpReward ?? 25} XP`}
      </button>

      {message && (
        <p className="text-xs text-neutral-400">
          {message}
        </p>
      )}
    </div>
  )
}