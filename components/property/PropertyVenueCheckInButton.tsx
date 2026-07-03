'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { logEvent } from '@/lib/logEvent'

type Props = {
  venueId: string
  venueName?: string | null
  city?: string | null
  propertyId?: string | null
  propertySlug?: string | null
  propertyName?: string | null

  visited?: boolean
  disabled?: boolean
  className?: string

  label?: string
  visitedLabel?: string
  loadingLabel?: string

  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']

  onCheckedIn?: (payload: {
    venueId: string
    visited: boolean
    xpEarned?: number | null
    distanceMeters?: number | null
  }) => void
}

type GeoPayload = {
  user_lat: number
  user_lon: number
  location_accuracy_meters: number | null
  device_timestamp: string
}

function safeLogEvent(eventName: string, metadata: Record<string, unknown> = {}) {
  try {
    void Promise.resolve(logEvent(eventName, { metadata }))
  } catch (error) {
    console.warn('[PropertyVenueCheckInButton] logEvent failed:', error)
  }
}

function getCurrentLocation(): Promise<GeoPayload> {
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

export default function PropertyVenueCheckInButton({
  venueId,
  venueName = null,
  city = null,
  propertyId = null,
  propertySlug = null,
  propertyName = null,

  visited = false,
  disabled = false,
  className,

  label = 'Check In',
  visitedLabel = '✓ Visited',
  loadingLabel = 'Checking location...',

  variant = 'outline',
  size = 'sm',

  onCheckedIn,
}: Props) {
  const router = useRouter()

  const [checkingIn, setCheckingIn] = useState(false)
  const [locallyVisited, setLocallyVisited] = useState(visited)

  const isVisited = locallyVisited || visited

  async function handleCheckIn() {
    if (!venueId || checkingIn || disabled || isVisited) return

    setCheckingIn(true)

    const analytics = {
      venue_id: venueId,
      venue_name: venueName,
      city,
      property_id: propertyId,
      property_slug: propertySlug,
      property_name: propertyName,
      source: 'property_guide',
    }

    safeLogEvent('property_venue_check_in_clicked', analytics)

    try {
      const location = await getCurrentLocation()

      const response = await fetch(`/api/venue-profile/${venueId}/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...location,
          source: 'property_guide',
          property_id: propertyId,
          property_slug: propertySlug,
          property_name: propertyName,
          city,
        }),
      })

      const json = await response.json().catch(() => null)

      if (!response.ok) {
        safeLogEvent('property_venue_check_in_failed', {
          ...analytics,
          status: response.status,
          error: json?.error ?? null,
        })

        alert(json?.error ?? 'Could not check in.')
        return
      }

      setLocallyVisited(true)

      safeLogEvent('property_venue_check_in_completed', {
        ...analytics,
        xp_earned: json?.xpEarned ?? null,
        distance_meters: json?.distanceMeters ?? null,
        geo_verified: json?.geoVerified ?? null,
      })

      onCheckedIn?.({
        venueId,
        visited: true,
        xpEarned: json?.xpEarned ?? null,
        distanceMeters: json?.distanceMeters ?? null,
      })

      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unexpected error checking in.'

      safeLogEvent('property_venue_check_in_error', {
        ...analytics,
        error: message,
      })

      console.error('[PropertyVenueCheckInButton] Check-in failed:', error)
      alert(message)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <Button
      type="button"
      variant={isVisited ? 'secondary' : variant}
      size={size}
      className={className}
      disabled={disabled || checkingIn || isVisited}
      onClick={handleCheckIn}
    >
      {checkingIn ? loadingLabel : isVisited ? visitedLabel : label}
    </Button>
  )
}