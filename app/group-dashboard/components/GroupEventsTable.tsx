'use client'

import { useMemo, useState } from 'react'
import type { SocialGroupEventMetric } from '@/types/social-group-dashboard'

type GroupEventsTableProps = {
  events: SocialGroupEventMetric[]
  selectedEventId?: string | null
  onSelectEvent?: (eventId: string) => void
  loading?: boolean
}

type SortKey =
  | 'date'
  | 'attendees'
  | 'checkins'
  | 'repeat'
  | 'movement'
  | 'xp'

type SortDirection = 'asc' | 'desc'

export default function GroupEventsTable({
  events,
  selectedEventId = null,
  onSelectEvent,
  loading = false,
}: GroupEventsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('desc')

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const filteredEvents = useMemo(() => {
    const matchingEvents = normalizedSearch
      ? events.filter((event) => {
          const searchable = [
            event.title ?? '',
            event.eventTimezone ?? '',
          ]
            .join(' ')
            .toLowerCase()

          return searchable.includes(normalizedSearch)
        })
      : events

    return [...matchingEvents].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1

      switch (sortKey) {
        case 'attendees':
          return (
            (a.uniqueAttendees - b.uniqueAttendees) *
            direction
          )

        case 'checkins':
          return (
            (a.explicitEventCheckins -
              b.explicitEventCheckins) *
            direction
          )

        case 'repeat':
          return (
            (a.repeatGroupAttendees -
              b.repeatGroupAttendees) *
            direction
          )

        case 'movement': {
          const aMovement =
            a.beforeVenueVisitCount +
            a.afterVenueVisitCount

          const bMovement =
            b.beforeVenueVisitCount +
            b.afterVenueVisitCount

          return (aMovement - bMovement) * direction
        }

        case 'xp':
          return (a.xpAwarded - b.xpAwarded) * direction

        case 'date':
        default: {
          const aTime = getEventTimestamp(a)
          const bTime = getEventTimestamp(b)

          return (aTime - bTime) * direction
        }
      }
    })
  }, [
    events,
    normalizedSearch,
    sortKey,
    sortDirection,
  ])

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) =>
        current === 'asc' ? 'desc' : 'asc'
      )
      return
    }

    setSortKey(nextKey)
    setSortDirection(
      nextKey === 'date' ? 'desc' : 'desc'
    )
  }

  if (loading) {
    return <LoadingState />
  }

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl">
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Event Performance
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Event-by-Event Analytics
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Compare attendance, repeat participation,
              surrounding venue movement, and XP across this
              Social Group&apos;s events.
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-neutral-400">
            {events.length.toLocaleString()}{' '}
            {events.length === 1 ? 'event' : 'events'}
          </div>
        </div>

        {events.length > 5 && (
          <div className="mt-5">
            <label
              htmlFor="group-event-search"
              className="sr-only"
            >
              Search events
            </label>

            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              >
                <path
                  d="m14.5 14.5 3 3M16 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>

              <input
                id="group-event-search"
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(event.target.value)
                }
                placeholder="Search events..."
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/50 focus:bg-black/50"
              />
            </div>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState />
      ) : filteredEvents.length === 0 ? (
        <NoResultsState
          onClear={() => setSearchQuery('')}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-left">
              <thead className="border-b border-white/10 bg-black/25">
                <tr>
                  <HeaderCell
                    label="Event"
                    sortKey="date"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                  />

                  <HeaderCell
                    label="Attendees"
                    sortKey="attendees"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />

                  <HeaderCell
                    label="Check-ins"
                    sortKey="checkins"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />

                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Venue-only
                  </th>

                  <HeaderCell
                    label="Repeat"
                    sortKey="repeat"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />

                  <HeaderCell
                    label="Movement"
                    sortKey="movement"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />

                  <HeaderCell
                    label="XP"
                    sortKey="xp"
                    activeSortKey={sortKey}
                    direction={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />

                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                    Details
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => {
                  const active =
                    selectedEventId === event.eventId

                  const movementCount =
                    event.beforeVenueVisitCount +
                    event.afterVenueVisitCount

                  return (
                    <tr
                      key={event.eventId}
                      className={`border-b border-white/5 transition last:border-0 ${
                        active
                          ? 'bg-cyan-400/[0.08]'
                          : 'hover:bg-white/[0.035]'
                      }`}
                    >
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-white">
                              {event.title ??
                                'Untitled Event'}
                            </p>

                            {active && (
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                                Selected
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-neutral-500">
                            {formatEventDate(
                              event.eventStart ??
                                event.startsAt,
                              event.eventTimezone
                            )}
                          </p>
                        </div>
                      </td>

                      <NumericCell
                        value={event.uniqueAttendees}
                        tone="white"
                      />

                      <NumericCell
                        value={
                          event.explicitEventCheckins
                        }
                        tone="emerald"
                      />

                      <NumericCell
                        value={
                          event.venueOnlyAttendees
                        }
                        tone="amber"
                      />

                      <NumericCell
                        value={
                          event.repeatGroupAttendees
                        }
                        tone="violet"
                      />

                      <td className="px-4 py-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className="font-black text-cyan-300">
                            {movementCount.toLocaleString()}
                          </span>

                          <span className="mt-0.5 text-[10px] text-neutral-600">
                            {event.beforeVenueVisitCount.toLocaleString()}{' '}
                            before ·{' '}
                            {event.afterVenueVisitCount.toLocaleString()}{' '}
                            after
                          </span>
                        </div>
                      </td>

                      <NumericCell
                        value={event.xpAwarded}
                        tone="cyan"
                      />

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectEvent?.(
                              event.eventId
                            )
                          }
                          className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-black transition ${
                            active
                              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
                              : 'border-white/10 bg-white/[0.05] text-neutral-300 hover:border-cyan-400/30 hover:text-white'
                          }`}
                        >
                          {active
                            ? 'Viewing'
                            : 'View Event'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-3 lg:hidden">
            {filteredEvents.map((event) => (
              <MobileEventCard
                key={event.eventId}
                event={event}
                active={
                  selectedEventId === event.eventId
                }
                onSelect={() =>
                  onSelectEvent?.(event.eventId)
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function MobileEventCard({
  event,
  active,
  onSelect,
}: {
  event: SocialGroupEventMetric
  active: boolean
  onSelect: () => void
}) {
  const movementCount =
    event.beforeVenueVisitCount +
    event.afterVenueVisitCount

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        active
          ? 'border-cyan-400/40 bg-cyan-400/[0.08] shadow-lg shadow-cyan-950/20'
          : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black text-white">
              {event.title ?? 'Untitled Event'}
            </h3>

            {active && (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
                Selected
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-neutral-500">
            {formatEventDate(
              event.eventStart ?? event.startsAt,
              event.eventTimezone
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition ${
            active
              ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
              : 'border-white/10 bg-white/[0.05] text-neutral-300 hover:text-white'
          }`}
        >
          {active ? 'Viewing' : 'View'}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <CompactMetric
          label="Attendees"
          value={event.uniqueAttendees}
          tone="white"
        />

        <CompactMetric
          label="Check-ins"
          value={event.explicitEventCheckins}
          tone="emerald"
        />

        <CompactMetric
          label="Venue-only"
          value={event.venueOnlyAttendees}
          tone="amber"
        />

        <CompactMetric
          label="Repeat"
          value={event.repeatGroupAttendees}
          tone="violet"
        />

        <CompactMetric
          label="Movement"
          value={movementCount}
          tone="cyan"
        />

        <CompactMetric
          label="XP"
          value={event.xpAwarded}
          tone="cyan"
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/25 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-600">
          Surrounding movement
        </p>

        <p className="text-xs font-bold text-neutral-400">
          {event.beforeVenueVisitCount.toLocaleString()}{' '}
          before ·{' '}
          {event.afterVenueVisitCount.toLocaleString()}{' '}
          after
        </p>
      </div>
    </article>
  )
}

function HeaderCell({
  label,
  sortKey,
  activeSortKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeSortKey: SortKey
  direction: SortDirection
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = activeSortKey === sortKey

  return (
    <th
      className={`px-4 py-3 ${
        align === 'right'
          ? 'text-right'
          : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] transition ${
          active
            ? 'text-cyan-300'
            : 'text-neutral-500 hover:text-neutral-300'
        }`}
      >
        {label}

        <span
          aria-hidden="true"
          className={`text-[9px] ${
            active
              ? 'opacity-100'
              : 'opacity-30'
          }`}
        >
          {active && direction === 'asc'
            ? '↑'
            : '↓'}
        </span>
      </button>
    </th>
  )
}

function NumericCell({
  value,
  tone,
}: {
  value: number
  tone: MetricTone
}) {
  return (
    <td
      className={`px-4 py-4 text-right text-sm font-black ${METRIC_TONES[tone]}`}
    >
      {value.toLocaleString()}
    </td>
  )
}

function CompactMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: MetricTone
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/25 p-3">
      <p
        className={`text-lg font-black ${METRIC_TONES[tone]}`}
      >
        {value.toLocaleString()}
      </p>

      <p className="mt-0.5 truncate text-[10px] font-bold text-neutral-600">
        {label}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <section
      className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl"
      aria-live="polite"
      aria-label="Loading event analytics"
    >
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-3 h-7 w-64 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="mt-3 h-3 w-full max-w-xl animate-pulse rounded-full bg-white/[0.05]" />
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl border border-white/10 bg-black/20"
          />
        ))}
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <div className="px-5 py-12 text-center sm:px-6">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
        📅
      </div>

      <h3 className="mt-4 text-base font-black text-white">
        No events yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
        Events associated with this Social Group will
        appear here once they are available.
      </p>
    </div>
  )
}

function NoResultsState({
  onClear,
}: {
  onClear: () => void
}) {
  return (
    <div className="px-5 py-12 text-center sm:px-6">
      <h3 className="text-base font-black text-white">
        No matching events
      </h3>

      <p className="mt-2 text-sm text-neutral-500">
        Try another event name.
      </p>

      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black text-neutral-300 transition hover:border-cyan-400/30 hover:text-white"
      >
        Clear Search
      </button>
    </div>
  )
}

function getEventTimestamp(
  event: SocialGroupEventMetric
): number {
  const value =
    event.eventStart ?? event.startsAt

  if (!value) {
    return 0
  }

  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp)
    ? timestamp
    : 0
}

function formatEventDate(
  value: string | null,
  timezone: string | null
): string {
  if (!value) {
    return 'Date unavailable'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone ?? undefined,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
}

type MetricTone =
  | 'white'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'violet'

const METRIC_TONES: Record<
  MetricTone,
  string
> = {
  white: 'text-white',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  violet: 'text-violet-300',
}