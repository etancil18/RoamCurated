// lib/guides/buildGuideConfig.ts

import {
  DEFAULT_GUIDE_BRAND_COLORS,
  type GuideAccessMode,
  type GuideBrandConfig,
  type GuideBrandRow,
  type GuideConfig,
  type GuideConfigResult,
  type GuideFeaturedVenueConfig,
  type GuideFeaturedVenueRow,
  type GuideJson,
  type GuideLookupResult,
  type GuidePropertySummary,
  type GuideSectionConfig,
  type GuideSectionDisplayStyle,
  type GuideSectionKey,
  type GuideSectionOptions,
  type GuideVenueSummary,
  type PropertyGuideRow,
  type PropertyGuideSectionRow,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Public Types                                     */
/* ------------------------------------------------ */

export type BuildGuideConfigOptions = {
  /**
   * Public mode requires the guide to be active.
   * Preview and admin modes can build draft or archived guides.
   */
  accessMode?: GuideAccessMode

  /**
   * Used when evaluating venue visibility windows.
   * Defaults to the current time.
   */
  now?: Date

  /**
   * Hidden sections are normally excluded so preview matches
   * the public guide. Admin tools may opt into seeing them.
   */
  includeHiddenSections?: boolean

  /**
   * Hidden featured venues are normally excluded.
   */
  includeHiddenFeaturedVenues?: boolean

  /**
   * Visibility windows are normally enforced.
   * Set false only for administrative inspection tools.
   */
  enforceVisibilityWindows?: boolean
}

/* ------------------------------------------------ */
/* Defaults                                         */
/* ------------------------------------------------ */

const DEFAULT_BRAND_ID = 'roam-default'
const DEFAULT_BRAND_NAME = 'Roam'
const DEFAULT_BRAND_SLUG = 'roam'

const GUIDE_SECTION_KEYS = new Set<GuideSectionKey>([
  'welcome',
  'favorites',
  'suggested_routes',
  'coffee',
  'dining',
  'bars',
  'wellness',
  'events',
  'map',
  'partner_offers',
  'custom',
])

const GUIDE_DISPLAY_STYLES =
  new Set<GuideSectionDisplayStyle>([
    'grid',
    'list',
    'carousel',
    'compact',
    'featured',
  ])

/* ------------------------------------------------ */
/* Main Builder                                     */
/* ------------------------------------------------ */

export function buildGuideConfig(
  lookup: GuideLookupResult,
  options: BuildGuideConfigOptions = {}
): GuideConfigResult {
  const {
    accessMode = 'public',
    now = new Date(),
    includeHiddenSections = false,
    includeHiddenFeaturedVenues = false,
    enforceVisibilityWindows = true,
  } = options

  try {
    const guide = normalizeGuideRow(lookup.guide)

    if (!guide) {
      return invalidConfiguration()
    }

    if (
      accessMode === 'public' &&
      guide.status !== 'active'
    ) {
      return {
        found: false,
        config: null,
        reason: 'inactive',
      }
    }

    const property = normalizeProperty(lookup.property)

    if (!property) {
      return {
        found: false,
        config: null,
        reason: 'missing_property',
      }
    }

    if (property.id !== guide.property_id) {
      return invalidConfiguration()
    }

    const brand = buildBrandConfig(
      lookup.brand,
      guide,
      property
    )

    const allSections = normalizeSections(
      lookup.sections,
      guide.id
    )

    const sections = allSections
      .filter(
        (section) =>
          includeHiddenSections ||
          section.isVisible
      )
      .sort(sortSections)

    const allowedSectionKeys = new Set(
      sections.map((section) => section.key)
    )

    const featuredVenues =
      normalizeFeaturedVenues(
        lookup.featuredVenues,
        guide.id
      )
        .filter((item) => {
          if (
            !includeHiddenFeaturedVenues &&
            !item.isVisible
          ) {
            return false
          }

          if (
            !allowedSectionKeys.has(item.sectionKey)
          ) {
            return false
          }

          if (
            enforceVisibilityWindows &&
            !isVisibleAtDate(item, now)
          ) {
            return false
          }

          return true
        })
        .sort(sortFeaturedVenues)

    const config: GuideConfig = {
      id: guide.id,
      propertyId: guide.property_id,
      brandId: guide.brand_id,

      title: guide.title,
      subtitle: guide.subtitle,
      slug: guide.slug,

      status: guide.status,
      guideMode: guide.guide_mode,

      welcomeHeading: guide.welcome_heading,
      welcomeDescription:
        guide.welcome_description,
      heroImageUrl: guide.hero_image_url,

      showPropertyFavorites:
        guide.show_property_favorites,
      showSuggestedRoutes:
        guide.show_suggested_routes,
      showNearbyEvents:
        guide.show_nearby_events,
      showPartnerOffers:
        guide.show_partner_offers,

      defaultTravelMode:
        guide.default_travel_mode,
      poweredByRoam:
        resolvePoweredByRoam(guide, brand),

      publishedAt: guide.published_at,
      createdAt: guide.created_at,
      updatedAt: guide.updated_at,

      property,
      brand,
      sections,
      featuredVenues,
    }

    return {
      found: true,
      config,
    }
  } catch (error) {
    console.error(
      '[buildGuideConfig] Failed to build guide configuration:',
      error
    )

    return invalidConfiguration()
  }
}

/* ------------------------------------------------ */
/* Guide Normalization                              */
/* ------------------------------------------------ */

function normalizeGuideRow(
  value: PropertyGuideRow | null | undefined
): PropertyGuideRow | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = cleanRequiredString(value.id)
  const propertyId = cleanRequiredString(
    value.property_id
  )
  const title = cleanRequiredString(value.title)
  const slug = cleanRequiredString(value.slug)

  if (!id || !propertyId || !title || !slug) {
    return null
  }

  if (!isValidSlug(slug)) {
    return null
  }

  if (
    value.status !== 'draft' &&
    value.status !== 'active' &&
    value.status !== 'archived'
  ) {
    return null
  }

  if (
    value.guide_mode !== 'roam' &&
    value.guide_mode !== 'hotel' &&
    value.guide_mode !== 'partner' &&
    value.guide_mode !== 'concierge'
  ) {
    return null
  }

  if (
    value.default_travel_mode !== 'walking' &&
    value.default_travel_mode !== 'driving' &&
    value.default_travel_mode !== 'transit' &&
    value.default_travel_mode !== 'rideshare'
  ) {
    return null
  }

  return {
    ...value,

    id,
    property_id: propertyId,
    brand_id:
      cleanOptionalString(value.brand_id),

    title,
    subtitle:
      cleanOptionalString(value.subtitle),
    slug,

    welcome_heading:
      cleanOptionalString(
        value.welcome_heading
      ),

    welcome_description:
      cleanOptionalString(
        value.welcome_description
      ),

    hero_image_url:
      cleanOptionalString(
        value.hero_image_url
      ),

    show_property_favorites:
      value.show_property_favorites !== false,

    show_suggested_routes:
      value.show_suggested_routes !== false,

    show_nearby_events:
      value.show_nearby_events !== false,

    show_partner_offers:
      value.show_partner_offers === true,

    powered_by_roam:
      value.powered_by_roam !== false,

    published_at:
      normalizeIsoDateOrNull(
        value.published_at
      ),

    created_at:
      normalizeIsoDate(
        value.created_at
      ),

    updated_at:
      normalizeIsoDate(
        value.updated_at
      ),
  }
}

/* ------------------------------------------------ */
/* Property Normalization                           */
/* ------------------------------------------------ */

function normalizeProperty(
  value:
    | GuidePropertySummary
    | null
    | undefined
): GuidePropertySummary | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = cleanRequiredString(value.id)
  const name = cleanRequiredString(value.name)
  const slug = cleanRequiredString(value.slug)
  const city = cleanRequiredString(value.city)

  const lat = toFiniteNumber(value.lat)
  const lon = toFiniteNumber(value.lon)

  if (
    !id ||
    !name ||
    !slug ||
    !city ||
    lat === null ||
    lon === null
  ) {
    return null
  }

  return {
    id,
    name,
    slug,
    city,
    lat,
    lon,

    address:
      cleanOptionalString(value.address),

    website:
      cleanOptionalString(value.website),

    welcomeDescription:
      cleanOptionalString(
        value.welcomeDescription
      ),

    hostName:
      cleanOptionalString(value.hostName),
  }
}

/* ------------------------------------------------ */
/* Brand Normalization                              */
/* ------------------------------------------------ */

function buildBrandConfig(
  value: GuideBrandRow | null,
  guide: PropertyGuideRow,
  property: GuidePropertySummary
): GuideBrandConfig {
  if (!value) {
    return buildDefaultBrand(
      guide,
      property
    )
  }

  const brandingMode =
    value.branding_mode === 'roam' ||
    value.branding_mode === 'co_branded' ||
    value.branding_mode === 'white_label'
      ? value.branding_mode
      : 'co_branded'

  return {
    id:
      cleanRequiredString(value.id) ??
      DEFAULT_BRAND_ID,

    name:
      cleanRequiredString(value.name) ??
      property.name ??
      DEFAULT_BRAND_NAME,

    slug:
      cleanRequiredString(value.slug) ??
      DEFAULT_BRAND_SLUG,

    logoUrl:
      normalizeAssetUrl(value.logo_url),

    faviconUrl:
      normalizeAssetUrl(
        value.favicon_url
      ),

    primaryColor: normalizeHexColor(
      value.primary_color,
      DEFAULT_GUIDE_BRAND_COLORS.primaryColor
    ),

    secondaryColor: normalizeHexColor(
      value.secondary_color,
      DEFAULT_GUIDE_BRAND_COLORS.secondaryColor
    ),

    accentColor: normalizeHexColor(
      value.accent_color,
      DEFAULT_GUIDE_BRAND_COLORS.accentColor
    ),

    backgroundColor: normalizeHexColor(
      value.background_color,
      DEFAULT_GUIDE_BRAND_COLORS.backgroundColor
    ),

    surfaceColor: normalizeHexColor(
      value.surface_color,
      DEFAULT_GUIDE_BRAND_COLORS.surfaceColor
    ),

    textColor: normalizeHexColor(
      value.text_color,
      DEFAULT_GUIDE_BRAND_COLORS.textColor
    ),

    mutedTextColor: normalizeHexColor(
      value.muted_text_color,
      DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor
    ),

    buttonTextColor: normalizeHexColor(
      value.button_text_color,
      DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor
    ),

    fontFamily:
      cleanOptionalString(
        value.font_family
      ),

    brandingMode,

    poweredByRoam:
      value.powered_by_roam !== false,

    customCss:
      cleanOptionalString(
        value.custom_css
      ),
  }
}

function buildDefaultBrand(
  guide: PropertyGuideRow,
  property: GuidePropertySummary
): GuideBrandConfig {
  const shouldUsePropertyName =
    guide.guide_mode === 'hotel' ||
    guide.guide_mode === 'partner' ||
    guide.guide_mode === 'concierge'

  return {
    id: DEFAULT_BRAND_ID,

    name: shouldUsePropertyName
      ? property.name
      : DEFAULT_BRAND_NAME,

    slug: shouldUsePropertyName
      ? property.slug
      : DEFAULT_BRAND_SLUG,

    logoUrl: null,
    faviconUrl: null,

    primaryColor:
      DEFAULT_GUIDE_BRAND_COLORS.primaryColor,

    secondaryColor:
      DEFAULT_GUIDE_BRAND_COLORS.secondaryColor,

    accentColor:
      DEFAULT_GUIDE_BRAND_COLORS.accentColor,

    backgroundColor:
      DEFAULT_GUIDE_BRAND_COLORS.backgroundColor,

    surfaceColor:
      DEFAULT_GUIDE_BRAND_COLORS.surfaceColor,

    textColor:
      DEFAULT_GUIDE_BRAND_COLORS.textColor,

    mutedTextColor:
      DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor,

    buttonTextColor:
      DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor,

    fontFamily: null,

    brandingMode:
      guide.guide_mode === 'roam'
        ? 'roam'
        : 'co_branded',

    poweredByRoam:
      guide.powered_by_roam !== false,

    customCss: null,
  }
}

function resolvePoweredByRoam(
  guide: PropertyGuideRow,
  brand: GuideBrandConfig
) {
  return (
    guide.powered_by_roam !== false &&
    brand.poweredByRoam !== false
  )
}

/* ------------------------------------------------ */
/* Section Normalization                            */
/* ------------------------------------------------ */

function normalizeSections(
  rows: PropertyGuideSectionRow[],
  guideId: string
): GuideSectionConfig[] {
  if (!Array.isArray(rows)) {
    return []
  }

  const seenIds = new Set<string>()
  const seenNonCustomKeys =
    new Set<GuideSectionKey>()

  const result: GuideSectionConfig[] = []

  for (const row of rows) {
    const normalized =
      normalizeSection(row, guideId)

    if (!normalized) {
      continue
    }

    if (seenIds.has(normalized.id)) {
      continue
    }

    if (
      normalized.key !== 'custom' &&
      seenNonCustomKeys.has(normalized.key)
    ) {
      continue
    }

    seenIds.add(normalized.id)

    if (normalized.key !== 'custom') {
      seenNonCustomKeys.add(normalized.key)
    }

    result.push(normalized)
  }

  return result
}

function normalizeSection(
  value: PropertyGuideSectionRow,
  guideId: string
): GuideSectionConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = cleanRequiredString(value.id)
  const rowGuideId = cleanRequiredString(
    value.guide_id
  )

  if (
    !id ||
    !rowGuideId ||
    rowGuideId !== guideId ||
    !isGuideSectionKey(
      value.section_key
    )
  ) {
    return null
  }

  return {
    id,
    guideId: rowGuideId,

    key: value.section_key,

    title:
      cleanOptionalString(value.title),

    subtitle:
      cleanOptionalString(
        value.subtitle
      ),

    position:
      normalizePosition(value.position),

    isVisible:
      value.is_visible !== false,

    config:
      normalizeSectionOptions(
        value.config
      ),
  }
}

function normalizeSectionOptions(
  value: GuideJson | null
): GuideSectionOptions {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return {}
  }

  const raw = value as Record<
    string,
    GuideJson | undefined
  >

  const options: GuideSectionOptions = {
    ...raw,
  }

  const limit = toFiniteNumber(raw.limit)

  if (
    limit !== null &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 100
  ) {
    options.limit = limit
  } else {
    delete options.limit
  }

  if (
    typeof raw.displayStyle === 'string' &&
    isGuideDisplayStyle(
      raw.displayStyle
    )
  ) {
    options.displayStyle =
      raw.displayStyle
  } else {
    delete options.displayStyle
  }

  assignOptionalString(
    options,
    'titleOverride',
    raw.titleOverride
  )

  assignOptionalString(
    options,
    'subtitleOverride',
    raw.subtitleOverride
  )

  assignOptionalBoolean(
    options,
    'showDescriptions',
    raw.showDescriptions
  )

  assignOptionalBoolean(
    options,
    'showDistance',
    raw.showDistance
  )

  assignOptionalBoolean(
    options,
    'showImages',
    raw.showImages
  )

  assignOptionalBoolean(
    options,
    'showMapLink',
    raw.showMapLink
  )

  assignOptionalString(
    options,
    'routeTheme',
    raw.routeTheme
  )

  const venueTypes =
    normalizeStringArray(
      raw.venueTypes
    )

  if (venueTypes.length > 0) {
    options.venueTypes = venueTypes
  } else {
    delete options.venueTypes
  }

  return options
}

/* ------------------------------------------------ */
/* Featured Venue Normalization                     */
/* ------------------------------------------------ */

function normalizeFeaturedVenues(
  rows: Array<
    GuideFeaturedVenueRow & {
      venue?: GuideVenueSummary | null
    }
  >,
  guideId: string
): GuideFeaturedVenueConfig[] {
  if (!Array.isArray(rows)) {
    return []
  }

  const seenIds = new Set<string>()
  const seenAssignments = new Set<string>()

  const result: GuideFeaturedVenueConfig[] = []

  for (const row of rows) {
    const normalized =
      normalizeFeaturedVenue(
        row,
        guideId
      )

    if (!normalized) {
      continue
    }

    if (seenIds.has(normalized.id)) {
      continue
    }

    const assignmentKey =
      `${normalized.sectionKey}:${normalized.venueId}`

    if (
      seenAssignments.has(
        assignmentKey
      )
    ) {
      continue
    }

    seenIds.add(normalized.id)
    seenAssignments.add(
      assignmentKey
    )

    result.push(normalized)
  }

  return result
}

function normalizeFeaturedVenue(
  value: GuideFeaturedVenueRow & {
    venue?: GuideVenueSummary | null
  },
  guideId: string
): GuideFeaturedVenueConfig | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = cleanRequiredString(value.id)
  const rowGuideId = cleanRequiredString(
    value.guide_id
  )
  const venueId = cleanRequiredString(
    value.venue_id
  )

  if (
    !id ||
    !rowGuideId ||
    !venueId ||
    rowGuideId !== guideId ||
    !isGuideSectionKey(
      value.section_key
    )
  ) {
    return null
  }

  const venue =
    normalizeVenueSummary(
      value.venue
    )

  if (
    venue &&
    venue.id !== venueId
  ) {
    return null
  }

  return {
    id,
    guideId: rowGuideId,
    venueId,

    sectionKey:
      value.section_key,

    label:
      cleanOptionalString(value.label),

    description:
      cleanOptionalString(
        value.description
      ),

    conciergeNote:
      cleanOptionalString(
        value.concierge_note
      ),

    position:
      normalizePosition(value.position),

    isFeatured:
      value.is_featured === true,

    isVisible:
      value.is_visible !== false,

    visibleFrom:
      normalizeIsoDateOrNull(
        value.visible_from
      ),

    visibleUntil:
      normalizeIsoDateOrNull(
        value.visible_until
      ),

    venue,
  }
}

function normalizeVenueSummary(
  value:
    | GuideVenueSummary
    | null
    | undefined
): GuideVenueSummary | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const id = cleanRequiredString(value.id)
  const name = cleanRequiredString(
    value.name
  )

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,

    city:
      cleanOptionalString(value.city),

    description:
      cleanOptionalString(
        value.description
      ),

    address:
      cleanOptionalString(
        value.address
      ),

    cover:
      normalizeAssetUrl(value.cover),

    link:
      cleanOptionalString(value.link) ??
      `/venue-profile/${id}`,

    type:
      normalizeStringOrArray(
        value.type
      ),

    tags:
      normalizeStringOrArray(
        value.tags
      ),

    vibe:
      normalizeStringOrArray(
        value.vibe
      ),

    lat:
      toFiniteNumber(value.lat),

    lon:
      toFiniteNumber(value.lon),
  }
}

/* ------------------------------------------------ */
/* Visibility                                      */
/* ------------------------------------------------ */

function isVisibleAtDate(
  item: GuideFeaturedVenueConfig,
  now: Date
) {
  const nowTime = now.getTime()

  if (Number.isNaN(nowTime)) {
    return true
  }

  if (item.visibleFrom) {
    const visibleFrom =
      new Date(item.visibleFrom).getTime()

    if (
      Number.isFinite(visibleFrom) &&
      nowTime < visibleFrom
    ) {
      return false
    }
  }

  if (item.visibleUntil) {
    const visibleUntil =
      new Date(item.visibleUntil).getTime()

    if (
      Number.isFinite(visibleUntil) &&
      nowTime > visibleUntil
    ) {
      return false
    }
  }

  return true
}

/* ------------------------------------------------ */
/* Sorting                                          */
/* ------------------------------------------------ */

function sortSections(
  a: GuideSectionConfig,
  b: GuideSectionConfig
) {
  if (a.position !== b.position) {
    return a.position - b.position
  }

  return a.key.localeCompare(b.key)
}

function sortFeaturedVenues(
  a: GuideFeaturedVenueConfig,
  b: GuideFeaturedVenueConfig
) {
  if (a.sectionKey !== b.sectionKey) {
    return a.sectionKey.localeCompare(
      b.sectionKey
    )
  }

  if (a.position !== b.position) {
    return a.position - b.position
  }

  if (a.isFeatured !== b.isFeatured) {
    return a.isFeatured ? -1 : 1
  }

  return (
    a.venue?.name.localeCompare(
      b.venue?.name ?? ''
    ) ?? 0
  )
}

/* ------------------------------------------------ */
/* Generic Normalizers                              */
/* ------------------------------------------------ */

function cleanRequiredString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const cleaned = value.trim()

  return cleaned.length > 0
    ? cleaned
    : null
}

function cleanOptionalString(
  value: unknown
): string | null {
  return cleanRequiredString(value)
}

function normalizePosition(
  value: unknown
) {
  const number = toFiniteNumber(value)

  if (number === null) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(number)
  )
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (
    typeof value === 'string' &&
    value.trim()
  ) {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function normalizeIsoDate(
  value: unknown
): string {
  const normalized =
    normalizeIsoDateOrNull(value)

  return normalized ?? ''
}

function normalizeIsoDateOrNull(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function normalizeHexColor(
  value: unknown,
  fallback: string
) {
  if (
    typeof value === 'string' &&
    /^#[0-9a-f]{6}$/i.test(
      value.trim()
    )
  ) {
    return value.trim().toLowerCase()
  }

  return fallback
}

function normalizeAssetUrl(
  value: unknown
): string | null {
  const cleaned =
    cleanOptionalString(value)

  if (!cleaned) {
    return null
  }

  if (
    cleaned.startsWith('/') ||
    cleaned.startsWith('https://') ||
    cleaned.startsWith('http://')
  ) {
    return cleaned
  }

  return `/${cleaned}`
}

function normalizeStringOrArray(
  value: unknown
): string | string[] | null {
  if (typeof value === 'string') {
    const cleaned = value.trim()

    return cleaned || null
  }

  if (Array.isArray(value)) {
    const normalized =
      normalizeStringArray(value)

    return normalized.length > 0
      ? normalized
      : null
  }

  return null
}

function normalizeStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .filter(
          (
            item
          ): item is string =>
            typeof item === 'string'
        )
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
    ),
  ]
}

function assignOptionalString<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  target: T,
  key: K,
  value: unknown
) {
  const normalized =
    cleanOptionalString(value)

  if (normalized) {
    target[key] =
      normalized as T[K]
  } else {
    delete target[key]
  }
}

function assignOptionalBoolean<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  target: T,
  key: K,
  value: unknown
) {
  if (typeof value === 'boolean') {
    target[key] = value as T[K]
  } else {
    delete target[key]
  }
}

/* ------------------------------------------------ */
/* Type Guards                                      */
/* ------------------------------------------------ */

function isGuideSectionKey(
  value: unknown
): value is GuideSectionKey {
  return (
    typeof value === 'string' &&
    GUIDE_SECTION_KEYS.has(
      value as GuideSectionKey
    )
  )
}

function isGuideDisplayStyle(
  value: unknown
): value is GuideSectionDisplayStyle {
  return (
    typeof value === 'string' &&
    GUIDE_DISPLAY_STYLES.has(
      value as GuideSectionDisplayStyle
    )
  )
}

function isValidSlug(
  value: string
) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value
  )
}

/* ------------------------------------------------ */
/* Result Helpers                                   */
/* ------------------------------------------------ */

function invalidConfiguration(): GuideConfigResult {
  return {
    found: false,
    config: null,
    reason: 'invalid_configuration',
  }
}