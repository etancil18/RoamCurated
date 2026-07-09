import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { Json } from '@/types/supabase'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{
    eventId: string
    plannedOutingId: string
  }>
}

type PlannedOutingRow = {
  id: string
  user_id: string | null
  event_id: string | null
  venue_id: string | null
  city: string | null
  mode: 'before' | 'after' | 'full'
  status: string | null
  confidence_score: number | null
  plan_summary: string | null
  anchor_title: string | null
  anchor_starts_at: string | null
  anchor_ends_at: string | null
  metadata: Json | null
}

type PlannedOutingStopRow = {
  id: string
  venue_id: string | null
  stop_order: number | null
  travel_mode: string | null
  metadata: Json | null
}

type ActiveFlowSessionInsert = {
  user_id: string
  title: string
  city: string | null
  source: string
  theme_id: string | null
  travel_mode: 'walking' | 'cycling' | 'driving'
  venue_ids: string[]
  status: 'active'
  started_at: string
}

export async function POST(_request: Request, { params }: Props) {
  const { eventId, plannedOutingId } = await params

  const supabase = await createServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json(
      { error: 'You must be logged in to start this flow.' },
      { status: 401 }
    )
  }

  const { data: outing, error: outingError } = await supabase
    .from('planned_outings')
    .select(
      `
        id,
        user_id,
        event_id,
        venue_id,
        city,
        mode,
        status,
        confidence_score,
        plan_summary,
        anchor_title,
        anchor_starts_at,
        anchor_ends_at,
        metadata
      `
    )
    .eq('id', plannedOutingId)
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .single<PlannedOutingRow>()

  if (outingError || !outing) {
    return NextResponse.json(
      { error: 'Planned outing not found.' },
      { status: 404 }
    )
  }

  const { data: stops, error: stopsError } = await supabase
    .from('planned_outing_stops')
    .select('id, venue_id, stop_order, travel_mode, metadata')
    .eq('planned_outing_id', plannedOutingId)
    .order('stop_order', { ascending: true })
    .returns<PlannedOutingStopRow[]>()

  if (stopsError) {
    console.error('[start-flow] Failed to load planned outing stops:', stopsError)

    return NextResponse.json(
      { error: 'Could not load outing stops.' },
      { status: 500 }
    )
  }

  const venueIds = buildActiveFlowVenueIds({
    mode: outing.mode,
    anchorVenueId: outing.venue_id,
    stops: stops ?? [],
  })

  if (venueIds.length === 0) {
    return NextResponse.json(
      { error: 'This outing does not have any valid stops to start as a flow.' },
      { status: 422 }
    )
  }

  const insertPayload: ActiveFlowSessionInsert = {
    user_id: user.id,
    title: buildFlowTitle({
      anchorTitle: outing.anchor_title,
      planSummary: outing.plan_summary,
    }),
    city: outing.city,
    source: 'event_flow',
    theme_id: null,
    travel_mode: inferTravelMode(outing.mode, stops ?? []),
    venue_ids: venueIds,
    status: 'active',
    started_at: new Date().toISOString(),
  }

  const { data: session, error: sessionError } = await supabase
    .from('active_flow_sessions')
    .insert(insertPayload)
    .select(
      `
        id,
        user_id,
        title,
        city,
        source,
        theme_id,
        travel_mode,
        venue_ids,
        status,
        started_at,
        completed_at,
        created_at
      `
    )
    .single()

  if (sessionError || !session) {
    console.error('[start-flow] Failed to create active flow session:', sessionError)

    return NextResponse.json(
      {
        error: 'Could not start flow.',
        details: sessionError?.message ?? null,
        code: sessionError?.code ?? null,
      },
      { status: 500 }
    )
  }

  await logEventFlowStarted({
    supabase,
    userId: user.id,
    plannedOutingId,
    eventId,
    sessionId: session.id,
    city: outing.city,
    mode: outing.mode,
    stopCount: venueIds.length,
    confidenceScore: outing.confidence_score,
    anchorVenueId: outing.venue_id,
    eventArchetype:
      readPlannerEventArchetype(outing.metadata) ??
      readFirstStopEventArchetype(stops ?? []),
    semanticRoles: readStopSemanticRoles(stops ?? []),
  })

  return NextResponse.json({
    success: true,
    session,
  })
}

function buildActiveFlowVenueIds({
  mode,
  anchorVenueId,
  stops,
}: {
  mode: PlannedOutingRow['mode']
  anchorVenueId: string | null
  stops: PlannedOutingStopRow[]
}): string[] {
  const orderedStops = [...stops].sort(
    (a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0)
  )

  const cleanAnchorVenueId = normalizeVenueId(anchorVenueId)

  const beforeVenueIds = orderedStops
    .filter((stop) => readStopPhase(stop) === 'before')
    .map((stop) => normalizeVenueId(stop.venue_id))
    .filter((venueId): venueId is string => Boolean(venueId))

  const afterVenueIds = orderedStops
    .filter((stop) => readStopPhase(stop) === 'after')
    .map((stop) => normalizeVenueId(stop.venue_id))
    .filter((venueId): venueId is string => Boolean(venueId))

  const fallbackStopVenueIds = orderedStops
    .map((stop) => normalizeVenueId(stop.venue_id))
    .filter((venueId): venueId is string => Boolean(venueId))

  if (!cleanAnchorVenueId) {
    return uniqueVenueIds(fallbackStopVenueIds)
  }

  if (mode === 'before') {
    return uniqueVenueIds([...fallbackStopVenueIds, cleanAnchorVenueId])
  }

  if (mode === 'after') {
    return uniqueVenueIds([cleanAnchorVenueId, ...fallbackStopVenueIds])
  }

  if (beforeVenueIds.length > 0 || afterVenueIds.length > 0) {
    return uniqueVenueIds([
      ...beforeVenueIds,
      cleanAnchorVenueId,
      ...afterVenueIds,
    ])
  }

  return uniqueVenueIds([...fallbackStopVenueIds, cleanAnchorVenueId])
}

function inferTravelMode(
  mode: PlannedOutingRow['mode'],
  stops: PlannedOutingStopRow[]
): 'walking' | 'cycling' | 'driving' {
  const stopModes = stops
    .map((stop) => stop.travel_mode?.toLowerCase())
    .filter(Boolean)

  if (stopModes.some((travelMode) => travelMode === 'cycling')) {
    return 'cycling'
  }

  if (
    stopModes.some(
      (travelMode) =>
        travelMode === 'driving' ||
        travelMode === 'short_ride' ||
        travelMode === 'ride' ||
        travelMode === 'rideshare'
    )
  ) {
    return 'driving'
  }

  if (
    stopModes.some(
      (travelMode) => travelMode === 'walking' || travelMode === 'walk'
    )
  ) {
    return 'walking'
  }

  return mode === 'before' ? 'walking' : 'driving'
}

function buildFlowTitle({
  anchorTitle,
  planSummary,
}: {
  anchorTitle: string | null
  planSummary: string | null
}): string {
  if (anchorTitle && anchorTitle.trim().length > 0) {
    return `${anchorTitle.trim()} Flow`
  }

  if (planSummary && planSummary.trim().length > 0) {
    return planSummary.trim().slice(0, 80)
  }

  return 'Event Flow'
}

async function logEventFlowStarted({
  supabase,
  userId,
  plannedOutingId,
  eventId,
  sessionId,
  city,
  mode,
  stopCount,
  confidenceScore,
  anchorVenueId,
  eventArchetype,
  semanticRoles,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
  plannedOutingId: string
  eventId: string
  sessionId: string
  city: string | null
  mode: 'before' | 'after' | 'full'
  stopCount: number
  confidenceScore: number | null
  anchorVenueId: string | null
  eventArchetype: string | null
  semanticRoles: Array<string | null>
}): Promise<void> {
  try {
    await supabase.from('planned_outing_events').insert({
      planned_outing_id: plannedOutingId,
      user_id: userId,
      event_type: 'event_flow_started',
      metadata: {
        eventId,
        sessionId,
        city,
        mode,
        stopCount,
        confidenceScore,
        anchorVenueId,
        eventArchetype,
        semanticRoles,
        source: 'event_flow',
      },
    })
  } catch (error) {
    console.warn('[start-flow] Failed to log event_flow_started:', error)
  }
}

function readPlannerEventArchetype(metadata: Json | null): string | null {
  const object = jsonObject(metadata)
  const planner = jsonObject(object.planner as Json | null)
  const value = planner.eventArchetype

  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function readFirstStopEventArchetype(stops: PlannedOutingStopRow[]): string | null {
  for (const stop of stops) {
    const value = jsonObject(stop.metadata).eventArchetype
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return null
}

function readStopSemanticRoles(stops: PlannedOutingStopRow[]): Array<string | null> {
  return stops.map((stop) => {
    const value = jsonObject(stop.metadata).semanticRole
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  })
}

function readStopPhase(stop: PlannedOutingStopRow): 'before' | 'after' | null {
  const value = jsonObject(stop.metadata).slotPhase

  if (value === 'before' || value === 'after') {
    return value
  }

  return null
}

function normalizeVenueId(value: string | null): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function uniqueVenueIds(values: string[]): string[] {
  return Array.from(new Set(values))
}

function jsonObject(value: Json | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}