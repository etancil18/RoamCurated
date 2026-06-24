'use client'

import { useEffect, useState } from 'react'
import VenueRatingModal from '@/components/venue-profile/VenueRatingModal'

type VenueVisitButtonProps = {
  venueId: string
  venueName?: string | null
  className?: string
}

type VisitStatusResponse = {
  visited?: boolean
  rating?: number | null
  error?: string
}

type VerifiedLocation = {
  user_lat: number
  user_lon: number
  location_accuracy_meters: number | null
  device_timestamp: string
}

function isValidRating(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  )
}

function renderStars(rating: number | null) {
  if (!rating) return null
  return '★'.repeat(rating)
}

export default function VenueVisitButton({
  venueId,
  venueName = null,
  className = '',
}: VenueVisitButtonProps) {
  const [visited, setVisited] = useState<boolean | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [draftRating, setDraftRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkingLocation, setCheckingLocation] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifiedLocation, setVerifiedLocation] = useState<VerifiedLocation | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadVisitStatus() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/venue-profile/${venueId}/visit`, {
          method: 'GET',
        })

        const json = (await res.json().catch(() => null)) as
          | VisitStatusResponse
          | null

        if (!res.ok) {
          throw new Error(json?.error || 'Failed to load visit status')
        }

        if (cancelled) return

        const nextVisited = Boolean(json?.visited)
        const nextRating = isValidRating(json?.rating) ? json.rating : null

        setVisited(nextVisited)
        setRating(nextRating)
        setDraftRating(nextRating)
      } catch (err) {
        if (cancelled) return

        console.error('[VenueVisitButton] Failed to load visit status:', err)
        setVisited(false)
        setRating(null)
        setDraftRating(null)
        setError(
          err instanceof Error ? err.message : 'Failed to load visit status'
        )
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadVisitStatus()

    return () => {
      cancelled = true
    }
  }, [venueId])

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported on this device.'))
        return
      }

      let settled = false

      const hardTimeout = window.setTimeout(() => {
        if (settled) return

        settled = true

        reject(
          new Error(
            'Location check timed out. Make sure location access is enabled for Roam.'
          )
        )
      }, 12000)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (settled) return

          settled = true
          window.clearTimeout(hardTimeout)

          resolve(position)
        },
        (error) => {
          if (settled) return

          settled = true
          window.clearTimeout(hardTimeout)

          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })

  const openRatingModal = async () => {
    if (saving || checkingLocation) return

    if (visited) {
      setError(null)
      setDraftRating(rating)
      setModalOpen(true)
      return
    }

    setCheckingLocation(true)
    setError(null)

    try {
      const position = await getCurrentPosition()

      const nextLocation: VerifiedLocation = {
        user_lat: position.coords.latitude,
        user_lon: position.coords.longitude,
        location_accuracy_meters:
          typeof position.coords.accuracy === 'number'
            ? position.coords.accuracy
            : null,
        device_timestamp: new Date().toISOString(),
      }

      const params = new URLSearchParams({
        check_proximity: '1',
        user_lat: String(nextLocation.user_lat),
        user_lon: String(nextLocation.user_lon),
        location_accuracy_meters: String(
          nextLocation.location_accuracy_meters ?? ''
        ),
        device_timestamp: nextLocation.device_timestamp,
      })

      const res = await fetch(
        `/api/venue-profile/${venueId}/visit?${params.toString()}`,
        {
          method: 'GET',
        }
      )

      const json = (await res.json().catch(() => null)) as
        | VisitStatusResponse
        | null

      if (!res.ok) {
        throw new Error(json?.error || 'You need to be closer to this venue.')
      }

      setVerifiedLocation(nextLocation)
      setDraftRating(rating)
      setModalOpen(true)
    } catch (err: any) {
      console.error('[VenueVisitButton] Proximity check failed:', err)

      if (
        err?.code === 1 ||
        err?.message?.toLowerCase().includes('permission')
      ) {
        setError('Location access is required to mark this venue as visited.')
      } else if (
        err?.code === 2 ||
        err?.message?.toLowerCase().includes('unavailable')
      ) {
        setError('Unable to determine your location. Please try again.')
      } else if (
        err?.code === 3 ||
        err?.message?.toLowerCase().includes('timeout')
      ) {
        setError('Location request timed out. Please try again.')
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'You need to be closer to this venue.'
        )
      }
    } finally {
      setCheckingLocation(false)
    }
  }

  const saveVisit = async () => {
    if (!isValidRating(draftRating)) {
      setError('Choose a rating from 1 to 5 stars.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (!visited && !verifiedLocation) {
        throw new Error('Location must be verified before rating this venue.')
      }

      const res = await fetch(`/api/venue-profile/${venueId}/visit`, {
        method: visited ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: draftRating,
          ...(visited ? {} : verifiedLocation),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | VisitStatusResponse
        | null

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to save venue visit')
      }

      const nextRating = isValidRating(json?.rating)
        ? json.rating
        : draftRating

      setVisited(true)
      setRating(nextRating)
      setDraftRating(nextRating)
      setModalOpen(false)
      setVerifiedLocation(null)
    } catch (err) {
      console.error('[VenueVisitButton] Failed to save visit:', err)
      setError(err instanceof Error ? err.message : 'Failed to save visit')
    } finally {
      setSaving(false)
    }
  }

  const removeVisit = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/venue-profile/${venueId}/visit`, {
        method: 'DELETE',
      })

      const json = (await res.json().catch(() => null)) as
        | VisitStatusResponse
        | null

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to remove venue visit')
      }

      setVisited(false)
      setRating(null)
      setDraftRating(null)
      setVerifiedLocation(null)
      setModalOpen(false)
    } catch (err) {
      console.error('[VenueVisitButton] Failed to remove visit:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove visit')
    } finally {
      setSaving(false)
    }
  }

  if (loading || visited === null) {
    return (
      <button
        disabled
        className={[
          'inline-flex items-center justify-center rounded-xl bg-zinc-400 px-4 py-2 text-sm font-medium text-white opacity-60',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        Loading…
      </button>
    )
  }

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void openRatingModal()}
          disabled={saving || checkingLocation}
          className={[
            'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
            visited
              ? 'border border-amber-300/60 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50'
              : 'bg-zinc-950 text-white hover:-translate-y-0.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {visited ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-amber-500">{renderStars(rating)}</span>
              <span>Visited</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span>📍</span>
              <span>{checkingLocation ? 'Checking location…' : 'Check In'}</span>
            </span>
          )}
        </button>

        {error ? (
          <p className="max-w-xs text-xs text-red-500">{error}</p>
        ) : null}
      </div>

      <VenueRatingModal
        open={modalOpen}
        venueName={venueName}
        rating={draftRating}
        saving={saving}
        onRatingChange={setDraftRating}
        onSave={saveVisit}
        onClose={() => {
          if (!saving) {
            setDraftRating(rating)
            setVerifiedLocation(null)
            setModalOpen(false)
          }
        }}
        onRemove={visited ? removeVisit : undefined}
      />
    </>
  )
}