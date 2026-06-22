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

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported on this device.'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    })

  const handleCheckIn = async () => {
    if (loading || checkedIn || disabled) return

    setLoading(true)
    setMessage(null)

    try {
      const position = await getCurrentPosition()

      const userLat = position.coords.latitude
      const userLon = position.coords.longitude
      const accuracy = position.coords.accuracy

      const res = await fetch(`/api/events/${eventId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_lat: userLat,
          user_lon: userLon,
          location_accuracy_meters: accuracy,
          device_timestamp: new Date().toISOString(),
        }),
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
    } catch (error: any) {
      console.error('Event check-in error:', error)

      if (
        error?.code === 1 ||
        error?.message?.toLowerCase().includes('permission')
      ) {
        setMessage(
          'Location access is required to check into this event.'
        )
      } else if (
        error?.code === 2 ||
        error?.message?.toLowerCase().includes('unavailable')
      ) {
        setMessage(
          'Unable to determine your location. Please try again.'
        )
      } else if (
        error?.code === 3 ||
        error?.message?.toLowerCase().includes('timeout')
      ) {
        setMessage(
          'Location request timed out. Please try again.'
        )
      } else {
        setMessage('Check-in failed')
      }
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
        {loading
          ? 'Checking in…'
          : checkedIn
          ? '✅ Checked In'
          : `✅ Check In +${xpReward ?? 25} XP`}
      </button>

      {message && (
        <p className="text-xs text-neutral-400">
          {message}
        </p>
      )}
    </div>
  )
}