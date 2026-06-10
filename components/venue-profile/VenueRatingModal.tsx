'use client'

import { useEffect } from 'react'

type VenueRatingModalProps = {
  open: boolean
  venueName?: string | null
  rating: number | null
  saving?: boolean
  onRatingChange: (rating: number) => void
  onSave: () => void
  onClose: () => void
  onRemove?: () => void
}

const ratingLabels: Record<number, string> = {
  1: "Wouldn't revisit",
  2: 'Not my spot',
  3: 'Solid',
  4: 'Great spot',
  5: 'Loved it',
}

export default function VenueRatingModal({
  open,
  venueName = null,
  rating,
  saving = false,
  onRatingChange,
  onSave,
  onClose,
  onRemove,
}: VenueRatingModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const selectedLabel = rating ? ratingLabels[rating] : 'Choose a rating'

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-rating-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-white text-zinc-950 shadow-2xl dark:bg-zinc-950 dark:text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-zinc-950 via-indigo-950 to-cyan-950 px-6 py-6 text-white dark:border-zinc-800">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-400/20 blur-2xl" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Venue Memory
            </p>

            <h2
              id="venue-rating-title"
              className="mt-3 text-2xl font-bold tracking-tight"
            >
              Been here?
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/75">
              {venueName
                ? `Rate ${venueName} so Roam can remember what kind of places you love.`
                : 'Rate this spot so Roam can remember what kind of places you love.'}
            </p>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="flex justify-center gap-1.5" aria-label="Venue rating">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = typeof rating === 'number' && star <= rating

              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
                  disabled={saving}
                  aria-label={`${star} star${star === 1 ? '' : 's'}: ${
                    ratingLabels[star]
                  }`}
                  className={`rounded-xl px-1 py-1 text-4xl transition ${
                    active
                      ? 'scale-105 text-amber-400 drop-shadow-sm'
                      : 'text-zinc-300 hover:scale-105 hover:text-amber-300 dark:text-zinc-700'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  ★
                </button>
              )
            })}
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {selectedLabel}
            </p>

            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              1 = wouldn’t revisit • 5 = loved it
            </p>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] text-zinc-500 dark:text-zinc-500">
            <span>Never</span>
            <span>Meh</span>
            <span>Solid</span>
            <span>Great</span>
            <span>Loved</span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!rating || saving}
              className="w-full rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {saving ? 'Saving…' : 'Save Visit'}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Not now
            </button>

            {onRemove ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={saving}
                className="w-full rounded-xl px-4 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                Remove visit
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}