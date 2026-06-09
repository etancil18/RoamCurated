import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
}

type PlannedOutingStopRow = {
  id: string
  venue_id: string | null
  stop_order: number | null
  travel_mode: string | null
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
        anchor_ends_at
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
    .select('id, venue_id, stop_order, travel_mode')
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

  const orderedVenueIds =
    stops
      ?.filter(
        (stop) =>
          typeof stop.venue_id === 'string' && stop.venue_id.trim().length > 0
      )
      .sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0))
      .map((stop) => stop.venue_id as string) ?? []

  const venueIds = Array.from(new Set(orderedVenueIds))

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
  })

  return NextResponse.json({
    success: true,
    session,
  })
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
        source: 'event_flow',
      },
    })
  } catch (error) {
    console.warn('[start-flow] Failed to log event_flow_started:', error)
  }
}