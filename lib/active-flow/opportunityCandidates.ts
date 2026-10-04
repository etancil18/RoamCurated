import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  evaluateActiveFlowCommunitySignalBoundary,
} from '@/lib/active-flow/communitySignalBoundary'

import {
  evaluateActiveFlowContextualFit,
  type ActiveFlowContextualFitResult,
} from '@/lib/active-flow/contextualFit'

import {
  createActiveFlowSemanticRouteStop,
  createActiveFlowVenueSemantics,
  type ActiveFlowDeclaredIntent,
  type ActiveFlowEventSemantics,
  type ActiveFlowSemanticRouteStop,
} from '@/lib/active-flow/contextualIntelligence'

import {
  getActiveFlowExecutionPolicy,
  isActiveFlowAdaptiveEligible,
} from '@/lib/active-flow/executionPolicy'

import {
  loadActiveFlowRuntimeRoute,
} from '@/lib/active-flow/runtimeRoute.server'

import {
  normalizeEventArchetypeForPlanner,
} from '@/lib/outings/eventArchetypes'

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
   * 022C.2 — Optional server-hydrated semantic evidence.
   *
   * Optional at the shared type boundary so frozen V1 consumers and
   * historical fixtures remain valid.
   *
   * Production Community Event candidates admitted through this loader
   * populate it after the frozen 350m boundary passes.
   */
  eventSemantics?: ActiveFlowEventSemantics

  /**
   * 022D.3 — Server-evaluated broad contextual fit.
   *
   * Optional at the shared type boundary so frozen V1 consumers and
   * historical fixtures remain valid.
   *
   * Production Community Event candidates admitted through this loader
   * populate it after the frozen 350m boundary and semantic hydration.
   *
   * This result is contextual evidence for opportunity scoring only.
   * It does not authorize feasibility, recommendation, or mutation.
   */
  contextualFit?: ActiveFlowContextualFitResult

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

  /**
   * 022C.2 — Optional additive semantic context.
   *
   * Absence means semantic context was not supplied by the producer.
   * It must never be interpreted as contextual incompatibility.
   */
  semanticContext?: {
    flowIntent: ActiveFlowDeclaredIntent
    remainingStops: ActiveFlowSemanticRouteStop[]
    currentStop: ActiveFlowSemanticRouteStop | null
  }

  candidates: ActiveFlowOpportunityCandidate[]
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string
  status: string
  title: string | null
  theme_id: string | null
  source: string | null
  source_id: string | null
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
  description: string | null
  archetype: string | null
  tags: string[] | null
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
  type: string[] | null
  vibe: string[] | null
  tags: string[] | null
  time_category: string[] | null
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
 * - make intervention-specific Detour / Swap contextual decisions
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
      'id, user_id, status, title, theme_id, source, source_id, travel_mode'
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
   *
   * 022C.2 additionally hydrates semantic venue fields in this same
   * server-owned read. Runtime-stop identity and canonical execution
   * ordering remain wholly unchanged.
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
      'id, name, lat, lon, type, vibe, tags, time_category'
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

  /**
   * 022C.2 — Additive semantic hydration.
   *
   * Semantic route context is derived from the exact same canonical
   * remaining runtime stops above. It does not reconstruct route
   * authority and does not alter the frozen runtime-stop public shape.
   */
  const flowIntent:
    ActiveFlowDeclaredIntent = {
      title:
        session.title?.trim() ||
        null,

      themeId:
        session.theme_id,

      source:
        session.source,

      sourceId:
        session.source_id,

      travelMode:
        normalizeTravelMode(
          session.travel_mode
        ),
    }

  const semanticRemainingStops:
    ActiveFlowSemanticRouteStop[] =
    remainingStops.map(
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

        return createActiveFlowSemanticRouteStop({
          flowStopId:
            stop.id,

          executionIndex:
            stop.executionIndex,

          kind:
            stop.kind,

          venue:
            createActiveFlowVenueSemantics({
              venueId:
                venue.id,

              name:
                venue.name,

              types:
                venue.type,

              vibes:
                venue.vibe,

              tags:
                venue.tags,

              timeCategories:
                venue.time_category,
            }),
        })
      }
    )

  const semanticContext = {
    flowIntent,

    remainingStops:
      semanticRemainingStops,

    currentStop:
      semanticRemainingStops[0] ??
      null,
  }

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

      semanticContext,

      candidates: [],
    }
  }

  const {
    data: eventData,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, venue_id, title, description, archetype, tags, starts_at, ends_at, timezone, is_active, source, source_type'
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
        'id, name, lat, lon, type, vibe, tags, time_category'
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

    /**
     * 021C — Hard Active Flow Community Signal geographic boundary.
     *
     * A trusted Community Signal may influence this Active Flow only
     * when its venue is within 350 meters of at least one canonical
     * remaining executable runtime stop.
     *
     * This is candidate eligibility, not opportunity scoring.
     *
     * Missing geometry fails closed inside the pure 021B boundary.
     * User GPS, travel mode, base position, and legacy session venue
     * arrays are deliberately irrelevant.
     */
    const boundary =
      evaluateActiveFlowCommunitySignalBoundary({
        signalVenue: {
          lat:
            venue.lat,

          lon:
            venue.lon,
        },

        remainingStops,
      })

    if (
      !boundary.eligible
    ) {
      continue
    }

    /**
     * 022C.2 — Semantic hydration occurs only after the frozen
     * 350m candidate-admission boundary.
     *
     * This evidence is advisory input for the contextual layer.
     * It does not change eligibility, scoring, feasibility,
     * recommendation, or mutation authority here.
     */
    const candidateVenueSemantics =
      createActiveFlowVenueSemantics({
        venueId:
          venue.id,

        name:
          venue.name,

        types:
          venue.type,

        vibes:
          venue.vibe,

        tags:
          venue.tags,

        timeCategories:
          venue.time_category,
      })

    const eventSemantics:
      ActiveFlowEventSemantics = {
        eventId:
          event.id,

        title,

        description:
          event.description?.trim() ||
          null,

        /**
         * Missing archetype evidence must remain missing.
         *
         * normalizeEventArchetypeForPlanner() may normalize unknown
         * non-null values into the planner's "other" bucket, but a null
         * database value is not semantic evidence and must not be
         * manufactured into one.
         */
        archetype:
          event.archetype
            ? normalizeEventArchetypeForPlanner(
                event.archetype
              )
            : null,

        tags:
          Array.from(
            new Set(
              (event.tags ?? [])
                .map(
                  (tag) =>
                    tag
                      .trim()
                      .toLowerCase()
                )
                .filter(Boolean)
            )
          ).sort(),

        startsAt:
          event.starts_at,

        endsAt:
          event.ends_at,

        venue:
          candidateVenueSemantics,
      }

    /**
     * 022D.3 — Broad deterministic contextual fit.
     *
     * Ordering is intentional:
     *
     * trusted/discoverable event
     * → temporal candidate eligibility
     * → 350m Active Flow boundary
     * → semantic hydration
     * → contextual fit
     * → later 013C opportunity scoring
     *
     * An incompatible result does not remove the candidate here.
     * The scorer retains it as a non-actionable diagnostic result with
     * contextual_mismatch.
     *
     * compatible and insufficient_context both continue downstream.
     */
    const contextualFit =
      evaluateActiveFlowContextualFit({
        event:
          eventSemantics,

        remainingStops:
          semanticContext.remainingStops,
      })

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

      eventSemantics,

      contextualFit,

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

    semanticContext,

    candidates,
  }
}