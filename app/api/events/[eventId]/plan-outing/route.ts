// app/api/events/[eventId]/plan-outing/route.ts

import { NextResponse } from "next/server"
import { supabaseServerApi } from "@/lib/supabase/server-api"
import { generateEventOutingPlan } from "@/lib/outings/generateEventOutingPlan"
import { persistGeneratedOutingPlan } from "@/lib/outings/persistGeneratedOutingPlan"
import type {
  Budget,
  EventRecord,
  Mobility,
  PlanMode,
  PlanOutingRequestBody,
  VenueRecord,
} from "@/lib/outings/types"

const ALLOWED_MODES: PlanMode[] = ["before", "after", "full"]
const ALLOWED_BUDGETS: Budget[] = ["$", "$$", "$$$", "$$$$"]
const ALLOWED_MOBILITY: Mobility[] = ["walk", "short_ride", "any"]

type VenueRecordWithHours = VenueRecord & {
  hours?: Record<string, { open?: string | null; close?: string | null }> | null
}

type EventWithVenueRecord = EventRecord & {
  venue: VenueRecordWithHours | VenueRecordWithHours[] | null
}

export async function POST(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params

    const supabase = await supabaseServerApi()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await safeJson(req)) as PlanOutingRequestBody
    const mode = normalizeMode(body.mode)
    const groupSize = normalizeGroupSize(body.groupSize)
    const budget = normalizeBudget(body.budget)
    const mobility = normalizeMobility(body.mobility)
    const vibeTags = normalizeVibeTags(body.vibeTags)

    // ---------- Fetch Event ----------

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        `
          id,
          title,
          description,
          starts_at,
          ends_at,
          tags,
          venue_id,
          venue:venues (
            id,
            name,
            city,
            lat,
            lon,
            address,
            tags,
            vibe,
            type,
            price,
            hours
          )
        `
      )
      .eq("id", eventId)
      .single<EventWithVenueRecord>()

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const anchorVenue = normalizeVenueRelation(event.venue)
    const city = anchorVenue?.city?.trim()

    if (!city) {
      return NextResponse.json(
        { error: "Event venue city is required to plan an outing" },
        { status: 422 }
      )
    }

    if (anchorVenue && (anchorVenue.lat == null || anchorVenue.lon == null)) {
      return NextResponse.json(
        { error: "Event venue coordinates are required to plan an outing" },
        { status: 422 }
      )
    }

    // ---------- Fetch Candidate Venues ----------

    const { data: venueCandidatesRaw, error: venuesError } = await supabase
      .from("venues")
      .select(
        "id, name, city, lat, lon, address, tags, vibe, type, price, hours"
      )
      .eq("city", city)
      .neq("id", anchorVenue?.id ?? "")
      .limit(150)

    if (venuesError) {
      return NextResponse.json(
        { error: `Failed to fetch nearby venues: ${venuesError.message}` },
        { status: 500 }
      )
    }

    const venueCandidates = (venueCandidatesRaw ?? []) as VenueRecordWithHours[]

    // ---------- Generate Plan ----------

    const generatedPlan = generateEventOutingPlan({
      mode,
      event,
      anchorVenue,
      candidateVenues: venueCandidates,
      groupSize,
      budget,
      mobility,
      vibeTags,
    })

    console.log(
      "generated outing plan",
      JSON.stringify(
        {
          eventId,
          mode,
          city,
          requestedGroupSize: groupSize,
          requestedBudget: budget,
          requestedMobility: mobility,
          requestedVibeTags: vibeTags,
          candidateVenueCount: venueCandidates.length,
          generatedStopCount: generatedPlan.stops.length,
          scoreBreakdown: generatedPlan.scoreBreakdown,
          debug: generatedPlan.debug ?? null,
        },
        null,
        2
      )
    )

    if (generatedPlan.stops.length < minimumStopsForMode(mode)) {
      console.warn(
        "insufficient outing coverage",
        JSON.stringify(
          {
            eventId,
            mode,
            minimumRequiredStops: minimumStopsForMode(mode),
            generatedStopCount: generatedPlan.stops.length,
            candidateVenueCount: venueCandidates.length,
            scoreBreakdown: generatedPlan.scoreBreakdown,
            debug: generatedPlan.debug ?? null,
          },
          null,
          2
        )
      )

      return NextResponse.json(
        {
          error:
            "Insufficient venue coverage to generate a credible outing plan for this event",
          debug: generatedPlan.debug ?? null,
          scoreBreakdown: generatedPlan.scoreBreakdown,
        },
        { status: 422 }
      )
    }

    // ---------- Persist Plan ----------

    const { plannedOuting, insertedStops } = await persistGeneratedOutingPlan({
      supabase,
      userId: user.id,
      event,
      anchorVenue,
      city,
      mode,
      groupSize,
      budget,
      mobility,
      vibeTags,
      generatedPlan,
    })

    // ---------- Log Event ----------

    await supabase.from("planned_outing_events").insert({
      planned_outing_id: plannedOuting.id,
      user_id: user.id,
      event_type: "plan_generated",
      metadata: {
        mode,
        city,
        stopCount: insertedStops.length,
        confidenceScore: generatedPlan.confidenceScore,
        completionRate: generatedPlan.scoreBreakdown.completionRate ?? null,
        candidatePoolSize: generatedPlan.scoreBreakdown.candidatePoolSize,
        preparedCandidateCount:
          generatedPlan.scoreBreakdown.preparedCandidateCount ?? null,
      },
    })

    // ---------- Response ----------

    const insertedStopIdsByOrder = new Map<number, string>(
      insertedStops.map((stop) => [stop.stop_order, stop.id])
    )

    const responseStops = generatedPlan.stops.map((stop) => ({
      id: insertedStopIdsByOrder.get(stop.stopOrder) ?? `${plannedOuting.id}:${stop.stopOrder}`,
      venueId: stop.venueId,
      stopOrder: stop.stopOrder,
      role: stop.role,
      venueType: stop.venueType ?? stop.metadata?.venueType ?? null,
      displayType: stop.displayType ?? stop.metadata?.displayType ?? null,
      title: stop.title,
      rationale: stop.rationale,
      plannedArrivalAt: stop.plannedArrivalAt,
      plannedDepartureAt: stop.plannedDepartureAt,
      dwellMinutes: stop.dwellMinutes,
      travelMode: stop.travelMode,
      travelMinutesFromPrev: stop.travelMinutesFromPrev,
      distanceMetersFromPrev: stop.distanceMetersFromPrev,
    }))

    return NextResponse.json({
      success: true,
      plannedOutingId: plannedOuting.id,
      status: plannedOuting.status,
      mode,
      summary: plannedOuting.plan_summary,
      confidenceScore: plannedOuting.confidence_score,
      anchor: {
        eventId: event.id,
        title: event.title,
        startsAt: event.starts_at,
        endsAt: generatedPlan.estimatedEndAt,
        venue: anchorVenue
          ? {
              id: anchorVenue.id,
              name: anchorVenue.name,
              city: anchorVenue.city,
              address: anchorVenue.address,
            }
          : null,
      },
      stops: responseStops,
      debug: generatedPlan.debug ?? undefined,
      scoreBreakdown: generatedPlan.scoreBreakdown,
    })
  } catch (error) {
    console.error("plan-outing POST error:", error)
    return NextResponse.json(
      { error: "Failed to generate outing plan" },
      { status: 500 }
    )
  }
}

// ---------- Helpers ----------

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

function normalizeMode(mode?: string): PlanMode {
  return ALLOWED_MODES.includes(mode as PlanMode) ? (mode as PlanMode) : "full"
}

function normalizeBudget(budget?: string): Budget | null {
  return ALLOWED_BUDGETS.includes(budget as Budget) ? (budget as Budget) : null
}

function normalizeMobility(mobility?: string): Mobility {
  return ALLOWED_MOBILITY.includes(mobility as Mobility)
    ? (mobility as Mobility)
    : "short_ride"
}

function normalizeGroupSize(groupSize?: number): number | null {
  if (!Number.isFinite(groupSize)) return null
  const n = Math.floor(Number(groupSize))
  if (n < 1) return 1
  if (n > 20) return 20
  return n
}

function normalizeVibeTags(vibeTags?: string[]): string[] {
  if (!Array.isArray(vibeTags)) return []
  return vibeTags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8)
}

function normalizeVenueRelation(
  venue: EventWithVenueRecord["venue"]
): VenueRecordWithHours | null {
  if (!venue) return null
  return Array.isArray(venue) ? venue[0] ?? null : venue
}

function minimumStopsForMode(mode: PlanMode): number {
  return mode === "full" ? 3 : 2
}