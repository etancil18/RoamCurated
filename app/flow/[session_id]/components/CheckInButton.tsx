'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Props = {
  sessionId: string
  venueId: string
  stopIndex: number
  checked?: boolean
  disabled?: boolean
  onCheckedIn?: (payload: {
    progress: {
      id: string
      session_id: string
      user_id: string
      venue_id: string
      stop_index: number
      checked_in_at: string
    }
    completedStops: number
    totalStops: number
    flowCompleted: boolean
    xpEarned: number
  }) => void
}

type GeoLocationPayload = {
  user_lat: number
  user_lon: number
  location_accuracy_meters: number | null
  device_timestamp: string
}

function getCurrentLocationForCheckIn(): Promise<GeoLocationPayload> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          user_lat: position.coords.latitude,
          user_lon: position.coords.longitude,
          location_accuracy_meters:
            typeof position.coords.accuracy === 'number'
              ? position.coords.accuracy
              : null,
          device_timestamp: new Date(position.timestamp).toISOString(),
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission is required to check in.'))
          return
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(
            new Error(
              'We could not confirm your location. Try again near the venue entrance.'
            )
          )
          return
        }

        if (error.code === error.TIMEOUT) {
          reject(new Error('Location check timed out. Please try again.'))
          return
        }

        reject(new Error('Could not get your current location.'))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  })
}

export default function CheckInButton({
  sessionId,
  venueId,
  stopIndex,
  checked = false,
  disabled = false,
  onCheckedIn,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleCheckIn = async () => {
    if (checked || disabled || loading) return

    setLoading(true)

    try {
      const location = await getCurrentLocationForCheckIn()

      const res = await fetch('/api/active-flow/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          venue_id: venueId,
          stop_index: stopIndex,
          user_lat: location.user_lat,
          user_lon: location.user_lon,
          location_accuracy_meters: location.location_accuracy_meters,
          device_timestamp: location.device_timestamp,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        alert(json.error ?? 'Could not check in.')
        return
      }

      onCheckedIn?.(json)
      router.refresh()
    } catch (err) {
      console.error('[CheckInButton] Check-in failed:', err)

      alert(
        err instanceof Error
          ? err.message
          : 'Unexpected error checking in.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      disabled={checked || disabled || loading}
      onClick={handleCheckIn}
      className={
        checked
          ? 'bg-green-700 text-white hover:bg-green-700'
          : ''
      }
    >
      {checked
        ? '✓ Checked In'
        : loading
          ? 'Checking in...'
          : 'Check In'}
    </Button>
  )
}