'use client'

import { useMemo, useState } from 'react'
import VenueRatingModal from '@/components/venue-profile/VenueRatingModal'

type Venue = {
  id: string
  name: string
  city?: string | null
  address?: string | null
  lat?: number | null
  lon?: number | null
}

type ProgressRow = {
  venue_id: string
  stop_index: number
  checked_in_at: string
}

type Props = {
  sessionId: string
  venues: Venue[]
  progress: ProgressRow[]
  flowCompleted: boolean
  flowCancelled: boolean
}

type RatedVenueState = Record<string, number | null>

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

export default function FlowVenueRatingPrompt({
  sessionId,
  venues,
  progress,
  flowCompleted,
  flowCancelled,
}: Props) {
  const [openVenueId, setOpenVenueId] = useState<string | null>(null)
  const [draftRating, setDraftRating] = useState<number | null>(null)
  const [ratedVenues, setRatedVenues] = useState<RatedVenueState>({})
  const [savingVenueId, setSavingVenueId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkedVenueIds = useMemo(() => {
    return new Set(progress.map((row) => row.venue_id))
  }, [progress])

  const checkedVenues = useMemo(() => {
    return venues.filter((venue) => checkedVenueIds.has(venue.id))
  }, [venues, checkedVenueIds])

  const openVenue = checkedVenues.find((venue) => venue.id === openVenueId)
  const ratedCount = Object.values(ratedVenues).filter((rating) =>
    isValidRating(rating)
  ).length

  const shouldShow =
    !dismissed &&
    checkedVenues.length > 0 &&
    (flowCompleted || flowCancelled)

  if (!shouldShow) return null

  const openRatingModal = (venue: Venue) => {
    setError(null)
    setOpenVenueId(venue.id)
    setDraftRating(ratedVenues[venue.id] ?? null)
  }

  const closeRatingModal = () => {
    if (savingVenueId) return

    setOpenVenueId(null)
    setDraftRating(null)
  }

  const saveRating = async () => {
    if (!openVenue || !isValidRating(draftRating)) {
      setError('Choose a rating from 1 to 5 stars.')
      return
    }

    setSavingVenueId(openVenue.id)
    setError(null)

    try {
      const res = await fetch(`/api/venue-profile/${openVenue.id}/visit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: draftRating,
          source: 'active_flow',
          session_id: sessionId,
        }),
      })

      const json = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to save venue rating')
      }

      setRatedVenues((prev) => ({
        ...prev,
        [openVenue.id]: draftRating,
      }))

      setOpenVenueId(null)
      setDraftRating(null)
    } catch (err) {
      console.error('[FlowVenueRatingPrompt] Failed to save rating:', err)
      setError(err instanceof Error ? err.message : 'Failed to save rating')
    } finally {
      setSavingVenueId(null)
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
              Rate Your Stops
            </p>

            <h3 className="mt-2 text-lg font-semibold">
              How were the places you visited?
            </h3>

            <p className="mt-1 text-sm text-amber-100/75">
              Help Roam remember your taste so future flows get smarter.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="self-start rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/10"
          >
            Skip
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {checkedVenues.map((venue, index) => {
            const rating = ratedVenues[venue.id] ?? null

            return (
              <button
                key={venue.id}
                type="button"
                onClick={() => openRatingModal(venue)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-black/30 p-3 text-left transition hover:border-amber-500/40 hover:bg-amber-950/20"
              >
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500">
                    Visited Stop {index + 1}
                  </p>

                  <p className="mt-1 truncate text-sm font-medium text-white">
                    {venue.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-neutral-500">
                    {venue.address ?? venue.city ?? 'Checked in'}
                  </p>
                </div>

                <div className="shrink-0 rounded-full border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-200">
                  {rating ? renderStars(rating) : 'Rate'}
                </div>
              </button>
            )
          })}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-neutral-500">
          {ratedCount} of {checkedVenues.length} visited venue
          {checkedVenues.length === 1 ? '' : 's'} rated.
        </p>
      </section>

      <VenueRatingModal
        open={Boolean(openVenue)}
        venueName={openVenue?.name ?? null}
        rating={draftRating}
        saving={Boolean(savingVenueId)}
        onRatingChange={setDraftRating}
        onSave={saveRating}
        onClose={closeRatingModal}
      />
    </>
  )
}