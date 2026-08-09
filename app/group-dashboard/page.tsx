import { redirect } from 'next/navigation'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

import SocialGroupSelector from './components/SocialGroupSelector'
import GroupSummaryMetrics from './components/GroupSummaryMetrics'
import GroupEventsTable from './components/GroupEventsTable'
import EventAnalyticsDetail from './components/EventAnalyticsDetail'

import type {
  SocialGroupDashboardGroup,
  SocialGroupDashboardMetrics,
  SocialGroupEventMetric,
  SocialGroupEventMetricsResponse,
  SocialGroupMovementVenue,
} from '@/types/social-group-dashboard'

const founderAdminEmails = [
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
]

type Props = {
  searchParams?: Promise<{
    groupId?: string
    eventId?: string
  }>
}

type EventRow = {
  id: string
  title: string | null
  description: string | null
  starts_at: string | null
  ends_at: string | null
  venue_id: string | null
  social_group_id: string | null
}

type MetricRow = {
  event_id: string
  social_group_id: string
  venue_id: string | null

  event_start: string | null
  event_end: string | null
  event_timezone: string | null

  before_window_start: string | null
  after_window_end: string | null

  unique_attendees: number
  explicit_event_checkins: number
  venue_only_attendees: number
  both_checkin_and_venue_visit: number

  interested_users: number
  ticket_clicks: number
  outing_planner_opens: number

  before_venue_visitors: number
  after_venue_visitors: number
  both_before_and_after: number

  before_venue_visit_count: number
  after_venue_visit_count: number

  repeat_group_attendees: number
  first_time_group_attendees: number

  flow_starts: number
  flow_completions: number
  flow_venue_stops: number

  xp_generated: number

  calculation_version: number
  calculated_at: string
}

type AttendeeActivityRow = {
  event_id: string
  social_group_id: string
  user_id: string
  event_venue_id: string | null

  attendance_source: 'event_checkin' | 'venue_visit' | 'both'
  attendance_at: string

  event_checkin_at: string | null
  event_venue_visit_at: string | null

  before_venue_1_id: string | null
  before_venue_1_at: string | null

  before_venue_2_id: string | null
  before_venue_2_at: string | null

  after_venue_1_id: string | null
  after_venue_1_at: string | null

  after_venue_2_id: string | null
  after_venue_2_at: string | null

  had_before_movement: boolean
  had_after_movement: boolean
  had_before_and_after_movement: boolean

  is_first_time_group_attendee: boolean
  is_repeat_group_attendee: boolean

  roam_flow_starts: number
  roam_flow_completions: number
  roam_flow_venue_stops: number

  xp_generated: number
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
}

export const dynamic = 'force-dynamic'

export default async function GroupDashboardPage({
  searchParams,
}: Props) {
  const resolvedSearchParams = await searchParams

  const selectedGroupId =
    resolvedSearchParams?.groupId ?? null

  const selectedEventId =
    resolvedSearchParams?.eventId ?? null

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isFounderAdmin = user.email
    ? founderAdminEmails.includes(
        user.email.toLowerCase()
      )
    : false

  // ============================================================
  // LOAD GROUPS AVAILABLE TO THIS DASHBOARD USER
  // ============================================================

  const { data: allGroups } = isFounderAdmin
    ? await supabase
        .from('social_groups')
        .select(
          'id, name, slug, description, logo_url'
        )
        .order('name', { ascending: true })
    : { data: null }

  const { data: memberships } = !isFounderAdmin
    ? await supabase
        .from('social_group_members')
        .select(`
          group_id,
          role,
          social_groups (
            id,
            name,
            slug,
            description,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
    : { data: null }

  const groups: SocialGroupDashboardGroup[] =
    isFounderAdmin
      ? ((allGroups ?? []) as SocialGroupDashboardGroup[])
      : ((memberships ?? [])
          .map(
            (membership: any) =>
              membership.social_groups
          )
          .filter(
            Boolean
          ) as SocialGroupDashboardGroup[])

  if (groups.length === 0) {
    return (
      <main className="min-h-screen bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-center shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
              Organizer Analytics
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Group Dashboard
            </h1>

            <p className="mt-3 text-sm text-neutral-400">
              You do not have access to any group
              dashboards yet.
            </p>
          </section>
        </div>
      </main>
    )
  }

  // ============================================================
  // RESOLVE ACTIVE GROUP
  // ============================================================

  const activeGroup =
    (selectedGroupId
      ? groups.find(
          (group) =>
            group.id === selectedGroupId
        )
      : null) ?? groups[0]

  const groupId = activeGroup.id

  // ============================================================
  // SERVER-ONLY ANALYTICS CLIENT
  //
  // Required because analytics tables have RLS enabled and the
  // canonical refresh function is service-role restricted.
  // ============================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  const analyticsSupabase = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )

  // ============================================================
  // LOAD GROUP EVENTS
  // ============================================================

  const {
    data: eventsRaw,
    error: eventsError,
  } = await analyticsSupabase
    .from('events')
    .select(`
      id,
      title,
      description,
      starts_at,
      ends_at,
      venue_id,
      social_group_id
    `)
    .eq('social_group_id', groupId)
    .order('starts_at', {
      ascending: false,
    })

  if (eventsError) {
    console.error(
      'Group dashboard events lookup error:',
      eventsError
    )
  }

  const events =
    (eventsRaw ?? []) as EventRow[]

  // ============================================================
  // REFRESH CANONICAL ANALYTICS
  //
  // One broken historical event does not prevent the dashboard
  // from rendering existing snapshots for the others.
  // ============================================================

  const refreshResults = await Promise.all(
    events.map(async (event) => {
      const {
        data,
        error,
      } = await analyticsSupabase.rpc(
        'refresh_social_group_event_metrics',
        {
          target_event_id: event.id,
        }
      )

      if (error) {
        console.error(
          `Failed to refresh Social Group event ${event.id}:`,
          error
        )

        return {
          eventId: event.id,
          refreshed: false,
          error: error.message,
          result: null,
        }
      }

      return {
        eventId: event.id,
        refreshed: true,
        error: null,
        result: data,
      }
    })
  )

  const eventIds = events.map(
    (event) => event.id
  )

  // ============================================================
  // LOAD CANONICAL GROUP ANALYTICS
  // ============================================================

  let metricsRows: MetricRow[] = []
  let attendeeRows: AttendeeActivityRow[] = []

  if (eventIds.length > 0) {
    const [
      {
        data: metricsData,
        error: metricsError,
      },
      {
        data: attendeeData,
        error: attendeesError,
      },
    ] = await Promise.all([
      analyticsSupabase
        .from(
          'social_group_event_metrics'
        )
        .select(`
          event_id,
          social_group_id,
          venue_id,
          event_start,
          event_end,
          event_timezone,
          before_window_start,
          after_window_end,
          unique_attendees,
          explicit_event_checkins,
          venue_only_attendees,
          both_checkin_and_venue_visit,
          interested_users,
          ticket_clicks,
          outing_planner_opens,
          before_venue_visitors,
          after_venue_visitors,
          both_before_and_after,
          before_venue_visit_count,
          after_venue_visit_count,
          repeat_group_attendees,
          first_time_group_attendees,
          flow_starts,
          flow_completions,
          flow_venue_stops,
          xp_generated,
          calculation_version,
          calculated_at
        `)
        .eq(
          'social_group_id',
          groupId
        )
        .in(
          'event_id',
          eventIds
        ),

      analyticsSupabase
        .from(
          'social_group_event_attendee_activity'
        )
        .select(`
          event_id,
          social_group_id,
          user_id,
          event_venue_id,
          attendance_source,
          attendance_at,
          event_checkin_at,
          event_venue_visit_at,
          before_venue_1_id,
          before_venue_1_at,
          before_venue_2_id,
          before_venue_2_at,
          after_venue_1_id,
          after_venue_1_at,
          after_venue_2_id,
          after_venue_2_at,
          had_before_movement,
          had_after_movement,
          had_before_and_after_movement,
          is_first_time_group_attendee,
          is_repeat_group_attendee,
          roam_flow_starts,
          roam_flow_completions,
          roam_flow_venue_stops,
          xp_generated
        `)
        .eq(
          'social_group_id',
          groupId
        )
        .in(
          'event_id',
          eventIds
        ),
    ])

    if (metricsError) {
      console.error(
        'Group dashboard canonical metrics lookup error:',
        metricsError
      )
    }

    if (attendeesError) {
      console.error(
        'Group dashboard attendee analytics lookup error:',
        attendeesError
      )
    }

    metricsRows =
      (metricsData ?? []) as MetricRow[]

    attendeeRows =
      (attendeeData ??
        []) as AttendeeActivityRow[]
  }

  const metricsByEventId = new Map(
    metricsRows.map((metric) => [
      metric.event_id,
      metric,
    ])
  )

  // ============================================================
  // GROUP-LEVEL UNIQUE + REPEAT ATTENDANCE
  // ============================================================

  const uniqueAttendeeIds = new Set(
    attendeeRows.map(
      (row) => row.user_id
    )
  )

  const eventsByUser =
    new Map<string, Set<string>>()

  for (const row of attendeeRows) {
    const userEvents =
      eventsByUser.get(row.user_id) ??
      new Set<string>()

    userEvents.add(row.event_id)

    eventsByUser.set(
      row.user_id,
      userEvents
    )
  }

  const repeatAttendees = Array.from(
    eventsByUser.values()
  ).filter(
    (userEvents) =>
      userEvents.size > 1
  ).length

  // ============================================================
  // GROUP SUMMARY
  // ============================================================

  const metrics: SocialGroupDashboardMetrics = {
    groupId,

    totalEvents:
      events.length,

    totalCheckins:
      sumMetric(
        metricsRows,
        'explicit_event_checkins'
      ),

    uniqueAttendees:
      uniqueAttendeeIds.size,

    repeatAttendees,

    totalXpAwarded:
      sumMetric(
        metricsRows,
        'xp_generated'
      ),

    explicitEventCheckins:
      sumMetric(
        metricsRows,
        'explicit_event_checkins'
      ),

    venueOnlyAttendees:
      sumMetric(
        metricsRows,
        'venue_only_attendees'
      ),

    bothCheckinAndVenueVisit:
      sumMetric(
        metricsRows,
        'both_checkin_and_venue_visit'
      ),

    interestedUsers:
      sumMetric(
        metricsRows,
        'interested_users'
      ),

    ticketClicks:
      sumMetric(
        metricsRows,
        'ticket_clicks'
      ),

    outingPlannerOpens:
      sumMetric(
        metricsRows,
        'outing_planner_opens'
      ),

    attendeesWithBeforeMovement:
      sumMetric(
        metricsRows,
        'before_venue_visitors'
      ),

    attendeesWithAfterMovement:
      sumMetric(
        metricsRows,
        'after_venue_visitors'
      ),

    attendeesWithBeforeAndAfterMovement:
      sumMetric(
        metricsRows,
        'both_before_and_after'
      ),

    beforeVenueVisits:
      sumMetric(
        metricsRows,
        'before_venue_visit_count'
      ),

    afterVenueVisits:
      sumMetric(
        metricsRows,
        'after_venue_visit_count'
      ),

    firstTimeAttendees:
      attendeeRows.filter(
        (row) =>
          row.is_first_time_group_attendee
      ).length,

    flowStarts:
      sumMetric(
        metricsRows,
        'flow_starts'
      ),

    flowCompletions:
      sumMetric(
        metricsRows,
        'flow_completions'
      ),

    flowVenueStops:
      sumMetric(
        metricsRows,
        'flow_venue_stops'
      ),
  }

  // ============================================================
  // EVENT TABLE
  // ============================================================

  const eventMetrics: SocialGroupEventMetric[] =
    events.map((event) => {
      const metric =
        metricsByEventId.get(event.id)

      return {
        eventId:
          event.id,

        title:
          event.title,

        startsAt:
          event.starts_at,

        checkins:
          metric?.explicit_event_checkins ??
          0,

        uniqueAttendees:
          metric?.unique_attendees ??
          0,

        xpAwarded:
          metric?.xp_generated ??
          0,

        explicitEventCheckins:
          metric?.explicit_event_checkins ??
          0,

        venueOnlyAttendees:
          metric?.venue_only_attendees ??
          0,

        bothCheckinAndVenueVisit:
          metric?.both_checkin_and_venue_visit ??
          0,

        interestedUsers:
          metric?.interested_users ??
          0,

        ticketClicks:
          metric?.ticket_clicks ??
          0,

        outingPlannerOpens:
          metric?.outing_planner_opens ??
          0,

        beforeVenueVisitors:
          metric?.before_venue_visitors ??
          0,

        afterVenueVisitors:
          metric?.after_venue_visitors ??
          0,

        bothBeforeAndAfter:
          metric?.both_before_and_after ??
          0,

        beforeVenueVisitCount:
          metric?.before_venue_visit_count ??
          0,

        afterVenueVisitCount:
          metric?.after_venue_visit_count ??
          0,

        firstTimeGroupAttendees:
          metric?.first_time_group_attendees ??
          0,

        repeatGroupAttendees:
          metric?.repeat_group_attendees ??
          0,

        flowStarts:
          metric?.flow_starts ??
          0,

        flowCompletions:
          metric?.flow_completions ??
          0,

        flowVenueStops:
          metric?.flow_venue_stops ??
          0,

        venueId:
          metric?.venue_id ??
          event.venue_id,

        eventStart:
          metric?.event_start ??
          event.starts_at,

        eventEnd:
          metric?.event_end ??
          event.ends_at,

        eventTimezone:
          metric?.event_timezone ??
          null,

        beforeWindowStart:
          metric?.before_window_start ??
          null,

        afterWindowEnd:
          metric?.after_window_end ??
          null,

        calculationVersion:
          metric?.calculation_version ??
          null,

        calculatedAt:
          metric?.calculated_at ??
          null,
      }
    })

  // ============================================================
  // RESOLVE SELECTED EVENT
  // ============================================================

  const selectedEvent =
    selectedEventId
      ? events.find(
          (event) =>
            event.id === selectedEventId
        ) ?? null
      : null

  let selectedEventAnalytics:
    | SocialGroupEventMetricsResponse
    | null = null

  if (selectedEvent) {
    selectedEventAnalytics =
      await buildEventAnalytics({
        analyticsSupabase,
        group:
          activeGroup,
        event:
          selectedEvent,
        metric:
          metricsByEventId.get(
            selectedEvent.id
          ) ?? null,
        attendees:
          attendeeRows.filter(
            (row) =>
              row.event_id ===
              selectedEvent.id
          ),
        refreshResult:
          refreshResults.find(
            (result) =>
              result.eventId ===
              selectedEvent.id
          ) ?? null,
      })
  }

  // ============================================================
  // SERVER ACTIONS FOR CLIENT COMPONENT SELECTION
  // ============================================================

  async function selectGroup(
    nextGroupId: string | null
  ) {
    'use server'

    if (!nextGroupId) {
      redirect('/group-dashboard')
    }

    redirect(
      `/group-dashboard?groupId=${encodeURIComponent(
        nextGroupId
      )}`
    )
  }

  async function selectEvent(
    nextEventId: string
  ) {
    'use server'

    redirect(
      `/group-dashboard?groupId=${encodeURIComponent(
        groupId
      )}&eventId=${encodeURIComponent(
        nextEventId
      )}`
    )
  }

  async function closeEvent() {
    'use server'

    redirect(
      `/group-dashboard?groupId=${encodeURIComponent(
        groupId
      )}`
    )
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/[0.07] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        {/* ====================================================
            HERO
        ==================================================== */}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-indigo-950/30 p-6 shadow-2xl sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
            Organizer Analytics
          </p>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Social Group Dashboard
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-400">
                Measure attendance, repeat behavior,
                surrounding venue movement, event
                engagement, and attributable Roam
                activity from one canonical analytics
                system.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                Active Group
              </p>

              <p className="mt-1 text-sm font-black text-white">
                {activeGroup.name}
              </p>
            </div>
          </div>
        </section>

        {/* ====================================================
            GROUP SELECTION
        ==================================================== */}

        <SocialGroupSelector
          groups={groups}
          selectedGroupId={groupId}
          onChange={selectGroup}
          includeAllGroups={false}
        />

        {/* ====================================================
            GROUP OVERVIEW
        ==================================================== */}

        <GroupSummaryMetrics
          metrics={metrics}
        />

        {/* ====================================================
            EVENT TABLE
        ==================================================== */}

        <GroupEventsTable
          events={eventMetrics}
          selectedEventId={
            selectedEvent?.id ?? null
          }
          onSelectEvent={selectEvent}
        />

        {/* ====================================================
            EVENT DRILLDOWN
        ==================================================== */}

        {selectedEventAnalytics && (
          <EventAnalyticsDetail
            data={selectedEventAnalytics}
            onClose={closeEvent}
          />
        )}

        {/* ====================================================
            ANALYTICS HEALTH
        ==================================================== */}

        {refreshResults.some(
          (result) => !result.refreshed
        ) && (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
              Analytics Refresh Notice
            </p>

            <p className="mt-2 text-sm leading-6 text-neutral-400">
              One or more event refreshes failed. Existing
              analytics snapshots are being used where
              available.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}

// ============================================================
// EVENT DETAIL BUILDER
// ============================================================

async function buildEventAnalytics({
  analyticsSupabase,
  group,
  event,
  metric,
  attendees,
  refreshResult,
}: {
  analyticsSupabase: SupabaseClient<any>
  group: SocialGroupDashboardGroup
  event: EventRow
  metric: MetricRow | null
  attendees: AttendeeActivityRow[]
  refreshResult: {
    eventId: string
    refreshed: boolean
    error: string | null
    result: unknown
  } | null
}): Promise<SocialGroupEventMetricsResponse | null> {
  if (!metric) {
    return null
  }

  const venueIds = new Set<string>()

  if (event.venue_id) {
    venueIds.add(event.venue_id)
  }

  for (const attendee of attendees) {
    if (attendee.before_venue_1_id) {
      venueIds.add(
        attendee.before_venue_1_id
      )
    }

    if (attendee.before_venue_2_id) {
      venueIds.add(
        attendee.before_venue_2_id
      )
    }

    if (attendee.after_venue_1_id) {
      venueIds.add(
        attendee.after_venue_1_id
      )
    }

    if (attendee.after_venue_2_id) {
      venueIds.add(
        attendee.after_venue_2_id
      )
    }
  }

  let venues: VenueRow[] = []

  if (venueIds.size > 0) {
    const {
      data,
      error,
    } = await analyticsSupabase
      .from('venues')
      .select('id, name, city')
      .in(
        'id',
        Array.from(venueIds)
      )

    if (error) {
      console.error(
        'Group dashboard venue enrichment error:',
        error
      )
    }

    venues =
      (data ?? []) as VenueRow[]
  }

  const venueById = new Map(
    venues.map((venue) => [
      venue.id,
      venue,
    ])
  )

  const beforeCounts =
    new Map<string, number>()

  const afterCounts =
    new Map<string, number>()

  for (const attendee of attendees) {
    const beforeIds = [
      attendee.before_venue_1_id,
      attendee.before_venue_2_id,
    ].filter(
      (value): value is string =>
        Boolean(value)
    )

    const afterIds = [
      attendee.after_venue_1_id,
      attendee.after_venue_2_id,
    ].filter(
      (value): value is string =>
        Boolean(value)
    )

    for (const venueId of beforeIds) {
      beforeCounts.set(
        venueId,
        (beforeCounts.get(venueId) ??
          0) + 1
      )
    }

    for (const venueId of afterIds) {
      afterCounts.set(
        venueId,
        (afterCounts.get(venueId) ??
          0) + 1
      )
    }
  }

  const topBeforeVenues =
    buildMovementVenueSummary(
      beforeCounts,
      venueById
    )

  const topAfterVenues =
    buildMovementVenueSummary(
      afterCounts,
      venueById
    )

  const eventCheckinOnly =
    attendees.filter(
      (attendee) =>
        attendee.attendance_source ===
        'event_checkin'
    ).length

  const venueVisitOnly =
    attendees.filter(
      (attendee) =>
        attendee.attendance_source ===
        'venue_visit'
    ).length

  const both =
    attendees.filter(
      (attendee) =>
        attendee.attendance_source ===
        'both'
    ).length

  const attendeesWithAnyMovement =
    attendees.filter(
      (attendee) =>
        attendee.had_before_movement ||
        attendee.had_after_movement
    ).length

  const totalAdditionalVenueVisits =
    metric.before_venue_visit_count +
    metric.after_venue_visit_count

  const averageAdditionalVenueVisitsPerAttendee =
    metric.unique_attendees > 0
      ? Math.round(
          (totalAdditionalVenueVisits /
            metric.unique_attendees) *
            100
        ) / 100
      : 0

  return {
    group,

    event: {
      id:
        event.id,

      title:
        event.title,

      description:
        event.description,

      startsAt:
        event.starts_at,

      endsAt:
        event.ends_at,

      venueId:
        event.venue_id,

      venue:
        event.venue_id
          ? {
              id:
                event.venue_id,

              name:
                venueById.get(
                  event.venue_id
                )?.name ?? null,

              city:
                venueById.get(
                  event.venue_id
                )?.city ?? null,
            }
          : null,
    },

    metrics: {
      attendance: {
        uniqueAttendees:
          metric.unique_attendees,

        explicitEventCheckins:
          metric.explicit_event_checkins,

        eventCheckinOnly,

        venueVisitOnly,

        bothCheckinAndVenueVisit:
          both,

        firstTimeGroupAttendees:
          metric.first_time_group_attendees,

        repeatGroupAttendees:
          metric.repeat_group_attendees,

        explicitCheckinRate:
          safeRate(
            metric.explicit_event_checkins,
            metric.unique_attendees
          ),

        repeatAttendanceRate:
          safeRate(
            metric.repeat_group_attendees,
            metric.unique_attendees
          ),
      },

      engagement: {
        interestedUsers:
          metric.interested_users,

        ticketClicks:
          metric.ticket_clicks,

        outingPlannerOpens:
          metric.outing_planner_opens,

        interestToAttendanceRate:
          safeRate(
            metric.unique_attendees,
            metric.interested_users
          ),
      },

      observedMovement: {
        attendeesWithBeforeMovement:
          metric.before_venue_visitors,

        attendeesWithAfterMovement:
          metric.after_venue_visitors,

        attendeesWithBeforeAndAfterMovement:
          metric.both_before_and_after,

        attendeesWithAnyMovement,

        beforeVenueVisitCount:
          metric.before_venue_visit_count,

        afterVenueVisitCount:
          metric.after_venue_visit_count,

        totalAdditionalVenueVisits,

        averageAdditionalVenueVisitsPerAttendee,

        surroundingMovementRate:
          safeRate(
            attendeesWithAnyMovement,
            metric.unique_attendees
          ),

        topBeforeVenues,

        topAfterVenues,
      },

      roamAttributed: {
        flowStarts:
          metric.flow_starts,

        flowCompletions:
          metric.flow_completions,

        flowVenueStops:
          metric.flow_venue_stops,
      },

      xp: {
        generated:
          metric.xp_generated,
      },
    },

    analyticsWindow: {
      timezone:
        metric.event_timezone,

      eventStart:
        metric.event_start,

      eventEnd:
        metric.event_end,

      beforeWindowStart:
        metric.before_window_start,

      afterWindowEnd:
        metric.after_window_end,

      beforeRule:
        'Same local calendar day as event; maximum two distinct venues before attendance.',

      afterRule:
        'Maximum two distinct venues after attendance; no later than 3:00 AM local time the following day.',
    },

    attendees:
      attendees.map(
        (attendee) => ({
          userId:
            attendee.user_id,

          attendance: {
            source:
              attendee.attendance_source,

            attendanceAt:
              attendee.attendance_at,

            eventCheckinAt:
              attendee.event_checkin_at,

            eventVenueVisitAt:
              attendee.event_venue_visit_at,
          },

          groupAttendance: {
            isFirstTime:
              attendee.is_first_time_group_attendee,

            isRepeat:
              attendee.is_repeat_group_attendee,
          },

          observedMovement: {
            hadBefore:
              attendee.had_before_movement,

            hadAfter:
              attendee.had_after_movement,

            hadBeforeAndAfter:
              attendee.had_before_and_after_movement,

            before: [
              attendee.before_venue_1_id
                ? {
                    venueId:
                      attendee.before_venue_1_id,

                    venueName:
                      venueById.get(
                        attendee.before_venue_1_id
                      )?.name ?? null,

                    visitedAt:
                      attendee.before_venue_1_at,
                  }
                : null,

              attendee.before_venue_2_id
                ? {
                    venueId:
                      attendee.before_venue_2_id,

                    venueName:
                      venueById.get(
                        attendee.before_venue_2_id
                      )?.name ?? null,

                    visitedAt:
                      attendee.before_venue_2_at,
                  }
                : null,
            ].filter(
              (
                value
              ): value is {
                venueId: string
                venueName: string | null
                visitedAt: string | null
              } => value !== null
            ),

            after: [
              attendee.after_venue_1_id
                ? {
                    venueId:
                      attendee.after_venue_1_id,

                    venueName:
                      venueById.get(
                        attendee.after_venue_1_id
                      )?.name ?? null,

                    visitedAt:
                      attendee.after_venue_1_at,
                  }
                : null,

              attendee.after_venue_2_id
                ? {
                    venueId:
                      attendee.after_venue_2_id,

                    venueName:
                      venueById.get(
                        attendee.after_venue_2_id
                      )?.name ?? null,

                    visitedAt:
                      attendee.after_venue_2_at,
                  }
                : null,
            ].filter(
              (
                value
              ): value is {
                venueId: string
                venueName: string | null
                visitedAt: string | null
              } => value !== null
            ),
          },

          roamAttributed: {
            flowStarts:
              attendee.roam_flow_starts,

            flowCompletions:
              attendee.roam_flow_completions,

            flowVenueStops:
              attendee.roam_flow_venue_stops,
          },

          xpGenerated:
            attendee.xp_generated,
        })
      ),

    analytics: {
      calculationVersion:
        metric.calculation_version,

      calculatedAt:
        metric.calculated_at,

      refresh: {
        succeeded:
          refreshResult?.refreshed ??
          false,

        error:
          refreshResult?.error ??
          null,

        result:
          refreshResult?.result ??
          null,

        servedExistingSnapshot:
          Boolean(
            refreshResult &&
              !refreshResult.refreshed
          ),
      },
    },
  }
}

// ============================================================
// HELPERS
// ============================================================

function sumMetric(
  metrics: MetricRow[],
  key:
    | 'explicit_event_checkins'
    | 'venue_only_attendees'
    | 'both_checkin_and_venue_visit'
    | 'interested_users'
    | 'ticket_clicks'
    | 'outing_planner_opens'
    | 'before_venue_visitors'
    | 'after_venue_visitors'
    | 'both_before_and_after'
    | 'before_venue_visit_count'
    | 'after_venue_visit_count'
    | 'flow_starts'
    | 'flow_completions'
    | 'flow_venue_stops'
    | 'xp_generated'
): number {
  return metrics.reduce(
    (sum, metric) =>
      sum +
      Number(
        metric[key] ?? 0
      ),
    0
  )
}

function safeRate(
  numerator: number,
  denominator: number
): number | null {
  if (denominator <= 0) {
    return null
  }

  return (
    Math.round(
      (numerator / denominator) *
        1000
    ) / 10
  )
}

function buildMovementVenueSummary(
  counts: Map<string, number>,
  venueById: Map<string, VenueRow>
): SocialGroupMovementVenue[] {
  return Array.from(
    counts.entries()
  )
    .map(
      ([venueId, attendeeCount]) => {
        const venue =
          venueById.get(venueId)

        return {
          venueId,

          venueName:
            venue?.name ?? null,

          city:
            venue?.city ?? null,

          attendeeCount,
        }
      }
    )
    .sort((a, b) => {
      if (
        b.attendeeCount !==
        a.attendeeCount
      ) {
        return (
          b.attendeeCount -
          a.attendeeCount
        )
      }

      return (
        a.venueName ?? ''
      ).localeCompare(
        b.venueName ?? ''
      )
    })
}