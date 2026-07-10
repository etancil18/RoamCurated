// app/events/[eventId]/outing/[plannedOutingId]/page.tsx

import { notFound, redirect } from "next/navigation"

import OutingMap from "@/components/events/OutingMap"
import StartFlowFromOutingButton from "@/components/flows/StartFlowFromOutingButton"
import { createServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// -----------------------------------------------------------------------------
// Page types
// -----------------------------------------------------------------------------

type OutingMode = "before" | "after" | "full"
type OutingPhase = "before" | "after"

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
  mode: OutingMode
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
  type?: string | string[] | null
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
  phase?: OutingPhase | null

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

  slotPhase?: OutingPhase | null
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

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function EventOutingPage({
  params,
}: Props) {
  const {
    eventId,
    plannedOutingId,
  } = await params

  const supabase =
    await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const {
    data: outing,
    error: outingError,
  } = await supabase
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

  if (
    outingError ||
    !outing
  ) {
    notFound()
  }

  const {
    data: anchorVenue,
  } = outing.venue_id
    ? await supabase
        .from("venues")
        .select(
          `
            id,
            name,
            city,
            lat,
            lon,
            address,
            type
          `
        )
        .eq(
          "id",
          outing.venue_id
        )
        .single<VenueRow>()
    : {
        data: null,
      }

  const {
    data: stopsRaw,
    error: stopsError,
  } = await supabase
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
    .eq(
      "planned_outing_id",
      plannedOutingId
    )
    .order(
      "stop_order",
      {
        ascending: true,
      }
    )
    .returns<
      PlannedOutingStopRow[]
    >()

  if (stopsError) {
    notFound()
  }

  const normalizedAnchorVenueType =
    normalizeVenueType(
      anchorVenue?.type
    )

  const anchor: OutingMapAnchor = {
    id: outing.event_id,

    title:
      outing.anchor_title,

    startsAt:
      outing.anchor_starts_at,

    endsAt:
      outing.anchor_ends_at,

    venue: anchorVenue
      ? {
          id:
            anchorVenue.id,

          name:
            anchorVenue.name,

          city:
            anchorVenue.city,

          lat:
            anchorVenue.lat,

          lon:
            anchorVenue.lon,

          address:
            anchorVenue.address,

          type:
            normalizedAnchorVenueType,
        }
      : null,
  }

  const stops: OutingMapStop[] =
    (stopsRaw ?? []).map(
      (stop) => {
        const venue =
          normalizeVenueRelation(
            stop.venue
          )

        const normalizedVenueType =
          normalizeVenueType(
            venue?.type
          )

        const phase =
          normalizeOutingPhase(
            readMetadataString(
              stop.metadata,
              "phase"
            )
          ) ??
          normalizeOutingPhase(
            readMetadataString(
              stop.metadata,
              "slotPhase"
            )
          ) ??
          inferLegacyStopPhase({
            mode: outing.mode,
            stopOrder:
              stop.stop_order,
          })

        const slotPhase =
          normalizeOutingPhase(
            readMetadataString(
              stop.metadata,
              "slotPhase"
            )
          ) ??
          phase

        const displayType =
          readMetadataString(
            stop.metadata,
            "displayType"
          ) ??
          readMetadataString(
            stop.metadata,
            "appliedDisplayType"
          ) ??
          normalizedVenueType ??
          humanizeRole(
            stop.role
          )

        const venueType =
          readMetadataString(
            stop.metadata,
            "venueType"
          ) ??
          normalizedVenueType

        return {
          id:
            stop.id,

          venueId:
            stop.venue_id,

          stopOrder:
            stop.stop_order,

          role:
            stop.role,

          phase,

          venueType,
          displayType,

          title:
            stop.title,

          rationale:
            stop.rationale,

          plannedArrivalAt:
            stop.planned_arrival_at,

          plannedDepartureAt:
            stop.planned_departure_at,

          dwellMinutes:
            stop.dwell_minutes,

          travelMode:
            stop.travel_mode,

          travelMinutesFromPrev:
            stop.travel_minutes_from_prev,

          distanceMetersFromPrev:
            stop.distance_meters_from_prev,

          eventArchetype:
            readMetadataString(
              stop.metadata,
              "eventArchetype"
            ),

          semanticRole:
            readMetadataString(
              stop.metadata,
              "semanticRole"
            ),

          slotPhase,

          slotIndex:
            readMetadataNumber(
              stop.metadata,
              "slotIndex"
            ),

          venue: venue
            ? {
                id:
                  venue.id,

                name:
                  venue.name,

                city:
                  venue.city,

                lat:
                  venue.lat,

                lon:
                  venue.lon,

                address:
                  venue.address,

                type:
                  normalizedVenueType,
              }
            : null,
        }
      }
    )

  const city =
    outing.city ??
    anchor.venue?.city ??
    stops[0]?.venue?.city ??
    ""

  const {
    data: existingActiveFlow,
  } = await supabase
    .from("active_flow_sessions")
    .select(
      `
        id,
        user_id,
        title,
        city,
        source,
        status,
        venue_ids
      `
    )
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "status",
      "active"
    )
    .maybeSingle<
      ActiveFlowSessionRow
    >()

  const beforeStopCount =
    stops.filter(
      (stop) =>
        resolveStopPhase(
          stop,
          outing.mode
        ) === "before"
    ).length

  const afterStopCount =
    stops.filter(
      (stop) =>
        resolveStopPhase(
          stop,
          outing.mode
        ) === "after"
    ).length

  await logPlannedOutingViewed({
    supabase,

    userId:
      user.id,

    plannedOutingId:
      outing.id,

    eventId,
    city,

    mode:
      outing.mode,

    status:
      outing.status,

    confidenceScore:
      outing.confidence_score,

    stopCount:
      stops.length,

    beforeStopCount,
    afterStopCount,

    anchorVenueId:
      anchor.venue?.id ??
      null,

    eventArchetype:
      stops.find(
        (stop) =>
          stop.eventArchetype
      )?.eventArchetype ??
      null,

    semanticRoles:
      stops.map(
        (stop) =>
          stop.semanticRole ??
          null
      ),

    stopPhases:
      stops.map(
        (stop) =>
          resolveStopPhase(
            stop,
            outing.mode
          )
      ),
  })

  const draftPath =
    `/events/${eventId}/outing/${outing.id}`

  const pageTitle =
    buildUserFriendlyOutingTitle({
      mode:
        outing.mode,

      anchorTitle:
        anchor.title,
    })

  const pageSubtitle =
    buildUserFriendlyOutingSubtitle({
      mode:
        outing.mode,

      anchorVenueName:
        anchor.venue?.name ??
        null,

      stops,
    })

  const shareText =
    encodeURIComponent(
      `${pageTitle}${
        pageSubtitle
          ? `\n\n${pageSubtitle}`
          : ""
      }`
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
                {humanizeMode(
                  outing.mode
                )}{" "}
                Flow Draft
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

                {outing.confidence_score !=
                null ? (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                    Confidence{" "}
                    {formatConfidencePercentage(
                      outing.confidence_score
                    )}
                    %
                  </span>
                ) : null}

                {anchor.startsAt ? (
                  <span className="rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1.5 text-xs font-bold text-indigo-200">
                    {formatDateTime(
                      anchor.startsAt
                    )}
                  </span>
                ) : null}

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-300">
                  {stops.length}{" "}
                  {stops.length === 1
                    ? "stop"
                    : "stops"}
                </span>

                {outing.mode ===
                  "full" &&
                beforeStopCount > 0 ? (
                  <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                    {beforeStopCount} before
                  </span>
                ) : null}

                {outing.mode ===
                  "full" &&
                afterStopCount > 0 ? (
                  <span className="rounded-full border border-green-400/25 bg-green-400/10 px-3 py-1.5 text-xs font-bold text-green-200">
                    {afterStopCount} after
                  </span>
                ) : null}
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
                eventId={
                  eventId
                }
                plannedOutingId={
                  outing.id
                }
                existingSessionId={
                  existingActiveFlow?.id ??
                  null
                }
                label={
                  existingActiveFlow
                    ? "Resume Flow"
                    : "Start Flow"
                }
                loadingLabel={
                  existingActiveFlow
                    ? "Opening Flow…"
                    : "Starting Flow…"
                }
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <a
                href={draftPath}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-white/[0.13]"
              >
                Copy Link
              </a>

              <a
                href={`mailto:?subject=Roam Flow&body=${shareText}%0A%0A${encodeURIComponent(
                  draftPath
                )}`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2.5 text-center text-sm font-black text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Share Flow
              </a>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-3 shadow-2xl backdrop-blur-xl sm:p-4">
          <OutingMap
            plannedOutingId={
              outing.id
            }
            eventId={
              eventId
            }
            city={
              city
            }
            mode={
              outing.mode
            }
            status={
              outing.status
            }
            summary={
              outing.plan_summary
            }
            anchor={
              anchor
            }
            stops={
              stops
            }
          />
        </section>
      </div>
    </main>
  )
}

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------

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
  beforeStopCount,
  afterStopCount,
  anchorVenueId,
  eventArchetype,
  semanticRoles,
  stopPhases,
}: {
  supabase: Awaited<
    ReturnType<
      typeof createServerClient
    >
  >

  userId: string
  plannedOutingId: string
  eventId: string

  city: string
  mode: OutingMode
  status: string | null

  confidenceScore: number | null

  stopCount: number
  beforeStopCount: number
  afterStopCount: number

  anchorVenueId: string | null
  eventArchetype: string | null

  semanticRoles: Array<
    string | null
  >

  stopPhases: OutingPhase[]
}): Promise<void> {
  try {
    const {
      error,
    } = await supabase
      .from(
        "planned_outing_events"
      )
      .insert({
        planned_outing_id:
          plannedOutingId,

        user_id:
          userId,

        event_type:
          "outing_plan_viewed",

        metadata: {
          eventId,
          city,
          mode,
          status,
          confidenceScore,

          stopCount,
          beforeStopCount,
          afterStopCount,

          anchorVenueId,
          eventArchetype,

          semanticRoles,
          stopPhases,
        },
      })

    if (error) {
      console.warn(
        "Failed to log outing_plan_viewed:",
        error
      )
    }
  } catch (error) {
    console.warn(
      "Failed to log outing_plan_viewed:",
      error
    )
  }
}

// -----------------------------------------------------------------------------
// User-facing copy
// -----------------------------------------------------------------------------

function buildUserFriendlyOutingTitle({
  mode,
  anchorTitle,
}: {
  mode: OutingMode
  anchorTitle: string | null
}): string {
  const eventName =
    anchorTitle?.trim() ||
    "your event"

  if (mode === "before") {
    return `Your pre-event Flow for ${eventName}`
  }

  if (mode === "after") {
    return `Your post-event Flow for ${eventName}`
  }

  return `Your event Flow for ${eventName}`
}

function buildUserFriendlyOutingSubtitle({
  mode,
  anchorVenueName,
  stops,
}: {
  mode: OutingMode
  anchorVenueName: string | null
  stops: OutingMapStop[]
}): string {
  const venueText =
    anchorVenueName
      ? ` at ${anchorVenueName}`
      : ""

  const namedStops =
    stops
      .map(
        (stop) => ({
          name:
            getStopDisplayName(
              stop
            ),

          phase:
            resolveStopPhase(
              stop,
              mode
            ),

          order:
            stop.stopOrder,
        })
      )
      .filter(
        (
          stop
        ): stop is {
          name: string
          phase: OutingPhase
          order: number
        } =>
          stop.name != null
      )
      .sort(
        (
          first,
          second
        ) =>
          first.order -
          second.order
      )

  if (
    namedStops.length === 0
  ) {
    return `A simple route built around your event${venueText}.`
  }

  if (mode === "before") {
    return `Start with ${joinRouteNames(
      namedStops.map(
        (stop) => stop.name
      )
    )}, then head to your event${venueText}.`
  }

  if (mode === "after") {
    return `After the event${venueText}, continue with ${joinRouteNames(
      namedStops.map(
        (stop) => stop.name
      )
    )}.`
  }

  const beforeStops =
    namedStops
      .filter(
        (stop) =>
          stop.phase ===
          "before"
      )
      .map(
        (stop) =>
          stop.name
      )

  const afterStops =
    namedStops
      .filter(
        (stop) =>
          stop.phase ===
          "after"
      )
      .map(
        (stop) =>
          stop.name
      )

  if (
    beforeStops.length > 0 &&
    afterStops.length > 0
  ) {
    return `Start with ${joinRouteNames(
      beforeStops
    )}, head to your event${venueText}, then continue with ${joinRouteNames(
      afterStops
    )}.`
  }

  if (
    beforeStops.length > 0
  ) {
    return `Start with ${joinRouteNames(
      beforeStops
    )}, then head to your event${venueText}.`
  }

  if (
    afterStops.length > 0
  ) {
    return `After the event${venueText}, continue with ${joinRouteNames(
      afterStops
    )}.`
  }

  return `Your event${venueText} is built into a ${namedStops.length}-stop Flow.`
}

function getStopDisplayName(
  stop: OutingMapStop
): string | null {
  const value =
    stop.title ??
    stop.venue?.name ??
    null

  if (
    typeof value !== "string"
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

function joinRouteNames(
  names: string[]
): string {
  return names.join(" → ")
}

// -----------------------------------------------------------------------------
// Phase normalization
// -----------------------------------------------------------------------------

function resolveStopPhase(
  stop: Pick<
    OutingMapStop,
    | "phase"
    | "slotPhase"
    | "stopOrder"
  >,
  mode: OutingMode
): OutingPhase {
  const explicitPhase =
    normalizeOutingPhase(
      stop.phase
    ) ??
    normalizeOutingPhase(
      stop.slotPhase
    )

  if (explicitPhase) {
    return explicitPhase
  }

  return inferLegacyStopPhase({
    mode,
    stopOrder:
      stop.stopOrder,
  })
}

function inferLegacyStopPhase({
  mode,
  stopOrder,
}: {
  mode: OutingMode
  stopOrder: number
}): OutingPhase {
  if (mode === "before") {
    return "before"
  }

  if (mode === "after") {
    return "after"
  }

  /*
   * Legacy full-mode records were historically treated as first-stop-before,
   * remaining-stops-after. New records should always carry persisted phase
   * metadata, so this is only a compatibility fallback.
   */
  return stopOrder === 1
    ? "before"
    : "after"
}

function normalizeOutingPhase(
  value:
    | string
    | null
    | undefined
): OutingPhase | null {
  if (
    value === "before" ||
    value === "after"
  ) {
    return value
  }

  return null
}

// -----------------------------------------------------------------------------
// Supabase relation and metadata helpers
// -----------------------------------------------------------------------------

function normalizeVenueRelation(
  venue:
    PlannedOutingStopRow["venue"]
): VenueRow | null {
  if (!venue) {
    return null
  }

  return Array.isArray(venue)
    ? venue[0] ?? null
    : venue
}

function readMetadataString(
  metadata: unknown,
  key: string
): string | null {
  if (
    !metadata ||
    typeof metadata !==
      "object" ||
    Array.isArray(metadata)
  ) {
    return null
  }

  const value =
    (
      metadata as Record<
        string,
        unknown
      >
    )[key]

  return (
    typeof value ===
      "string" &&
    value.trim().length > 0
  )
    ? value.trim()
    : null
}

function readMetadataNumber(
  metadata: unknown,
  key: string
): number | null {
  if (
    !metadata ||
    typeof metadata !==
      "object" ||
    Array.isArray(metadata)
  ) {
    return null
  }

  const value =
    (
      metadata as Record<
        string,
        unknown
      >
    )[key]

  return (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  )
    ? value
    : null
}

// -----------------------------------------------------------------------------
// Venue presentation helpers
// -----------------------------------------------------------------------------

function normalizeVenueType(
  value:
    | string
    | string[]
    | null
    | undefined
): string | null {
  if (
    Array.isArray(value)
  ) {
    const normalizedValues =
      value
        .map(
          (entry) =>
            String(entry).trim()
        )
        .filter(Boolean)

    return normalizedValues[0] ??
      null
  }

  if (
    typeof value !==
    "string"
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

function humanizeRole(
  role: string
): string {
  const normalized =
    role
      .trim()
      .replace(
        /[_-]+/g,
        " "
      )

  if (!normalized) {
    return "Stop"
  }

  return normalized.replace(
    /\b\w/g,
    (character) =>
      character.toUpperCase()
  )
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function humanizeMode(
  mode: OutingMode
): string {
  if (mode === "before") {
    return "Before Event"
  }

  if (mode === "after") {
    return "After Event"
  }

  return "Full Flow"
}

function formatDateTime(
  value: string
): string {
  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleString(
    "en-US",
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  )
}

function formatConfidencePercentage(
  value: number
): number {
  if (
    !Number.isFinite(value)
  ) {
    return 0
  }

  const normalized =
    value <= 1
      ? value * 100
      : value

  return Math.round(
    Math.min(
      Math.max(
        normalized,
        0
      ),
      100
    )
  )
}