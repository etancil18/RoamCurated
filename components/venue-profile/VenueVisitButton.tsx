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
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const openRatingModal = () => {
    setError(null)
    setDraftRating(rating)
    setModalOpen(true)
  }

  const saveVisit = async () => {
    if (!isValidRating(draftRating)) {
      setError('Choose a rating from 1 to 5 stars.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/venue-profile/${venueId}/visit`, {
        method: visited ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: draftRating,
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
          onClick={openRatingModal}
          disabled={saving}
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
              <span>Been Here</span>
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
            setModalOpen(false)
          }
        }}
        onRemove={visited ? removeVisit : undefined}
      />
    </>
  )
}