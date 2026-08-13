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
    <div className="relative overflow-hidden rounded-[1.75rem] bg-white/[0.025] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.055] sm:p-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/15 to-transparent" />

        <div className="absolute -right-16 -top-20 h-44 w-44 rounded-full bg-indigo-300/[0.035] blur-[80px]" />
      </div>

      <div className="relative z-10">
        <div className="flex min-w-0 items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-indigo-300/50" />

              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-indigo-300">
                Route progress
              </p>
            </div>

            <p className="mt-2 text-sm font-bold text-zinc-300">
              {completedStops} of {totalStops}{' '}
              {totalStops === 1 ? 'stop' : 'stops'} complete
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xl font-black leading-none tracking-[-0.04em] text-white">
              {progressPercent}
              <span className="ml-0.5 text-sm text-zinc-600">
                %
              </span>
            </p>
          </div>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.055]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-violet-300 shadow-[0_0_14px_rgba(129,140,248,0.24)] transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>

        <div className="mt-5 space-y-2.5">
          {orderedVenues.map((venue, index) => {
            const checked = checkedVenueIds.has(venue.id)

            return (
              <div
                key={venue.id}
                className={[
                  'relative flex min-w-0 items-center justify-between gap-3 rounded-[1.25rem] px-3.5 py-3.5 ring-1 transition',
                  checked
                    ? 'bg-emerald-300/[0.035] ring-emerald-300/10'
                    : 'bg-black/20 ring-white/[0.05]',
                ].join(' ')}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ring-1',
                      checked
                        ? 'bg-emerald-300/[0.08] text-emerald-200 ring-emerald-300/15'
                        : 'bg-white/[0.035] text-zinc-500 ring-white/[0.055]',
                    ].join(' ')}
                  >
                    {checked ? '✓' : index + 1}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={[
                        'truncate text-sm font-black tracking-[-0.015em]',
                        checked
                          ? 'text-zinc-300'
                          : 'text-white',
                      ].join(' ')}
                    >
                      {venue.name}
                    </p>

                    {venue.city ? (
                      <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                        {venue.city}
                      </p>
                    ) : null}
                  </div>
                </div>

                <span
                  className={[
                    'shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em]',
                    checked
                      ? 'bg-emerald-300/[0.07] text-emerald-200 ring-1 ring-emerald-300/12'
                      : 'bg-white/[0.025] text-zinc-700 ring-1 ring-white/[0.045]',
                  ].join(' ')}
                >
                  {checked
                    ? 'Done'
                    : 'Ahead'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}