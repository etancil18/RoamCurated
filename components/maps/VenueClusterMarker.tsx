'use client'

import {
  Marker,
  Tooltip,
  useMap,
} from 'react-leaflet'
import {
  useCallback,
  useMemo,
} from 'react'
import type {
  DivIcon,
  LeafletMouseEvent,
} from 'leaflet'

import type {
  VenueCluster,
} from '@/lib/maps/clustering'
import {
  getClusterBoundsCoordinates,
  getClusterExpansionZoom,
  getClusterLabel,
} from '@/lib/maps/clustering'

export type VenueClusterMarkerInteractionContext =
  | 'default'
  | 'creator-exploration-map'

export type VenueClusterMarkerProps = {
  cluster: VenueCluster

  /**
   * Optional visual scale supplied by MapCanvas.
   */
  markerScale?: number

  /**
   * Explicit selected state in addition to any selected venue contained
   * within the cluster.
   */
  selected?: boolean

  /**
   * Called immediately before the default map-expansion behavior.
   */
  onExpand?: (
    cluster: VenueCluster
  ) => void

  /**
   * Set this only when the parent owns cluster expansion.
   */
  disableDefaultExpansion?: boolean

  /**
   * Obstruction-aware map padding.
   */
  paddingTopLeft?: [
    number,
    number,
  ]

  paddingBottomRight?: [
    number,
    number,
  ]

  /**
   * Identifies the surface that owns this cluster marker.
   *
   * Creator Exploration Map callers should pass:
   *
   *   interactionContext="creator-exploration-map"
   *
   * Existing callers may omit this prop and retain the current
   * visual and interaction behavior.
   */
  interactionContext?:
    VenueClusterMarkerInteractionContext

  zIndexOffset?: number
  className?: string
}

function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(
      (
        value
      ): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0
    )
    .join(' ')
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  )
}

function escapeHtml(
  value: string
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatClusterCount(
  count: number
): string {
  if (count > 999) {
    return '999+'
  }

  if (count > 99) {
    return '99+'
  }

  return String(count)
}

function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !==
      'function'
  ) {
    return false
  }

  return window
    .matchMedia(
      '(prefers-reduced-motion: reduce)'
    )
    .matches
}

export default function VenueClusterMarker({
  cluster,
  markerScale = 1,
  selected = false,
  onExpand,
  disableDefaultExpansion = false,
  paddingTopLeft = [56, 96],
  paddingBottomRight = [56, 112],
  interactionContext = 'default',
  zIndexOffset,
  className,
}: VenueClusterMarkerProps) {
  const map = useMap()

  const isCreatorExplorationMap =
    interactionContext ===
    'creator-exploration-map'

  const isSelected =
    selected ||
    cluster.hasSelectedVenue

  const safeScale = clamp(
    Number.isFinite(
      markerScale
    )
      ? markerScale
      : 1,
    0.72,
    1.3
  )

  const accessibleLabel =
    useMemo(
      () =>
        getClusterLabel(
          cluster
        ),
      [cluster]
    )

  const icon =
    useMemo<DivIcon | null>(() => {
      if (
        typeof window ===
        'undefined'
      ) {
        return null
      }

      const L =
        require('leaflet')

      const baseSize =
        isSelected
          ? 58
          : cluster.count >= 25
            ? 54
            : 50

      const iconSize =
        Math.round(
          baseSize *
            safeScale
        )

      const countLabel =
        formatClusterCount(
          cluster.count
        )

      const eventLabel =
        cluster.liveEventCount >
        0
          ? formatClusterCount(
              cluster.liveEventCount
            )
          : null

      const markerClasses =
        joinClassNames(
          'roam-cluster-marker',
          isSelected &&
            'roam-cluster-marker--selected',
          cluster.hasLiveEvent &&
            'roam-cluster-marker--event',
          cluster.hasRouteVenue &&
            'roam-cluster-marker--route',
          cluster.hasSearchMatch &&
            'roam-cluster-marker--search',
          isCreatorExplorationMap &&
            'roam-cluster-marker--creator-exploration',
          className
        )

      const safeLabel =
        escapeHtml(
          accessibleLabel
        )

      const safeInteractionContext =
        escapeHtml(
          interactionContext
        )

      return L.divIcon({
        className:
          'roam-cluster-marker-container',
        html: `
          <div
            class="${markerClasses}"
            style="
              --roam-cluster-scale:${safeScale};
              width:${iconSize}px;
              height:${iconSize}px;
            "
            role="button"
            aria-label="${safeLabel}"
            title="${safeLabel}"
            data-roam-map-context="${safeInteractionContext}"
          >
            <span
              class="roam-cluster-marker__halo"
              aria-hidden="true"
            ></span>

            <span
              class="roam-cluster-marker__surface"
              aria-hidden="true"
            >
              <span
                class="roam-cluster-marker__count"
              >
                ${countLabel}
              </span>

              <span
                class="roam-cluster-marker__label"
              >
                places
              </span>
            </span>

            ${
              eventLabel
                ? `
                  <span
                    class="roam-cluster-marker__event-badge"
                    aria-hidden="true"
                  >
                    ${eventLabel}
                  </span>
                `
                : ''
            }

            ${
              cluster.hasRouteVenue
                ? `
                  <span
                    class="roam-cluster-marker__route-indicator"
                    aria-hidden="true"
                  ></span>
                `
                : ''
            }
          </div>
        `,
        iconSize: [
          iconSize,
          iconSize,
        ],
        iconAnchor: [
          Math.round(
            iconSize / 2
          ),
          Math.round(
            iconSize / 2
          ),
        ],
        tooltipAnchor: [
          0,
          -Math.round(
            iconSize / 2
          ),
        ],
      })
    }, [
      accessibleLabel,
      className,
      cluster.count,
      cluster.hasLiveEvent,
      cluster.hasRouteVenue,
      cluster.hasSearchMatch,
      cluster.liveEventCount,
      interactionContext,
      isCreatorExplorationMap,
      isSelected,
      safeScale,
    ])

  const resolvedZIndexOffset =
    zIndexOffset ??
    (
      isSelected
        ? 900
        : cluster.hasRouteVenue
          ? 700
          : cluster.hasLiveEvent
            ? 500
            : cluster.hasSearchMatch
              ? 400
              : 250
    )

  const handleExpand =
    useCallback(
      (
        event:
          LeafletMouseEvent
      ) => {
        event.originalEvent
          ?.preventDefault()

        event.originalEvent
          ?.stopPropagation()

        onExpand?.(
          cluster
        )

        if (
          disableDefaultExpansion
        ) {
          return
        }

        const [
          southWest,
          northEast,
        ] =
          getClusterBoundsCoordinates(
            cluster
          )

        const south =
          southWest[0]

        const west =
          southWest[1]

        const north =
          northEast[0]

        const east =
          northEast[1]

        const targetZoom =
          getClusterExpansionZoom(
            map.getZoom(),
            cluster.count
          )

        const reduceMotion =
          prefersReducedMotion()

        const isDegenerateBounds =
          south === north &&
          west === east

        if (
          isDegenerateBounds
        ) {
          map.flyTo(
            [
              cluster.center.lat,
              cluster.center.lon,
            ],
            targetZoom,
            {
              animate:
                !reduceMotion,
              duration:
                reduceMotion
                  ? 0
                  : 0.55,
            }
          )

          return
        }

        map.flyToBounds(
          [
            [
              south,
              west,
            ],
            [
              north,
              east,
            ],
          ],
          {
            paddingTopLeft,
            paddingBottomRight,
            maxZoom:
              targetZoom,
            animate:
              !reduceMotion,
            duration:
              reduceMotion
                ? 0
                : 0.65,
          }
        )
      },
      [
        cluster,
        disableDefaultExpansion,
        map,
        onExpand,
        paddingBottomRight,
        paddingTopLeft,
      ]
    )

  if (!icon) {
    return null
  }

  return (
    <Marker
      position={[
        cluster.center.lat,
        cluster.center.lon,
      ]}
      icon={icon}
      zIndexOffset={
        resolvedZIndexOffset
      }
      keyboard
      riseOnHover
      riseOffset={250}
      eventHandlers={{
        click:
          handleExpand,

        keydown: (
          event: any
        ) => {
          const originalEvent =
            event.originalEvent as
              | KeyboardEvent
              | undefined

          if (
            originalEvent?.key ===
              'Enter' ||
            originalEvent?.key ===
              ' '
          ) {
            handleExpand(
              event as LeafletMouseEvent
            )
          }
        },
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -8]}
        opacity={0.96}
      >
        <div className="min-w-[132px] text-center">
          <strong className="block text-xs font-black">
            {cluster.count}{' '}
            {isCreatorExplorationMap
              ? 'explored places'
              : 'curated places'}
          </strong>

          {cluster.liveEventCount >
            0 && (
            <span className="mt-0.5 block text-[11px] text-violet-300">
              {
                cluster.liveEventCount
              }{' '}
              with events
            </span>
          )}

          <span className="mt-1 block text-[10px] text-zinc-400">
            Select to explore
          </span>
        </div>
      </Tooltip>
    </Marker>
  )
}