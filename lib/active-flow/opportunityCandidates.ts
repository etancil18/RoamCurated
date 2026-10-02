import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getActiveFlowExecutionPolicy,
  isActiveFlowAdaptiveEligible,
} from '@/lib/active-flow/executionPolicy'

import {
  loadActiveFlowRuntimeRoute,
} from '@/lib/active-flow/runtimeRoute.server'

import { getSupabaseAdmin } from '@/lib/supabase/admin-runtime'

export type ActiveFlowOpportunityConfidenceBand =
  | 'supported'
  | 'strong'

export type ActiveFlowOpportunityTravelMode =
  | 'walking'
  | 'cycling'
  | 'driving'

export type ActiveFlowOpportunityRuntimeStop = {
  id: string
  venueId: string

  /**
   * Immutable base-route slot identity.
   *
   * NULL for inserted runtime stops such as Detours.
   */
  position: number | null

  /**
   * Canonical derived execution order.
   *
   * This value is never persisted into active_flow_progress.stop_index.
   */
  executionIndex: number

  kind:
    | 'base'
    | 'detour'

  beforeFlowStopId: string | null

  status: string
  origin: string
  originalStopId: string | null
  completed: boolean

  venue: {
    id: string
    name: string
    lat: number | null
    lon: number | null
  }
}

export type ActiveFlowOpportunityCandidate = {
  eventId: string
  occurrenceId: string
  confidenceBand: ActiveFlowOpportunityConfidenceBand

  venueId: string
  title: string

  startsAt: string
  endsAt: string | null
  timezone: string | null

  venue: {
    id: string
    name: string
    lat: number | null
    lon: number | null
  }

  /**
   * True when the event venue already exists among the remaining
   * runtime stops.
   *
   * This is deliberately metadata rather than an exclusion.
   * A future scorer may determine that reaching an existing stop
   * earlier is a valuable reroute/reorder opportunity.
   */
  venueAlreadyInRemainingFlow: boolean

  /**
   * Position in the canonical remaining executable route.
   *
   * This is derived execution order, not active_flow_stops.position.
   */
  remainingFlowPosition: number | null
}

export type ActiveFlowOpportunityContext = {
  sessionId: string
  userId: string

  asOf: string

  travelMode: ActiveFlowOpportunityTravelMode

  runtimeStops: ActiveFlowOpportunityRuntimeStop[]
  remainingStops: ActiveFlowOpportunityRuntimeStop[]

  currentStop: ActiveFlowOpportunityRuntimeStop | null

  candidates: ActiveFlowOpportunityCandidate[]
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string
  status: string
  travel_mode: string | null
}

type DiscoverableCommunityEventRow = {
  event_id: string
  occurrence_id: string
  confidence_band: string
}

type EventRow = {
  id: string
  venue_id: string
  title: string | null
  starts_at: string | null
  ends_at: string | null
  timezone: string | null
  is_active: boolean | null
  source: string | null
  source_type: string | null
}

type VenueRow = {
  id: string
  name: string | null
  lat: number | null
  lon: number | null
}

function normalizeTravelMode(
  value: string | null
): ActiveFlowOpportunityTravelMode {
  if (
    value === 'cycling' ||
    value === 'driving'
  ) {
    return value
  }

  return 'walking'
}

function normalizeConfidenceBand(
  value: string
): ActiveFlowOpportunityConfidenceBand | null {
  if (
    value === 'supported' ||
    value === 'strong'
  ) {
    return value
  }

  return null
}

function parseTimestamp(
  value: string | null
): number | null {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)

  return Number.isFinite(timestamp)
    ? timestamp
    : null
}

/**
 * A candidate must still have temporal utility at p_as_of.
 *
 * 012B remains authoritative for Community Signal discovery eligibility.
 * This check is intentionally defensive because time continues moving
 * after that projection is evaluated and before candidates are consumed.
 */
function isTemporallyActionable({
  startsAt,
  endsAt,
  asOfMs,
}: {
  startsAt: string | null
  endsAt: string | null
  asOfMs: number
}): boolean {
  const startsAtMs =
    parseTimestamp(startsAt)

  if (startsAtMs == null) {
    return false
  }

  const endsAtMs =
    parseTimestamp(endsAt)

  if (endsAtMs != null) {
    return endsAtMs > asOfMs
  }

  return startsAtMs > asOfMs
}

/**
 * Build the read-only Live Signal candidate context for one Active Flow.
 *
 * Authority boundaries:
 *
 * - active_flow_sessions owns session state.
 * - executionPolicy.ts owns adaptive eligibility.
 * - runtimeRoute.server.ts + runtimeRoute.ts own canonical runtime
 *   execution ordering and progress identity resolution.
 * - active_flow_stops owns runtime-stop identity/history.
 * - active_flow_detours owns inserted Detour ordering.
 * - active_flow_progress owns execution progress.
 * - get_discoverable_community_event_ids owns Community Signal
 *   discovery eligibility.
 *
 * This function does not:
 *
 * - mutate the Flow
 * - reroute
 * - insert/replace/remove/reorder stops
 * - write progress
 * - create venue visits
 * - create event participation
 * - create event interest
 * - infer attendance
 * - calculate the 013C opportunity score
 */
export async function getActiveFlowOpportunityCandidates({
  sessionId,
  userId,
  asOf = new Date(),
  supabase: providedSupabase,
}: {
  sessionId: string
  userId: string
  asOf?: Date
  supabase?: SupabaseClient
}): Promise<ActiveFlowOpportunityContext> {
  const normalizedSessionId =
    sessionId.trim()

  const normalizedUserId =
    userId.trim()

  if (!normalizedSessionId) {
    throw new Error(
      '[active-flow/opportunity-candidates] sessionId is required.'
    )
  }

  if (!normalizedUserId) {
    throw new Error(
      '[active-flow/opportunity-candidates] userId is required.'
    )
  }

  if (
    Number.isNaN(
      asOf.getTime()
    )
  ) {
    throw new Error(
      '[active-flow/opportunity-candidates] asOf must be a valid date.'
    )
  }

  const asOfIso =
    asOf.toISOString()

  const asOfMs =
    asOf.getTime()

  const supabase =
    providedSupabase ??
    getSupabaseAdmin()

  /**
   * Session ownership and active state are explicit prerequisites.
   */
  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from('active_flow_sessions')
    .select(
      'id, user_id, status, travel_mode'
    )
    .eq(
      'id',
      normalizedSessionId
    )
    .eq(
      'user_id',
      normalizedUserId
    )
    .maybeSingle<ActiveFlowSessionRow>()

  if (sessionError) {
    console.error(
      '[active-flow/opportunity-candidates] Session lookup failed:',
      sessionError
    )

    throw new Error(
      'Could not load Active Flow opportunity context.'
    )
  }

  if (!session) {
    throw new Error(
      'Active Flow session not found.'
    )
  }

  if (session.status !== 'active') {
    throw new Error(
      'Live Signal opportunities require an active Flow.'
    )
  }

  /**
   * The frozen execution-policy boundary decides whether this Flow
   * may participate in adaptive execution.
   *
   * This deliberately does not reconstruct Relay / competition /
   * snapshot rules here.
   */
  const policy =
    await getActiveFlowExecutionPolicy({
      sessionId:
        normalizedSessionId,
      userId:
        normalizedUserId,
      supabase: supabase as any,
    })

  if (
    !isActiveFlowAdaptiveEligible(
      policy
    )
  ) {
    throw new Error(
      'This Active Flow is fixed and is not eligible for Live Signal opportunities.'
    )
  }

  /**
   * 016C — Canonical runtime execution route.
   *
   * Route ordering and completion identity are deliberately delegated
   * to the shared runtime-route boundary rather than reconstructed here.
   *
   * Discovery remains independent and read-only.
   */
  const [
    canonicalRuntimeStops,
    discoveryResult,
  ] = await Promise.all([
    loadActiveFlowRuntimeRoute({
      sessionId:
        normalizedSessionId,

      userId:
        normalizedUserId,

      supabase,
    }),

    supabase.rpc(
      'get_discoverable_community_event_ids',
      {
        p_as_of:
          asOfIso,
      }
    ),
  ])

  if (discoveryResult.error) {
    console.error(
      '[active-flow/opportunity-candidates] Community discovery projection failed:',
      discoveryResult.error
    )

    /**
     * Fail closed. A failure to establish trusted Community Signal
     * eligibility must never turn untrusted events into opportunities.
     */
    throw new Error(
      'Could not determine trusted Live Signal opportunities.'
    )
  }

  if (
    canonicalRuntimeStops.length === 0
  ) {
    throw new Error(
      'Active Flow has no materialized runtime stops.'
    )
  }

  /**
   * 013C scoring requires geometry for the canonical runtime route.
   * Load venue data for every canonical runtime stop once, while
   * preserving runtime-stop identity and execution order as authority.
   */
  const runtimeVenueIds =
    Array.from(
      new Set(
        canonicalRuntimeStops.map(
          (stop) =>
            stop.venueId
        )
      )
    )

  const {
    data: runtimeVenueData,
    error: runtimeVenueError,
  } = await supabase
    .from('venues')
    .select(
      'id, name, lat, lon'
    )
    .in(
      'id',
      runtimeVenueIds
    )
    .returns<VenueRow[]>()

  if (runtimeVenueError) {
    console.error(
      '[active-flow/opportunity-candidates] Runtime venue lookup failed:',
      runtimeVenueError
    )

    throw new Error(
      'Could not load Active Flow runtime venues.'
    )
  }

  const runtimeVenuesById =
    new Map<
      string,
      VenueRow
    >()

  for (
    const venue of
    runtimeVenueData ?? []
  ) {
    runtimeVenuesById.set(
      venue.id,
      venue
    )
  }

  const runtimeStops:
    ActiveFlowOpportunityRuntimeStop[] =
    canonicalRuntimeStops.map(
      (stop) => {
        const venue =
          runtimeVenuesById.get(
            stop.venueId
          )

        if (!venue) {
          throw new Error(
            `Runtime venue ${stop.venueId} was not found.`
          )
        }

        return {
          id:
            stop.id,

          venueId:
            stop.venueId,

          position:
            stop.position,

          executionIndex:
            stop.executionIndex,

          kind:
            stop.kind,

          beforeFlowStopId:
            stop.beforeFlowStopId,

          status:
            stop.status,

          origin:
            stop.origin,

          originalStopId:
            stop.originalStopId,

          completed:
            stop.completed,

          venue: {
            id:
              venue.id,

            name:
              venue.name?.trim() ||
              'Venue',

            lat:
              venue.lat,

            lon:
              venue.lon,
          },
        }
      }
    )

  const remainingStops =
    runtimeStops.filter(
      (stop) =>
        !stop.completed
    )

  /**
   * "Current" means the first incomplete runtime stop.
   *
   * This is canonical execution order, not GPS position and not
   * active_flow_stops.position.
   */
  const currentStop =
    remainingStops[0] ??
    null

  const discoveryRows =
    (discoveryResult.data ??
      []) as DiscoverableCommunityEventRow[]

  const discoverableByEventId =
    new Map<
      string,
      {
        occurrenceId: string
        confidenceBand: ActiveFlowOpportunityConfidenceBand
      }
    >()

  for (
    const row of
    discoveryRows
  ) {
    const confidenceBand =
      normalizeConfidenceBand(
        row.confidence_band
      )

    if (
      !row.event_id ||
      !row.occurrence_id ||
      !confidenceBand
    ) {
      continue
    }

    discoverableByEventId.set(
      row.event_id,
      {
        occurrenceId:
          row.occurrence_id,

        confidenceBand,
      }
    )
  }

  const discoverableEventIds =
    Array.from(
      discoverableByEventId.keys()
    )

  if (
    discoverableEventIds.length ===
    0
  ) {
    return {
      sessionId:
        session.id,

      userId:
        session.user_id,

      asOf:
        asOfIso,

      travelMode:
        normalizeTravelMode(
          session.travel_mode
        ),

      runtimeStops,
      remainingStops,
      currentStop,

      candidates: [],
    }
  }

  const {
    data: eventData,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, venue_id, title, starts_at, ends_at, timezone, is_active, source, source_type'
    )
    .in(
      'id',
      discoverableEventIds
    )
    .eq(
      'is_active',
      true
    )
    .eq(
      'source',
      'community'
    )
    .eq(
      'source_type',
      'community_signal'
    )
    .returns<EventRow[]>()

  if (eventError) {
    console.error(
      '[active-flow/opportunity-candidates] Event lookup failed:',
      eventError
    )

    throw new Error(
      'Could not load Live Signal events.'
    )
  }

  /**
   * Events at already completed runtime venues are not useful as
   * forward-looking v1 intervention candidates.
   */
  const completedVenueIds =
    new Set(
      runtimeStops
        .filter(
          (stop) =>
            stop.completed
        )
        .map(
          (stop) =>
            stop.venueId
        )
    )

  /**
   * 016C — remainingFlowPosition now describes canonical execution
   * order rather than immutable base-route position.
   *
   * This preserves the existing API field while allowing NULL-position
   * inserted stops to participate correctly in the runtime route.
   */
  const remainingPositionByVenueId =
    new Map<string, number>()

  for (
    const stop of
    remainingStops
  ) {
    const existingPosition =
      remainingPositionByVenueId.get(
        stop.venueId
      )

    if (
      existingPosition == null ||
      stop.executionIndex <
        existingPosition
    ) {
      remainingPositionByVenueId.set(
        stop.venueId,
        stop.executionIndex
      )
    }
  }

  const actionableEvents =
    (
      eventData ??
      []
    ).filter(
      (event) =>
        !completedVenueIds.has(
          event.venue_id
        ) &&
        isTemporallyActionable({
          startsAt:
            event.starts_at,

          endsAt:
            event.ends_at,

          asOfMs,
        })
    )

  const candidateVenueIds =
    Array.from(
      new Set(
        actionableEvents.map(
          (event) =>
            event.venue_id
        )
      )
    )

  const venuesById =
    new Map<
      string,
      VenueRow
    >()

  if (
    candidateVenueIds.length >
    0
  ) {
    const {
      data: venueData,
      error: venueError,
    } = await supabase
      .from('venues')
      .select(
        'id, name, lat, lon'
      )
      .in(
        'id',
        candidateVenueIds
      )
      .returns<VenueRow[]>()

    if (venueError) {
      console.error(
        '[active-flow/opportunity-candidates] Candidate venue lookup failed:',
        venueError
      )

      throw new Error(
        'Could not load Live Signal venues.'
      )
    }

    for (
      const venue of
      venueData ?? []
    ) {
      venuesById.set(
        venue.id,
        venue
      )
    }
  }

  const candidates:
    ActiveFlowOpportunityCandidate[] =
    []

  for (
    const event of
    actionableEvents
  ) {
    const discovery =
      discoverableByEventId.get(
        event.id
      )

    const venue =
      venuesById.get(
        event.venue_id
      )

    if (
      !discovery ||
      !venue
    ) {
      continue
    }

    const title =
      event.title?.trim()

    if (
      !title ||
      !event.starts_at
    ) {
      continue
    }

    const remainingFlowPosition =
      remainingPositionByVenueId.get(
        event.venue_id
      ) ?? null

    candidates.push({
      eventId:
        event.id,

      occurrenceId:
        discovery.occurrenceId,

      confidenceBand:
        discovery.confidenceBand,

      venueId:
        event.venue_id,

      title,

      startsAt:
        event.starts_at,

      endsAt:
        event.ends_at,

      timezone:
        event.timezone,

      venue: {
        id:
          venue.id,

        name:
          venue.name?.trim() ||
          'Venue',

        lat:
          venue.lat,

        lon:
          venue.lon,
      },

      venueAlreadyInRemainingFlow:
        remainingFlowPosition != null,

      remainingFlowPosition,
    })
  }

  candidates.sort(
    (
      a,
      b
    ) => {
      const aStart =
        parseTimestamp(
          a.startsAt
        ) ??
        Number.MAX_SAFE_INTEGER

      const bStart =
        parseTimestamp(
          b.startsAt
        ) ??
        Number.MAX_SAFE_INTEGER

      if (
        aStart !==
        bStart
      ) {
        return (
          aStart -
          bStart
        )
      }

      return a.eventId.localeCompare(
        b.eventId
      )
    }
  )

  return {
    sessionId:
      session.id,

    userId:
      session.user_id,

    asOf:
      asOfIso,

    travelMode:
      normalizeTravelMode(
        session.travel_mode
      ),

    runtimeStops,
    remainingStops,
    currentStop,

    candidates,
  }
}