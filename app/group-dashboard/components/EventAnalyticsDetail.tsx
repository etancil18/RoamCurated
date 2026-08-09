'use client'

import { useMemo, useState } from 'react'
import type {
  SocialGroupEventMetricsResponse,
  SocialGroupEventAttendeeActivity,
  SocialGroupMovementVenue,
} from '@/types/social-group-dashboard'

type EventAnalyticsDetailProps = {
  data: SocialGroupEventMetricsResponse | null
  loading?: boolean
  onClose?: () => void
}

export default function EventAnalyticsDetail({
  data,
  loading = false,
  onClose,
}: EventAnalyticsDetailProps) {
  const [showAttendees, setShowAttendees] = useState(false)

  const sortedAttendees = useMemo(() => {
    if (!data) return []

    return [...data.attendees].sort((a, b) => {
      return (
        new Date(a.attendance.attendanceAt).getTime() -
        new Date(b.attendance.attendanceAt).getTime()
      )
    })
  }, [data])

  if (loading) {
    return <LoadingState />
  }

  if (!data) {
    return null
  }

  const {
    group,
    event,
    metrics,
    analyticsWindow,
    analytics,
  } = data

  const totalObservedMovement =
    metrics.observedMovement.totalAdditionalVenueVisits

  const hasMovement =
    metrics.observedMovement.attendeesWithAnyMovement > 0

  const hasRoamAttribution =
    metrics.roamAttributed.flowStarts > 0 ||
    metrics.roamAttributed.flowCompletions > 0 ||
    metrics.roamAttributed.flowVenueStops > 0

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-white/10 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-indigo-500/[0.08] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Event Intelligence
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {event.title ?? 'Untitled Event'}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
              <span>
                {formatDateTime(
                  event.startsAt,
                  analyticsWindow.timezone
                )}
              </span>

              {event.venue?.name && (
                <span>
                  📍 {event.venue.name}
                </span>
              )}

              <span>
                {group.name}
              </span>
            </div>

            {event.description && (
              <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-neutral-400">
                {event.description}
              </p>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close event analytics"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-lg text-neutral-400 transition hover:border-white/20 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <AnalyticsStatusBadge
            succeeded={analytics.refresh.succeeded}
            servedExistingSnapshot={
              analytics.refresh.servedExistingSnapshot
            }
          />

          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-neutral-500">
            Calculation v{analytics.calculationVersion}
          </span>

          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] font-bold text-neutral-500">
            Updated {formatRelativeTimestamp(analytics.calculatedAt)}
          </span>
        </div>
      </div>

      <div className="space-y-7 p-5 sm:p-6">
        {/* ====================================================
            PRIMARY KPIs
        ==================================================== */}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PrimaryMetric
            label="Unique Attendees"
            value={metrics.attendance.uniqueAttendees}
            eyebrow="Attendance"
            tone="cyan"
          />

          <PrimaryMetric
            label="Explicit Check-ins"
            value={metrics.attendance.explicitEventCheckins}
            eyebrow="Verified"
            tone="emerald"
          />

          <PrimaryMetric
            label="Repeat Attendees"
            value={metrics.attendance.repeatGroupAttendees}
            eyebrow="Retention"
            tone="violet"
          />

          <PrimaryMetric
            label="Surrounding Visits"
            value={totalObservedMovement}
            eyebrow="Movement"
            tone="amber"
          />
        </div>

        {/* ====================================================
            ATTENDANCE
        ==================================================== */}

        <DashboardSection
          eyebrow="Attendance"
          title="Who actually showed up?"
          description="Roam combines explicit event check-ins with qualifying visits to the event venue during the event window."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <MetricPanel title="Attendance Detection">
              <MetricRow
                label="Unique attendees"
                value={metrics.attendance.uniqueAttendees}
                tone="cyan"
              />

              <MetricRow
                label="Event check-in only"
                value={metrics.attendance.eventCheckinOnly}
                tone="emerald"
              />

              <MetricRow
                label="Venue visit only"
                value={metrics.attendance.venueVisitOnly}
                tone="amber"
              />

              <MetricRow
                label="Both signals"
                value={metrics.attendance.bothCheckinAndVenueVisit}
              />

              <MetricRow
                label="Explicit check-in rate"
                value={formatPercent(
                  metrics.attendance.explicitCheckinRate
                )}
              />
            </MetricPanel>

            <MetricPanel title="Attendance History">
              <MetricRow
                label="First-time attendees"
                value={metrics.attendance.firstTimeGroupAttendees}
              />

              <MetricRow
                label="Repeat attendees"
                value={metrics.attendance.repeatGroupAttendees}
                tone="violet"
              />

              <MetricRow
                label="Repeat attendance rate"
                value={formatPercent(
                  metrics.attendance.repeatAttendanceRate
                )}
              />
            </MetricPanel>
          </div>
        </DashboardSection>

        {/* ====================================================
            ENGAGEMENT
        ==================================================== */}

        <DashboardSection
          eyebrow="Intent"
          title="What happened before attendance?"
          description="These metrics represent intent signals captured around the event."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SecondaryMetric
              label="Interested"
              value={metrics.engagement.interestedUsers}
            />

            <SecondaryMetric
              label="Ticket / RSVP"
              value={metrics.engagement.ticketClicks}
            />

            <SecondaryMetric
              label="Planner Opens"
              value={metrics.engagement.outingPlannerOpens}
            />

            <SecondaryMetric
              label="Interest → Attendance"
              value={formatPercent(
                metrics.engagement.interestToAttendanceRate
              )}
            />
          </div>
        </DashboardSection>

        {/* ====================================================
            OBSERVED MOVEMENT
        ==================================================== */}

        <DashboardSection
          eyebrow="Observed Movement"
          title="Where did attendees move around the event?"
          description="These visits were observed around the event. They are not automatically attributed to Roam."
        >
          {!hasMovement ? (
            <EmptyMovementState />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SecondaryMetric
                  label="Visited Before"
                  value={
                    metrics.observedMovement
                      .attendeesWithBeforeMovement
                  }
                />

                <SecondaryMetric
                  label="Visited After"
                  value={
                    metrics.observedMovement
                      .attendeesWithAfterMovement
                  }
                />

                <SecondaryMetric
                  label="Before + After"
                  value={
                    metrics.observedMovement
                      .attendeesWithBeforeAndAfterMovement
                  }
                />

                <SecondaryMetric
                  label="Movement Rate"
                  value={formatPercent(
                    metrics.observedMovement
                      .surroundingMovementRate
                  )}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <MetricPanel title="Movement Volume">
                  <MetricRow
                    label="Before venue visits"
                    value={
                      metrics.observedMovement
                        .beforeVenueVisitCount
                    }
                    tone="cyan"
                  />

                  <MetricRow
                    label="After venue visits"
                    value={
                      metrics.observedMovement
                        .afterVenueVisitCount
                    }
                    tone="indigo"
                  />

                  <MetricRow
                    label="Total additional visits"
                    value={
                      metrics.observedMovement
                        .totalAdditionalVenueVisits
                    }
                  />

                  <MetricRow
                    label="Avg. visits / attendee"
                    value={
                      metrics.observedMovement
                        .averageAdditionalVenueVisitsPerAttendee
                    }
                  />
                </MetricPanel>

                <VenueRanking
                  title="Top Before Venues"
                  venues={
                    metrics.observedMovement
                      .topBeforeVenues
                  }
                  emptyLabel="No qualifying before-event venues."
                  tone="cyan"
                />

                <VenueRanking
                  title="Top After Venues"
                  venues={
                    metrics.observedMovement
                      .topAfterVenues
                  }
                  emptyLabel="No qualifying after-event venues."
                  tone="indigo"
                />
              </div>
            </div>
          )}
        </DashboardSection>

        {/* ====================================================
            ROAM ATTRIBUTION
        ==================================================== */}

        <DashboardSection
          eyebrow="Roam Attribution"
          title="What can Roam prove it influenced?"
          description="Only activity explicitly attributable to a Roam Flow belongs in this section."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <SecondaryMetric
              label="Flow Starts"
              value={metrics.roamAttributed.flowStarts}
            />

            <SecondaryMetric
              label="Flow Completions"
              value={metrics.roamAttributed.flowCompletions}
            />

            <SecondaryMetric
              label="Flow Venue Stops"
              value={metrics.roamAttributed.flowVenueStops}
            />
          </div>

          {!hasRoamAttribution && (
            <p className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-xs leading-5 text-neutral-500">
              No explicitly attributable Flow activity is currently recorded
              for this event. Observed before/after venue movement remains
              separate.
            </p>
          )}
        </DashboardSection>

        {/* ====================================================
            XP
        ==================================================== */}

        <DashboardSection
          eyebrow="Passport Impact"
          title="XP generated"
        >
          <div className="rounded-[1.5rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.10] to-black p-5">
            <p className="text-3xl font-black tracking-tight text-cyan-300">
              {metrics.xp.generated.toLocaleString()}
            </p>

            <p className="mt-1 text-sm font-bold text-white">
              XP attributed to this event
            </p>
          </div>
        </DashboardSection>

        {/* ====================================================
            ANALYTICS WINDOW
        ==================================================== */}

        <DashboardSection
          eyebrow="Methodology"
          title="Movement window"
          description="These rules define which surrounding venue visits qualify for event analytics."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <RuleCard
              title="Before"
              value={analyticsWindow.beforeRule}
              range={`${formatDateTime(
                analyticsWindow.beforeWindowStart,
                analyticsWindow.timezone
              )} → event attendance`}
              tone="cyan"
            />

            <RuleCard
              title="After"
              value={analyticsWindow.afterRule}
              range={`event attendance → ${formatDateTime(
                analyticsWindow.afterWindowEnd,
                analyticsWindow.timezone
              )}`}
              tone="indigo"
            />
          </div>

          {analyticsWindow.timezone && (
            <p className="mt-3 text-xs text-neutral-600">
              Local timezone: {analyticsWindow.timezone}
            </p>
          )}
        </DashboardSection>

        {/* ====================================================
            ATTENDEE SIGNALS
        ==================================================== */}

        <div className="border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() =>
              setShowAttendees((current) => !current)
            }
            aria-expanded={showAttendees}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div>
              <p className="text-sm font-black text-white">
                Attendee Signals
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                {data.attendees.length.toLocaleString()}{' '}
                attendee-level analytics records
              </p>
            </div>

            <span
              aria-hidden="true"
              className={`text-neutral-500 transition ${
                showAttendees ? 'rotate-180' : ''
              }`}
            >
              ↓
            </span>
          </button>

          {showAttendees && (
            <AttendeeTable attendees={sortedAttendees} />
          )}
        </div>

        {analytics.refresh.error && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              Analytics Refresh Warning
            </p>

            <p className="mt-2 text-xs leading-5 text-neutral-400">
              {analytics.refresh.error}
            </p>

            {analytics.refresh.servedExistingSnapshot && (
              <p className="mt-2 text-xs text-neutral-500">
                The dashboard is displaying the latest existing analytics
                snapshot.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">
        {eyebrow}
      </p>

      <h3 className="mt-1 text-xl font-black tracking-tight text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-3xl text-xs leading-5 text-neutral-500">
          {description}
        </p>
      )}

      <div className="mt-4">
        {children}
      </div>
    </div>
  )
}

function PrimaryMetric({
  eyebrow,
  label,
  value,
  tone,
}: {
  eyebrow: string
  label: string
  value: number
  tone: Tone
}) {
  return (
    <div
      className={`rounded-[1.5rem] border bg-gradient-to-br p-4 sm:p-5 ${
        PRIMARY_TONES[tone]
      }`}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
        {eyebrow}
      </p>

      <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
        {value.toLocaleString()}
      </p>

      <p className="mt-1 text-xs font-bold text-neutral-300">
        {label}
      </p>
    </div>
  )
}

function SecondaryMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xl font-black text-white">
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </p>

      <p className="mt-1 text-xs text-neutral-500">
        {label}
      </p>
    </div>
  )
}

function MetricPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </p>

      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number | string
  tone?: RowTone
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-neutral-500">
        {label}
      </span>

      <span
        className={`shrink-0 text-sm font-black ${ROW_TONES[tone]}`}
      >
        {typeof value === 'number'
          ? value.toLocaleString()
          : value}
      </span>
    </div>
  )
}

function VenueRanking({
  title,
  venues,
  emptyLabel,
  tone,
}: {
  title: string
  venues: SocialGroupMovementVenue[]
  emptyLabel: string
  tone: 'cyan' | 'indigo'
}) {
  const accent =
    tone === 'cyan'
      ? 'text-cyan-300'
      : 'text-indigo-300'

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">
        {title}
      </p>

      {venues.length === 0 ? (
        <p className="mt-4 text-xs leading-5 text-neutral-600">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {venues.slice(0, 5).map((venue, index) => (
            <div
              key={venue.venueId}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/25 p-3"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-black ${accent}`}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-neutral-200">
                  {venue.venueName ?? 'Unknown Venue'}
                </p>

                {venue.city && (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                    {venue.city}
                  </p>
                )}
              </div>

              <span className={`text-sm font-black ${accent}`}>
                {venue.attendeeCount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RuleCard({
  title,
  value,
  range,
  tone,
}: {
  title: string
  value: string
  range: string
  tone: 'cyan' | 'indigo'
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p
        className={`text-xs font-black ${
          tone === 'cyan'
            ? 'text-cyan-300'
            : 'text-indigo-300'
        }`}
      >
        {title}
      </p>

      <p className="mt-2 text-sm leading-6 text-neutral-300">
        {value}
      </p>

      <p className="mt-3 text-[10px] leading-5 text-neutral-600">
        {range}
      </p>
    </div>
  )
}

function AttendeeTable({
  attendees,
}: {
  attendees: SocialGroupEventAttendeeActivity[]
}) {
  if (attendees.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
        <p className="text-sm text-neutral-500">
          No attendee activity records.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
      <div className="max-h-[440px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 bg-neutral-950">
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 font-black uppercase tracking-wide text-neutral-600">
                Attendee
              </th>

              <th className="px-4 py-3 font-black uppercase tracking-wide text-neutral-600">
                Source
              </th>

              <th className="px-4 py-3 font-black uppercase tracking-wide text-neutral-600">
                Attendance
              </th>

              <th className="px-4 py-3 text-right font-black uppercase tracking-wide text-neutral-600">
                Before
              </th>

              <th className="px-4 py-3 text-right font-black uppercase tracking-wide text-neutral-600">
                After
              </th>

              <th className="px-4 py-3 text-right font-black uppercase tracking-wide text-neutral-600">
                XP
              </th>
            </tr>
          </thead>

          <tbody>
            {attendees.map((attendee) => (
              <tr
                key={attendee.userId}
                className="border-b border-white/5 last:border-0"
              >
                <td className="px-4 py-3 font-mono text-neutral-400">
                  {formatUserId(attendee.userId)}
                </td>

                <td className="px-4 py-3">
                  <AttendanceSourceBadge
                    source={attendee.attendance.source}
                  />
                </td>

                <td className="px-4 py-3 text-neutral-500">
                  {formatDateTime(
                    attendee.attendance.attendanceAt,
                    null
                  )}
                </td>

                <td className="px-4 py-3 text-right font-black text-cyan-300">
                  {attendee.observedMovement.before.length}
                </td>

                <td className="px-4 py-3 text-right font-black text-indigo-300">
                  {attendee.observedMovement.after.length}
                </td>

                <td className="px-4 py-3 text-right font-black text-white">
                  {attendee.xpGenerated.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/10 bg-black/25 px-4 py-3">
        <p className="text-[10px] leading-5 text-neutral-600">
          User identifiers are truncated in the interface. Movement analytics
          should be used for aggregate operational insight rather than
          individual behavioral profiling.
        </p>
      </div>
    </div>
  )
}

function AttendanceSourceBadge({
  source,
}: {
  source: SocialGroupEventAttendeeActivity['attendance']['source']
}) {
  const styles = {
    event_checkin:
      'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',

    venue_visit:
      'border-amber-400/20 bg-amber-400/10 text-amber-300',

    both:
      'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  }

  const labels = {
    event_checkin: 'Event Check-in',
    venue_visit: 'Venue Visit',
    both: 'Both',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${styles[source]}`}
    >
      {labels[source]}
    </span>
  )
}

function AnalyticsStatusBadge({
  succeeded,
  servedExistingSnapshot,
}: {
  succeeded: boolean
  servedExistingSnapshot: boolean
}) {
  if (succeeded) {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black text-emerald-300">
        Analytics Current
      </span>
    )
  }

  if (servedExistingSnapshot) {
    return (
      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black text-amber-300">
        Existing Snapshot
      </span>
    )
  }

  return (
    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[10px] font-black text-red-300">
      Refresh Failed
    </span>
  )
}

function EmptyMovementState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
      <p className="text-sm font-bold text-neutral-300">
        No surrounding venue movement detected
      </p>

      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-neutral-600">
        Qualifying before and after venue visits will appear here when
        available.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl backdrop-blur-xl"
      aria-live="polite"
      aria-label="Loading event analytics"
    >
      <div className="border-b border-white/10 p-5 sm:p-6">
        <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded-full bg-white/[0.08]" />
        <div className="mt-3 h-3 w-56 animate-pulse rounded-full bg-white/[0.05]" />
      </div>

      <div className="space-y-7 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-[1.5rem] border border-white/10 bg-black/20"
            />
          ))}
        </div>

        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-52 animate-pulse rounded-[1.5rem] border border-white/10 bg-black/20"
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

function formatDateTime(
  value: string | null,
  timezone: string | null
): string {
  if (!value) {
    return 'Unavailable'
  }

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

function formatRelativeTimestamp(value: string): string {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    return value
  }

  const difference = Date.now() - timestamp

  const minutes = Math.floor(difference / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) {
    return 'just now'
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  if (hours < 24) {
    return `${hours}h ago`
  }

  if (days < 7) {
    return `${days}d ago`
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUserId(value: string): string {
  if (value.length <= 12) {
    return value
  }

  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

type Tone =
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'violet'

type RowTone =
  | 'neutral'
  | 'cyan'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'violet'

const PRIMARY_TONES: Record<Tone, string> = {
  cyan:
    'border-cyan-400/20 from-cyan-500/[0.10] to-black',

  emerald:
    'border-emerald-400/20 from-emerald-500/[0.10] to-black',

  amber:
    'border-amber-400/20 from-amber-500/[0.10] to-black',

  violet:
    'border-violet-400/20 from-violet-500/[0.10] to-black',
}

const ROW_TONES: Record<RowTone, string> = {
  neutral: 'text-white',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  indigo: 'text-indigo-300',
  violet: 'text-violet-300',
}