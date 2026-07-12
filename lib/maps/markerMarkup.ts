// lib/maps/markerMarkup.ts

import type {
  MapIconColor,
  MapMarkerDisplayMode,
} from '@/lib/maps/icons'
import {
  createMapIconStateClasses,
  createMapIconStyleAttribute,
  createSafeMapIconAttributes,
  escapeMapIconHtml,
  joinClassNames,
  MAP_ICON_COLORS,
  normalizeCompactMarkerLabel,
  normalizeMarkerScale,
  normalizeRouteStopNumber,
  resolveMapIconColor,
} from '@/lib/maps/icons'
import type {
  RouteStopRole,
  VenueMarkerVisualState,
} from '@/lib/maps/mapTypes'

/**
 * This module owns branded marker DOM structure.
 *
 * It must remain:
 * - free of Leaflet runtime imports,
 * - deterministic,
 * - safe for server-side utilities and tests,
 * - free of product data fetching,
 * - free of marker-ranking logic.
 *
 * All values inserted into HTML must be escaped or constrained.
 */

export type MarkerMarkupResult = {
  html: string
  className: string
  dataState: string
}

export type VenueMarkerMarkupOptions = {
  visualState: VenueMarkerVisualState
  displayMode?: MapMarkerDisplayMode
  categoryGlyph?: string | null
  accentColor?: MapIconColor | string
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  openNow?: boolean
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
  isSearchMatch?: boolean
}

export type RouteStopMarkupOptions = {
  index: number
  role: RouteStopRole
  color?: MapIconColor | string
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  active?: boolean
  completed?: boolean
}

export type CityOverviewMarkupOptions = {
  abbreviation: string
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  hasLiveActivity?: boolean
  venueCount?: number | null
  liveEventCount?: number
}

export type UserLocationMarkupOptions = {
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  following?: boolean
}

export type CustomStartMarkupOptions = {
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  dragging?: boolean
}

export type ClusterMarkupOptions = {
  count: number
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  liveEventCount?: number
}

/**
 * Build branded venue-marker markup.
 */
export function createVenueMarkerMarkup(
  options: VenueMarkerMarkupOptions
): MarkerMarkupResult {
  const visualState = normalizeVenueVisualState(
    options.visualState
  )

  const selected =
    options.selected === true ||
    visualState === 'selected'

  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const openNow = options.openNow !== false
  const scale = normalizeMarkerScale(options.scale)

  const hasLiveEvent =
    options.hasLiveEvent === true ||
    visualState === 'live-event'

  const hasUpcomingEvent =
    !hasLiveEvent &&
    (
      options.hasUpcomingEvent === true ||
      visualState === 'upcoming-event'
    )

  const isSearchMatch =
    options.isSearchMatch === true ||
    visualState === 'search-match'

  const displayMode = normalizeDisplayMode(
    options.displayMode
  )

  const glyph = normalizeMarkerGlyph(
    options.categoryGlyph
  )

  const accentColor = resolveMapIconColor(
    options.accentColor,
    getVenueAccentColor({
      visualState,
      openNow,
    })
  )

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'venue',
      selected,
      dimmed,
      interactive,
      active: hasLiveEvent,
    }),
    'roam-venue-marker',
    `roam-venue-marker--${visualState}`,
    `roam-venue-marker--${displayMode}`,
    !openNow && 'roam-venue-marker--closed',
    hasLiveEvent && 'roam-venue-marker--live',
    hasUpcomingEvent && 'roam-venue-marker--upcoming',
    isSearchMatch && 'roam-venue-marker--search'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-accent': accentColor,
    '--roam-marker-opacity': dimmed ? 0.42 : 1,
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState: visualState,
  })

  const glyphMarkup =
    (
      displayMode === 'category' ||
      displayMode === 'emoji'
    ) &&
    glyph
      ? `
        <span
          class="roam-venue-marker__glyph"
          aria-hidden="true"
        >
          ${escapeMapIconHtml(glyph)}
        </span>
      `
      : `
        <span
          class="roam-venue-marker__brand-dot"
          aria-hidden="true"
        ></span>
      `

  const statusMarkup = openNow
    ? `
      <span
        class="roam-venue-marker__status roam-venue-marker__status--open"
        aria-hidden="true"
      ></span>
    `
    : `
      <span
        class="roam-venue-marker__status roam-venue-marker__status--closed"
        aria-hidden="true"
      ></span>
    `

  const eventMarkup = hasLiveEvent
    ? `
      <span
        class="roam-venue-marker__event roam-venue-marker__event--live"
        aria-hidden="true"
      ></span>
    `
    : hasUpcomingEvent
      ? `
        <span
          class="roam-venue-marker__event roam-venue-marker__event--upcoming"
          aria-hidden="true"
        ></span>
      `
      : ''

  const searchMarkup = isSearchMatch
    ? `
      <span
        class="roam-venue-marker__search"
        aria-hidden="true"
      ></span>
    `
    : ''

  return {
    className,
    dataState: visualState,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-venue-marker__halo"
          aria-hidden="true"
        ></span>

        <span
          class="roam-venue-marker__shell"
          aria-hidden="true"
        >
          <span
            class="roam-venue-marker__core"
          >
            ${glyphMarkup}
          </span>

          ${statusMarkup}
          ${eventMarkup}
          ${searchMarkup}
        </span>

        <span
          class="roam-venue-marker__tip"
          aria-hidden="true"
        ></span>
      </div>
    `,
  }
}

/**
 * Build numbered route-stop markup.
 */
export function createRouteStopMarkup(
  options: RouteStopMarkupOptions
): MarkerMarkupResult {
  const index = normalizeRouteStopNumber(
    options.index
  )

  const role = normalizeRouteStopRole(
    options.role
  )

  const selected = options.selected === true
  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const active = options.active === true
  const completed = options.completed === true
  const scale = normalizeMarkerScale(options.scale)

  const color = resolveMapIconColor(
    options.color,
    MAP_ICON_COLORS.cyan
  )

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'route-stop',
      selected,
      dimmed,
      interactive,
      active,
      completed,
    }),
    'roam-route-stop',
    `roam-route-stop--${role}`
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-accent': color,
    '--roam-marker-opacity': dimmed ? 0.5 : 1,
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState: role,
  })

  const roleMarkup =
    role === 'start'
      ? `
        <span
          class="roam-route-stop__role roam-route-stop__role--start"
          aria-hidden="true"
        ></span>
      `
      : role === 'end'
        ? `
          <span
            class="roam-route-stop__role roam-route-stop__role--end"
            aria-hidden="true"
          ></span>
        `
        : ''

  const completedMarkup = completed
    ? `
      <span
        class="roam-route-stop__completed"
        aria-hidden="true"
      >
        ✓
      </span>
    `
    : ''

  return {
    className,
    dataState: role,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-route-stop__halo"
          aria-hidden="true"
        ></span>

        <span
          class="roam-route-stop__shell"
          aria-hidden="true"
        >
          <span
            class="roam-route-stop__number"
          >
            ${escapeMapIconHtml(index)}
          </span>

          ${completedMarkup}
        </span>

        ${roleMarkup}
      </div>
    `,
  }
}

/**
 * Build branded city-overview marker markup.
 */
export function createCityOverviewMarkup(
  options: CityOverviewMarkupOptions
): MarkerMarkupResult {
  const abbreviation =
    normalizeCompactMarkerLabel(
      options.abbreviation,
      4
    ) || 'CITY'

  const scale = normalizeMarkerScale(options.scale)
  const selected = options.selected === true
  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const hasLiveActivity =
    options.hasLiveActivity === true

  const venueCount = normalizeOptionalCount(
    options.venueCount
  )

  const liveEventCount =
    normalizeOptionalCount(
      options.liveEventCount
    ) ?? 0

  const dataState = hasLiveActivity
    ? 'live'
    : selected
      ? 'selected'
      : 'default'

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'city-overview',
      selected,
      dimmed,
      interactive,
      active: hasLiveActivity,
    }),
    'roam-city-marker',
    hasLiveActivity && 'roam-city-marker--live'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity': dimmed ? 0.48 : 1,
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState,
  })

  const countMarkup =
    venueCount !== null
      ? `
        <span
          class="roam-city-marker__count"
          aria-hidden="true"
        >
          ${escapeMapIconHtml(
            compactCount(venueCount)
          )}
        </span>
      `
      : ''

  const liveMarkup = hasLiveActivity
    ? `
      <span
        class="roam-city-marker__activity"
        aria-hidden="true"
        data-live-count="${escapeMapIconHtml(
          liveEventCount
        )}"
      ></span>
    `
    : ''

  return {
    className,
    dataState,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-city-marker__halo"
          aria-hidden="true"
        ></span>

        <span
          class="roam-city-marker__shell"
          aria-hidden="true"
        >
          <span
            class="roam-city-marker__label"
          >
            ${escapeMapIconHtml(abbreviation)}
          </span>

          ${countMarkup}
          ${liveMarkup}
        </span>
      </div>
    `,
  }
}

/**
 * Build user-location marker markup.
 */
export function createUserLocationMarkup(
  options: UserLocationMarkupOptions = {}
): MarkerMarkupResult {
  const scale = normalizeMarkerScale(options.scale)
  const selected = options.selected === true
  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const following = options.following === true

  const dataState = following
    ? 'following'
    : selected
      ? 'selected'
      : 'default'

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'user-location',
      selected,
      dimmed,
      interactive,
      active: following,
    }),
    'roam-user-location',
    following && 'roam-user-location--following'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity': dimmed ? 0.5 : 1,
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState,
  })

  return {
    className,
    dataState,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-user-location__pulse"
          aria-hidden="true"
        ></span>

        <span
          class="roam-user-location__ring"
          aria-hidden="true"
        ></span>

        <span
          class="roam-user-location__core"
          aria-hidden="true"
        ></span>
      </div>
    `,
  }
}

/**
 * Build draggable custom-start marker markup.
 */
export function createCustomStartMarkup(
  options: CustomStartMarkupOptions = {}
): MarkerMarkupResult {
  const scale = normalizeMarkerScale(options.scale)
  const selected = options.selected === true
  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const dragging = options.dragging === true

  const dataState = dragging
    ? 'dragging'
    : selected
      ? 'selected'
      : 'default'

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'custom-start',
      selected,
      dimmed,
      interactive,
      active: dragging,
    }),
    'roam-custom-start',
    dragging && 'roam-custom-start--dragging'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity': dimmed ? 0.5 : 1,
    '--roam-marker-accent': MAP_ICON_COLORS.cyan,
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState,
  })

  return {
    className,
    dataState,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-custom-start__pulse"
          aria-hidden="true"
        ></span>

        <span
          class="roam-custom-start__pin"
          aria-hidden="true"
        >
          <span
            class="roam-custom-start__ring"
          ></span>

          <span
            class="roam-custom-start__core"
          ></span>
        </span>

        <span
          class="roam-custom-start__shadow"
          aria-hidden="true"
        ></span>
      </div>
    `,
  }
}

/**
 * Build branded venue-cluster marker markup.
 */
export function createClusterMarkup(
  options: ClusterMarkupOptions
): MarkerMarkupResult {
  const count = normalizeRequiredCount(
    options.count
  )

  const liveEventCount =
    normalizeOptionalCount(
      options.liveEventCount
    ) ?? 0

  const scale = normalizeMarkerScale(options.scale)
  const selected = options.selected === true
  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false
  const hasLiveActivity = liveEventCount > 0

  const dataState = hasLiveActivity
    ? 'live'
    : selected
      ? 'selected'
      : 'default'

  const className = joinClassNames(
    createMapIconStateClasses({
      family: 'cluster',
      selected,
      dimmed,
      interactive,
      active: hasLiveActivity,
    }),
    'roam-cluster',
    hasLiveActivity && 'roam-cluster--live',
    count >= 100 && 'roam-cluster--large'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity': dimmed ? 0.46 : 1,
    '--roam-cluster-intensity': Math.min(
      1,
      liveEventCount / Math.max(1, count)
    ).toFixed(3),
  })

  const attributes = createSafeMapIconAttributes({
    role: 'presentation',
    dataState,
  })

  const liveMarkup = hasLiveActivity
    ? `
      <span
        class="roam-cluster__live"
        aria-hidden="true"
      >
        ${escapeMapIconHtml(
          compactCount(liveEventCount)
        )}
      </span>
    `
    : ''

  return {
    className,
    dataState,
    html: `
      <div
        class="${className}"
        style="${style}"
        ${attributes}
      >
        <span
          class="roam-cluster__halo"
          aria-hidden="true"
        ></span>

        <span
          class="roam-cluster__shell"
          aria-hidden="true"
        >
          <span
            class="roam-cluster__count"
          >
            ${escapeMapIconHtml(
              compactCount(count)
            )}
          </span>

          ${liveMarkup}
        </span>
      </div>
    `,
  }
}

/**
 * Resolve the dominant venue visual state from marker signals.
 *
 * Route stops are intentionally excluded here because they use their own
 * dedicated route-stop markup factory.
 */
export function resolveVenueMarkupVisualState({
  selected,
  isSearchMatch,
  hasLiveEvent,
  hasUpcomingEvent,
}: {
  selected?: boolean
  isSearchMatch?: boolean
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
}): VenueMarkerVisualState {
  if (selected) return 'selected'
  if (isSearchMatch) return 'search-match'
  if (hasLiveEvent) return 'live-event'
  if (hasUpcomingEvent) return 'upcoming-event'
  return 'default'
}

function normalizeVenueVisualState(
  value: VenueMarkerVisualState
): VenueMarkerVisualState {
  switch (value) {
    case 'default':
    case 'upcoming-event':
    case 'live-event':
    case 'search-match':
    case 'selected':
    case 'route-stop':
      return value

    default:
      return 'default'
  }
}

function normalizeDisplayMode(
  value: MapMarkerDisplayMode | undefined
): MapMarkerDisplayMode {
  switch (value) {
    case 'category':
    case 'emoji':
      return 'category'

    case 'brand':
    case 'color':
    default:
      return 'brand'
  }
}

function normalizeRouteStopRole(
  value: RouteStopRole
): RouteStopRole {
  switch (value) {
    case 'start':
    case 'middle':
    case 'end':
      return value

    default:
      return 'middle'
  }
}

function normalizeMarkerGlyph(
  value: string | null | undefined
): string {
  if (!value) return ''

  return Array.from(value.trim())
    .slice(0, 4)
    .join('')
}

function getVenueAccentColor({
  visualState,
  openNow,
}: {
  visualState: VenueMarkerVisualState
  openNow: boolean
}): string {
  if (!openNow) {
    return MAP_ICON_COLORS.closed
  }

  switch (visualState) {
    case 'selected':
      return MAP_ICON_COLORS.white

    case 'search-match':
      return MAP_ICON_COLORS.amber

    case 'live-event':
      return MAP_ICON_COLORS.violet

    case 'upcoming-event':
      return MAP_ICON_COLORS.indigo

    case 'route-stop':
    case 'default':
    default:
      return MAP_ICON_COLORS.cyan
  }
}

function normalizeOptionalCount(
  value: number | null | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return Math.max(0, Math.round(value))
}

function normalizeRequiredCount(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(1, Math.round(value))
}

function compactCount(
  value: number
): string {
  const normalized = Math.max(
    0,
    Math.round(value)
  )

  if (normalized < 1_000) {
    return String(normalized)
  }

  if (normalized < 10_000) {
    return `${
      (normalized / 1_000)
        .toFixed(1)
        .replace(/\.0$/, '')
    }k`
  }

  if (normalized < 1_000_000) {
    return `${Math.floor(
      normalized / 1_000
    )}k`
  }

  return `${
    (normalized / 1_000_000)
      .toFixed(1)
      .replace(/\.0$/, '')
  }m`
}