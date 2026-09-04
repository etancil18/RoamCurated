"use client"

import {
  useEffect,
  useMemo,
  useState,
} from "react"

import { useRouter } from "next/navigation"

import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"

import {
  CARTO_DARK_BASEMAP_URL,
  CARTO_BASEMAP_ATTRIBUTION,
} from '@/lib/maps/basemaps'

import RouteControl from "@/components/RouteControl"
import { Button } from "@/components/ui/button"
import { logEvent } from "@/lib/logEvent"

import "leaflet/dist/leaflet.css"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type OutingMode =
  | "before"
  | "after"
  | "full"

type OutingPhase =
  | "before"
  | "after"

type MapTravelMode =
  | "walking"
  | "driving"

type Anchor = {
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

type Stop = {
  id: string
  venueId: string
  stopOrder: number

  role: string

  phase?: OutingPhase | string | null
  slotPhase?: OutingPhase | string | null
  slotIndex?: number | null

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

type Props = {
  plannedOutingId: string
  eventId: string
  city: string

  mode: OutingMode

  status: string | null
  summary: string | null

  anchor: Anchor
  stops: Stop[]
}

type RouteVenue = {
  id: string
  name: string

  lat: number
  lon: number

  city: string
  link: string

  phase: OutingPhase | null
  stopOrder: number | null
}

type RouteTimelineItem =
  | {
      kind: "anchor"
      key: string
    }
  | {
      kind: "stop"
      key: string
      stop: Stop
      index: number
    }

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------

function safeLogEvent(
  eventName: string,
  metadata: Record<string, unknown> = {}
): void {
  try {
    void Promise.resolve(
      logEvent(eventName, {
        metadata,
      })
    )
  } catch (error) {
    console.warn(
      "logEvent failed:",
      eventName,
      error
    )
  }
}

// -----------------------------------------------------------------------------
// Map layers
// -----------------------------------------------------------------------------

function RoutingLayer({
  routeStops,
  anchorVenue,
  mode,
  travelMode,
}: {
  routeStops: RouteVenue[]
  anchorVenue: RouteVenue | null
  mode: OutingMode
  travelMode: MapTravelMode
}) {
  const map = useMap()

  if (
    !map ||
    !anchorVenue ||
    routeStops.length < 1
  ) {
    return null
  }

  const route = buildDisplayRoute({
    mode,
    anchorVenue,
    routeStops,
  }).filter(
    (venue) =>
      Number.isFinite(venue.lat) &&
      Number.isFinite(venue.lon)
  )

  if (route.length < 2) {
    return null
  }

  return (
    <RouteControl
      map={map}
      route={route}
      travelMode={travelMode}
    />
  )
}

function FitRouteBounds({
  anchorVenue,
  routeStops,
}: {
  anchorVenue: RouteVenue | null
  routeStops: RouteVenue[]
}) {
  const map = useMap()

  const coordinateKey = useMemo(() => {
    return [
      anchorVenue
        ? `${anchorVenue.lat}:${anchorVenue.lon}`
        : "",
      ...routeStops.map(
        (stop) =>
          `${stop.lat}:${stop.lon}`
      ),
    ].join("|")
  }, [
    anchorVenue,
    routeStops,
  ])

  useEffect(() => {
    const coordinates: Array<
      [number, number]
    > = []

    if (anchorVenue) {
      coordinates.push([
        anchorVenue.lat,
        anchorVenue.lon,
      ])
    }

    for (const stop of routeStops) {
      coordinates.push([
        stop.lat,
        stop.lon,
      ])
    }

    if (coordinates.length === 0) {
      return
    }

    if (coordinates.length === 1) {
      map.setView(
        coordinates[0],
        15,
        {
          animate: false,
        }
      )

      return
    }

    map.fitBounds(
      coordinates,
      {
        padding: [36, 36],
        maxZoom: 15,
        animate: false,
      }
    )
  }, [
    map,
    coordinateKey,
    anchorVenue,
    routeStops,
  ])

  return null
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function OutingMap({
  plannedOutingId,
  eventId,
  city,
  mode,
  anchor,
  stops,
}: Props) {
  const router = useRouter()

  const [travelMode, setTravelMode] =
    useState<MapTravelMode>("walking")

  const [orderedStops, setOrderedStops] =
    useState<Stop[]>(() =>
      orderStopsForDisplay(
        stops,
        mode
      )
    )

  useEffect(() => {
    setOrderedStops(
      orderStopsForDisplay(
        stops,
        mode
      )
    )
  }, [
    stops,
    mode,
  ])

  useEffect(() => {
    if (
      typeof window === "undefined"
    ) {
      return
    }

    const L = require("leaflet")

    delete (
      L.Icon.Default.prototype as {
        _getIconUrl?: unknown
      }
    )._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",

      iconUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",

      shadowUrl:
        "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png",
    })
  }, [])

  const anchorVenue =
    useMemo<RouteVenue | null>(() => {
      if (
        !hasValidCoordinates(
          anchor.venue
        )
      ) {
        return null
      }

      return {
        id:
          anchor.venue.id ??
          "anchor-event",

        name:
          anchor.venue.name ??
          anchor.title ??
          "Event",

        lat:
          anchor.venue.lat,

        lon:
          anchor.venue.lon,

        city:
          anchor.venue.city ??
          city,

        link: "#",

        phase: null,
        stopOrder: null,
      }
    }, [
      anchor,
      city,
    ])

  const routeStops =
    useMemo<RouteVenue[]>(() => {
      return orderedStops
        .map(
          (
            stop,
            index
          ): RouteVenue | null => {
            if (
              !hasValidCoordinates(
                stop.venue
              )
            ) {
              return null
            }

            return {
              id: stop.id,

              name:
                stop.title ??
                stop.venue.name ??
                `Stop ${stop.stopOrder}`,

              lat:
                stop.venue.lat,

              lon:
                stop.venue.lon,

              city:
                stop.venue.city ??
                city,

              link: "#",

              phase:
                resolveStopPhase({
                  stop,
                  mode,
                  index,
                  totalStops:
                    orderedStops.length,
                }),

              stopOrder:
                stop.stopOrder,
            }
          }
        )
        .filter(
          (
            stop
          ): stop is RouteVenue =>
            stop != null
        )
    }, [
      orderedStops,
      city,
      mode,
    ])

  const center: [number, number] =
    anchorVenue
      ? [
          anchorVenue.lat,
          anchorVenue.lon,
        ]
      : routeStops[0]
        ? [
            routeStops[0].lat,
            routeStops[0].lon,
          ]
        : [0, 0]

  const timelineItems =
    useMemo<RouteTimelineItem[]>(
      () =>
        buildRouteTimeline({
          mode,
          orderedStops,
        }),
      [
        mode,
        orderedStops,
      ]
    )

  function anchorIcon() {
    const L = require("leaflet")

    return L.divIcon({
      className:
        "outing-anchor-marker",

      html: `
        <div style="
          background:#06b6d4;
          color:white;
          border-radius:999px;
          min-width:54px;
          height:28px;
          padding:0 10px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:700;
          font-size:11px;
          letter-spacing:.04em;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          EVENT
        </div>
      `,

      iconSize: [54, 28],
      iconAnchor: [27, 28],
    })
  }

  function numberedIcon(
    index: number,
    phase: OutingPhase | null
  ) {
    const L = require("leaflet")

    const background =
      phase === "before"
        ? "#f59e0b"
        : phase === "after"
          ? "#22c55e"
          : "#8b5cf6"

    return L.divIcon({
      className:
        "outing-stop-marker",

      html: `
        <div style="
          background:${background};
          color:white;
          border-radius:50%;
          width:28px;
          height:28px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:600;
          font-size:13px;
          border:2px solid white;
          box-shadow:0 0 4px rgba(0,0,0,0.4);
        ">
          ${index}
        </div>
      `,

      iconSize: [28, 28],
      iconAnchor: [14, 28],
    })
  }

  function baseLogMetadata(): Record<
    string,
    unknown
  > {
    const beforeStopCount =
      orderedStops.filter(
        (
          stop,
          index
        ) =>
          resolveStopPhase({
            stop,
            mode,
            index,
            totalStops:
              orderedStops.length,
          }) === "before"
      ).length

    const afterStopCount =
      orderedStops.filter(
        (
          stop,
          index
        ) =>
          resolveStopPhase({
            stop,
            mode,
            index,
            totalStops:
              orderedStops.length,
          }) === "after"
      ).length

    return {
      planned_outing_id:
        plannedOutingId,

      event_id:
        eventId,

      city,
      mode,

      travel_mode:
        travelMode,

      stop_count:
        routeStops.length,

      before_stop_count:
        beforeStopCount,

      after_stop_count:
        afterStopCount,

      event_archetype:
        orderedStops[0]
          ?.eventArchetype ??
        null,
    }
  }

  function canMoveStop(
    index: number,
    direction: -1 | 1
  ): boolean {
    const targetIndex =
      index + direction

    if (
      targetIndex < 0 ||
      targetIndex >=
        orderedStops.length
    ) {
      return false
    }

    if (mode !== "full") {
      return true
    }

    const currentPhase =
      resolveStopPhase({
        stop:
          orderedStops[index],
        mode,
        index,
        totalStops:
          orderedStops.length,
      })

    const targetPhase =
      resolveStopPhase({
        stop:
          orderedStops[
            targetIndex
          ],
        mode,
        index: targetIndex,
        totalStops:
          orderedStops.length,
      })

    return (
      currentPhase ===
      targetPhase
    )
  }

  function moveStopUp(
    index: number
  ) {
    if (
      !canMoveStop(
        index,
        -1
      )
    ) {
      return
    }

    const stop =
      orderedStops[index]

    safeLogEvent(
      "outing_stop_reordered",
      {
        ...baseLogMetadata(),

        direction: "up",

        from_index:
          index,

        to_index:
          index - 1,

        stop_id:
          stop?.id,

        stop_phase:
          stop
            ? resolveStopPhase({
                stop,
                mode,
                index,
                totalStops:
                  orderedStops.length,
              })
            : null,

        semantic_role:
          stop?.semanticRole ??
          null,
      }
    )

    setOrderedStops(
      (previousStops) => {
        const next =
          [...previousStops]

        const temporary =
          next[index - 1]

        next[index - 1] =
          next[index]

        next[index] =
          temporary

        return next.map(
          (
            currentStop,
            currentIndex
          ) => ({
            ...currentStop,
            stopOrder:
              currentIndex + 1,
          })
        )
      }
    )
  }

  function moveStopDown(
    index: number
  ) {
    if (
      !canMoveStop(
        index,
        1
      )
    ) {
      return
    }

    const stop =
      orderedStops[index]

    safeLogEvent(
      "outing_stop_reordered",
      {
        ...baseLogMetadata(),

        direction: "down",

        from_index:
          index,

        to_index:
          index + 1,

        stop_id:
          stop?.id,

        stop_phase:
          stop
            ? resolveStopPhase({
                stop,
                mode,
                index,
                totalStops:
                  orderedStops.length,
              })
            : null,

        semantic_role:
          stop?.semanticRole ??
          null,
      }
    )

    setOrderedStops(
      (previousStops) => {
        const next =
          [...previousStops]

        const temporary =
          next[index + 1]

        next[index + 1] =
          next[index]

        next[index] =
          temporary

        return next.map(
          (
            currentStop,
            currentIndex
          ) => ({
            ...currentStop,
            stopOrder:
              currentIndex + 1,
          })
        )
      }
    )
  }

  function goBackToEvent() {
    safeLogEvent(
      "outing_back_to_events_clicked",
      baseLogMetadata()
    )

    router.push("/events")
  }

  function changeTravelMode(
    nextTravelMode: MapTravelMode
  ) {
    if (
      nextTravelMode ===
      travelMode
    ) {
      return
    }

    safeLogEvent(
      "outing_travel_mode_changed",
      {
        ...baseLogMetadata(),

        previous_travel_mode:
          travelMode,

        selected_travel_mode:
          nextTravelMode,
      }
    )

    setTravelMode(
      nextTravelMode
    )
  }

  function formatStopMeta(
    stop: Stop
  ): string {
    const parts: string[] = []

    if (
      stop.plannedArrivalAt
    ) {
      const arrivalDate =
        new Date(
          stop.plannedArrivalAt
        )

      if (
        !Number.isNaN(
          arrivalDate.getTime()
        )
      ) {
        parts.push(
          `Arrive around ${arrivalDate.toLocaleTimeString(
            "en-US",
            {
              hour: "numeric",
              minute: "2-digit",
            }
          )}`
        )
      }
    }

    if (
      typeof stop
        .travelMinutesFromPrev ===
        "number" &&
      Number.isFinite(
        stop.travelMinutesFromPrev
      )
    ) {
      parts.push(
        `${Math.max(
          0,
          Math.round(
            stop.travelMinutesFromPrev
          )
        )} min from previous stop`
      )
    }

    return parts.join(" • ")
  }

  function renderAnchorCard() {
    if (!anchorVenue) {
      return null
    }

    return (
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-500">
            Event
          </span>

          <p className="text-sm font-medium text-foreground">
            {anchor.title ??
              anchorVenue.name}
          </p>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {anchorVenue.name}

          {anchor.venue?.address
            ? ` • ${anchor.venue.address}`
            : ""}
        </p>
      </div>
    )
  }

  function renderStopCard(
    stop: Stop,
    index: number
  ) {
    const phase =
      resolveStopPhase({
        stop,
        mode,
        index,
        totalStops:
          orderedStops.length,
      })

    const stopMeta =
      formatStopMeta(stop)

    return (
      <div
        key={`${stop.id}-${index}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={
                phase === "before"
                  ? "inline-flex shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500"
                  : "inline-flex shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-500"
              }
            >
              {phase}
            </span>

            <p className="truncate text-sm font-medium text-foreground">
              {index + 1}.{" "}
              {stop.title ??
                stop.venue?.name ??
                "Stop"}
            </p>
          </div>

          {stopMeta ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {stopMeta}
            </p>
          ) : null}

          {stop.displayType ||
          stop.venueType ||
          stop.role ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {stop.displayType ??
                stop.venueType ??
                formatRoleLabel(
                  stop.role
                )}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              moveStopUp(index)
            }
            disabled={
              !canMoveStop(
                index,
                -1
              )
            }
            aria-label={`Move ${
              stop.title ??
              stop.venue?.name ??
              `stop ${index + 1}`
            } earlier`}
          >
            ↑
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              moveStopDown(index)
            }
            disabled={
              !canMoveStop(
                index,
                1
              )
            }
            aria-label={`Move ${
              stop.title ??
              stop.venue?.name ??
              `stop ${index + 1}`
            } later`}
          >
            ↓
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="h-[420px] overflow-hidden rounded-xl border border-border bg-card sm:h-[500px]">
        <MapContainer
          center={center}
          zoom={15}
          style={{
            height: "100%",
            width: "100%",
          }}
          scrollWheelZoom={true}
        >
          <TileLayer
            url={CARTO_DARK_BASEMAP_URL}
            attribution={CARTO_BASEMAP_ATTRIBUTION}
          />

          {anchorVenue ? (
            <Marker
              position={[
                anchorVenue.lat,
                anchorVenue.lon,
              ]}
              icon={anchorIcon()}
            >
              <Tooltip>
                {anchor.title ??
                  "Event"}

                {anchorVenue.name
                  ? ` • ${anchorVenue.name}`
                  : ""}
              </Tooltip>
            </Marker>
          ) : null}

          {orderedStops.map(
            (
              stop,
              index
            ) => {
              if (
                !hasValidCoordinates(
                  stop.venue
                )
              ) {
                return null
              }

              const phase =
                resolveStopPhase({
                  stop,
                  mode,
                  index,
                  totalStops:
                    orderedStops.length,
                })

              return (
                <Marker
                  key={stop.id}
                  position={[
                    stop.venue.lat,
                    stop.venue.lon,
                  ]}
                  icon={numberedIcon(
                    index + 1,
                    phase
                  )}
                >
                  <Tooltip>
                    {index + 1}.{" "}
                    {stop.title ??
                      stop.venue
                        .name ??
                      "Stop"}

                    {phase
                      ? ` • ${formatPhaseLabel(
                          phase
                        )}`
                      : ""}
                  </Tooltip>
                </Marker>
              )
            }
          )}

          <RoutingLayer
            routeStops={
              routeStops
            }
            anchorVenue={
              anchorVenue
            }
            mode={mode}
            travelMode={
              travelMode
            }
          />

          <FitRouteBounds
            anchorVenue={
              anchorVenue
            }
            routeStops={
              routeStops
            }
          />
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant={
            travelMode ===
            "walking"
              ? "default"
              : "outline"
          }
          onClick={() =>
            changeTravelMode(
              "walking"
            )
          }
          className="w-full"
        >
          Walking Route
        </Button>

        <Button
          variant={
            travelMode ===
            "driving"
              ? "default"
              : "outline"
          }
          onClick={() =>
            changeTravelMode(
              "driving"
            )
          }
          className="w-full"
        >
          Driving Route
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="font-medium text-foreground">
            Route Stops
          </p>

          <p className="text-sm text-muted-foreground">
            Review your route,
            adjust stops within
            their phase, and start
            when you&apos;re ready.
          </p>
        </div>

        <div className="space-y-2">
          {timelineItems.map(
            (item) => {
              if (
                item.kind ===
                "anchor"
              ) {
                return (
                  <div key={item.key}>
                    {renderAnchorCard()}
                  </div>
                )
              }

              return renderStopCard(
                item.stop,
                item.index
              )
            }
          )}
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={
          goBackToEvent
        }
        className="w-full"
      >
        Back to Events
      </Button>

      {orderedStops.length ===
      0 ? (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No mapped outing stops
          available yet.
        </div>
      ) : null}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Route composition
// -----------------------------------------------------------------------------

function buildDisplayRoute({
  mode,
  anchorVenue,
  routeStops,
}: {
  mode: OutingMode
  anchorVenue: RouteVenue
  routeStops: RouteVenue[]
}): RouteVenue[] {
  if (mode === "before") {
    return [
      ...routeStops,
      anchorVenue,
    ]
  }

  if (mode === "after") {
    return [
      anchorVenue,
      ...routeStops,
    ]
  }

  const beforeStops =
    routeStops.filter(
      (stop) =>
        stop.phase ===
        "before"
    )

  const afterStops =
    routeStops.filter(
      (stop) =>
        stop.phase ===
        "after"
    )

  const unresolvedStops =
    routeStops.filter(
      (stop) =>
        stop.phase == null
    )

  return [
    ...beforeStops,
    anchorVenue,
    ...afterStops,
    ...unresolvedStops,
  ]
}

function buildRouteTimeline({
  mode,
  orderedStops,
}: {
  mode: OutingMode
  orderedStops: Stop[]
}): RouteTimelineItem[] {
  if (mode === "before") {
    return [
      ...orderedStops.map(
        (
          stop,
          index
        ): RouteTimelineItem => ({
          kind: "stop",
          key: `stop:${stop.id}:${index}`,
          stop,
          index,
        })
      ),

      {
        kind: "anchor",
        key: "anchor",
      },
    ]
  }

  if (mode === "after") {
    return [
      {
        kind: "anchor",
        key: "anchor",
      },

      ...orderedStops.map(
        (
          stop,
          index
        ): RouteTimelineItem => ({
          kind: "stop",
          key: `stop:${stop.id}:${index}`,
          stop,
          index,
        })
      ),
    ]
  }

  const beforeItems:
    RouteTimelineItem[] = []

  const afterItems:
    RouteTimelineItem[] = []

  for (
    let index = 0;
    index <
    orderedStops.length;
    index += 1
  ) {
    const stop =
      orderedStops[index]

    const phase =
      resolveStopPhase({
        stop,
        mode,
        index,
        totalStops:
          orderedStops.length,
      })

    const item:
      RouteTimelineItem = {
      kind: "stop",
      key: `stop:${stop.id}:${index}`,
      stop,
      index,
    }

    if (
      phase === "before"
    ) {
      beforeItems.push(item)
    } else {
      afterItems.push(item)
    }
  }

  return [
    ...beforeItems,

    {
      kind: "anchor",
      key: "anchor",
    },

    ...afterItems,
  ]
}

// -----------------------------------------------------------------------------
// Ordering and phase resolution
// -----------------------------------------------------------------------------

function orderStopsForDisplay(
  stops: Stop[],
  mode: OutingMode
): Stop[] {
  const stableStops =
    [...stops].sort(
      (
        first,
        second
      ) => {
        const orderDelta =
          finiteStopOrder(
            first.stopOrder
          ) -
          finiteStopOrder(
            second.stopOrder
          )

        if (
          orderDelta !== 0
        ) {
          return orderDelta
        }

        return first.id.localeCompare(
          second.id
        )
      }
    )

  if (
    mode !== "full"
  ) {
    return stableStops.map(
      (
        stop,
        index
      ) => ({
        ...stop,
        stopOrder:
          index + 1,
      })
    )
  }

  const beforeStops: Stop[] =
    []

  const afterStops: Stop[] =
    []

  stableStops.forEach(
    (
      stop,
      index
    ) => {
      const phase =
        resolveStopPhase({
          stop,
          mode,
          index,
          totalStops:
            stableStops.length,
        })

      if (
        phase === "before"
      ) {
        beforeStops.push(stop)
      } else {
        afterStops.push(stop)
      }
    }
  )

  return [
    ...beforeStops,
    ...afterStops,
  ].map(
    (
      stop,
      index
    ) => ({
      ...stop,
      stopOrder:
        index + 1,
    })
  )
}

function resolveStopPhase({
  stop,
  mode,
  index,
  totalStops,
}: {
  stop: Stop
  mode: OutingMode
  index: number
  totalStops: number
}): OutingPhase {
  const explicitPhase =
    normalizePhase(
      stop.phase
    ) ??
    normalizePhase(
      stop.slotPhase
    )

  if (explicitPhase) {
    return explicitPhase
  }

  if (mode === "before") {
    return "before"
  }

  if (mode === "after") {
    return "after"
  }

  /*
   * Legacy fallback only.
   *
   * New planner responses should always carry phase or slotPhase. For older
   * stored outings, retain the previous first-stop-before behavior rather than
   * failing to render the route.
   */
  if (
    totalStops > 0 &&
    index === 0
  ) {
    return "before"
  }

  return "after"
}

function normalizePhase(
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
// Presentation helpers
// -----------------------------------------------------------------------------

function formatPhaseLabel(
  phase: OutingPhase
): string {
  return phase === "before"
    ? "Before event"
    : "After event"
}

function formatRoleLabel(
  role: string
): string {
  return role
    .trim()
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    )
}

function finiteStopOrder(
  value: number
): number {
  return Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER
}

// -----------------------------------------------------------------------------
// Coordinate guards
// -----------------------------------------------------------------------------

function hasValidCoordinates(
  venue:
    | Stop["venue"]
    | Anchor["venue"]
    | null
    | undefined
): venue is NonNullable<
  Stop["venue"]
> & {
  lat: number
  lon: number
} {
  return (
    venue != null &&
    typeof venue.lat ===
      "number" &&
    Number.isFinite(
      venue.lat
    ) &&
    typeof venue.lon ===
      "number" &&
    Number.isFinite(
      venue.lon
    )
  )
}