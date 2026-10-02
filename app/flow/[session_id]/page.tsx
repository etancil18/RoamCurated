// app/flow/[session_id]/page.tsx

import { notFound, redirect } from 'next/navigation'

import FlowRouteLauncher from '@/components/flows/FlowRouteLauncher'
import { loadActiveFlowRuntimeRoute } from '@/lib/active-flow/runtimeRoute.server'
import { createServerClient } from '@/lib/supabase/server'

import ActiveFlowCard from './components/ActiveFlowCard'
import ActiveFlowOpportunitySurface from './components/ActiveFlowOpportunitySurface'
import BackToRouteButton from './components/BackToRouteButton'
import FlowMap from './components/FlowMap'


export const dynamic = 'force-dynamic'

// -----------------------------------------------------------------------------
// Page types
// -----------------------------------------------------------------------------

type FlowTravelMode =
  | 'walking'
  | 'cycling'
  | 'driving'

type FlowStatus =
  | 'active'
  | 'completed'
  | 'cancelled'

type PageProps = {
  params: Promise<{
    session_id: string
  }>
}

type ActiveFlowSessionRow = {
  id: string
  user_id: string

  title?: string | null
  city?: string | null
  source?: string | null

  theme_id: string | null
  started_at: string | null
  completed_at: string | null

  status: string
  travel_mode: string | null

  venue_ids: string[] | null

  [key: string]: unknown
}

type VenueRow = {
  id: string
  name: string | null

  city: string | null
  address: string | null

  lat: number | null
  lon: number | null

  instagram_handle: string | null
  contact: string[] | string | null
  description: string | null
}

type VenueBookingRow = {
  venue_id: string
  provider: string | null
  url: string | null
}

type VenueBookingOption = {
  provider: string
  url: string
}

type Venue = {
  id: string
  name: string

  city: string | null
  address: string | null

  lat: number | null
  lon: number | null

  instagram_handle: string | null
  contact?: string[] | string | null
  description?: string | null

  booking_options?: VenueBookingOption[]
}

/**
 * Raw database shape.
 *
 * Historical rows may contain missing or nullable identifiers, indexes, and
 * timestamps. These values are normalized before reaching UI components.
 */
type ActiveFlowProgressRow = {
  id?: string | null
  session_id?: string | null
  user_id?: string | null

  venue_id: string
  stop_index?: number | null

  status?: string | null
  completed_at?: string | null
  checked_in_at?: string | null

  [key: string]: unknown
}

/**
 * Component-safe progress shape.
 *
 * ActiveFlowCard and FlowProgress expect these properties to be concrete.
 */
type NormalizedFlowProgressRow = Omit<
  ActiveFlowProgressRow,
  | 'id'
  | 'session_id'
  | 'user_id'
  | 'venue_id'
  | 'stop_index'
  | 'checked_in_at'
> & {
  id: string
  session_id: string
  user_id: string

  venue_id: string
  stop_index: number | null

  checked_in_at: string
}

/**
 * 016D.4 runtime identity bridge.
 *
 * The page already owns the canonical runtime route. Preserve only the
 * identity metadata ActiveFlowCard needs to distinguish immutable base-route
 * position from inserted Detour execution order.
 */
type ActiveFlowRuntimeStopIdentity = {
  venueId: string
  position: number | null
  kind: 'base' | 'detour'
}

// -----------------------------------------------------------------------------
// Normalization
// -----------------------------------------------------------------------------

function normalizeTravelMode(
  value: string | null | undefined
): FlowTravelMode | null {
  if (
    value === 'walking' ||
    value === 'cycling' ||
    value === 'driving'
  ) {
    return value
  }

  return null
}

function normalizeStatus(
  value: string | null | undefined
): FlowStatus {
  if (
    value === 'active' ||
    value === 'completed' ||
    value === 'cancelled'
  ) {
    return value
  }

  return 'active'
}

function normalizeVenueIds(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue
    }

    const venueId = entry.trim()

    if (
      !venueId ||
      seen.has(venueId)
    ) {
      continue
    }

    seen.add(venueId)
    normalized.push(venueId)
  }

  return normalized
}

function normalizeExternalUrl(
  url: string
): string {
  const trimmed = url.trim()

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed
  }

  return `https://${trimmed.replace(/^\/+/, '')}`
}

function normalizeBookingProvider(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
}

function normalizeProgressRows({
  rows,
  sessionId,
  userId,
}: {
  rows: ActiveFlowProgressRow[]
  sessionId: string
  userId: string
}): NormalizedFlowProgressRow[] {
  return rows
    .map(
      (
        row,
        index
      ): NormalizedFlowProgressRow | null => {
        const venueId =
          typeof row.venue_id === 'string'
            ? row.venue_id.trim()
            : ''

        if (!venueId) {
          return null
        }

        const id =
          typeof row.id === 'string' &&
          row.id.trim().length > 0
            ? row.id.trim()
            : `${sessionId}:${venueId}:${index}`

        const normalizedSessionId =
          typeof row.session_id === 'string' &&
          row.session_id.trim().length > 0
            ? row.session_id.trim()
            : sessionId

        const normalizedUserId =
          typeof row.user_id === 'string' &&
          row.user_id.trim().length > 0
            ? row.user_id.trim()
            : userId

        const stopIndex =
          typeof row.stop_index === 'number' &&
          Number.isFinite(row.stop_index)
            ? Math.max(
                0,
                Math.floor(row.stop_index)
              )
            : null

        const checkedInAt =
          typeof row.checked_in_at === 'string'
            ? row.checked_in_at
            : ''

        return {
          ...row,

          id,
          session_id:
            normalizedSessionId,
          user_id:
            normalizedUserId,

          venue_id:
            venueId,
          stop_index:
            stopIndex,

          checked_in_at:
            checkedInAt,
        }
      }
    )
    .filter(
      (
        row
      ): row is NormalizedFlowProgressRow =>
        row != null
    )
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default async function ActiveFlowPage({
  params,
}: PageProps) {
  /*
   * The parameter key must match the folder name exactly:
   *
   * app/flow/[session_id]/page.tsx
   */
  const {
    session_id: sessionId,
  } = await params

  if (
    typeof sessionId !== 'string' ||
    sessionId.trim().length === 0
  ) {
    notFound()
  }

  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser()

  if (
    userError ||
    !user
  ) {
    redirect('/login')
  }

  const {
    data: session,
    error: sessionError,
  } = await supabase
    .from('active_flow_sessions')
    .select('*')
    .eq(
      'id',
      sessionId
    )
    .eq(
      'user_id',
      user.id
    )
    .maybeSingle<ActiveFlowSessionRow>()

  if (sessionError) {
    console.error(
      '[flow/page] Session fetch error:',
      sessionError
    )

    notFound()
  }

  if (!session) {
    notFound()
  }

  /*
   * 016C — canonical runtime route:
   *
   * Runtime ordering and completion identity are resolved centrally from
   * active_flow_stops + active_flow_detours + active_flow_progress.
   *
   * position remains immutable base-route identity and is never treated here
   * as execution order. Detours may therefore participate in the rendered
   * route with position=NULL while executionIndex supplies canonical order.
   */
  let runtimeStops

  try {
    runtimeStops =
      await loadActiveFlowRuntimeRoute({
        sessionId:
          session.id,
        userId:
          user.id,
        supabase,
      })
  } catch (error) {
    console.error(
      '[flow/page] Runtime route fetch error:',
      error
    )

    notFound()
  }

  const venueIds =
    normalizeVenueIds(
      runtimeStops.map(
        (stop) =>
          stop.venueId
      )
    )

  /*
   * 016D.4 — preserve canonical runtime identity for check-in presentation.
   *
   * position remains immutable base-route identity.
   * Detours intentionally carry position=NULL.
   */
  const runtimeStopIdentities: ActiveFlowRuntimeStopIdentity[] =
    runtimeStops.map(
      (stop) => ({
        venueId:
          stop.venueId,

        position:
          stop.position,

        kind:
          stop.kind,
      })
    )

  /*
   * Supabase/PostgREST may reject or behave inconsististently with `.in(..., [])`.
   * Skip dependent queries entirely when a flow contains no venue IDs.
   */
  const venueQueryResult =
    venueIds.length > 0
      ? await supabase
          .from('venues')
          .select(
            `
              id,
              name,
              city,
              address,
              lat,
              lon,
              instagram_handle,
              contact,
              description
            `
          )
          .in(
            'id',
            venueIds
          )
          .returns<VenueRow[]>()
      : {
          data: [] as VenueRow[],
          error: null,
        }

  const {
    data: venueData,
    error: venueError,
  } = venueQueryResult

  if (venueError) {
    console.error(
      '[flow/page] Venue fetch error:',
      venueError
    )
  }

  const bookingQueryResult =
    venueIds.length > 0
      ? await supabase
          .from('venue_bookings')
          .select(
            `
              venue_id,
              provider,
              url
            `
          )
          .in(
            'venue_id',
            venueIds
          )
          .returns<VenueBookingRow[]>()
      : {
          data: [] as VenueBookingRow[],
          error: null,
        }

  const {
    data: bookingData,
    error: bookingError,
  } = bookingQueryResult

  if (bookingError) {
    console.error(
      '[flow/page] Venue booking fetch error:',
      bookingError
    )
  }

  const venuesById =
    new Map<string, VenueRow>(
      (venueData ?? []).map(
        (venue) => [
          venue.id,
          venue,
        ]
      )
    )

  const bookingsByVenueId =
    buildBookingsByVenueId(
      bookingData ?? []
    )

  /*
   * Venue order must always follow the canonical executable runtime-stop route.
   *
   * Database `.in(...)` results are not guaranteed to preserve input order.
   */
  const venues: Venue[] =
    venueIds.reduce<Venue[]>(
      (
        accumulatedVenues,
        venueId
      ) => {
        const venue =
          venuesById.get(
            venueId
          )

        if (
          !venue ||
          !venue.name?.trim()
        ) {
          return accumulatedVenues
        }

        accumulatedVenues.push({
          id:
            venue.id,

          name:
            venue.name.trim(),

          city:
            venue.city,

          address:
            venue.address ?? null,

          lat:
            venue.lat,

          lon:
            venue.lon,

          instagram_handle:
            venue.instagram_handle,

          contact:
            venue.contact ?? null,

          description:
            venue.description ?? null,

          booking_options:
            bookingsByVenueId.get(
              venueId
            ) ?? [],
        })

        return accumulatedVenues
      },
      []
    )

  /*
   * Keep the raw progress read for the existing ActiveFlowCard component
   * contract. Runtime ordering/completion authority above does not depend on
   * this second representation.
   */
  const {
    data: progressData,
    error: progressError,
  } = await supabase
    .from('active_flow_progress')
    .select('*')
    .eq(
      'session_id',
      session.id
    )
    .eq(
      'user_id',
      user.id
    )
    .order(
      'stop_index',
      {
        ascending: true,
      }
    )
    .returns<
      ActiveFlowProgressRow[]
    >()

  if (progressError) {
    console.error(
      '[flow/page] Progress fetch error:',
      progressError
    )
  }

  /*
   * Normalize database rows once at the server-page boundary.
   *
   * Child components receive a stable shape and do not need to account for
   * nullable historical database fields.
   */
  const progress: NormalizedFlowProgressRow[] =
    normalizeProgressRows({
      rows:
        progressData ?? [],
      sessionId:
        session.id,
      userId:
        user.id,
    })

  /*
   * 016C — completion/current-stop presentation derives from the same canonical
   * runtime route used for execution ordering.
   *
   * This preserves flow_stop_id-first completion plus historical
   * stop_index↔position fallback without reimplementing either rule here.
   */
  const completedVenueIds =
    uniqueStrings(
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

  const currentVenueId =
    runtimeStops.find(
      (stop) =>
        !stop.completed
    )?.venueId ?? null

  const travelMode =
    normalizeTravelMode(
      session.travel_mode
    ) ?? 'walking'

  /*
   * Explicit normalization guarantees that the page boundary satisfies the
   * ActiveFlowCard session contract without weakening child component types.
   *
   * venue_ids is projected from the canonical executable runtime route rather
   * than mutating the legacy active_flow_sessions.venue_ids column.
   */
  const normalizedSession = {
    ...session,

    id:
      session.id,

    user_id:
      session.user_id,

    title:
      session.title ?? null,

    city:
      session.city ?? null,

    source:
      session.source ?? null,

    theme_id:
      session.theme_id ?? null,

    started_at:
      session.started_at ?? null,

    completed_at:
      session.completed_at ?? null,

    venue_ids:
      venueIds,

    travel_mode:
      normalizeTravelMode(
        session.travel_mode
      ),

    status:
      normalizeStatus(
        session.status
      ),
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-black text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-20 h-80 w-80 rounded-full bg-cyan-300/[0.045] blur-[110px]" />

        <div className="absolute -right-36 top-[32rem] h-96 w-96 rounded-full bg-indigo-400/[0.045] blur-[120px]" />

        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-cyan-300/[0.025] to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-14 pt-[calc(4rem+env(safe-area-inset-top)+1rem)] sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <BackToRouteButton />

          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.035] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500 ring-1 ring-white/[0.055]">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]"
            />

            Live Roam
          </span>
        </div>

        <div className="mt-7">
          <ActiveFlowCard
            session={
              normalizedSession
            }
            venues={
              venues
            }
            progress={
              progress
            }
            runtimeStops={
              runtimeStopIdentities
            }
          />
        </div>

        <ActiveFlowOpportunitySurface
          sessionId={
            session.id
          }
        />

        <section
          aria-labelledby="active-flow-route-title"
          className="mt-8 min-w-0"
        >
          <div className="mb-4 flex min-w-0 items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                Your route
              </p>

              <h2
                id="active-flow-route-title"
                className="mt-2 text-xl font-black tracking-[-0.03em] text-white"
              >
                See where you’re headed
              </h2>
            </div>

            <span className="shrink-0 text-[10px] font-bold text-zinc-700">
              {completedVenueIds.length.toLocaleString(
                'en-US'
              )}
              {' / '}
              {venueIds.length.toLocaleString(
                'en-US'
              )}{' '}
              stops
            </span>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] bg-white/[0.025] p-2 shadow-[0_22px_70px_rgba(0,0,0,0.2)] ring-1 ring-white/[0.06]">
            <div className="overflow-hidden rounded-[1.4rem]">
              <FlowMap
                venues={
                  venues
                }
                completedVenueIds={
                  completedVenueIds
                }
                currentVenueId={
                  currentVenueId
                }
                travelMode={
                  travelMode
                }
                heightPx={
                  320
                }
              />
            </div>
          </div>

          <div className="mt-3">
            <FlowRouteLauncher
              venues={
                venues
              }
              travelMode={
                travelMode
              }
              flowId={
                session.id
              }
              source="active_flow"
            />
          </div>
        </section>
      </div>
    </main>
  )
}

// -----------------------------------------------------------------------------
// Booking normalization
// -----------------------------------------------------------------------------

function buildBookingsByVenueId(
  rows: VenueBookingRow[]
): Map<
  string,
  VenueBookingOption[]
> {
  const result =
    new Map<
      string,
      VenueBookingOption[]
    >()

  const seen =
    new Set<string>()

  for (const row of rows) {
    if (
      typeof row.venue_id !== 'string' ||
      row.venue_id.trim().length === 0 ||
      typeof row.provider !== 'string' ||
      row.provider.trim().length === 0 ||
      typeof row.url !== 'string' ||
      row.url.trim().length === 0
    ) {
      continue
    }

    const venueId =
      row.venue_id.trim()

    const provider =
      normalizeBookingProvider(
        row.provider
      )

    const url =
      normalizeExternalUrl(
        row.url
      )

    const dedupeKey =
      `${venueId}:${provider}:${url}`

    if (
      seen.has(
        dedupeKey
      )
    ) {
      continue
    }

    seen.add(
      dedupeKey
    )

    const existing =
      result.get(
        venueId
      ) ?? []

    existing.push({
      provider,
      url,
    })

    result.set(
      venueId,
      existing
    )
  }

  return result
}

// -----------------------------------------------------------------------------
// Generic helpers
// -----------------------------------------------------------------------------

function uniqueStrings(
  values: string[]
): string[] {
  return Array.from(
    new Set(
      values.map(
        (value) =>
          value.trim()
      )
    )
  ).filter(Boolean)
}