import { notFound, redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import OutingMap from "@/components/events/OutingMap"
import StartFlowFromOutingButton from "@/components/flows/StartFlowFromOutingButton"

export const dynamic = "force-dynamic"

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
  mode: "before" | "after" | "full"
  status: string | null
  confidence_score: number | null
  plan_summary: string | null
  anchor_title: string | null
  anchor_starts_at: string | null
  anchor_ends_at: string | null
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  lat: number | null
  lon: number | null
  address: string | null
  type?: string | null
}

type PlannedOutingStopRow = {
  id: string
  venue_id: string
  stop_order: number
  role: string
  title: string | null
  rationale: string | null
  planned_arrival_at: string | null
  planned_departure_at: string | null
  dwell_minutes: number | null
  travel_mode: string | null
  travel_minutes_from_prev: number | null
  distance_meters_from_prev: number | null
  metadata: unknown
  venue: VenueRow | VenueRow[] | null
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string
  title: string | null
  city: string | null
  source: string | null
  status: string
  venue_ids: string[] | null
}

type OutingMapAnchor = {
  id: string | null
  title: string | null
  startsAt: string | null
  endsAt: string | null
  venue: {
    id: string | null
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
    address: string | null
    type?: string | null
  } | null
}

type OutingMapStop = {
  id: string
  venueId: string
  stopOrder: number
  role: string
  venueType: string | null
  displayType: string | null
  title: string | null
  rationale: string | null
  plannedArrivalAt: string | null
  plannedDepartureAt: string | null
  dwellMinutes: number | null
  travelMode: string | null
  travelMinutesFromPrev: number | null
  distanceMetersFromPrev: number | null
  venue: {
    id: string
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
    address: string | null
    type?: string | null
  } | null
}

export default async function EventOutingPage({ params }: Props) {
  const { eventId, plannedOutingId } = await params

  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: outing, error: outingError } = await supabase
    .from("planned_outings")
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
    .eq("id", plannedOutingId)
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single<PlannedOutingRow>()

  if (outingError || !outing) {
    notFound()
  }

  const { data: anchorVenue } = outing.venue_id
    ? await supabase
        .from("venues")
        .select("id, name, city, lat, lon, address, type")
        .eq("id", outing.venue_id)
        .single<VenueRow>()
    : { data: null }

  const { data: stopsRaw, error: stopsError } = await supabase
    .from("planned_outing_stops")
    .select(
      `
        id,
        venue_id,
        stop_order,
        role,
        title,
        rationale,
        planned_arrival_at,
        planned_departure_at,
        dwell_minutes,
        travel_mode,
        travel_minutes_from_prev,
        distance_meters_from_prev,
        metadata,
        venue:venues (
          id,
          name,
          city,
          lat,
          lon,
          address,
          type
        )
      `
    )
    .eq("planned_outing_id", plannedOutingId)
    .order("stop_order", { ascending: true })
    .returns<PlannedOutingStopRow[]>()

  if (stopsError) {
    notFound()
  }

  const anchor: OutingMapAnchor = {
    id: outing.event_id,
    title: outing.anchor_title,
    startsAt: outing.anchor_starts_at,
    endsAt: outing.anchor_ends_at,
    venue: anchorVenue
      ? {
          id: anchorVenue.id,
          name: anchorVenue.name,
          city: anchorVenue.city,
          lat: anchorVenue.lat,
          lon: anchorVenue.lon,
          address: anchorVenue.address,
          type: anchorVenue.type ?? null,
        }
      : null,
  }

  const stops: OutingMapStop[] = (stopsRaw ?? []).map((stop) => {
    const venue = normalizeVenueRelation(stop.venue)
    const displayType =
      readMetadataString(stop.metadata, "displayType") ??
      venue?.type ??
      stop.role ??
      null

    const venueType =
      readMetadataString(stop.metadata, "venueType") ??
      venue?.type ??
      null

    return {
      id: stop.id,
      venueId: stop.venue_id,
      stopOrder: stop.stop_order,
      role: stop.role,
      venueType,
      displayType,
      title: stop.title,
      rationale: stop.rationale,
      plannedArrivalAt: stop.planned_arrival_at,
      plannedDepartureAt: stop.planned_departure_at,
      dwellMinutes: stop.dwell_minutes,
      travelMode: stop.travel_mode,
      travelMinutesFromPrev: stop.travel_minutes_from_prev,
      distanceMetersFromPrev: stop.distance_meters_from_prev,
      venue: venue
        ? {
            id: venue.id,
            name: venue.name,
            city: venue.city,
            lat: venue.lat,
            lon: venue.lon,
            address: venue.address,
            type: venue.type ?? null,
          }
        : null,
    }
  })

  const city = outing.city ?? anchor.venue?.city ?? stops[0]?.venue?.city ?? ""

  const { data: existingActiveFlow } = await supabase
    .from("active_flow_sessions")
    .select("id, user_id, title, city, source, status, venue_ids")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle<ActiveFlowSessionRow>()

  await logPlannedOutingViewed({
    supabase,
    userId: user.id,
    plannedOutingId: outing.id,
    eventId,
    city,
    mode: outing.mode,
    status: outing.status,
    confidenceScore: outing.confidence_score,
    stopCount: stops.length,
    anchorVenueId: anchor.venue?.id ?? null,
  })

  const draftPath = `/events/${eventId}/outing/${outing.id}`
  const shareText = encodeURIComponent(
    outing.plan_summary ?? anchor.title ?? "View this Roam event flow"
  )

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-4 pt-[calc(4rem+env(safe-area-inset-top)+1rem)]">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {humanizeMode(outing.mode)} Flow Draft
        </p>
        <h1 className="text-2xl font-bold">
          {outing.plan_summary ?? anchor.title ?? "Event Flow"}
        </h1>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {city ? <span>{city}</span> : null}
          {outing.confidence_score != null ? (
            <span>Confidence {Math.round(outing.confidence_score * 100)}%</span>
          ) : null}
          {anchor.startsAt ? <span>{formatDateTime(anchor.startsAt)}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-300">
              {existingActiveFlow ? "Flow already in progress" : "Ready to execute this Flow?"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {existingActiveFlow
                ? "Resume your active flow to keep checking in, tracking progress, and completing your route."
                : "Start this event flow to check in, track progress, complete it, and save it to your Passport."}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StartFlowFromOutingButton
              eventId={eventId}
              plannedOutingId={outing.id}
              existingSessionId={existingActiveFlow?.id ?? null}
              label={existingActiveFlow ? "Resume Flow" : "Start Flow"}
              loadingLabel={existingActiveFlow ? "Opening Flow…" : "Starting Flow…"}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <a
              href={draftPath}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Copy Link
            </a>

            <a
              href={`mailto:?subject=Roam Flow&body=${shareText}%0A%0A${draftPath}`}
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Share Flow
            </a>
          </div>
        </div>
      </div>

      <OutingMap
        plannedOutingId={outing.id}
        eventId={eventId}
        city={city}
        mode={outing.mode}
        status={outing.status}
        summary={outing.plan_summary}
        anchor={anchor}
        stops={stops}
      />
    </main>
  )
}

async function logPlannedOutingViewed({
  supabase,
  userId,
  plannedOutingId,
  eventId,
  city,
  mode,
  status,
  confidenceScore,
  stopCount,
  anchorVenueId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
  plannedOutingId: string
  eventId: string
  city: string
  mode: "before" | "after" | "full"
  status: string | null
  confidenceScore: number | null
  stopCount: number
  anchorVenueId: string | null
}): Promise<void> {
  try {
    await supabase.from("planned_outing_events").insert({
      planned_outing_id: plannedOutingId,
      user_id: userId,
      event_type: "outing_plan_viewed",
      metadata: {
        eventId,
        city,
        mode,
        status,
        confidenceScore,
        stopCount,
        anchorVenueId,
      },
    })
  } catch (error) {
    console.warn("Failed to log outing_plan_viewed:", error)
  }
}

function normalizeVenueRelation(
  venue: PlannedOutingStopRow["venue"]
): VenueRow | null {
  if (!venue) return null
  return Array.isArray(venue) ? venue[0] ?? null : venue
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function humanizeMode(mode: "before" | "after" | "full"): string {
  if (mode === "before") return "Before Event"
  if (mode === "after") return "After Event"
  return "Full Night"
}

function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}