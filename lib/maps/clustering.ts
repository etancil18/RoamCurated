import type { Venue } from '@/types/venue'

export type ClusterCoordinate = {
  lat: number
  lon: number
}

export type VenueCluster = {
  id: string
  venues: Venue[]
  count: number

  center: ClusterCoordinate

  bounds: {
    north: number
    south: number
    east: number
    west: number
  }

  hasLiveEvent: boolean
  liveEventCount: number

  hasSelectedVenue: boolean
  hasRouteVenue: boolean
  hasSearchMatch: boolean

  priorityScore: number
}

export type ClusterVenuesOptions = {
  zoom: number

  /**
   * Optional override for the grid cell size.
   *
   * Values represent approximate degrees of latitude and longitude.
   */
  cellSize?: number

  /**
   * Prevents distant venues from being grouped into an overly broad cluster.
   *
   * Defaults to the active cell size.
   */
  maxClusterSpan?: number

  /**
   * Venue IDs that currently have one or more relevant events.
   */
  liveEventVenueIds?: ReadonlySet<string>

  /**
   * Optional event counts by venue ID.
   */
  liveEventCountByVenueId?: ReadonlyMap<string, number>

  /**
   * Active route membership.
   */
  routeVenueIds?: ReadonlySet<string>

  /**
   * Search matches currently being highlighted.
   */
  searchMatchVenueIds?: ReadonlySet<string>

  /**
   * Currently selected venue.
   */
  selectedVenueId?: string | null

  /**
   * Minimum number of venues required before producing a cluster.
   *
   * Groups smaller than this are returned as individual venues.
   */
  minimumClusterSize?: number
}

export type ClusterVenuesResult = {
  clusters: VenueCluster[]
  unclusteredVenues: Venue[]
}

type WorkingCluster = {
  key: string
  venues: Venue[]
  latTotal: number
  lonTotal: number
  north: number
  south: number
  east: number
  west: number
}

const DEFAULT_MINIMUM_CLUSTER_SIZE = 2

const ZOOM_CELL_SIZE: ReadonlyArray<{
  maxZoomExclusive: number
  cellSize: number
}> = [
  {
    maxZoomExclusive: 10,
    cellSize: 1.1,
  },
  {
    maxZoomExclusive: 11,
    cellSize: 0.55,
  },
  {
    maxZoomExclusive: 12,
    cellSize: 0.24,
  },
  {
    maxZoomExclusive: 13,
    cellSize: 0.11,
  },
  {
    maxZoomExclusive: 14,
    cellSize: 0.055,
  },
  {
    maxZoomExclusive: 15,
    cellSize: 0.025,
  },
  {
    maxZoomExclusive: 16,
    cellSize: 0.012,
  },
  {
    maxZoomExclusive: 17,
    cellSize: 0.006,
  },
  {
    maxZoomExclusive: Number.POSITIVE_INFINITY,
    cellSize: 0.003,
  },
]

function getVenueId(
  venue: Venue
): string | null {
  if (
    typeof venue.id === 'string' &&
    venue.id.trim().length > 0
  ) {
    return venue.id
  }

  if (
    typeof venue.slug === 'string' &&
    venue.slug.trim().length > 0
  ) {
    return venue.slug
  }

  if (
    typeof venue.name === 'string' &&
    venue.name.trim().length > 0
  ) {
    return venue.name
  }

  return null
}

function isValidCoordinate(
  venue: Venue
): boolean {
  return (
    Number.isFinite(venue.lat) &&
    Number.isFinite(venue.lon) &&
    venue.lat >= -90 &&
    venue.lat <= 90 &&
    venue.lon >= -180 &&
    venue.lon <= 180
  )
}

function roundCoordinate(
  value: number,
  precision = 6
): number {
  const factor = 10 ** precision

  return Math.round(value * factor) / factor
}

function createGridKey(
  venue: Venue,
  cellSize: number
): string {
  const latCell =
    Math.floor(venue.lat / cellSize)

  const lonCell =
    Math.floor(venue.lon / cellSize)

  return `${latCell}:${lonCell}`
}

function createClusterId(
  key: string,
  zoom: number,
  venues: Venue[]
): string {
  const venueKeys = venues
    .map((venue) => getVenueId(venue))
    .filter(
      (
        venueId
      ): venueId is string =>
        venueId !== null
    )
    .sort()
    .join('|')

  return `cluster:${zoom}:${key}:${venueKeys}`
}

function getClusterSpan(
  cluster: WorkingCluster
): number {
  const latitudeSpan =
    cluster.north - cluster.south

  const longitudeSpan =
    cluster.east - cluster.west

  return Math.max(
    latitudeSpan,
    longitudeSpan
  )
}

function buildWorkingCluster(
  key: string,
  venue: Venue
): WorkingCluster {
  return {
    key,
    venues: [venue],
    latTotal: venue.lat,
    lonTotal: venue.lon,
    north: venue.lat,
    south: venue.lat,
    east: venue.lon,
    west: venue.lon,
  }
}

function appendVenueToCluster(
  cluster: WorkingCluster,
  venue: Venue
): void {
  cluster.venues.push(venue)

  cluster.latTotal += venue.lat
  cluster.lonTotal += venue.lon

  cluster.north =
    Math.max(
      cluster.north,
      venue.lat
    )

  cluster.south =
    Math.min(
      cluster.south,
      venue.lat
    )

  cluster.east =
    Math.max(
      cluster.east,
      venue.lon
    )

  cluster.west =
    Math.min(
      cluster.west,
      venue.lon
    )
}

function getLiveEventCount(
  venueId: string | null,
  options: ClusterVenuesOptions
): number {
  if (!venueId) {
    return 0
  }

  const explicitCount =
    options.liveEventCountByVenueId?.get(
      venueId
    )

  if (
    typeof explicitCount === 'number' &&
    Number.isFinite(explicitCount)
  ) {
    return Math.max(
      0,
      Math.floor(explicitCount)
    )
  }

  return options.liveEventVenueIds?.has(
    venueId
  )
    ? 1
    : 0
}

function calculateClusterPriority(
  cluster: WorkingCluster,
  options: ClusterVenuesOptions
): {
  hasLiveEvent: boolean
  liveEventCount: number
  hasSelectedVenue: boolean
  hasRouteVenue: boolean
  hasSearchMatch: boolean
  priorityScore: number
} {
  let liveEventCount = 0
  let hasSelectedVenue = false
  let hasRouteVenue = false
  let hasSearchMatch = false

  cluster.venues.forEach(
    (venue) => {
      const venueId =
        getVenueId(venue)

      liveEventCount +=
        getLiveEventCount(
          venueId,
          options
        )

      if (
        venueId &&
        options.selectedVenueId ===
          venueId
      ) {
        hasSelectedVenue = true
      }

      if (
        venueId &&
        options.routeVenueIds?.has(
          venueId
        )
      ) {
        hasRouteVenue = true
      }

      if (
        venueId &&
        options.searchMatchVenueIds?.has(
          venueId
        )
      ) {
        hasSearchMatch = true
      }
    }
  )

  const hasLiveEvent =
    liveEventCount > 0

  const priorityScore =
    (hasSelectedVenue ? 1000 : 0) +
    (hasRouteVenue ? 700 : 0) +
    (hasSearchMatch ? 500 : 0) +
    liveEventCount * 150 +
    cluster.venues.length * 10

  return {
    hasLiveEvent,
    liveEventCount,
    hasSelectedVenue,
    hasRouteVenue,
    hasSearchMatch,
    priorityScore,
  }
}

function toVenueCluster(
  cluster: WorkingCluster,
  zoom: number,
  options: ClusterVenuesOptions
): VenueCluster {
  const count =
    cluster.venues.length

  const center = {
    lat: roundCoordinate(
      cluster.latTotal / count
    ),
    lon: roundCoordinate(
      cluster.lonTotal / count
    ),
  }

  const priority =
    calculateClusterPriority(
      cluster,
      options
    )

  return {
    id: createClusterId(
      cluster.key,
      zoom,
      cluster.venues
    ),
    venues: cluster.venues,
    count,
    center,
    bounds: {
      north: cluster.north,
      south: cluster.south,
      east: cluster.east,
      west: cluster.west,
    },
    ...priority,
  }
}

export function getClusterCellSize(
  zoom: number
): number {
  const normalizedZoom =
    Number.isFinite(zoom)
      ? zoom
      : 0

  const match =
    ZOOM_CELL_SIZE.find(
      ({ maxZoomExclusive }) =>
        normalizedZoom <
        maxZoomExclusive
    )

  return (
    match?.cellSize ??
    ZOOM_CELL_SIZE[
      ZOOM_CELL_SIZE.length - 1
    ].cellSize
  )
}

export function shouldClusterAtZoom(
  zoom: number
): boolean {
  return zoom < 16
}

export function clusterVenuesByGrid(
  venues: readonly Venue[],
  options: ClusterVenuesOptions
): ClusterVenuesResult {
  const zoom =
    Number.isFinite(options.zoom)
      ? options.zoom
      : 0

  const cellSize =
    options.cellSize &&
    Number.isFinite(
      options.cellSize
    ) &&
    options.cellSize > 0
      ? options.cellSize
      : getClusterCellSize(zoom)

  const maxClusterSpan =
    options.maxClusterSpan &&
    Number.isFinite(
      options.maxClusterSpan
    ) &&
    options.maxClusterSpan > 0
      ? options.maxClusterSpan
      : cellSize

  const minimumClusterSize =
    Math.max(
      2,
      Math.floor(
        options.minimumClusterSize ??
          DEFAULT_MINIMUM_CLUSTER_SIZE
      )
    )

  const validVenues =
    venues.filter(
      isValidCoordinate
    )

  if (
    validVenues.length === 0
  ) {
    return {
      clusters: [],
      unclusteredVenues: [],
    }
  }

  if (!shouldClusterAtZoom(zoom)) {
    return {
      clusters: [],
      unclusteredVenues: [
        ...validVenues,
      ],
    }
  }

  const workingClusters =
    new Map<
      string,
      WorkingCluster
    >()

  validVenues.forEach(
    (venue) => {
      const gridKey =
        createGridKey(
          venue,
          cellSize
        )

      const existingCluster =
        workingClusters.get(
          gridKey
        )

      if (!existingCluster) {
        workingClusters.set(
          gridKey,
          buildWorkingCluster(
            gridKey,
            venue
          )
        )

        return
      }

      const prospectiveCluster: WorkingCluster =
        {
          ...existingCluster,
          venues: [
            ...existingCluster.venues,
            venue,
          ],
          latTotal:
            existingCluster.latTotal +
            venue.lat,
          lonTotal:
            existingCluster.lonTotal +
            venue.lon,
          north: Math.max(
            existingCluster.north,
            venue.lat
          ),
          south: Math.min(
            existingCluster.south,
            venue.lat
          ),
          east: Math.max(
            existingCluster.east,
            venue.lon
          ),
          west: Math.min(
            existingCluster.west,
            venue.lon
          ),
        }

      if (
        getClusterSpan(
          prospectiveCluster
        ) <= maxClusterSpan
      ) {
        appendVenueToCluster(
          existingCluster,
          venue
        )

        return
      }

      const overflowKey =
        `${gridKey}:overflow:${venue.lat.toFixed(5)}:${venue.lon.toFixed(5)}`

      workingClusters.set(
        overflowKey,
        buildWorkingCluster(
          overflowKey,
          venue
        )
      )
    }
  )

  const clusters: VenueCluster[] =
    []

  const unclusteredVenues: Venue[] =
    []

  workingClusters.forEach(
    (cluster) => {
      if (
        cluster.venues.length >=
        minimumClusterSize
      ) {
        clusters.push(
          toVenueCluster(
            cluster,
            zoom,
            options
          )
        )

        return
      }

      unclusteredVenues.push(
        ...cluster.venues
      )
    }
  )

  clusters.sort(
    (first, second) => {
      if (
        second.priorityScore !==
        first.priorityScore
      ) {
        return (
          second.priorityScore -
          first.priorityScore
        )
      }

      return (
        second.count -
        first.count
      )
    }
  )

  return {
    clusters,
    unclusteredVenues,
  }
}

export function getClusterExpansionZoom(
  currentZoom: number,
  clusterCount: number
): number {
  const normalizedZoom =
    Number.isFinite(currentZoom)
      ? currentZoom
      : 0

  if (clusterCount >= 50) {
    return Math.min(
      normalizedZoom + 3,
      18
    )
  }

  if (clusterCount >= 15) {
    return Math.min(
      normalizedZoom + 2,
      18
    )
  }

  return Math.min(
    normalizedZoom + 1,
    18
  )
}

export function getClusterBoundsCoordinates(
  cluster: VenueCluster
): [
  [number, number],
  [number, number],
] {
  return [
    [
      cluster.bounds.south,
      cluster.bounds.west,
    ],
    [
      cluster.bounds.north,
      cluster.bounds.east,
    ],
  ]
}

export function getClusterLabel(
  cluster: VenueCluster
): string {
  if (cluster.hasSelectedVenue) {
    return `${cluster.count} places, including the selected venue`
  }

  if (
    cluster.liveEventCount > 0
  ) {
    return `${cluster.count} places, ${cluster.liveEventCount} with events`
  }

  return `${cluster.count} curated places`
}