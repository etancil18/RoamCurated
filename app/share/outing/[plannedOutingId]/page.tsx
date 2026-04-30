// app/share/outing/[plannedOutingId]/page.tsx

import Link from "next/link"
import { notFound } from "next/navigation"
import { supabaseServerApi } from "@/lib/supabase/server-api"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{
    plannedOutingId: string
  }>
}

type PlannedOutingRow = {
  id: string
  event_id: string | null
  city: string | null
  mode: "before" | "after" | "full" | null
  status: string | null
  confidence_score: number | null
  plan_summary: string | null
  anchor_title: string | null
  anchor_starts_at: string | null
  anchor_ends_at: string | null
  share_enabled?: boolean | null
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  address: string | null
  type?: string[] | string | null
}

type PlannedOutingStopRow = {
  id: string
  venue_id: string | null
  stop_order: number | null
  role: string | null
  title: string | null
  rationale: string | null
  planned_arrival_at: string | null
  planned_departure_at: string | null
  metadata: unknown
  venue: VenueRow | VenueRow[] | null
}

export default async function SharedOutingPage({ params }: Props) {
  const { plannedOutingId } = await params
  const supabase = await supabaseServerApi()

  const { data: outing, error: outingError } = await supabase
    .from("planned_outings")
    .select(
      `
        id,
        event_id,
        city,
        mode,
        status,
        confidence_score,
        plan_summary,
        anchor_title,
        anchor_starts_at,
        anchor_ends_at,
        share_enabled
      `
    )
    .eq("id", plannedOutingId)
    .single<PlannedOutingRow>()

  if (outingError || !outing || outing.share_enabled !== true) {
    notFound()
  }

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
        metadata,
        venue:venues (
          id,
          name,
          city,
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

  const stops = (stopsRaw ?? []).map((stop) => {
    const venue = normalizeVenueRelation(stop.venue)

    return {
      id: stop.id,
      venueId: stop.venue_id,
      stopOrder: stop.stop_order,
      role: stop.role,
      title: stop.title ?? venue?.name ?? "Roam stop",
      rationale: stop.rationale,
      plannedArrivalAt: stop.planned_arrival_at,
      plannedDepartureAt: stop.planned_departure_at,
      venueName: venue?.name ?? null,
      venueCity: venue?.city ?? null,
      venueAddress: venue?.address ?? null,
      displayType:
        readMetadataString(stop.metadata, "displayType") ??
        readMetadataString(stop.metadata, "venueType") ??
        normalizeVenueTypeLabel(venue?.type) ??
        stop.role ??
        null,
    }
  })

  const city = outing.city ?? stops[0]?.venueCity ?? null

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Roam Itinerary
          </p>

          <h1 className="mt-3 text-3xl font-bold leading-tight">
            {outing.anchor_title ?? "Shared Roam Plan"}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-neutral-300">
            {city ? (
              <span className="rounded-full bg-neutral-950 px-3 py-1">
                {city.toUpperCase()}
              </span>
            ) : null}

            {outing.mode ? (
              <span className="rounded-full bg-neutral-950 px-3 py-1">
                {humanizeMode(outing.mode)}
              </span>
            ) : null}

            {outing.anchor_starts_at ? (
              <span className="rounded-full bg-neutral-950 px-3 py-1">
                {formatDateTime(outing.anchor_starts_at)}
              </span>
            ) : null}

            {outing.confidence_score != null ? (
              <span className="rounded-full bg-neutral-950 px-3 py-1">
                {Math.round(outing.confidence_score * 100)}% confidence
              </span>
            ) : null}
          </div>

          {outing.plan_summary ? (
            <p className="mt-5 text-sm leading-6 text-neutral-300">
              {outing.plan_summary}
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Route</h2>
            <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">
              {stops.length} stop{stops.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {stops.length > 0 ? (
              stops.map((stop, index) => (
                <article
                  key={stop.id}
                  className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
                >
                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">
                          {stop.title}
                        </h3>

                        {stop.displayType ? (
                          <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-300">
                            {humanizeLabel(stop.displayType)}
                          </span>
                        ) : null}
                      </div>

                      {stop.plannedArrivalAt ? (
                        <p className="mt-1 text-xs text-neutral-400">
                          Arrive {formatTime(stop.plannedArrivalAt)}
                          {stop.plannedDepartureAt
                            ? ` · Leave ${formatTime(stop.plannedDepartureAt)}`
                            : ""}
                        </p>
                      ) : null}

                      {stop.rationale ? (
                        <p className="mt-3 text-sm leading-6 text-neutral-300">
                          {stop.rationale}
                        </p>
                      ) : null}

                      {stop.venueAddress ? (
                        <p className="mt-3 text-xs text-neutral-500">
                          {stop.venueAddress}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-neutral-400">
                No public stops are available for this itinerary.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-cyan-900/60 bg-cyan-950/30 p-6 text-center">
          <p className="text-sm font-medium text-cyan-200">
            Built with Roam
          </p>
          <p className="mt-2 text-sm text-neutral-300">
            Discover places, events, and context-aware plans around your city.
          </p>

          <Link
            href="/events"
            className="mt-5 inline-flex rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Plan your own night
          </Link>
        </section>
      </div>
    </main>
  )
}

function normalizeVenueRelation(
  venue: PlannedOutingStopRow["venue"]
): VenueRow | null {
  if (!venue) return null
  return Array.isArray(venue) ? venue[0] ?? null : venue
}

function readMetadataString(
  metadata: unknown,
  key: string
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }

  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function normalizeVenueTypeLabel(value: VenueRow["type"]): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function humanizeMode(mode: "before" | "after" | "full"): string {
  if (mode === "before") return "Before Event"
  if (mode === "after") return "After Event"
  return "Full Night"
}

function humanizeLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}