// lib/maps/icons.ts

import type {
  DivIcon,
  DivIconOptions,
  PointExpression,
} from 'leaflet'

import type {
  RouteStopRole,
  VenueMarkerVisualState,
} from '@/lib/maps/mapTypes'

/**
 * IMPORTANT SSR RULE
 * ---------------------------------------------------------------------------
 * This module must never import Leaflet at runtime at module scope.
 *
 * Type-only imports from `leaflet` are safe because TypeScript removes them
 * from the emitted JavaScript.
 *
 * All runtime Leaflet access must go through `loadLeaflet()`.
 */

/**
 * Supported icon families.
 *
 * Part 2 will build the concrete icon factories on top of these families.
 */
export type MapIconFamily =
  | 'venue'
  | 'route-stop'
  | 'city-overview'
  | 'user-location'
  | 'custom-start'
  | 'cluster'

/**
 * Product-level marker display modes.
 *
 * `brand` is the intended premium default.
 * `category` allows a controlled category glyph inside the branded marker.
 *
 * Legacy values are included temporarily so current callers can migrate
 * without forcing an immediate breaking change.
 */
export type MapMarkerDisplayMode =
  | 'brand'
  | 'category'
  | 'color'
  | 'emoji'

/**
 * CSS-safe icon color tokens.
 *
 * Marker factories should prefer semantic color names or validated CSS colors
 * instead of accepting arbitrary unsanitized HTML values.
 */
export type MapIconColor =
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'white'
  | 'black'
  | `#${string}`
  | `rgb(${string})`
  | `rgba(${string})`
  | `hsl(${string})`
  | `hsla(${string})`

/**
 * Common properties shared by all branded map icons.
 */
export type BaseMapIconOptions = {
  scale?: number
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  className?: string
}

/**
 * Options that will eventually drive the branded venue-marker factory.
 */
export type VenueIconOptions = BaseMapIconOptions & {
  visualState: VenueMarkerVisualState
  displayMode?: MapMarkerDisplayMode
  categoryGlyph?: string | null
  accentColor?: MapIconColor | string
  openNow?: boolean
  routeIndex?: number | null
  routeRole?: RouteStopRole | null
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
  isSearchMatch?: boolean
}

export type RouteStopIconOptions = BaseMapIconOptions & {
  index: number
  role: RouteStopRole
  color?: MapIconColor | string
  completed?: boolean
  active?: boolean

  /**
   * Canonical venue-category glyph retained while the route-stop number
   * remains the dominant route decoration.
   */
  categoryGlyph?: string | null
}

/**
 * Options that will eventually drive city overview markers.
 */
export type CityOverviewIconOptions = BaseMapIconOptions & {
  abbreviation: string
  hasLiveActivity?: boolean
  venueCount?: number | null
  liveEventCount?: number
}

/**
 * Options that will eventually drive the user-location marker.
 */
export type UserLocationIconOptions = BaseMapIconOptions & {
  following?: boolean
}

/**
 * Options that will eventually drive the custom-start marker.
 */
export type CustomStartIconOptions = BaseMapIconOptions & {
  dragging?: boolean
}

/**
 * Options that will eventually drive branded venue clusters.
 */
export type ClusterIconOptions = BaseMapIconOptions & {
  count: number
  liveEventCount?: number
  selected?: boolean
}

/**
 * Normalized dimensions used when creating a Leaflet DivIcon.
 */
export type MapIconDimensions = {
  width: number
  height: number
  anchorX: number
  anchorY: number
  popupAnchorX?: number
  popupAnchorY?: number
  tooltipAnchorX?: number
  tooltipAnchorY?: number
}

/**
 * Input accepted by the generic cached DivIcon builder.
 */
export type CreateCachedDivIconInput = {
  /**
   * Stable cache key. It must include every option that changes icon markup,
   * dimensions, classes or anchoring.
   */
  cacheKey: string

  /**
   * Sanitized HTML markup rendered inside the Leaflet DivIcon.
   */
  html: string

  /**
   * Outer Leaflet icon class.
   *
   * Most visual styling should be applied inside the marker markup. Keep this
   * class stable so global Leaflet normalization remains predictable.
   */
  className?: string

  dimensions: MapIconDimensions

  /**
   * Optional extra Leaflet DivIcon settings.
   *
   * Core markup, dimensions and anchor fields are intentionally excluded so
   * callers cannot accidentally override the normalized values.
   */
  options?: Omit<
    DivIconOptions,
    | 'html'
    | 'className'
    | 'iconSize'
    | 'iconAnchor'
    | 'popupAnchor'
    | 'tooltipAnchor'
  >
}

/**
 * Minimal runtime Leaflet shape required by this module.
 *
 * This avoids exporting or storing the entire Leaflet namespace as `any`.
 */
type LeafletRuntime = typeof import('leaflet')

const DEFAULT_ICON_CLASS_NAME = 'roam-leaflet-div-icon'

const ICON_SCALE_MIN = 0.55
const ICON_SCALE_MAX = 1.5

/**
 * Shared icon dimensions before zoom scaling is applied.
 */
export const MAP_ICON_BASE_DIMENSIONS = {
  venue: {
    width: 38,
    height: 44,
    anchorX: 19,
    anchorY: 40,
    popupAnchorX: 0,
    popupAnchorY: -38,
    tooltipAnchorX: 0,
    tooltipAnchorY: -32,
  },

  routeStop: {
    width: 38,
    height: 38,
    anchorX: 19,
    anchorY: 19,
    popupAnchorX: 0,
    popupAnchorY: -22,
    tooltipAnchorX: 0,
    tooltipAnchorY: -20,
  },

  cityOverview: {
    width: 54,
    height: 42,
    anchorX: 27,
    anchorY: 21,
    popupAnchorX: 0,
    popupAnchorY: -24,
    tooltipAnchorX: 0,
    tooltipAnchorY: -24,
  },

  userLocation: {
    width: 24,
    height: 24,
    anchorX: 12,
    anchorY: 12,
    popupAnchorX: 0,
    popupAnchorY: -16,
    tooltipAnchorX: 0,
    tooltipAnchorY: -16,
  },

  customStart: {
    width: 34,
    height: 42,
    anchorX: 17,
    anchorY: 38,
    popupAnchorX: 0,
    popupAnchorY: -36,
    tooltipAnchorX: 0,
    tooltipAnchorY: -32,
  },

  cluster: {
    width: 48,
    height: 48,
    anchorX: 24,
    anchorY: 24,
    popupAnchorX: 0,
    popupAnchorY: -28,
    tooltipAnchorX: 0,
    tooltipAnchorY: -28,
  },
} as const satisfies Record<string, MapIconDimensions>

/**
 * Central semantic color palette for marker factories.
 *
 * Keeping colors here prevents slightly different cyan, blue or slate values
 * from spreading across marker components.
 */
export const MAP_ICON_COLORS = {
  cyan: '#22d3ee',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  slate: '#64748b',
  white: '#ffffff',
  black: '#05070a',

  backgroundStrong: '#090c12',
  backgroundSoft: '#151a23',
  muted: '#94a3b8',
  closed: '#64748b',
  routeCasing: '#05070a',
} as const

let leafletPromise: Promise<LeafletRuntime> | null = null
let loadedLeaflet: LeafletRuntime | null = null

/**
 * Globally cached DivIcon instances.
 *
 * Leaflet icons are immutable for our purposes, so the same instance can be
 * reused safely by multiple markers that share the same visual configuration.
 */
const divIconCache = new Map<string, DivIcon>()

/**
 * Load Leaflet only in a browser environment.
 *
 * This is the sole runtime Leaflet entry point for this module.
 */
export async function loadLeaflet(): Promise<LeafletRuntime> {
  if (loadedLeaflet) {
    return loadedLeaflet
  }

  if (typeof window === 'undefined') {
    throw new Error(
      'Leaflet icons can only be created in a browser environment.'
    )
  }

  if (!leafletPromise) {
    leafletPromise = import('leaflet')
      .then((module) => {
        loadedLeaflet = module
        return module
      })
      .catch((error: unknown) => {
        leafletPromise = null
        throw error
      })
  }

  return leafletPromise
}

/**
 * Return Leaflet synchronously only after `loadLeaflet()` has resolved.
 *
 * This is useful for advanced callers that preload Leaflet once before
 * rendering a large marker collection.
 */
export function getLoadedLeaflet(): LeafletRuntime | null {
  return loadedLeaflet
}

/**
 * Preload Leaflet before a dense marker layer renders.
 *
 * The returned promise should be handled by a client-only hook or component.
 */
export function preloadLeaflet(): Promise<void> {
  return loadLeaflet().then(() => undefined)
}

/**
 * Return a cached icon when it already exists.
 */
export function getCachedMapIcon(cacheKey: string): DivIcon | null {
  const normalizedKey = normalizeCacheKey(cacheKey)

  if (!normalizedKey) {
    return null
  }

  return divIconCache.get(normalizedKey) ?? null
}

/**
 * Add a manually created icon to the shared cache.
 */
export function setCachedMapIcon(
  cacheKey: string,
  icon: DivIcon
): DivIcon {
  const normalizedKey = normalizeCacheKey(cacheKey)

  if (!normalizedKey) {
    throw new Error('Map icon cache keys must not be empty.')
  }

  divIconCache.set(normalizedKey, icon)
  return icon
}

/**
 * Remove one icon from the cache.
 */
export function removeCachedMapIcon(cacheKey: string): boolean {
  const normalizedKey = normalizeCacheKey(cacheKey)

  if (!normalizedKey) {
    return false
  }

  return divIconCache.delete(normalizedKey)
}

/**
 * Clear all cached marker icons.
 *
 * This should generally be used only in tests, development tooling or when the
 * global marker theme changes.
 */
export function clearMapIconCache(): void {
  divIconCache.clear()
}

/**
 * Return the number of currently cached icon instances.
 */
export function getMapIconCacheSize(): number {
  return divIconCache.size
}

/**
 * Build and cache a Leaflet DivIcon.
 *
 * Concrete marker factories in Part 2 should call this function rather than
 * invoking `L.divIcon()` directly.
 */
export async function createCachedDivIcon({
  cacheKey,
  html,
  className = DEFAULT_ICON_CLASS_NAME,
  dimensions,
  options = {},
}: CreateCachedDivIconInput): Promise<DivIcon> {
  const normalizedKey = normalizeCacheKey(cacheKey)

  if (!normalizedKey) {
    throw new Error('Map icon cache keys must not be empty.')
  }

  const cached = divIconCache.get(normalizedKey)

  if (cached) {
    return cached
  }

  const L = await loadLeaflet()
  const normalizedDimensions = normalizeIconDimensions(dimensions)

  const icon = L.divIcon({
    ...options,
    className: joinClassNames(
      DEFAULT_ICON_CLASS_NAME,
      className
    ),
    html,
    iconSize: toLeafletPoint([
      normalizedDimensions.width,
      normalizedDimensions.height,
    ]),
    iconAnchor: toLeafletPoint([
      normalizedDimensions.anchorX,
      normalizedDimensions.anchorY,
    ]),
    popupAnchor: toOptionalLeafletPoint(
      normalizedDimensions.popupAnchorX,
      normalizedDimensions.popupAnchorY
    ),
    tooltipAnchor: toOptionalLeafletPoint(
      normalizedDimensions.tooltipAnchorX,
      normalizedDimensions.tooltipAnchorY
    ),
  })

  divIconCache.set(normalizedKey, icon)

  return icon
}

/**
 * Resolve an icon from cache or create it with the provided factory.
 *
 * This helper is useful when Part 2 factories need custom Leaflet construction
 * beyond the generic `createCachedDivIcon()` path.
 */
export async function getOrCreateCachedMapIcon(
  cacheKey: string,
  factory: (
    leaflet: LeafletRuntime
  ) => DivIcon | Promise<DivIcon>
): Promise<DivIcon> {
  const normalizedKey = normalizeCacheKey(cacheKey)

  if (!normalizedKey) {
    throw new Error('Map icon cache keys must not be empty.')
  }

  const cached = divIconCache.get(normalizedKey)

  if (cached) {
    return cached
  }

  const leaflet = await loadLeaflet()
  const icon = await factory(leaflet)

  divIconCache.set(normalizedKey, icon)

  return icon
}

/**
 * Build a deterministic cache key.
 *
 * Undefined, null and empty values are normalized so semantically equivalent
 * icon configurations resolve to the same cache entry.
 */
export function createMapIconCacheKey(
  family: MapIconFamily,
  parts: ReadonlyArray<
    string | number | boolean | null | undefined
  >
): string {
  const normalizedFamily = normalizeCachePart(family)

  const normalizedParts = parts.map((part) =>
    normalizeCachePart(part)
  )

  return [
    'roam-map-icon',
    normalizedFamily,
    ...normalizedParts,
  ].join(':')
}

/**
 * Scale icon dimensions while preserving their anchoring proportions.
 */
export function scaleIconDimensions(
  dimensions: MapIconDimensions,
  scale = 1
): MapIconDimensions {
  const normalizedScale = normalizeMarkerScale(scale)

  return {
    width: scaleDimension(
      dimensions.width,
      normalizedScale
    ),
    height: scaleDimension(
      dimensions.height,
      normalizedScale
    ),
    anchorX: scaleDimension(
      dimensions.anchorX,
      normalizedScale
    ),
    anchorY: scaleDimension(
      dimensions.anchorY,
      normalizedScale
    ),

    popupAnchorX:
      dimensions.popupAnchorX === undefined
        ? undefined
        : scaleSignedDimension(
            dimensions.popupAnchorX,
            normalizedScale
          ),

    popupAnchorY:
      dimensions.popupAnchorY === undefined
        ? undefined
        : scaleSignedDimension(
            dimensions.popupAnchorY,
            normalizedScale
          ),

    tooltipAnchorX:
      dimensions.tooltipAnchorX === undefined
        ? undefined
        : scaleSignedDimension(
            dimensions.tooltipAnchorX,
            normalizedScale
          ),

    tooltipAnchorY:
      dimensions.tooltipAnchorY === undefined
        ? undefined
        : scaleSignedDimension(
            dimensions.tooltipAnchorY,
            normalizedScale
          ),
  }
}

/**
 * Clamp marker scaling to a controlled visual range.
 */
export function normalizeMarkerScale(
  scale: number | undefined
): number {
  if (!Number.isFinite(scale)) {
    return 1
  }

  const clampedScale = clamp(
    Number(scale),
    ICON_SCALE_MIN,
    ICON_SCALE_MAX
  )

  if (clampedScale < 0.9) {
    return 0.85
  }

  if (clampedScale > 1.1) {
    return 1.15
  }

  return 1
}

/**
 * Resolve a supported semantic or CSS color.
 *
 * Invalid values fall back to the supplied default instead of entering marker
 * HTML or CSS variables.
 */
export function resolveMapIconColor(
  color: MapIconColor | string | null | undefined,
  fallback: string = MAP_ICON_COLORS.cyan
): string {
  if (!color) {
    return fallback
  }

  const normalized = color.trim()

  if (!normalized) {
    return fallback
  }

  const semanticColor =
    MAP_ICON_COLORS[
      normalized as keyof typeof MAP_ICON_COLORS
    ]

  if (semanticColor) {
    return semanticColor
  }

  return isSafeCssColor(normalized)
    ? normalized
    : fallback
}

/**
 * Escape text before inserting it into DivIcon HTML.
 *
 * Marker factories must use this for labels, abbreviations, glyph fallbacks
 * and any value that did not originate as a trusted static string.
 */
export function escapeMapIconHtml(
  value: string | number | null | undefined
): string {
  const text = String(value ?? '')

  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

/**
 * Restrict city abbreviations or compact labels to predictable characters.
 */
export function normalizeCompactMarkerLabel(
  value: string,
  maximumLength = 4
): string {
  const normalizedMaximumLength = clamp(
    Math.round(maximumLength),
    1,
    8
  )

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, normalizedMaximumLength)
}

/**
 * Restrict route indices to safe, readable marker labels.
 */
export function normalizeRouteStopNumber(
  index: number
): number {
  if (!Number.isFinite(index)) {
    return 1
  }

  return clamp(
    Math.round(index),
    1,
    999
  )
}

/**
 * Construct a CSS custom-property attribute.
 *
 * Values must already be trusted or normalized before being passed here.
 */
export function createMapIconStyleAttribute(
  variables: Record<
    `--${string}`,
    string | number | null | undefined
  >
): string {
  return Object.entries(variables)
    .map(([property, value]) => {
      if (value === null || value === undefined) {
        return null
      }

      const normalizedProperty =
        normalizeCssCustomProperty(property)

      if (!normalizedProperty) {
        return null
      }

      const normalizedValue =
        normalizeCssVariableValue(value)

      if (normalizedValue === null) {
        return null
      }

      return `${normalizedProperty}:${normalizedValue}`
    })
    .filter((entry): entry is string => entry !== null)
    .join(';')
}

/**
 * Join conditional CSS class names.
 */
export function joinClassNames(
  ...values: Array<
    string | false | null | undefined
  >
): string {
  return values
    .filter(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0
    )
    .map((value) => value.trim())
    .join(' ')
}

/**
 * Build modifier classes for common marker states.
 */
export function createMapIconStateClasses({
  family,
  selected = false,
  dimmed = false,
  interactive = true,
  active = false,
  completed = false,
}: {
  family: MapIconFamily
  selected?: boolean
  dimmed?: boolean
  interactive?: boolean
  active?: boolean
  completed?: boolean
}): string {
  return joinClassNames(
    'roam-map-icon',
    `roam-map-icon--${family}`,
    selected && 'roam-map-icon--selected',
    dimmed && 'roam-map-icon--dimmed',
    interactive && 'roam-map-icon--interactive',
    active && 'roam-map-icon--active',
    completed && 'roam-map-icon--completed'
  )
}

/**
 * Build a normalized HTML attribute string.
 *
 * This helper is intended only for static marker attributes. Event handlers
 * and arbitrary attribute names must never be passed into DivIcon markup.
 */
export function createSafeMapIconAttributes(
  attributes: {
    ariaLabel?: string | null
    role?: 'img' | 'presentation'
    title?: string | null
    dataState?: string | null
  }
): string {
  const entries: string[] = []

  if (attributes.role) {
    entries.push(`role="${attributes.role}"`)
  }

  if (attributes.ariaLabel) {
    entries.push(
      `aria-label="${escapeMapIconHtml(
        attributes.ariaLabel
      )}"`
    )
  }

  if (attributes.title) {
    entries.push(
      `title="${escapeMapIconHtml(
        attributes.title
      )}"`
    )
  }

  if (attributes.dataState) {
    entries.push(
      `data-state="${escapeMapIconHtml(
        attributes.dataState
      )}"`
    )
  }

  return entries.join(' ')
}

/**
 * Normalize dimensions before giving them to Leaflet.
 */
export function normalizeIconDimensions(
  dimensions: MapIconDimensions
): MapIconDimensions {
  const width = normalizePositiveDimension(
    dimensions.width,
    1
  )

  const height = normalizePositiveDimension(
    dimensions.height,
    1
  )

  return {
    width,
    height,
    anchorX: normalizeFiniteDimension(
      dimensions.anchorX,
      width / 2
    ),
    anchorY: normalizeFiniteDimension(
      dimensions.anchorY,
      height / 2
    ),
    popupAnchorX: normalizeOptionalDimension(
      dimensions.popupAnchorX
    ),
    popupAnchorY: normalizeOptionalDimension(
      dimensions.popupAnchorY
    ),
    tooltipAnchorX: normalizeOptionalDimension(
      dimensions.tooltipAnchorX
    ),
    tooltipAnchorY: normalizeOptionalDimension(
      dimensions.tooltipAnchorY
    ),
  }
}

function normalizeCacheKey(value: string): string {
  return value.trim()
}

function normalizeCachePart(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) {
    return 'none'
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toFixed(3)
      : 'invalid'
  }

  const normalized = value
    .trim()
    .toLowerCase()

  if (!normalized) {
    return 'empty'
  }

  return encodeURIComponent(normalized)
    .slice(0, 240)
}

function toLeafletPoint(
  point: [number, number]
): PointExpression {
  return point
}

function toOptionalLeafletPoint(
  x: number | undefined,
  y: number | undefined
): PointExpression | undefined {
  if (x === undefined || y === undefined) {
    return undefined
  }

  return [x, y]
}

function scaleDimension(
  value: number,
  scale: number
): number {
  return Math.max(
    1,
    Math.round(value * scale)
  )
}

function scaleSignedDimension(
  value: number,
  scale: number
): number {
  return Math.round(value * scale)
}

function normalizePositiveDimension(
  value: number,
  fallback: number
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }

  return Math.round(value)
}

function normalizeFiniteDimension(
  value: number,
  fallback: number
): number {
  if (!Number.isFinite(value)) {
    return Math.round(fallback)
  }

  return Math.round(value)
}

function normalizeOptionalDimension(
  value: number | undefined
): number | undefined {
  if (value === undefined) {
    return undefined
  }

  return Number.isFinite(value)
    ? Math.round(value)
    : undefined
}

function isSafeCssColor(value: string): boolean {
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgba?\(\s*[-+.\d%]+\s*,\s*[-+.\d%]+\s*,\s*[-+.\d%]+(?:\s*,\s*[-+.\d%]+)?\s*\)$/.test(
      value
    ) ||
    /^hsla?\(\s*[-+.\d]+\s*(?:deg|rad|turn)?\s*,\s*[-+.\d%]+\s*,\s*[-+.\d%]+(?:\s*,\s*[-+.\d%]+)?\s*\)$/.test(
      value
    )
  )
}

function normalizeCssCustomProperty(
  property: string
): string | null {
  const normalized = property.trim()

  return /^--[a-zA-Z0-9_-]+$/.test(normalized)
    ? normalized
    : null
}

function normalizeCssVariableValue(
  value: string | number
): string | null {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? String(value)
      : null
  }

  const normalized = value.trim()

  if (
    !normalized ||
    normalized.includes(';') ||
    normalized.includes('{') ||
    normalized.includes('}') ||
    normalized.includes('<') ||
    normalized.includes('>')
  ) {
    return null
  }

  return normalized
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}

/**
 * Concrete branded icon factories
 * ---------------------------------------------------------------------------
 *
 * All factories are asynchronous because Leaflet is loaded lazily through
 * `loadLeaflet()`.
 *
 * Components should not call these directly during render. Use a client-only
 * icon hook that resolves and stores the icon, or preload Leaflet and icons
 * before rendering dense marker collections.
 */

/**
 * Create or return a cached branded venue icon.
 */
export async function getVenueIcon(
  options: VenueIconOptions
): Promise<DivIcon> {
  const visualState = normalizeVenueVisualState(
    options.visualState
  )

  const scale = normalizeMarkerScale(
    options.scale
  )

  const selected =
    options.selected === true ||
    visualState === 'selected'

  const dimmed = options.dimmed === true
  const interactive = options.interactive !== false

  const routeIndex =
    typeof options.routeIndex === 'number' &&
    Number.isFinite(options.routeIndex)
      ? Math.max(0, Math.round(options.routeIndex))
      : null

  const routeRole =
    options.routeRole ??
    (routeIndex !== null
      ? 'middle'
      : null)

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

  const categoryGlyph =
    normalizeMarkerGlyph(
      options.categoryGlyph
    )

  const displayMode =
    categoryGlyph
      ? 'category'
      : normalizeMarkerDisplayMode(
          options.displayMode
        )

  const accentColor =
    resolveMapIconColor(
      options.accentColor,
      getVenueStateAccentColor(
        visualState,
        options.openNow === false
      )
    )

  const openNow =
    options.openNow !== false

  const dimensions = scaleIconDimensions(
    routeIndex !== null
      ? MAP_ICON_BASE_DIMENSIONS.routeStop
      : MAP_ICON_BASE_DIMENSIONS.venue,
    scale
  )

  const cacheKey = createMapIconCacheKey(
    routeIndex !== null
      ? 'route-stop'
      : 'venue',
    [
      visualState,
      displayMode,
      categoryGlyph,
      accentColor,
      selected,
      dimmed,
      interactive,
      openNow,
      routeIndex,
      routeRole,
      hasLiveEvent,
      hasUpcomingEvent,
      isSearchMatch,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  if (routeIndex !== null) {
    return getRouteStopIcon({
      index: routeIndex + 1,
      role: routeRole ?? 'middle',
      color: accentColor,
      selected,
      dimmed,
      interactive,
      scale,
      active: selected,
      completed: false,
      categoryGlyph,
    })
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'venue',
      selected,
      dimmed,
      interactive,
      active: hasLiveEvent,
    }),
    `roam-venue-marker--${visualState}`,
    `roam-venue-marker--${displayMode}`,
    !openNow &&
      'roam-venue-marker--closed',
    hasLiveEvent &&
      'roam-venue-marker--live',
    hasUpcomingEvent &&
      'roam-venue-marker--upcoming',
    isSearchMatch &&
      'roam-venue-marker--search'
  )

  const glyph =
    displayMode === 'category' ||
    displayMode === 'emoji'
      ? categoryGlyph
      : ''

  const eventBadge = hasLiveEvent
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

  const searchIndicator =
    isSearchMatch
      ? `
        <span
          class="roam-venue-marker__search"
          aria-hidden="true"
        ></span>
      `
      : ''

  const statusIndicator =
    openNow
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

  const glyphMarkup =
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

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-accent': accentColor,
    '--roam-marker-opacity':
      dimmed ? 0.42 : 1,
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState: visualState,
    })

  const html = `
    <div
      class="${classes}"
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

        ${statusIndicator}
        ${eventBadge}
        ${searchIndicator}
      </span>

      <span
        class="roam-venue-marker__tip"
        aria-hidden="true"
      ></span>
    </div>
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--venue',
  })
}

/**
 * Create or return a cached numbered route-stop icon.
 */
export async function getRouteStopIcon(
  options: RouteStopIconOptions
): Promise<DivIcon> {
  const scale = normalizeMarkerScale(
    options.scale
  )

  const index =
    normalizeRouteStopNumber(
      options.index
    )

  const role =
    normalizeRouteStopRole(
      options.role
    )

  const selected =
    options.selected === true

  const dimmed =
    options.dimmed === true

  const interactive =
    options.interactive !== false

  const active =
    options.active === true

  const completed =
    options.completed === true

  const categoryGlyph =
    normalizeMarkerGlyph(
      options.categoryGlyph
    )

  const color =
    resolveMapIconColor(
      options.color,
      MAP_ICON_COLORS.cyan
    )

  const dimensions = scaleIconDimensions(
    MAP_ICON_BASE_DIMENSIONS.routeStop,
    scale
  )

  const cacheKey = createMapIconCacheKey(
    'route-stop',
    [
      index,
      role,
      color,
      selected,
      dimmed,
      interactive,
      active,
      completed,
      categoryGlyph,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'route-stop',
      selected,
      dimmed,
      interactive,
      active,
      completed,
    }),
    `roam-route-stop--${role}`,
    categoryGlyph &&
      'roam-route-stop--with-category'
  )

  const roleIndicator =
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

  const completedIndicator =
    completed
      ? `
        <span
          class="roam-route-stop__completed"
          aria-hidden="true"
        >
          ✓
        </span>
      `
      : ''

  const categoryGlyphMarkup =
    categoryGlyph
      ? `
        <span
          class="roam-route-stop__category"
          aria-hidden="true"
        >
          ${escapeMapIconHtml(categoryGlyph)}
        </span>
      `
      : ''

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-accent': color,
    '--roam-marker-opacity':
      dimmed ? 0.5 : 1,
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState: role,
    })

  const html = `
    <div
      class="${classes}"
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

        ${completedIndicator}
      </span>

      ${categoryGlyphMarkup}
      ${roleIndicator}
    </div>
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--route-stop',
  })
}

/**
 * Create or return a cached branded city-overview icon.
 */
export async function getCityOverviewIcon(
  options: CityOverviewIconOptions
): Promise<DivIcon> {
  const scale = normalizeMarkerScale(
    options.scale
  )

  const selected =
    options.selected === true

  const dimmed =
    options.dimmed === true

  const interactive =
    options.interactive !== false

  const abbreviation =
    normalizeCompactMarkerLabel(
      options.abbreviation,
      4
    ) || 'CITY'

  const hasLiveActivity =
    options.hasLiveActivity === true

  const venueCount =
    normalizeOptionalCount(
      options.venueCount
    )

  const liveEventCount =
    normalizeOptionalCount(
      options.liveEventCount
    ) ?? 0

  const dimensions = scaleIconDimensions(
    MAP_ICON_BASE_DIMENSIONS.cityOverview,
    scale
  )

  const cacheKey = createMapIconCacheKey(
    'city-overview',
    [
      abbreviation,
      selected,
      dimmed,
      interactive,
      hasLiveActivity,
      venueCount,
      liveEventCount,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'city-overview',
      selected,
      dimmed,
      interactive,
      active: hasLiveActivity,
    }),
    hasLiveActivity &&
      'roam-city-marker--live'
  )

  const activityMarkup =
    hasLiveActivity
      ? `
        <span
          class="roam-city-marker__activity"
          aria-hidden="true"
        ></span>
      `
      : ''

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

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity':
      dimmed ? 0.48 : 1,
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState:
        hasLiveActivity
          ? 'live'
          : selected
            ? 'selected'
            : 'default',
    })

  const html = `
    <div
      class="${classes}"
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
        ${activityMarkup}
      </span>
    </div>
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--city',
  })
}

/**
 * Create or return a cached user-location icon.
 */
export async function getUserLocationIcon(
  options: UserLocationIconOptions = {}
): Promise<DivIcon> {
  const scale = normalizeMarkerScale(
    options.scale
  )

  const following =
    options.following === true

  const selected =
    options.selected === true

  const dimmed =
    options.dimmed === true

  const interactive =
    options.interactive !== false

  const dimensions = scaleIconDimensions(
    MAP_ICON_BASE_DIMENSIONS.userLocation,
    scale
  )

  const cacheKey = createMapIconCacheKey(
    'user-location',
    [
      following,
      selected,
      dimmed,
      interactive,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'user-location',
      selected,
      dimmed,
      interactive,
      active: following,
    }),
    following &&
      'roam-user-location--following'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity':
      dimmed ? 0.5 : 1,
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState:
        following
          ? 'following'
          : 'default',
    })

  const html = `
    <div
      class="${classes}"
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
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--user-location',
  })
}

/**
 * Create or return a cached branded custom-start icon.
 */
export async function getCustomStartIcon(
  options: CustomStartIconOptions = {}
): Promise<DivIcon> {
  const scale = normalizeMarkerScale(
    options.scale
  )

  const dragging =
    options.dragging === true

  const selected =
    options.selected === true

  const dimmed =
    options.dimmed === true

  const interactive =
    options.interactive !== false

  const dimensions = scaleIconDimensions(
    MAP_ICON_BASE_DIMENSIONS.customStart,
    scale
  )

  const cacheKey = createMapIconCacheKey(
    'custom-start',
    [
      dragging,
      selected,
      dimmed,
      interactive,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'custom-start',
      selected,
      dimmed,
      interactive,
      active: dragging,
    }),
    dragging &&
      'roam-custom-start--dragging'
  )

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity':
      dimmed ? 0.5 : 1,
    '--roam-marker-accent':
      MAP_ICON_COLORS.cyan,
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState:
        dragging
          ? 'dragging'
          : selected
            ? 'selected'
            : 'default',
    })

  const html = `
    <div
      class="${classes}"
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
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--custom-start',
  })
}

/**
 * Create or return a cached branded cluster icon.
 */
export async function getClusterIcon(
  options: ClusterIconOptions
): Promise<DivIcon> {
  const scale = normalizeMarkerScale(
    options.scale
  )

  const selected =
    options.selected === true

  const dimmed =
    options.dimmed === true

  const interactive =
    options.interactive !== false

  const count =
    normalizeRequiredCount(
      options.count
    )

  const liveEventCount =
    normalizeOptionalCount(
      options.liveEventCount
    ) ?? 0

  const hasLiveActivity =
    liveEventCount > 0

  const dimensions = scaleIconDimensions(
    getClusterDimensions(count),
    scale
  )

  const cacheKey = createMapIconCacheKey(
    'cluster',
    [
      count,
      liveEventCount,
      selected,
      dimmed,
      interactive,
      scale,
    ]
  )

  const cached =
    getCachedMapIcon(cacheKey)

  if (cached) {
    return cached
  }

  const classes = joinClassNames(
    createMapIconStateClasses({
      family: 'cluster',
      selected,
      dimmed,
      interactive,
      active: hasLiveActivity,
    }),
    hasLiveActivity &&
      'roam-cluster--live',
    count >= 100 &&
      'roam-cluster--large'
  )

  const liveMarkup =
    hasLiveActivity
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

  const style = createMapIconStyleAttribute({
    '--roam-marker-scale': scale,
    '--roam-marker-opacity':
      dimmed ? 0.46 : 1,
    '--roam-cluster-intensity':
      Math.min(
        1,
        liveEventCount /
          Math.max(1, count)
      ).toFixed(3),
  })

  const attributes =
    createSafeMapIconAttributes({
      role: 'presentation',
      dataState:
        hasLiveActivity
          ? 'live'
          : selected
            ? 'selected'
            : 'default',
    })

  const html = `
    <div
      class="${classes}"
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
  `

  return createCachedDivIcon({
    cacheKey,
    html,
    dimensions,
    className:
      'roam-leaflet-div-icon roam-leaflet-div-icon--cluster',
  })
}

/**
 * Preload a common baseline set of icons.
 *
 * This is optional. It can reduce first-interaction latency on map entry.
 */
export async function preloadCoreMapIcons(): Promise<void> {
  await Promise.all([
    getVenueIcon({
      visualState: 'default',
      displayMode: 'brand',
      scale: 1,
    }),

    getVenueIcon({
      visualState: 'selected',
      displayMode: 'brand',
      selected: true,
      scale: 1,
    }),

    getVenueIcon({
      visualState: 'live-event',
      displayMode: 'brand',
      hasLiveEvent: true,
      scale: 1,
    }),

    getUserLocationIcon({
      scale: 1,
    }),

    getCustomStartIcon({
      scale: 1,
    }),

    getRouteStopIcon({
      index: 1,
      role: 'start',
      scale: 1,
    }),

    getRouteStopIcon({
      index: 2,
      role: 'middle',
      scale: 1,
    }),

    getRouteStopIcon({
      index: 3,
      role: 'end',
      scale: 1,
    }),
  ])
}

/**
 * Resolve the dominant visual state from marker signals.
 *
 * Priority:
 * route stop → selected → search → live event → upcoming event → default
 */
export function resolveVenueIconVisualState({
  routeIndex,
  selected,
  isSearchMatch,
  hasLiveEvent,
  hasUpcomingEvent,
}: {
  routeIndex?: number | null
  selected?: boolean
  isSearchMatch?: boolean
  hasLiveEvent?: boolean
  hasUpcomingEvent?: boolean
}): VenueMarkerVisualState {
  if (
    typeof routeIndex === 'number' &&
    Number.isFinite(routeIndex)
  ) {
    return 'route-stop'
  }

  if (selected) {
    return 'selected'
  }

  if (isSearchMatch) {
    return 'search-match'
  }

  if (hasLiveEvent) {
    return 'live-event'
  }

  if (hasUpcomingEvent) {
    return 'upcoming-event'
  }

  return 'default'
}

/**
 * Return the recommended Leaflet z-index offset for a venue marker.
 */
export function getVenueIconZIndex({
  routeIndex,
  selected,
  hasLiveEvent,
  isSearchMatch,
  dimmed,
}: {
  routeIndex?: number | null
  selected?: boolean
  hasLiveEvent?: boolean
  isSearchMatch?: boolean
  dimmed?: boolean
}): number {
  if (
    typeof routeIndex === 'number' &&
    Number.isFinite(routeIndex)
  ) {
    return 1_000 +
      Math.max(0, Math.round(routeIndex))
  }

  if (selected) return 900
  if (hasLiveEvent) return 400
  if (isSearchMatch) return 300
  if (dimmed) return -100

  return 0
}

/**
 * Return the recommended Leaflet z-index offset for a city overview marker.
 */
export function getCityOverviewIconZIndex({
  selected,
  hasLiveActivity,
}: {
  selected?: boolean
  hasLiveActivity?: boolean
}): number {
  if (selected) return 500
  if (hasLiveActivity) return 200
  return 0
}

/**
 * Return the recommended Leaflet z-index offset for a cluster marker.
 */
export function getClusterIconZIndex({
  selected,
  liveEventCount,
}: {
  selected?: boolean
  liveEventCount?: number
}): number {
  if (selected) return 600

  if (
    Number.isFinite(liveEventCount) &&
    Number(liveEventCount) > 0
  ) {
    return 250
  }

  return 100
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

function normalizeMarkerDisplayMode(
  value:
    | MapMarkerDisplayMode
    | undefined
): MapMarkerDisplayMode {
  switch (value) {
    case 'category':
    case 'emoji':
      return 'category'

    case 'color':
    case 'brand':
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
  value:
    | string
    | null
    | undefined
): string {
  if (!value) return ''

  return value
    .trim()
    .slice(0, 8)
}

function getVenueStateAccentColor(
  visualState: VenueMarkerVisualState,
  closed: boolean
): string {
  if (closed) {
    return MAP_ICON_COLORS.closed
  }

  switch (visualState) {
    case 'route-stop':
      return MAP_ICON_COLORS.cyan

    case 'selected':
      return MAP_ICON_COLORS.white

    case 'search-match':
      return MAP_ICON_COLORS.amber

    case 'live-event':
      return MAP_ICON_COLORS.violet

    case 'upcoming-event':
      return MAP_ICON_COLORS.indigo

    case 'default':
    default:
      return MAP_ICON_COLORS.cyan
  }
}

function normalizeOptionalCount(
  value:
    | number
    | null
    | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return Math.max(
    0,
    Math.round(value)
  )
}

function normalizeRequiredCount(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.max(
    1,
    Math.round(value)
  )
}

function compactCount(
  value: number
): string {
  const normalized =
    Math.max(
      0,
      Math.round(value)
    )

  if (normalized < 1_000) {
    return String(normalized)
  }

  if (normalized < 10_000) {
    const compact =
      normalized / 1_000

    return `${
      compact
        .toFixed(1)
        .replace(/\.0$/, '')
    }k`
  }

  if (normalized < 1_000_000) {
    return `${Math.floor(
      normalized / 1_000
    )}k`
  }

  const compact =
    normalized / 1_000_000

  return `${
    compact
      .toFixed(1)
      .replace(/\.0$/, '')
  }m`
}

function getClusterDimensions(
  count: number
): MapIconDimensions {
  if (count >= 100) {
    return {
      width: 58,
      height: 58,
      anchorX: 29,
      anchorY: 29,
      popupAnchorX: 0,
      popupAnchorY: -34,
      tooltipAnchorX: 0,
      tooltipAnchorY: -34,
    }
  }

  if (count >= 25) {
    return {
      width: 52,
      height: 52,
      anchorX: 26,
      anchorY: 26,
      popupAnchorX: 0,
      popupAnchorY: -30,
      tooltipAnchorX: 0,
      tooltipAnchorY: -30,
    }
  }

  return MAP_ICON_BASE_DIMENSIONS.cluster
}