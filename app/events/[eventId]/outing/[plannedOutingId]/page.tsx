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
  eventArchetype?: string | null
  semanticRole?: string | null
  slotPhase?: string | null
  slotIndex?: number | null
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
      eventArchetype: readMetadataString(stop.metadata, "eventArchetype"),
      semanticRole: readMetadataString(stop.metadata, "semanticRole"),
      slotPhase: readMetadataString(stop.metadata, "slotPhase"),
      slotIndex: readMetadataNumber(stop.metadata, "slotIndex"),
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
    eventArchetype: stops[0]?.eventArchetype ?? null,
    semanticRoles: stops.map((stop) => stop.semanticRole ?? null),
  })

  const draftPath = `/events/${eventId}/outing/${outing.id}`
  const pageTitle = buildUserFriendlyOutingTitle({
    mode: outing.mode,
    anchorTitle: anchor.title,
  })
  const pageSubtitle = buildUserFriendlyOutingSubtitle({
    mode: outing.mode,
    anchorVenueName: anchor.venue?.name ?? null,
    stops,
  })
  const shareText = encodeURIComponent(
    `${pageTitle}${pageSubtitle ? `\n\n${pageSubtitle}` : ""}`
  )

  return (
    <main className="min-h-screen overflow-hidden bg-black px-4 pb-12 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-[-12%] top-[-12%] h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl space-y-7">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                {humanizeMode(outing.mode)} Flow Draft
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">
                {pageTitle}
              </h1>

              {pageSubtitle ? (
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  {pageSubtitle}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {city ? (
                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">
                    {city}
                  </span>
                ) : null}

                {outing.confidence_score != null ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                    Confidence {Math.round(outing.confidence_score * 100)}%
                  </span>
                ) : null}

                {anchor.startsAt ? (
                  <span className="rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-200">
                    {formatDateTime(anchor.startsAt)}
                  </span>
                ) : null}

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-300">
                  {stops.length} {stops.length === 1 ? "stop" : "stops"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 via-white/[0.045] to-cyan-500/10 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-300">
                Flow Control
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                {existingActiveFlow
                  ? "Flow already in progress"
                  : "Ready to execute this Flow?"}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                {existingActiveFlow
                  ? "Resume your active flow to keep checking in, tracking progress, and completing your route."
                  : "Start this event flow to check in, track progress, complete it, and save it to your Passport."}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[420px]">
              <StartFlowFromOutingButton
                eventId={eventId}
                plannedOutingId={outing.id}
                existingSessionId={existingActiveFlow?.id ?? null}
                label={existingActiveFlow ? "Resume Flow" : "Start Flow"}
                loadingLabel={existingActiveFlow ? "Opening Flow…" : "Starting Flow…"}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <a
                href={draftPath}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-white/[0.13]"
              >
                Copy Link
              </a>

              <a
                href={`mailto:?subject=Roam Flow&body=${shareText}%0A%0A${draftPath}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-center text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Share Flow
              </a>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-3 shadow-2xl backdrop-blur-xl sm:p-4">
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
        </section>
      </div>
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
  eventArchetype,
  semanticRoles,
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
  eventArchetype: string | null
  semanticRoles: Array<string | null>
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
        eventArchetype,
        semanticRoles,
      },
    })
  } catch (error) {
    console.warn("Failed to log outing_plan_viewed:", error)
  }
}

function buildUserFriendlyOutingTitle({
  mode,
  anchorTitle,
}: {
  mode: "before" | "after" | "full"
  anchorTitle: string | null
}): string {
  const eventName = anchorTitle?.trim() || "your event"

  if (mode === "before") return `Your pre-event Flow for ${eventName}`
  if (mode === "after") return `Your post-event Flow for ${eventName}`

  return `Your event Flow for ${eventName}`
}

function buildUserFriendlyOutingSubtitle({
  mode,
  anchorVenueName,
  stops,
}: {
  mode: "before" | "after" | "full"
  anchorVenueName: string | null
  stops: Array<{ title: string | null; venue?: { name: string | null } | null }>
}): string {
  const stopNames = stops
    .map((stop) => stop.title ?? stop.venue?.name)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)

  const venueText = anchorVenueName ? ` at ${anchorVenueName}` : ""

  if (stopNames.length === 0) {
    return `A simple route built around your event${venueText}.`
  }

  const sequence = stopNames.join(" → ")

  if (mode === "before") {
    return `Start with ${sequence}, then head to your event${venueText}.`
  }

  if (mode === "after") {
    return `After the event${venueText}, continue with ${sequence}.`
  }

  return `Your route: ${sequence}, with your event${venueText} built in.`
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

function readMetadataNumber(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
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