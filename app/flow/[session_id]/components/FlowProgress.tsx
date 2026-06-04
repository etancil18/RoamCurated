'use client'

type Venue = {
  id: string
  name: string
  city?: string | null
}

type ProgressRow = {
  id: string
  session_id: string
  user_id: string
  venue_id: string
  stop_index: number
  checked_in_at: string
}

type Props = {
  venueIds: string[]
  venues: Venue[]
  progress: ProgressRow[]
}

export default function FlowProgress({
  venueIds,
  venues,
  progress,
}: Props) {
  const checkedVenueIds = new Set(progress.map((row) => row.venue_id))

  const completedStops = checkedVenueIds.size
  const totalStops = venueIds.length
  const progressPercent =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0

  const orderedVenues = venueIds
    .map((venueId) => venues.find((venue) => venue.id === venueId))
    .filter((venue): venue is Venue => Boolean(venue))

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">
            Flow Progress
          </p>

          <p className="mt-1 text-sm text-neutral-400">
            {completedStops} of {totalStops} stops checked in
          </p>
        </div>

        <div className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-semibold text-neutral-300">
          {progressPercent}%
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {orderedVenues.map((venue, index) => {
          const checked = checkedVenueIds.has(venue.id)

          return (
            <div
              key={venue.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                checked
                  ? 'border-green-500/40 bg-green-950/20'
                  : 'border-neutral-800 bg-black/30'
              }`}
            >
              <div>
                <p className="text-sm font-medium">
                  {index + 1}. {venue.name}
                </p>

                {venue.city && (
                  <p className="text-xs text-neutral-500">
                    {venue.city}
                  </p>
                )}
              </div>

              <span
                className={`text-xs font-semibold ${
                  checked ? 'text-green-300' : 'text-neutral-500'
                }`}
              >
                {checked ? '✓ Done' : 'Pending'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}