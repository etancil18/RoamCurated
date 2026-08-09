'use client'

import type { SocialGroupDashboardMetrics } from '@/types/social-group-dashboard'

type GroupSummaryMetricsProps = {
  metrics: SocialGroupDashboardMetrics
  loading?: boolean
}

export default function GroupSummaryMetrics({
  metrics,
  loading = false,
}: GroupSummaryMetricsProps) {
  if (loading) {
    return <LoadingState />
  }

  const totalDetectedAttendance =
    metrics.explicitEventCheckins +
    metrics.venueOnlyAttendees

  const totalObservedMovement =
    metrics.beforeVenueVisits +
    metrics.afterVenueVisits

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
            Group Performance
          </p>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            Social Group Overview
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            Verified event activity, attendance behavior, surrounding movement,
            and Roam-attributed engagement.
          </p>
        </div>

        <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-neutral-400">
          {metrics.totalEvents.toLocaleString()}{' '}
          {metrics.totalEvents === 1 ? 'event' : 'events'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Unique Attendees"
          value={metrics.uniqueAttendees}
          eyebrow="Attendance"
          accent="cyan"
          description="Deduplicated Roam users detected across this group’s events."
        />

        <MetricCard
          label="Explicit Check-ins"
          value={metrics.explicitEventCheckins}
          eyebrow="Verified"
          accent="emerald"
          description="Users who explicitly checked into a Social Group event."
        />

        <MetricCard
          label="Venue-only Attendees"
          value={metrics.venueOnlyAttendees}
          eyebrow="Detected"
          accent="amber"
          description="Users detected at the event venue during the event window without an explicit event check-in."
        />

        <MetricCard
          label="Repeat Attendees"
          value={metrics.repeatAttendees}
          eyebrow="Retention"
          accent="violet"
          description="Users detected at more than one event belonging to this Social Group."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <MetricPanel
          title="Attendance Mix"
          description="How Roam detected attendance across the group."
        >
          <MetricRow
            label="Total detected attendance signals"
            value={totalDetectedAttendance}
          />

          <MetricRow
            label="Explicit event check-ins"
            value={metrics.explicitEventCheckins}
            tone="emerald"
          />

          <MetricRow
            label="Venue-only attendees"
            value={metrics.venueOnlyAttendees}
            tone="amber"
          />

          <MetricRow
            label="Check-in + venue visit"
            value={metrics.bothCheckinAndVenueVisit}
            tone="cyan"
          />

          <MetricRow
            label="First-time attendees"
            value={metrics.firstTimeAttendees}
          />
        </MetricPanel>

        <MetricPanel
          title="Observed Movement"
          description="Venue activity surrounding Social Group events."
        >
          <MetricRow
            label="Attendees with a prior stop"
            value={metrics.attendeesWithBeforeMovement}
            tone="cyan"
          />

          <MetricRow
            label="Attendees with a later stop"
            value={metrics.attendeesWithAfterMovement}
            tone="indigo"
          />

          <MetricRow
            label="Attendees with both"
            value={metrics.attendeesWithBeforeAndAfterMovement}
            tone="violet"
          />

          <MetricRow
            label="Before venue visits"
            value={metrics.beforeVenueVisits}
          />

          <MetricRow
            label="After venue visits"
            value={metrics.afterVenueVisits}
          />

          <MetricRow
            label="Total surrounding venue visits"
            value={totalObservedMovement}
          />
        </MetricPanel>

        <MetricPanel
          title="Roam Impact"
          description="Activity Roam can explicitly attribute to the platform."
        >
          <MetricRow
            label="Interested users"
            value={metrics.interestedUsers}
            tone="cyan"
          />

          <MetricRow
            label="Ticket / RSVP clicks"
            value={metrics.ticketClicks}
            tone="amber"
          />

          <MetricRow
            label="Outing planner opens"
            value={metrics.outingPlannerOpens}
            tone="indigo"
          />

          <MetricRow
            label="Flow starts"
            value={metrics.flowStarts}
            tone="violet"
          />

          <MetricRow
            label="Flow completions"
            value={metrics.flowCompletions}
            tone="emerald"
          />

          <MetricRow
            label="XP generated"
            value={metrics.totalXpAwarded}
            tone="cyan"
          />
        </MetricPanel>
      </div>

      <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-r from-cyan-500/[0.06] via-white/[0.025] to-indigo-500/[0.06] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Analytics Note
            </p>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
              Surrounding venue visits are observed movement, not automatically
              Roam-attributed movement. Flow metrics are kept separate and should
              only reflect activity that can be explicitly tied to a Roam Flow.
            </p>
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-neutral-500">
            Canonical metrics
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricCard({
  eyebrow,
  label,
  value,
  description,
  accent,
}: {
  eyebrow: string
  label: string
  value: number
  description: string
  accent: Accent
}) {
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={`rounded-[1.5rem] border bg-gradient-to-br p-5 shadow-xl ${styles.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${styles.eyebrow}`}>
            {eyebrow}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-white">
            {value.toLocaleString()}
          </p>

          <p className="mt-1 text-sm font-bold text-neutral-200">
            {label}
          </p>
        </div>

        <div
          className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-lg ${styles.dot}`}
          aria-hidden="true"
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-neutral-500">
        {description}
      </p>
    </div>
  )
}

function MetricPanel({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl">
      <div className="border-b border-white/10 pb-4">
        <h3 className="text-base font-black text-white">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          {description}
        </p>
      </div>

      <div className="mt-3 divide-y divide-white/5">
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
  value: number
  tone?: RowTone
}) {
  const valueClass = ROW_TONE_STYLES[tone]

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-sm text-neutral-400">
        {label}
      </p>

      <p className={`shrink-0 text-sm font-black ${valueClass}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <section
      className="space-y-4"
      aria-live="polite"
      aria-label="Loading Social Group metrics"
    >
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-7 w-64 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="h-3 w-full max-w-lg animate-pulse rounded-full bg-white/[0.05]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-72 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>
    </section>
  )
}

type Accent =
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

const ACCENT_STYLES: Record<
  Accent,
  {
    card: string
    eyebrow: string
    dot: string
  }
> = {
  cyan: {
    card:
      'border-cyan-400/20 from-cyan-500/[0.10] via-white/[0.035] to-black',
    eyebrow: 'text-cyan-300',
    dot: 'bg-cyan-300 shadow-cyan-500/40',
  },

  emerald: {
    card:
      'border-emerald-400/20 from-emerald-500/[0.10] via-white/[0.035] to-black',
    eyebrow: 'text-emerald-300',
    dot: 'bg-emerald-300 shadow-emerald-500/40',
  },

  amber: {
    card:
      'border-amber-400/20 from-amber-500/[0.10] via-white/[0.035] to-black',
    eyebrow: 'text-amber-300',
    dot: 'bg-amber-300 shadow-amber-500/40',
  },

  violet: {
    card:
      'border-violet-400/20 from-violet-500/[0.10] via-white/[0.035] to-black',
    eyebrow: 'text-violet-300',
    dot: 'bg-violet-300 shadow-violet-500/40',
  },
}

const ROW_TONE_STYLES: Record<RowTone, string> = {
  neutral: 'text-white',
  cyan: 'text-cyan-300',
  emerald: 'text-emerald-300',
  amber: 'text-amber-300',
  indigo: 'text-indigo-300',
  violet: 'text-violet-300',
}