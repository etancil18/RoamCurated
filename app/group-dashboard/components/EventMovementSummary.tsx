'use client'

import type {
  SocialGroupEventObservedMovementMetrics,
  SocialGroupMovementVenue,
} from '@/types/social-group-dashboard'

type EventMovementSummaryProps = {
  movement: SocialGroupEventObservedMovementMetrics
  loading?: boolean

  /**
   * Optional event timezone for methodology context.
   * Example:
   * America/New_York
   */
  timezone?: string | null

  /**
   * Optional analytics window values.
   * These are presentation-only and should already be
   * calculated by the backend.
   */
  beforeWindowStart?: string | null
  afterWindowEnd?: string | null

  /**
   * Controls whether the explanatory methodology footer appears.
   */
  showMethodology?: boolean
}

export default function EventMovementSummary({
  movement,
  loading = false,
  timezone = null,
  beforeWindowStart = null,
  afterWindowEnd = null,
  showMethodology = true,
}: EventMovementSummaryProps) {
  if (loading) {
    return <LoadingState />
  }

  const hasMovement =
    movement.attendeesWithAnyMovement > 0 ||
    movement.totalAdditionalVenueVisits > 0

  if (!hasMovement) {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
        <SectionHeader />

        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/20 px-5 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
            ↔
          </div>

          <h3 className="mt-4 text-base font-black text-white">
            No surrounding movement detected
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
            Qualifying venue visits before or after this event will appear here
            once Roam detects them.
          </p>
        </div>

        {showMethodology && (
          <MethodologyNote
            timezone={timezone}
            beforeWindowStart={beforeWindowStart}
            afterWindowEnd={afterWindowEnd}
          />
        )}
      </section>
    )
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
      <SectionHeader />

      {/* ========================================================
          PRIMARY MOVEMENT KPIs
      ======================================================== */}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MovementMetric
          label="Moved Before"
          value={movement.attendeesWithBeforeMovement}
          tone="cyan"
        />

        <MovementMetric
          label="Moved After"
          value={movement.attendeesWithAfterMovement}
          tone="indigo"
        />

        <MovementMetric
          label="Before + After"
          value={movement.attendeesWithBeforeAndAfterMovement}
          tone="violet"
        />

        <MovementMetric
          label="Movement Rate"
          value={formatPercent(movement.surroundingMovementRate)}
          tone="emerald"
        />
      </div>

      {/* ========================================================
          MOVEMENT VOLUME
      ======================================================== */}

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
            Movement Volume
          </p>

          <div className="mt-3 divide-y divide-white/5">
            <MetricRow
              label="Attendees with any movement"
              value={movement.attendeesWithAnyMovement}
              tone="white"
            />

            <MetricRow
              label="Before venue visits"
              value={movement.beforeVenueVisitCount}
              tone="cyan"
            />

            <MetricRow
              label="After venue visits"
              value={movement.afterVenueVisitCount}
              tone="indigo"
            />

            <MetricRow
              label="Total additional venue visits"
              value={movement.totalAdditionalVenueVisits}
              tone="violet"
            />

            <MetricRow
              label="Average visits per attendee"
              value={formatDecimal(
                movement.averageAdditionalVenueVisitsPerAttendee
              )}
              tone="emerald"
            />
          </div>
        </div>

        <MovementFlowCard movement={movement} />
      </div>

      {/* ========================================================
          VENUE RANKINGS
      ======================================================== */}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <VenueRanking
          eyebrow="Before"
          title="Top Pre-Event Venues"
          venues={movement.topBeforeVenues}
          emptyLabel="No qualifying pre-event venues."
          tone="cyan"
        />

        <VenueRanking
          eyebrow="After"
          title="Top Post-Event Venues"
          venues={movement.topAfterVenues}
          emptyLabel="No qualifying post-event venues."
          tone="indigo"
        />
      </div>

      {/* ========================================================
          OBSERVED VS ATTRIBUTED CLARIFICATION
      ======================================================== */}

      <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-xs font-black text-amber-300"
          >
            i
          </div>

          <div>
            <p className="text-xs font-black text-amber-200">
              Observed movement
            </p>

            <p className="mt-1 text-xs leading-5 text-neutral-500">
              These venue visits occurred around the event, but they are not
              automatically considered movement caused by Roam. Explicitly
              attributable Flow activity should remain reported separately.
            </p>
          </div>
        </div>
      </div>

      {showMethodology && (
        <MethodologyNote
          timezone={timezone}
          beforeWindowStart={beforeWindowStart}
          afterWindowEnd={afterWindowEnd}
        />
      )}
    </section>
  )
}

function SectionHeader() {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
        Movement Intelligence
      </p>

      <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
        Surrounding Venue Activity
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
        See how attendees moved through the city immediately before and after
        the event.
      </p>
    </div>
  )
}

function MovementMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: MovementTone
}) {
  const style = MOVEMENT_TONES[tone]

  return (
    <div
      className={`rounded-[1.4rem] border bg-gradient-to-br p-4 ${style.card}`}
    >
      <div
        className={`mb-3 h-2 w-2 rounded-full shadow-lg ${style.dot}`}
        aria-hidden="true"
      />

      <p className="text-2xl font-black tracking-tight text-white">
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </p>

      <p className="mt-1 text-xs font-bold text-neutral-400">
        {label}
      </p>
    </div>
  )
}

function MovementFlowCard({
  movement,
}: {
  movement: SocialGroupEventObservedMovementMetrics
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.06] via-black/30 to-indigo-500/[0.06] p-4 sm:p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600">
        Event Movement Pattern
      </p>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
        <FlowPoint
          label="Before"
          value={movement.beforeVenueVisitCount}
          tone="cyan"
        />

        <FlowArrow />

        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] shadow-xl">
            <span className="text-lg">★</span>
          </div>

          <p className="mt-2 text-center text-[10px] font-black uppercase tracking-wider text-neutral-400">
            Event
          </p>
        </div>

        <FlowArrow />

        <FlowPoint
          label="After"
          value={movement.afterVenueVisitCount}
          tone="indigo"
        />
      </div>

      <div className="mt-5 rounded-xl border border-white/5 bg-black/25 p-3 text-center">
        <p className="text-xl font-black text-white">
          {movement.totalAdditionalVenueVisits.toLocaleString()}
        </p>

        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          observed surrounding venue visits
        </p>
      </div>
    </div>
  )
}

function FlowPoint({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'cyan' | 'indigo'
}) {
  const classes =
    tone === 'cyan'
      ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300'
      : 'border-indigo-400/20 bg-indigo-400/10 text-indigo-300'

  return (
    <div className="flex min-w-0 flex-col items-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-black ${classes}`}
      >
        {value.toLocaleString()}
      </div>

      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-neutral-500">
        {label}
      </p>
    </div>
  )
}

function FlowArrow() {
  return (
    <div
      aria-hidden="true"
      className="text-center text-sm font-black text-neutral-700"
    >
      →
    </div>
  )
}

function MetricRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: RowTone
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-xs text-neutral-500">
        {label}
      </p>

      <p
        className={`shrink-0 text-sm font-black ${ROW_TONES[tone]}`}
      >
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </p>
    </div>
  )
}

function VenueRanking({
  eyebrow,
  title,
  venues,
  emptyLabel,
  tone,
}: {
  eyebrow: string
  title: string
  venues: SocialGroupMovementVenue[]
  emptyLabel: string
  tone: 'cyan' | 'indigo'
}) {
  const accent =
    tone === 'cyan'
      ? {
          eyebrow: 'text-cyan-300',
          number:
            'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
          count: 'text-cyan-300',
        }
      : {
          eyebrow: 'text-indigo-300',
          number:
            'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
          count: 'text-indigo-300',
        }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <p
        className={`text-[10px] font-black uppercase tracking-[0.2em] ${accent.eyebrow}`}
      >
        {eyebrow}
      </p>

      <h3 className="mt-1 text-sm font-black text-white">
        {title}
      </h3>

      {venues.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
          <p className="text-xs text-neutral-600">
            {emptyLabel}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {venues.slice(0, 5).map((venue, index) => (
            <VenueRankingRow
              key={venue.venueId}
              venue={venue}
              rank={index + 1}
              rankClass={accent.number}
              countClass={accent.count}
            />
          ))}
        </div>
      )}

      {venues.length > 5 && (
        <p className="mt-3 text-[10px] text-neutral-600">
          Showing top 5 of {venues.length.toLocaleString()} venues.
        </p>
      )}
    </div>
  )
}

function VenueRankingRow({
  venue,
  rank,
  rankClass,
  countClass,
}: {
  venue: SocialGroupMovementVenue
  rank: number
  rankClass: string
  countClass: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 p-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${rankClass}`}
      >
        {rank}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-neutral-200">
          {venue.venueName ?? 'Unknown Venue'}
        </p>

        {venue.city && (
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-neutral-600">
            {venue.city}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className={`text-sm font-black ${countClass}`}>
          {venue.attendeeCount.toLocaleString()}
        </p>

        <p className="mt-0.5 text-[9px] text-neutral-600">
          {venue.attendeeCount === 1
            ? 'attendee'
            : 'attendees'}
        </p>
      </div>
    </div>
  )
}

function MethodologyNote({
  timezone,
  beforeWindowStart,
  afterWindowEnd,
}: {
  timezone: string | null
  beforeWindowStart: string | null
  afterWindowEnd: string | null
}) {
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-600">
        Movement Rules
      </p>

      <div className="mt-2 grid gap-2 text-xs leading-5 text-neutral-500 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <span className="font-bold text-cyan-300">
            Before:
          </span>{' '}
          maximum two distinct venue visits before attendance, restricted to
          the same local calendar day as the event.

          {beforeWindowStart && (
            <p className="mt-1 text-[10px] text-neutral-600">
              Window begins:{' '}
              {formatDateTime(beforeWindowStart, timezone)}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-white/5 bg-black/20 p-3">
          <span className="font-bold text-indigo-300">
            After:
          </span>{' '}
          maximum two distinct venue visits after attendance, ending no later
          than 3:00 AM on the following local day.

          {afterWindowEnd && (
            <p className="mt-1 text-[10px] text-neutral-600">
              Window ends:{' '}
              {formatDateTime(afterWindowEnd, timezone)}
            </p>
          )}
        </div>
      </div>

      {timezone && (
        <p className="mt-2 text-[10px] text-neutral-700">
          Timezone: {timezone}
        </p>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <section
      className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6"
      aria-live="polite"
      aria-label="Loading event movement analytics"
    >
      <div className="h-3 w-36 animate-pulse rounded-full bg-white/[0.06]" />
      <div className="mt-3 h-7 w-72 max-w-full animate-pulse rounded-full bg-white/[0.08]" />
      <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded-full bg-white/[0.05]" />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-[1.4rem] border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-56 animate-pulse rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="h-72 animate-pulse rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>
    </section>
  )
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—'
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })}%`
}

function formatDecimal(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(
  value: string,
  timezone: string | null
): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone ?? undefined,
    }).format(date)
  } catch {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
}

type MovementTone =
  | 'cyan'
  | 'indigo'
  | 'violet'
  | 'emerald'

type RowTone =
  | 'white'
  | 'cyan'
  | 'indigo'
  | 'violet'
  | 'emerald'

const MOVEMENT_TONES: Record<
  MovementTone,
  {
    card: string
    dot: string
  }
> = {
  cyan: {
    card:
      'border-cyan-400/20 from-cyan-500/[0.10] to-black',
    dot:
      'bg-cyan-300 shadow-cyan-500/40',
  },

  indigo: {
    card:
      'border-indigo-400/20 from-indigo-500/[0.10] to-black',
    dot:
      'bg-indigo-300 shadow-indigo-500/40',
  },

  violet: {
    card:
      'border-violet-400/20 from-violet-500/[0.10] to-black',
    dot:
      'bg-violet-300 shadow-violet-500/40',
  },

  emerald: {
    card:
      'border-emerald-400/20 from-emerald-500/[0.10] to-black',
    dot:
      'bg-emerald-300 shadow-emerald-500/40',
  },
}

const ROW_TONES: Record<RowTone, string> = {
  white: 'text-white',
  cyan: 'text-cyan-300',
  indigo: 'text-indigo-300',
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
}