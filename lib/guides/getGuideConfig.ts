// lib/guides/getGuideConfig.ts

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'

import {
  DEFAULT_GUIDE_SECTIONS,
  type GuideBrandConfig,
  type GuideBrandRow,
  type GuideConfig,
  type GuideConfigResult,
  type GuideFeaturedVenueConfig,
  type GuideFeaturedVenueRow,
  type GuideJson,
  type GuideMode,
  type GuidePropertySummary,
  type GuideSectionConfig,
  type GuideSectionKey,
  type GuideSectionOptions,
  type GuideStatus,
  type GuideTravelMode,
  type GuideVenueSummary,
  type PropertyGuideRow,
  type PropertyGuideSectionRow,
} from './types'

import {
  DEFAULT_GUIDE_BRAND,
  normalizeGuideBrand,
} from './guideTheme'

/* ------------------------------------------------ */
/* Public Types                                     */
/* ------------------------------------------------ */

export type GetGuideConfigOptions = {
  /**
   * Allows draft and archived guides to be returned.
   *
   * This should only be enabled after the caller has independently
   * verified that the current user is authorized to preview the guide.
   */
  includeInactive?: boolean

  /**
   * When true, missing section rows are supplemented with the default
   * guide sections defined in lib/guides/types.ts.
   */
  includeDefaultSections?: boolean

  /**
   * When true, featured venues outside their visibility window are
   * included. Intended for authenticated admin preview surfaces.
   */
  includeScheduledFeaturedVenues?: boolean
}

/* ------------------------------------------------ */
/* Internal Database Shapes                         */
/* ------------------------------------------------ */

type RawPropertyRow = {
  id: string
  name: string | null
  slug: string | null
  city: string | null
  lat: number | string | null
  lon: number | string | null

  address?: string | null
  website?: string | null
  welcome_description?: string | null
  host_name?: string | null
}

type RawGuideBrandRow = Partial<GuideBrandRow> & {
  id: string
  name: string | null
  slug: string | null
}

type RawPropertyGuideRow = Partial<PropertyGuideRow> & {
  id: string
  property_id: string
  brand_id: string | null

  title: string | null
  subtitle: string | null
  slug: string | null

  status: string | null
  guide_mode: string | null
}

type RawPropertyGuideSectionRow = Partial<PropertyGuideSectionRow> & {
  id: string
  guide_id: string
  section_key: string | null
}

type RawGuideFeaturedVenueRow = Partial<GuideFeaturedVenueRow> & {
  id: string
  guide_id: string
  venue_id: string
  section_key: string | null
}

type RawVenueRow = {
  id: string
  name: string | null

  city?: string | null
  description?: string | null
  address?: string | null
  cover?: string | null
  type?: string | string[] | null
  tags?: string | string[] | null
  vibe?: string | string[] | null

  lat?: number | string | null
  lon?: number | string | null
}

/* ------------------------------------------------ */
/* Valid Values                                     */
/* ------------------------------------------------ */

const GUIDE_STATUSES = new Set<GuideStatus>([
  'draft',
  'active',
  'archived',
])

const GUIDE_MODES = new Set<GuideMode>([
  'roam',
  'hotel',
  'partner',
  'concierge',
])

const GUIDE_TRAVEL_MODES = new Set<GuideTravelMode>([
  'walking',
  'driving',
  'transit',
  'rideshare',
])

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

/* ------------------------------------------------ */
/* Primary Public Loader                            */
/* ------------------------------------------------ */

/**
 * Loads a complete normalized guide configuration by public guide slug.
 *
 * Returns null when:
 * - the guide does not exist
 * - the guide is not active and includeInactive is false
 * - the associated property does not exist
 * - required guide or property data is invalid
 */
export async function getGuideConfig(
  guideSlug: string,
  options: GetGuideConfigOptions = {}
): Promise<GuideConfig | null> {
  const result = await getGuideConfigResult(guideSlug, options)

  return result.found ? result.config : null
}

/**
 * Same loader as getGuideConfig, but returns a structured failure reason.
 *
 * Use this in admin previews, diagnostics, logging, and tests.
 */
export async function getGuideConfigResult(
  guideSlug: string,
  options: GetGuideConfigOptions = {}
): Promise<GuideConfigResult> {
  const normalizedSlug = normalizeSlug(guideSlug)

  if (!normalizedSlug) {
    return {
      found: false,
      config: null,
      reason: 'not_found',
    }
  }

  try {
    const supabase = await createServerClient()

    /*
     * These guide tables may not yet exist in the generated Supabase
     * Database type. The local cast isolates that concern to this loader
     * without weakening the rest of the application.
     */
    const db = supabase as unknown as SupabaseClient<any>

    const guide = await loadGuideRow(db, normalizedSlug)

    if (!guide) {
      return {
        found: false,
        config: null,
        reason: 'not_found',
      }
    }

    const status = normalizeGuideStatus(guide.status)

    if (!options.includeInactive && status !== 'active') {
      return {
        found: false,
        config: null,
        reason: 'inactive',
      }
    }

    const property = await loadGuideProperty(db, guide.property_id)

    if (!property) {
      return {
        found: false,
        config: null,
        reason: 'missing_property',
      }
    }

    const [
      brandRow,
      sectionRows,
      featuredVenueRows,
    ] = await Promise.all([
      guide.brand_id
        ? loadGuideBrand(db, guide.brand_id)
        : Promise.resolve(null),
      loadGuideSections(db, guide.id),
      loadGuideFeaturedVenues(db, guide.id),
    ])

    const venueIds = uniqueStrings(
      featuredVenueRows.map((row) => row.venue_id)
    )

    const venueRows =
      venueIds.length > 0
        ? await loadVenuesByIds(db, venueIds)
        : []

    const venueById = new Map(
      venueRows.map((venue) => [
        venue.id,
        normalizeGuideVenue(venue),
      ])
    )

    const brand = normalizeGuideBrand(
      brandRow
        ? normalizeGuideBrandRow(brandRow)
        : DEFAULT_GUIDE_BRAND
    )

    const sections = normalizeGuideSections({
      guideId: guide.id,
      rows: sectionRows,
      includeDefaults:
        options.includeDefaultSections !== false,
    })

    const featuredVenues = normalizeFeaturedVenues({
      rows: featuredVenueRows,
      venueById,
      includeScheduled:
        options.includeScheduledFeaturedVenues === true,
    })

    const config = buildNormalizedGuideConfig({
      guide,
      property,
      brand,
      sections,
      featuredVenues,
    })

    if (!config) {
      return {
        found: false,
        config: null,
        reason: 'invalid_configuration',
      }
    }

    return {
      found: true,
      config,
    }
  } catch (error) {
    console.error('[getGuideConfig] Failed to load guide:', {
      guideSlug: normalizedSlug,
      error,
    })

    return {
      found: false,
      config: null,
      reason: 'invalid_configuration',
    }
  }
}

/* ------------------------------------------------ */
/* Direct ID Loader                                 */
/* ------------------------------------------------ */

/**
 * Loads a guide by ID.
 *
 * This is useful inside venue-admin after a guide has been selected.
 * It intentionally follows the same normalization path as the public
 * slug loader.
 */
export async function getGuideConfigById(
  guideId: string,
  options: GetGuideConfigOptions = {}
): Promise<GuideConfig | null> {
  const normalizedGuideId = cleanText(guideId)

  if (!normalizedGuideId) return null

  try {
    const supabase = await createServerClient()
    const db = supabase as unknown as SupabaseClient<any>

    const { data, error } = await db
      .from('property_guides')
      .select('slug')
      .eq('id', normalizedGuideId)
      .maybeSingle()

    if (error) {
      console.error(
        '[getGuideConfigById] Guide lookup failed:',
        error
      )

      return null
    }

    const slug = normalizeSlug(data?.slug)

    if (!slug) return null

    return getGuideConfig(slug, options)
  } catch (error) {
    console.error('[getGuideConfigById] Failed to load guide:', {
      guideId: normalizedGuideId,
      error,
    })

    return null
  }
}

/* ------------------------------------------------ */
/* Database Queries                                 */
/* ------------------------------------------------ */

async function loadGuideRow(
  db: SupabaseClient<any>,
  slug: string
): Promise<RawPropertyGuideRow | null> {
  const { data, error } = await db
    .from('property_guides')
    .select(
      `
      id,
      property_id,
      brand_id,
      title,
      subtitle,
      slug,
      status,
      guide_mode,
      welcome_heading,
      welcome_description,
      hero_image_url,
      show_property_favorites,
      show_suggested_routes,
      show_nearby_events,
      show_partner_offers,
      default_travel_mode,
      powered_by_roam,
      published_at,
      created_at,
      updated_at
    `
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[getGuideConfig] Guide query failed:', error)
    return null
  }

  if (!data?.id || !data?.property_id) {
    return null
  }

  return data as RawPropertyGuideRow
}

async function loadGuideProperty(
  db: SupabaseClient<any>,
  propertyId: string
): Promise<RawPropertyRow | null> {
  const { data, error } = await db
    .from('properties')
    .select(
      `
      id,
      name,
      slug,
      city,
      lat,
      lon,
      address,
      website,
      welcome_description,
      host_name
    `
    )
    .eq('id', propertyId)
    .maybeSingle()

  if (error) {
    console.error('[getGuideConfig] Property query failed:', error)
    return null
  }

  if (!data?.id) return null

  return data as RawPropertyRow
}

async function loadGuideBrand(
  db: SupabaseClient<any>,
  brandId: string
): Promise<RawGuideBrandRow | null> {
  const { data, error } = await db
    .from('guide_brands')
    .select(
      `
      id,
      name,
      slug,
      logo_url,
      favicon_url,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      surface_color,
      text_color,
      muted_text_color,
      button_text_color,
      font_family,
      branding_mode,
      powered_by_roam,
      custom_css,
      created_at,
      updated_at
    `
    )
    .eq('id', brandId)
    .maybeSingle()

  if (error) {
    console.error('[getGuideConfig] Brand query failed:', error)
    return null
  }

  if (!data?.id) return null

  return data as RawGuideBrandRow
}

async function loadGuideSections(
  db: SupabaseClient<any>,
  guideId: string
): Promise<RawPropertyGuideSectionRow[]> {
  const { data, error } = await db
    .from('property_guide_sections')
    .select(
      `
      id,
      guide_id,
      section_key,
      title,
      subtitle,
      position,
      is_visible,
      config,
      created_at,
      updated_at
    `
    )
    .eq('guide_id', guideId)
    .order('position', { ascending: true })

  if (error) {
    console.error('[getGuideConfig] Sections query failed:', error)
    return []
  }

  return (data ?? []) as RawPropertyGuideSectionRow[]
}

async function loadGuideFeaturedVenues(
  db: SupabaseClient<any>,
  guideId: string
): Promise<RawGuideFeaturedVenueRow[]> {
  const { data, error } = await db
    .from('guide_featured_venues')
    .select(
      `
      id,
      guide_id,
      venue_id,
      section_key,
      label,
      description,
      concierge_note,
      position,
      is_featured,
      is_visible,
      visible_from,
      visible_until,
      created_at,
      updated_at
    `
    )
    .eq('guide_id', guideId)
    .order('position', { ascending: true })

  if (error) {
    console.error(
      '[getGuideConfig] Featured venues query failed:',
      error
    )

    return []
  }

  return (data ?? []) as RawGuideFeaturedVenueRow[]
}

async function loadVenuesByIds(
  db: SupabaseClient<any>,
  venueIds: string[]
): Promise<RawVenueRow[]> {
  if (venueIds.length === 0) return []

  const { data, error } = await db
    .from('venues')
    .select(
      `
      id,
      name,
      city,
      description,
      address,
      cover,
      type,
      tags,
      vibe,
      lat,
      lon
    `
    )
    .in('id', venueIds)

  if (error) {
    console.error(
      '[getGuideConfig] Featured venue hydration failed:',
      error
    )

    return []
  }

  return (data ?? []) as RawVenueRow[]
}

/* ------------------------------------------------ */
/* Configuration Construction                       */
/* ------------------------------------------------ */

function buildNormalizedGuideConfig({
  guide,
  property,
  brand,
  sections,
  featuredVenues,
}: {
  guide: RawPropertyGuideRow
  property: RawPropertyRow
  brand: GuideBrandConfig
  sections: GuideSectionConfig[]
  featuredVenues: GuideFeaturedVenueConfig[]
}): GuideConfig | null {
  const normalizedProperty = normalizeGuideProperty(property)

  if (!normalizedProperty) return null

  const id = cleanText(guide.id)
  const propertyId = cleanText(guide.property_id)
  const title = cleanText(guide.title)
  const slug = normalizeSlug(guide.slug)

  if (!id || !propertyId || !title || !slug) {
    return null
  }

  return {
    id,
    propertyId,
    brandId: cleanNullableText(guide.brand_id),

    title,
    subtitle: cleanNullableText(guide.subtitle),
    slug,

    status: normalizeGuideStatus(guide.status),
    guideMode: normalizeGuideMode(guide.guide_mode),

    welcomeHeading: cleanNullableText(
      guide.welcome_heading
    ),
    welcomeDescription: cleanNullableText(
      guide.welcome_description
    ),
    heroImageUrl: cleanNullableText(
      guide.hero_image_url
    ),

    showPropertyFavorites: toBoolean(
      guide.show_property_favorites,
      true
    ),
    showSuggestedRoutes: toBoolean(
      guide.show_suggested_routes,
      true
    ),
    showNearbyEvents: toBoolean(
      guide.show_nearby_events,
      true
    ),
    showPartnerOffers: toBoolean(
      guide.show_partner_offers,
      false
    ),

    defaultTravelMode: normalizeGuideTravelMode(
      guide.default_travel_mode
    ),

    poweredByRoam: toBoolean(
      guide.powered_by_roam,
      brand.poweredByRoam
    ),

    publishedAt: normalizeIsoDateOrNull(
      guide.published_at
    ),
    createdAt:
      normalizeIsoDateOrNull(guide.created_at) ??
      new Date(0).toISOString(),
    updatedAt:
      normalizeIsoDateOrNull(guide.updated_at) ??
      new Date(0).toISOString(),

    property: normalizedProperty,
    brand,
    sections,
    featuredVenues,
  }
}

/* ------------------------------------------------ */
/* Brand Normalization                              */
/* ------------------------------------------------ */

function normalizeGuideBrandRow(
  row: RawGuideBrandRow
): GuideBrandRow {
  return {
    id: cleanText(row.id) || DEFAULT_GUIDE_BRAND.id,
    name: cleanText(row.name) || DEFAULT_GUIDE_BRAND.name,
    slug:
      normalizeSlug(row.slug) ||
      DEFAULT_GUIDE_BRAND.slug,

    logo_url: cleanNullableText(row.logo_url),
    favicon_url: cleanNullableText(row.favicon_url),

    primary_color: cleanNullableText(
      row.primary_color
    ),
    secondary_color: cleanNullableText(
      row.secondary_color
    ),
    accent_color: cleanNullableText(
      row.accent_color
    ),
    background_color: cleanNullableText(
      row.background_color
    ),
    surface_color: cleanNullableText(
      row.surface_color
    ),
    text_color: cleanNullableText(row.text_color),
    muted_text_color: cleanNullableText(
      row.muted_text_color
    ),
    button_text_color: cleanNullableText(
      row.button_text_color
    ),

    font_family: cleanNullableText(row.font_family),

    branding_mode:
      row.branding_mode === 'co_branded' ||
      row.branding_mode === 'white_label'
        ? row.branding_mode
        : 'roam',

    powered_by_roam: toBoolean(
      row.powered_by_roam,
      true
    ),
    custom_css: cleanNullableText(row.custom_css),

    created_at:
      normalizeIsoDateOrNull(row.created_at) ??
      new Date(0).toISOString(),

    updated_at:
      normalizeIsoDateOrNull(row.updated_at) ??
      new Date(0).toISOString(),
  }
}

/* ------------------------------------------------ */
/* Property Normalization                           */
/* ------------------------------------------------ */

function normalizeGuideProperty(
  property: RawPropertyRow
): GuidePropertySummary | null {
  const id = cleanText(property.id)
  const name = cleanText(property.name)
  const slug = normalizeSlug(property.slug)
  const city = cleanText(property.city)
  const lat = toFiniteNumberOrNull(property.lat)
  const lon = toFiniteNumberOrNull(property.lon)

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

    address: cleanNullableText(property.address),
    website: cleanNullableText(property.website),
    welcomeDescription: cleanNullableText(
      property.welcome_description
    ),
    hostName: cleanNullableText(property.host_name),
  }
}

/* ------------------------------------------------ */
/* Section Normalization                            */
/* ------------------------------------------------ */

function normalizeGuideSections({
  guideId,
  rows,
  includeDefaults,
}: {
  guideId: string
  rows: RawPropertyGuideSectionRow[]
  includeDefaults: boolean
}): GuideSectionConfig[] {
  const normalizedRows = rows
    .map(normalizeGuideSection)
    .filter(
      (section): section is GuideSectionConfig =>
        section !== null
    )

  if (!includeDefaults) {
    return normalizedRows.sort(compareGuideSections)
  }

  const existingKeys = new Set(
    normalizedRows.map((section) => section.key)
  )

  const defaultSections = DEFAULT_GUIDE_SECTIONS.some(
    (definition) => definition.key === 'events'
  )
    ? DEFAULT_GUIDE_SECTIONS
    : [
        ...DEFAULT_GUIDE_SECTIONS,
        {
          key: 'events' as const,
          position: 70,
          isVisible: true,
        },
      ]

  const fallbackSections: GuideSectionConfig[] =
    defaultSections
      .filter(
        (definition) =>
          !existingKeys.has(definition.key)
      )
      .map((definition) => ({
        id: `${guideId}:${definition.key}`,
        guideId,
        key: definition.key,
        title: null,
        subtitle: null,
        position: definition.position,
        isVisible: definition.isVisible,
        config: {},
      }))

  return [...normalizedRows, ...fallbackSections].sort(
    compareGuideSections
  )
}

function normalizeGuideSection(
  row: RawPropertyGuideSectionRow
): GuideSectionConfig | null {
  const id = cleanText(row.id)
  const guideId = cleanText(row.guide_id)
  const key = normalizeSectionKey(row.section_key)

  if (!id || !guideId || !key) {
    return null
  }

  return {
    id,
    guideId,
    key,

    title: cleanNullableText(row.title),
    subtitle: cleanNullableText(row.subtitle),

    position: toNonNegativeInteger(row.position, 0),
    isVisible: toBoolean(row.is_visible, true),
    config: normalizeSectionOptions(row.config),
  }
}

function normalizeSectionOptions(
  value: unknown
): GuideSectionOptions {
  if (!isPlainObject(value)) {
    return {}
  }

  const result: GuideSectionOptions = {}

  for (const [key, rawValue] of Object.entries(value)) {
    if (!isGuideJson(rawValue)) continue

    result[key] = rawValue
  }

  if (
    typeof result.limit === 'number' &&
    Number.isFinite(result.limit)
  ) {
    result.limit = Math.max(
      1,
      Math.round(result.limit)
    )
  } else {
    delete result.limit
  }

  if (
    result.displayStyle !== 'grid' &&
    result.displayStyle !== 'list' &&
    result.displayStyle !== 'carousel' &&
    result.displayStyle !== 'compact' &&
    result.displayStyle !== 'featured'
  ) {
    delete result.displayStyle
  }

  if (!Array.isArray(result.venueTypes)) {
    delete result.venueTypes
  } else {
    result.venueTypes = result.venueTypes
      .map((value) =>
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : ''
      )
      .filter(Boolean)
  }

  return result
}

function compareGuideSections(
  a: GuideSectionConfig,
  b: GuideSectionConfig
): number {
  const positionDelta = a.position - b.position

  if (positionDelta !== 0) return positionDelta

  return a.key.localeCompare(b.key)
}

/* ------------------------------------------------ */
/* Featured Venue Normalization                     */
/* ------------------------------------------------ */

function normalizeFeaturedVenues({
  rows,
  venueById,
  includeScheduled,
}: {
  rows: RawGuideFeaturedVenueRow[]
  venueById: Map<string, GuideVenueSummary | null>
  includeScheduled: boolean
}): GuideFeaturedVenueConfig[] {
  const now = Date.now()

  return rows
    .map((row) =>
      normalizeFeaturedVenue({
        row,
        venue:
          venueById.get(row.venue_id) ?? null,
      })
    )
    .filter(
      (item): item is GuideFeaturedVenueConfig =>
        item !== null
    )
    .filter((item) => {
      if (!item.isVisible) return false
      if (includeScheduled) return true

      return isFeaturedVenueCurrentlyVisible(
        item,
        now
      )
    })
    .sort((a, b) => {
      const positionDelta =
        a.position - b.position

      if (positionDelta !== 0) {
        return positionDelta
      }

      return a.id.localeCompare(b.id)
    })
}

function normalizeFeaturedVenue({
  row,
  venue,
}: {
  row: RawGuideFeaturedVenueRow
  venue: GuideVenueSummary | null
}): GuideFeaturedVenueConfig | null {
  const id = cleanText(row.id)
  const guideId = cleanText(row.guide_id)
  const venueId = cleanText(row.venue_id)
  const sectionKey = normalizeSectionKey(
    row.section_key
  )

  if (!id || !guideId || !venueId || !sectionKey) {
    return null
  }

  return {
    id,
    guideId,
    venueId,

    sectionKey,
    label: cleanNullableText(row.label),
    description: cleanNullableText(
      row.description
    ),
    conciergeNote: cleanNullableText(
      row.concierge_note
    ),

    position: toNonNegativeInteger(
      row.position,
      0
    ),
    isFeatured: toBoolean(
      row.is_featured,
      false
    ),
    isVisible: toBoolean(row.is_visible, true),

    visibleFrom: normalizeIsoDateOrNull(
      row.visible_from
    ),
    visibleUntil: normalizeIsoDateOrNull(
      row.visible_until
    ),

    venue,
  }
}

function isFeaturedVenueCurrentlyVisible(
  item: GuideFeaturedVenueConfig,
  currentTime: number
): boolean {
  const visibleFrom = item.visibleFrom
    ? Date.parse(item.visibleFrom)
    : null

  const visibleUntil = item.visibleUntil
    ? Date.parse(item.visibleUntil)
    : null

  if (
    visibleFrom !== null &&
    Number.isFinite(visibleFrom) &&
    currentTime < visibleFrom
  ) {
    return false
  }

  if (
    visibleUntil !== null &&
    Number.isFinite(visibleUntil) &&
    currentTime > visibleUntil
  ) {
    return false
  }

  return true
}

/* ------------------------------------------------ */
/* Venue Normalization                              */
/* ------------------------------------------------ */

function normalizeGuideVenue(
  venue: RawVenueRow
): GuideVenueSummary | null {
  const id = cleanText(venue.id)
  const name = cleanText(venue.name)

  if (!id || !name) return null

  return {
    id,
    name,

    city: cleanNullableText(venue.city),
    description: cleanNullableText(
      venue.description
    ),
    address: cleanNullableText(venue.address),
    cover: cleanNullableText(venue.cover),
    link: `/venue-profile/${id}`,

    type: normalizeStringOrStringArray(
      venue.type
    ),
    tags: normalizeStringOrStringArray(
      venue.tags
    ),
    vibe: normalizeStringOrStringArray(
      venue.vibe
    ),

    lat: toFiniteNumberOrNull(venue.lat),
    lon: toFiniteNumberOrNull(venue.lon),
  }
}

/* ------------------------------------------------ */
/* Scalar Normalization                             */
/* ------------------------------------------------ */

function normalizeGuideStatus(
  value: unknown
): GuideStatus {
  if (
    typeof value === 'string' &&
    GUIDE_STATUSES.has(value as GuideStatus)
  ) {
    return value as GuideStatus
  }

  return 'draft'
}

function normalizeGuideMode(
  value: unknown
): GuideMode {
  if (
    typeof value === 'string' &&
    GUIDE_MODES.has(value as GuideMode)
  ) {
    return value as GuideMode
  }

  return 'hotel'
}

function normalizeGuideTravelMode(
  value: unknown
): GuideTravelMode {
  if (
    typeof value === 'string' &&
    GUIDE_TRAVEL_MODES.has(
      value as GuideTravelMode
    )
  ) {
    return value as GuideTravelMode
  }

  return 'walking'
}

function normalizeSectionKey(
  value: unknown
): GuideSectionKey | null {
  if (
    typeof value === 'string' &&
    GUIDE_SECTION_KEYS.has(
      value as GuideSectionKey
    )
  ) {
    return value as GuideSectionKey
  }

  return null
}

function normalizeStringOrStringArray(
  value: unknown
): string | string[] | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) =>
        typeof item === 'string'
          ? item.trim()
          : ''
      )
      .filter(Boolean)

    return normalized.length > 0
      ? normalized
      : null
  }

  return null
}

function normalizeSlug(
  value: unknown
): string | null {
  if (typeof value !== 'string') return null

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || null
}

function normalizeIsoDateOrNull(
  value: unknown
): string | null {
  if (
    typeof value !== 'string' &&
    !(value instanceof Date)
  ) {
    return null
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value)

  if (!Number.isFinite(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function toFiniteNumberOrNull(
  value: unknown
): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function toNonNegativeInteger(
  value: unknown,
  fallback: number
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(0, Math.round(parsed))
}

function toBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (typeof value === 'boolean') return value

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase()

    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }

  return fallback
}

function cleanText(
  value: unknown
): string {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

function cleanNullableText(
  value: unknown
): string | null {
  const cleaned = cleanText(value)

  return cleaned || null
}

function uniqueStrings(
  values: Array<string | null | undefined>
): string[] {
  return [
    ...new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    ),
  ]
}

/* ------------------------------------------------ */
/* JSON Validation                                  */
/* ------------------------------------------------ */

function isGuideJson(
  value: unknown
): value is GuideJson {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every(isGuideJson)
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(
      (entry) =>
        entry === undefined ||
        isGuideJson(entry)
    )
  }

  return false
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}