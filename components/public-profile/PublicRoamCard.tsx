import ReplayRoamButton from '@/components/flows/ReplayRoamButton'
import PublicRoamRoutePreview, {
  type PublicRoamRouteStop,
} from '@/components/public-profile/PublicRoamRoutePreview'

export type PublicRoamCardCanonicalStop = {
  venueId: string
  stopIndex: number

  venue: {
    id: string
    name: string | null
    city: string | null
    lat: number | null
    lon: number | null
  }
}

export type PublicRoamCardSnapshotStop = {
  venue_id: string
  stop_index: number

  venue?: {
    id?: string | null
    name?: string | null
    city?: string | null
    lat?: number | null
    lon?: number | null
  } | null

  venues?: {
    id?: string | null
    name?: string | null
    city?: string | null
    lat?: number | null
    lon?: number | null
  } | null
}

export type PublicRoamCardSnapshot = {
  id: string
  title: string | null
  city: string | null
  status: string | null
  cover_image_url: string | null
  route_summary: string | null
  checked_in_count: number | null
  total_stops: number | null
  source_type: string | null
  source_id: string | null
  visibility: 'public'
  replayable?: boolean | null
  created_at: string

  /**
   * Preferred public-profile route contract.
   *
   * app/u/[username]/page.tsx normalizes immutable
   * flow_snapshot_stops into this shape before passing
   * the snapshot to this component.
   */
  stops?:
    | PublicRoamCardCanonicalStop[]
    | null

  /**
   * Backwards-compatible raw Supabase relationship shape.
   *
   * This remains supported so the card does not become coupled
   * to only one snapshot loader implementation.
   */
  flow_snapshot_stops?:
    | PublicRoamCardSnapshotStop[]
    | null
}

type Props = {
  snapshot: PublicRoamCardSnapshot
  className?: string
}

export default function PublicRoamCard({
  snapshot,
  className = '',
}: Props) {
  const title =
    normalizeNullableText(
      snapshot.title
    ) ??
    'Roam'

  const city =
    normalizeNullableText(
      snapshot.city
    )

  const routeSummary =
    normalizeNullableText(
      snapshot.route_summary
    )

  const checkedInCount =
    normalizeNonNegativeInteger(
      snapshot.checked_in_count
    )

  const totalStops =
    normalizeNonNegativeInteger(
      snapshot.total_stops
    )

  /*
   * Replay initiative:
   *
   * Prefer the already-normalized immutable route supplied by
   * the public-profile loader.
   *
   * Fall back to the raw flow_snapshot_stops relationship shape
   * only when the normalized public route was not supplied.
   */
  const canonicalStops =
    normalizeCanonicalStops(
      snapshot.stops
    )

  const fallbackSnapshotStops =
    canonicalStops.length > 0
      ? []
      : normalizeSnapshotStops(
          snapshot
            .flow_snapshot_stops
        )

  const renderedStops =
    canonicalStops.length > 0
      ? canonicalStops
      : fallbackSnapshotStops

  const displayedStopCount =
    renderedStops.length > 0
      ? renderedStops.length
      : totalStops > 0
        ? totalStops
        : checkedInCount

  const completed =
    snapshot.status ===
      'completed' ||
    (
      displayedStopCount >
        0 &&
      checkedInCount >=
        displayedStopCount
    )

  const replayable =
    snapshot.replayable ===
      true &&
    snapshot.visibility ===
      'public' &&
    completed

  const sourceLabel =
    getSnapshotSourceLabel(
      snapshot.source_type
    )

  const dateLabel =
    formatSnapshotDate(
      snapshot.created_at
    )

  const hasCanonicalRoute =
    renderedStops.length >=
    2

  return (
    <article
      className={[
        'group relative flex min-w-0 flex-col overflow-hidden rounded-[1.5rem] border border-neutral-800 bg-neutral-950/90 shadow-[0_20px_60px_rgba(0,0,0,0.22)] transition duration-300 hover:border-neutral-700 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative overflow-hidden">
        {hasCanonicalRoute ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-[#05070d]">
            <PublicRoamRoutePreview
              stops={
                renderedStops
              }
              title={
                title
              }
              city={
                city
              }
              showHeader={
                false
              }
              showStopLabels={
                false
              }
              compact
              aspectRatio="wide"
              className="h-full w-full rounded-none border-0"
            />
          </div>
        ) : snapshot.cover_image_url ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
            <img
              src={
                snapshot.cover_image_url
              }
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"
            />
          </div>
        ) : (
          <div className="aspect-[16/10]">
            <SnapshotFallback />
          </div>
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.04]"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="inline-flex min-h-7 items-center rounded-full border border-white/10 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-md">
              {sourceLabel}
            </span>

            {completed ? (
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-950/70 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur-md">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                />

                Completed
              </span>
            ) : null}
          </div>

          {displayedStopCount > 0 ? (
            <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-indigo-400/20 bg-indigo-950/75 px-2.5 py-1 text-[10px] font-semibold text-indigo-100 backdrop-blur-md">
              {displayedStopCount}{' '}
              {displayedStopCount ===
              1
                ? 'stop'
                : 'stops'}
            </span>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="max-w-[92%]">
            <h3 className="line-clamp-2 text-xl font-semibold leading-tight tracking-tight text-white sm:text-[1.35rem]">
              {title}
            </h3>

            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-300">
              {city ? (
                <span className="truncate">
                  {city}
                </span>
              ) : null}

              {city &&
              dateLabel ? (
                <span
                  aria-hidden="true"
                  className="text-neutral-600"
                >
                  ·
                </span>
              ) : null}

              {dateLabel ? (
                <time
                  dateTime={
                    snapshot.created_at
                  }
                  className="shrink-0"
                >
                  {dateLabel}
                </time>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex-1 px-4 py-4 sm:px-5">
          {renderedStops.length >
          0 ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-neutral-600">
                Route
              </p>

              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
                {buildCanonicalRouteSummary(
                  renderedStops
                )}
              </p>
            </div>
          ) : routeSummary ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-neutral-600">
                Route
              </p>

              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-400">
                {routeSummary}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-neutral-600">
                Route
              </p>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {buildRouteFallbackText({
                  city,
                  stopCount:
                    displayedStopCount,
                })}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {displayedStopCount >
            0 ? (
              <SnapshotMetric
                label={
                  displayedStopCount ===
                  1
                    ? '1 stop'
                    : `${displayedStopCount} stops`
                }
              />
            ) : null}

            {hasCanonicalRoute ? (
              <SnapshotMetric
                label="Route preserved"
              />
            ) : null}

            {replayable ? (
              <SnapshotMetric
                label="Replay enabled"
                tone="cyan"
              />
            ) : null}
          </div>
        </div>

        {replayable ? (
          <div className="border-t border-neutral-800 p-4 sm:p-5">
            <ReplayRoamButton
              snapshotId={
                snapshot.id
              }
              className="w-full"
            />
          </div>
        ) : (
          <div className="border-t border-neutral-800 px-4 py-3.5 sm:px-5">
            <p className="text-xs leading-5 text-neutral-600">
              Shared as a Roam
              memory.
            </p>
          </div>
        )}
      </div>
    </article>
  )
}

function SnapshotMetric({
  label,
  tone = 'neutral',
}: {
  label: string
  tone?: 'neutral' | 'cyan'
}) {
  return (
    <span
      className={[
        'inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium',
        tone === 'cyan'
          ? 'border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-300'
          : 'border-neutral-800 bg-neutral-900/70 text-neutral-500',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

function SnapshotFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#05070d]">
      <div
        aria-hidden="true"
        className="absolute left-[-10%] top-[-20%] h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute bottom-[-25%] right-[-5%] h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="relative flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/10 bg-white/[0.04] text-4xl shadow-2xl backdrop-blur"
      >
        🗺️
      </div>
    </div>
  )
}

/*
 * Preferred normalized public-profile route.
 *
 * This is the shape produced by app/u/[username]/page.tsx after
 * loading immutable flow_snapshot_stops and joining venue data.
 */
function normalizeCanonicalStops(
  value:
    | PublicRoamCardCanonicalStop[]
    | null
    | undefined
): PublicRoamRouteStop[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized:
    Array<{
      stop:
        PublicRoamRouteStop

      stopIndex:
        number
    }> = []

  for (
    const row
    of value
  ) {
    if (
      !row ||
      typeof row !==
        'object'
    ) {
      continue
    }

    const venueId =
      normalizeNullableText(
        row.venueId
      )

    if (
      !venueId ||
      typeof row.stopIndex !==
        'number' ||
      !Number.isInteger(
        row.stopIndex
      ) ||
      row.stopIndex <
        0
    ) {
      continue
    }

    const venue =
      row.venue

    if (
      !venue ||
      typeof venue !==
        'object'
    ) {
      continue
    }

    const joinedVenueId =
      normalizeNullableText(
        venue.id
      )

    if (
      !joinedVenueId ||
      joinedVenueId !==
        venueId
    ) {
      continue
    }

    normalized.push({
      stopIndex:
        row.stopIndex,

      stop: {
        id:
          `${venueId}:${row.stopIndex}`,

        venueId,

        stopIndex:
          row.stopIndex,

        stopOrder:
          row.stopIndex +
          1,

        title:
          normalizeNullableText(
            venue.name
          ) ??
          `Stop ${
            row.stopIndex +
            1
          }`,

        city:
          normalizeNullableText(
            venue.city
          ),

        lat:
          normalizeLatitude(
            venue.lat
          ),

        lon:
          normalizeLongitude(
            venue.lon
          ),
      },
    })
  }

  return finalizeCanonicalStops(
    normalized
  )
}

/*
 * Backwards-compatible raw Supabase relationship route.
 */
function normalizeSnapshotStops(
  value:
    | PublicRoamCardSnapshotStop[]
    | null
    | undefined
): PublicRoamRouteStop[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized:
    Array<{
      stop:
        PublicRoamRouteStop

      stopIndex:
        number
    }> = []

  for (
    const row
    of value
  ) {
    if (
      !row ||
      typeof row !==
        'object'
    ) {
      continue
    }

    const venueId =
      normalizeNullableText(
        row.venue_id
      )

    if (
      !venueId ||
      typeof row.stop_index !==
        'number' ||
      !Number.isInteger(
        row.stop_index
      ) ||
      row.stop_index <
        0
    ) {
      continue
    }

    const joinedVenue =
      row.venue ??
      row.venues ??
      null

    const joinedVenueId =
      normalizeNullableText(
        joinedVenue?.id
      )

    if (
      joinedVenueId &&
      joinedVenueId !==
        venueId
    ) {
      continue
    }

    normalized.push({
      stopIndex:
        row.stop_index,

      stop: {
        id:
          `${venueId}:${row.stop_index}`,

        venueId,

        stopIndex:
          row.stop_index,

        stopOrder:
          row.stop_index +
          1,

        title:
          normalizeNullableText(
            joinedVenue?.name
          ) ??
          `Stop ${
            row.stop_index +
            1
          }`,

        city:
          normalizeNullableText(
            joinedVenue?.city
          ),

        lat:
          normalizeLatitude(
            joinedVenue?.lat
          ),

        lon:
          normalizeLongitude(
            joinedVenue?.lon
          ),
      },
    })
  }

  return finalizeCanonicalStops(
    normalized
  )
}

/*
 * Snapshot route integrity:
 *
 * Preserve immutable stop_index ordering and reject malformed
 * gaps or repeated venue IDs rather than silently inventing a
 * different public route.
 */
function finalizeCanonicalStops(
  value:
    Array<{
      stop:
        PublicRoamRouteStop

      stopIndex:
        number
    }>
): PublicRoamRouteStop[] {
  if (
    value.length ===
    0
  ) {
    return []
  }

  const ordered =
    [...value].sort(
      (
        first,
        second
      ) =>
        first.stopIndex -
        second.stopIndex
    )

  const seenVenueIds =
    new Set<string>()

  const result:
    PublicRoamRouteStop[] =
    []

  for (
    let index = 0;
    index <
    ordered.length;
    index += 1
  ) {
    const entry =
      ordered[index]

    /*
     * Canonical snapshot routes are expected to be contiguous:
     *
     * 0, 1, 2, ...
     *
     * If that invariant is broken, do not present a reconstructed
     * route as though it were canonical.
     */
    if (
      entry.stopIndex !==
      index
    ) {
      return []
    }

    const venueId =
      normalizeNullableText(
        entry.stop
          .venueId
      )

    if (
      !venueId ||
      seenVenueIds.has(
        venueId
      )
    ) {
      return []
    }

    seenVenueIds.add(
      venueId
    )

    result.push({
      ...entry.stop,

      stopIndex:
        index,

      stopOrder:
        index + 1,
    })
  }

  return result
}

function buildCanonicalRouteSummary(
  stops:
    PublicRoamRouteStop[]
): string {
  const labels =
    stops
      .map(
        (
          stop,
          index
        ) =>
          normalizeNullableText(
            stop.title
          ) ??
          `Stop ${index + 1}`
      )

  if (
    labels.length ===
    0
  ) {
    return 'Canonical route preserved from this Roam.'
  }

  return labels.join(
    ' → '
  )
}

function getSnapshotSourceLabel(
  sourceType: string | null
): string {
  if (
    sourceType ===
    'roam_history'
  ) {
    return 'Roam day'
  }

  if (
    sourceType ===
    'hosted_flow'
  ) {
    return 'Hosted Flow'
  }

  if (
    sourceType ===
    'active_flow'
  ) {
    return 'Flow'
  }

  return 'Roam'
}

function buildRouteFallbackText({
  city,
  stopCount,
}: {
  city: string | null
  stopCount: number
}): string {
  if (
    city &&
    stopCount > 0
  ) {
    return `${stopCount} ${
      stopCount === 1
        ? 'stop'
        : 'stops'
    } completed across ${city}.`
  }

  if (stopCount > 0) {
    return `${stopCount} ${
      stopCount === 1
        ? 'stop'
        : 'stops'
    } completed on this Roam.`
  }

  if (city) {
    return `A completed Roam through ${city}.`
  }

  return 'A completed route preserved from this Roam.'
}

function formatSnapshotDate(
  value: string
): string | null {
  if (
    typeof value !==
      'string' ||
    value.trim().length ===
      0
  ) {
    return null
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric',

      year:
        'numeric',
    }
  ).format(date)
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeNonNegativeInteger(
  value: unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(
      value
    )
  )
}

function normalizeLatitude(
  value: unknown
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -90 &&
    value <= 90
  )
    ? value
    : null
}

function normalizeLongitude(
  value: unknown
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    ) &&
    value >= -180 &&
    value <= 180
  )
    ? value
    : null
}