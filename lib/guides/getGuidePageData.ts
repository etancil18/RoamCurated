import {
  getGuideNearbyEventsData,
  type GuideNearbyEventsData,
} from '@/lib/guides/getGuideNearbyEvents'
import {
  getGuideSuggestedFlowsData,
  type GuideSuggestedFlowsProperty,
} from '@/lib/guides/getGuideSuggestedFlows'
import type { PropertyCrawlCard } from '@/lib/property/buildPropertyCrawlCards'
import { createServerClient } from '@/lib/supabase/server'
import type { NearbyEventVM } from '@/lib/view-models/buildNearbyEventVM'

/* ------------------------------------------------ */
/* Public input                                     */
/* ------------------------------------------------ */

export type GetGuidePageDataParams = {
  /**
   * Public property-guide slug.
   */
  guideSlug: string

  /**
   * Optional brand slug.
   *
   * Supply this when guide slugs are only unique within a brand.
   */
  brandSlug?: string | null

  /**
   * Allows draft guides to be loaded for authenticated preview routes.
   *
   * Public routes should leave this false.
   */
  includeDraft?: boolean

  /**
   * Optional timestamp used for scheduled visibility checks and flow previews.
   */
  now?: Date
}

/* ------------------------------------------------ */
/* Public result                                    */
/* ------------------------------------------------ */

export type GuidePageData = {
  guide: GuidePageGuide
  property: GuidePageProperty
  brand: GuidePageBrand | null
  sections: GuidePageSection[]
  featuredVenues: GuideFeaturedVenue[]
  propertyFavorites: GuidePropertyFavorite[]
  suggestedFlows: PropertyCrawlCard[]
  nearbyEvents: NearbyEventVM[]
  nearbyVenueCount: number
}

export type GuidePageGuide = {
  id: string
  propertyId: string
  brandId: string | null

  title: string
  subtitle: string | null
  slug: string

  status: string
  guideMode: string | null

  welcomeHeading: string | null
  welcomeDescription: string | null
  heroImageUrl: string | null

  showPropertyFavorites: boolean
  showSuggestedRoutes: boolean
  showNearbyEvents: boolean
  showPartnerOffers: boolean

  defaultTravelMode: string
  poweredByRoam: boolean

  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type GuidePageProperty = GuideSuggestedFlowsProperty & {
  hostName: string | null
  hostType: string | null
  website: string | null
  address: string | null

  approved: boolean
  featured: boolean

  welcomeDescription: string | null
}

export type GuidePageBrand = {
  id: string
  name: string
  slug: string

  logoUrl: string | null
  faviconUrl: string | null

  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  backgroundColor: string | null
  surfaceColor: string | null
  textColor: string | null
  mutedTextColor: string | null
  buttonTextColor: string | null

  fontFamily: string | null
  brandingMode: string | null
  poweredByRoam: boolean
  customCss: string | null
}

export type GuidePageSection = {
  id: string
  guideId: string
  sectionKey: string

  title: string | null
  subtitle: string | null

  position: number
  isVisible: boolean
  config: Record<string, unknown>

  createdAt: string | null
  updatedAt: string | null
}

export type GuideFeaturedVenue = {
  id: string
  guideId: string
  venueId: string
  sectionKey: string | null

  label: string | null
  description: string | null
  conciergeNote: string | null

  position: number
  isFeatured: boolean
  isVisible: boolean

  visibleFrom: string | null
  visibleUntil: string | null

  venue: GuideVenue
}

export type GuidePropertyFavorite = {
  id: string
  propertyId: string
  venueId: string

  label: string | null
  description: string | null
  priority: number
  category: string | null

  venue: GuideVenue
}

export type GuideVenue = {
  id: string
  name: string

  city: string | null
  slug: string | null
  link: string

  description: string | null
  cover: string | null
  type: string | string[] | null

  lat: number | null
  lon: number | null

  raw: Record<string, unknown>
}

/* ------------------------------------------------ */
/* Database row contracts                           */
/* ------------------------------------------------ */

type PropertyGuideRow = {
  id: unknown
  property_id: unknown
  brand_id: unknown

  title: unknown
  subtitle: unknown
  slug: unknown

  status: unknown
  guide_mode: unknown

  welcome_heading: unknown
  welcome_description: unknown
  hero_image_url: unknown

  show_property_favorites: unknown
  show_suggested_routes: unknown
  show_nearby_events: unknown
  show_partner_offers: unknown

  default_travel_mode: unknown
  powered_by_roam: unknown

  published_at: unknown
  created_at: unknown
  updated_at: unknown
}

type PropertyRow = {
  id: unknown
  name: unknown
  slug: unknown
  city: unknown
  lat: unknown
  lon: unknown

  host_name: unknown
  host_type: unknown
  website: unknown
  address: unknown

  approved: unknown
  featured: unknown

  welcome_description: unknown
}

type GuideBrandRow = {
  id: unknown
  name: unknown
  slug: unknown

  logo_url: unknown
  favicon_url: unknown

  primary_color: unknown
  secondary_color: unknown
  accent_color: unknown
  background_color: unknown
  surface_color: unknown
  text_color: unknown
  muted_text_color: unknown
  button_text_color: unknown

  font_family: unknown
  branding_mode: unknown
  powered_by_roam: unknown
  custom_css: unknown
}

type GuideSectionRow = {
  id: unknown
  guide_id: unknown
  section_key: unknown

  title: unknown
  subtitle: unknown

  position: unknown
  is_visible: unknown
  config: unknown

  created_at: unknown
  updated_at: unknown
}

type GuideFeaturedVenueRow = {
  id: unknown
  guide_id: unknown
  venue_id: unknown
  section_key: unknown

  label: unknown
  description: unknown
  concierge_note: unknown

  position: unknown
  is_featured: unknown
  is_visible: unknown

  visible_from: unknown
  visible_until: unknown

  created_at: unknown
  updated_at: unknown
}

type PropertyFavoriteRow = {
  id: unknown
  property_id: unknown
  venue_id: unknown

  label: unknown
  description: unknown
  priority: unknown
  category: unknown

  created_at: unknown
}

type VenueRow = {
  id: unknown
  name: unknown

  city?: unknown
  slug?: unknown
  link?: unknown

  description?: unknown
  cover?: unknown
  type?: unknown

  lat?: unknown
  lon?: unknown

  [key: string]: unknown
}

/* ------------------------------------------------ */
/* Main loader                                      */
/* ------------------------------------------------ */

/**
 * Loads all data required to render one white-label property guide.
 *
 * Responsibilities:
 *
 * 1. Resolve the property guide.
 * 2. Resolve its property and optional brand.
 * 3. Load visible configured guide sections.
 * 4. Load visible featured venues.
 * 5. Load property favorites when enabled.
 * 6. Load shared suggested flows when enabled.
 * 7. Load nearby events when enabled.
 *
 * This loader intentionally does not perform UI rendering, map construction,
 * event-journey generation, route navigation, or client-side analytics.
 */
export async function getGuidePageData(
  params: GetGuidePageDataParams
): Promise<GuidePageData | null> {
  const guideSlug = cleanText(params.guideSlug)
  const brandSlug = cleanText(params.brandSlug)
  const includeDraft = params.includeDraft === true
  const now = normalizeDate(params.now)

  if (!guideSlug) {
    return null
  }

  const supabase = await createServerClient()

  const guideRow = await resolveGuideRow({
    supabase,
    guideSlug,
    brandSlug,
    includeDraft,
  })

  if (!guideRow) {
    return null
  }

  const guide = normalizeGuide(guideRow)

  if (!guide) {
    return null
  }

  const propertyRow = await resolvePropertyRow({
    supabase,
    propertyId: guide.propertyId,
  })

  if (!propertyRow) {
    return null
  }

  const property = normalizeProperty(propertyRow)

  if (!property) {
    return null
  }

  const [
    brand,
    sections,
    featuredVenues,
    propertyFavorites,
    flowsData,
    nearbyEventsData,
  ] = await Promise.all([
    guide.brandId
      ? loadBrand({
          supabase,
          brandId: guide.brandId,
        })
      : Promise.resolve(null),

    loadGuideSections({
      supabase,
      guideId: guide.id,
    }),

    loadGuideFeaturedVenues({
      supabase,
      guideId: guide.id,
      now,
    }),

    guide.showPropertyFavorites
      ? loadPropertyFavorites({
          supabase,
          propertyId: property.id,
        })
      : Promise.resolve([]),

    guide.showSuggestedRoutes
      ? getGuideSuggestedFlowsData({
          propertyId: property.id,
        })
      : Promise.resolve(null),

    guide.showNearbyEvents
      ? getGuideNearbyEventsData({
          propertyId: property.id,
          now,
        })
      : Promise.resolve<GuideNearbyEventsData | null>(null),
  ])

  return {
    guide,
    property,
    brand,
    sections,
    featuredVenues,
    propertyFavorites,
    suggestedFlows: flowsData?.flows ?? [],
    nearbyEvents: nearbyEventsData?.events ?? [],
    nearbyVenueCount: flowsData?.nearbyVenueCount ?? 0,
  }
}

/* ------------------------------------------------ */
/* Guide resolution                                 */
/* ------------------------------------------------ */

async function resolveGuideRow({
  supabase,
  guideSlug,
  brandSlug,
  includeDraft,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  guideSlug: string
  brandSlug: string | null
  includeDraft: boolean
}): Promise<PropertyGuideRow | null> {
  if (brandSlug) {
    const brandId = await resolveBrandIdBySlug({
      supabase,
      brandSlug,
    })

    if (!brandId) {
      return null
    }

    let query = supabase
      .from('property_guides')
      .select('*')
      .eq('slug', guideSlug)
      .eq('brand_id', brandId)
      .limit(1)

    if (!includeDraft) {
      query = query.eq('status', 'active')
    }

    const { data, error } = await query

    if (error) {
      throw new Error(
        `Failed to load property guide "${guideSlug}": ${error.message}`
      )
    }

    return firstRow<PropertyGuideRow>(data)
  }

  let query = supabase
    .from('property_guides')
    .select('*')
    .eq('slug', guideSlug)
    .limit(2)

  if (!includeDraft) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query

  if (error) {
    throw new Error(
      `Failed to load property guide "${guideSlug}": ${error.message}`
    )
  }

  const rows = rowsFrom<PropertyGuideRow>(data)

  if (rows.length === 0) {
    return null
  }

  if (rows.length > 1) {
    throw new Error(
      `Guide slug "${guideSlug}" is not unique. Supply brandSlug when loading the guide.`
    )
  }

  return rows[0]
}

async function resolveBrandIdBySlug({
  supabase,
  brandSlug,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  brandSlug: string
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('guide_brands')
    .select('id')
    .eq('slug', brandSlug)
    .limit(1)

  if (error) {
    throw new Error(
      `Failed to resolve guide brand "${brandSlug}": ${error.message}`
    )
  }

  const row = firstRow<{ id: unknown }>(data)

  return cleanText(row?.id)
}

/* ------------------------------------------------ */
/* Property                                         */
/* ------------------------------------------------ */

async function resolvePropertyRow({
  supabase,
  propertyId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  propertyId: string
}): Promise<PropertyRow | null> {
  const { data, error } = await supabase
    .from('properties')
    .select(
      [
        'id',
        'name',
        'slug',
        'city',
        'lat',
        'lon',
        'host_name',
        'host_type',
        'website',
        'address',
        'approved',
        'featured',
        'welcome_description',
      ].join(',')
    )
    .eq('id', propertyId)
    .limit(1)

  if (error) {
    throw new Error(
      `Failed to load property "${propertyId}": ${error.message}`
    )
  }

  return firstRow<PropertyRow>(data)
}

/* ------------------------------------------------ */
/* Brand                                            */
/* ------------------------------------------------ */

async function loadBrand({
  supabase,
  brandId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  brandId: string
}): Promise<GuidePageBrand | null> {
  const { data, error } = await supabase
    .from('guide_brands')
    .select('*')
    .eq('id', brandId)
    .limit(1)

  if (error) {
    throw new Error(
      `Failed to load guide brand "${brandId}": ${error.message}`
    )
  }

  const row = firstRow<GuideBrandRow>(data)

  return row ? normalizeBrand(row) : null
}

/* ------------------------------------------------ */
/* Sections                                         */
/* ------------------------------------------------ */

async function loadGuideSections({
  supabase,
  guideId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  guideId: string
}): Promise<GuidePageSection[]> {
  const { data, error } = await supabase
    .from('property_guide_sections')
    .select('*')
    .eq('guide_id', guideId)
    .eq('is_visible', true)
    .order('position', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Failed to load sections for guide "${guideId}": ${error.message}`
    )
  }

  return rowsFrom<GuideSectionRow>(data)
    .map(normalizeSection)
    .filter((section): section is GuidePageSection => section !== null)
}

/* ------------------------------------------------ */
/* Featured venues                                  */
/* ------------------------------------------------ */

async function loadGuideFeaturedVenues({
  supabase,
  guideId,
  now,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  guideId: string
  now: Date
}): Promise<GuideFeaturedVenue[]> {
  const { data, error } = await supabase
    .from('guide_featured_venues')
    .select('*')
    .eq('guide_id', guideId)
    .eq('is_visible', true)
    .order('position', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Failed to load featured venues for guide "${guideId}": ${error.message}`
    )
  }

  const rows = rowsFrom<GuideFeaturedVenueRow>(data).filter((row) =>
    isCurrentlyVisible({
      visibleFrom: row.visible_from,
      visibleUntil: row.visible_until,
      now,
    })
  )

  const venueIds = uniqueStrings(
    rows.map((row) => cleanText(row.venue_id))
  )

  const venueById = await loadVenuesById({
    supabase,
    venueIds,
  })

  return rows
    .map((row) => {
      const venueId = cleanText(row.venue_id)

      if (!venueId) {
        return null
      }

      const venue = venueById.get(venueId)

      if (!venue) {
        return null
      }

      return normalizeFeaturedVenue(row, venue)
    })
    .filter(
      (item): item is GuideFeaturedVenue =>
        item !== null
    )
}

/* ------------------------------------------------ */
/* Property favorites                               */
/* ------------------------------------------------ */

async function loadPropertyFavorites({
  supabase,
  propertyId,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  propertyId: string
}): Promise<GuidePropertyFavorite[]> {
  const { data, error } = await supabase
    .from('property_favorites')
    .select('*')
    .eq('property_id', propertyId)
    .order('priority', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Failed to load favorites for property "${propertyId}": ${error.message}`
    )
  }

  const rows = rowsFrom<PropertyFavoriteRow>(data)

  const venueIds = uniqueStrings(
    rows.map((row) => cleanText(row.venue_id))
  )

  const venueById = await loadVenuesById({
    supabase,
    venueIds,
  })

  return rows
    .map((row) => {
      const venueId = cleanText(row.venue_id)

      if (!venueId) {
        return null
      }

      const venue = venueById.get(venueId)

      if (!venue) {
        return null
      }

      return normalizePropertyFavorite(row, venue)
    })
    .filter(
      (item): item is GuidePropertyFavorite =>
        item !== null
    )
}

/* ------------------------------------------------ */
/* Venue loading                                    */
/* ------------------------------------------------ */

async function loadVenuesById({
  supabase,
  venueIds,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  venueIds: string[]
}): Promise<Map<string, GuideVenue>> {
  if (venueIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .in('id', venueIds)

  if (error) {
    throw new Error(
      `Failed to load guide venues: ${error.message}`
    )
  }

  const venueById = new Map<string, GuideVenue>()

  for (const row of rowsFrom<VenueRow>(data)) {
    const venue = normalizeVenue(row)

    if (venue) {
      venueById.set(venue.id, venue)
    }
  }

  return venueById
}

/* ------------------------------------------------ */
/* Guide normalization                              */
/* ------------------------------------------------ */

function normalizeGuide(
  row: PropertyGuideRow
): GuidePageGuide | null {
  const id = cleanText(row.id)
  const propertyId = cleanText(row.property_id)
  const title = cleanText(row.title)
  const slug = cleanText(row.slug)

  if (!id || !propertyId || !title || !slug) {
    return null
  }

  return {
    id,
    propertyId,
    brandId: cleanText(row.brand_id),

    title,
    subtitle: cleanText(row.subtitle),
    slug,

    status: cleanText(row.status) ?? 'draft',
    guideMode: cleanText(row.guide_mode),

    welcomeHeading: cleanText(row.welcome_heading),
    welcomeDescription: cleanText(row.welcome_description),
    heroImageUrl: normalizeAssetPath(row.hero_image_url),

    showPropertyFavorites: toBoolean(
      row.show_property_favorites,
      true
    ),
    showSuggestedRoutes: toBoolean(
      row.show_suggested_routes,
      true
    ),
    showNearbyEvents: toBoolean(
      row.show_nearby_events,
      false
    ),
    showPartnerOffers: toBoolean(
      row.show_partner_offers,
      false
    ),

    defaultTravelMode:
      cleanText(row.default_travel_mode) ??
      'walking',

    poweredByRoam: toBoolean(
      row.powered_by_roam,
      true
    ),

    publishedAt: toIsoString(row.published_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

/* ------------------------------------------------ */
/* Property normalization                           */
/* ------------------------------------------------ */

function normalizeProperty(
  row: PropertyRow
): GuidePageProperty | null {
  const id = cleanText(row.id)
  const name = cleanText(row.name)
  const slug = cleanText(row.slug)
  const city = cleanText(row.city)
  const lat = toFiniteNumber(row.lat)
  const lon = toFiniteNumber(row.lon)

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

    hostName: cleanText(row.host_name),
    hostType: cleanText(row.host_type),
    website: cleanText(row.website),
    address: cleanText(row.address),

    approved: toBoolean(row.approved, false),
    featured: toBoolean(row.featured, false),

    welcomeDescription: cleanText(
      row.welcome_description
    ),
  }
}

/* ------------------------------------------------ */
/* Brand normalization                              */
/* ------------------------------------------------ */

function normalizeBrand(
  row: GuideBrandRow
): GuidePageBrand | null {
  const id = cleanText(row.id)
  const name = cleanText(row.name)
  const slug = cleanText(row.slug)

  if (!id || !name || !slug) {
    return null
  }

  return {
    id,
    name,
    slug,

    logoUrl: normalizeAssetPath(row.logo_url),
    faviconUrl: normalizeAssetPath(row.favicon_url),

    primaryColor: normalizeCssColor(row.primary_color),
    secondaryColor: normalizeCssColor(row.secondary_color),
    accentColor: normalizeCssColor(row.accent_color),
    backgroundColor: normalizeCssColor(row.background_color),
    surfaceColor: normalizeCssColor(row.surface_color),
    textColor: normalizeCssColor(row.text_color),
    mutedTextColor: normalizeCssColor(row.muted_text_color),
    buttonTextColor: normalizeCssColor(row.button_text_color),

    fontFamily: cleanText(row.font_family),
    brandingMode: cleanText(row.branding_mode),

    poweredByRoam: toBoolean(
      row.powered_by_roam,
      true
    ),

    customCss: cleanText(row.custom_css),
  }
}

/* ------------------------------------------------ */
/* Section normalization                            */
/* ------------------------------------------------ */

function normalizeSection(
  row: GuideSectionRow
): GuidePageSection | null {
  const id = cleanText(row.id)
  const guideId = cleanText(row.guide_id)
  const sectionKey = cleanText(row.section_key)

  if (!id || !guideId || !sectionKey) {
    return null
  }

  return {
    id,
    guideId,
    sectionKey,

    title: cleanText(row.title),
    subtitle: cleanText(row.subtitle),

    position: toInteger(row.position, 0),
    isVisible: toBoolean(row.is_visible, true),
    config: toRecord(row.config),

    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  }
}

/* ------------------------------------------------ */
/* Featured venue normalization                     */
/* ------------------------------------------------ */

function normalizeFeaturedVenue(
  row: GuideFeaturedVenueRow,
  venue: GuideVenue
): GuideFeaturedVenue | null {
  const id = cleanText(row.id)
  const guideId = cleanText(row.guide_id)
  const venueId = cleanText(row.venue_id)

  if (!id || !guideId || !venueId) {
    return null
  }

  return {
    id,
    guideId,
    venueId,

    sectionKey: cleanText(row.section_key),

    label: cleanText(row.label),
    description: cleanText(row.description),
    conciergeNote: cleanText(row.concierge_note),

    position: toInteger(row.position, 0),
    isFeatured: toBoolean(row.is_featured, false),
    isVisible: toBoolean(row.is_visible, true),

    visibleFrom: toIsoString(row.visible_from),
    visibleUntil: toIsoString(row.visible_until),

    venue,
  }
}

/* ------------------------------------------------ */
/* Property-favorite normalization                  */
/* ------------------------------------------------ */

function normalizePropertyFavorite(
  row: PropertyFavoriteRow,
  venue: GuideVenue
): GuidePropertyFavorite | null {
  const id = cleanText(row.id)
  const propertyId = cleanText(row.property_id)
  const venueId = cleanText(row.venue_id)

  if (!id || !propertyId || !venueId) {
    return null
  }

  return {
    id,
    propertyId,
    venueId,

    label: cleanText(row.label),
    description: cleanText(row.description),
    priority: toInteger(row.priority, 0),
    category: cleanText(row.category),

    venue,
  }
}

/* ------------------------------------------------ */
/* Venue normalization                              */
/* ------------------------------------------------ */

function normalizeVenue(
  row: VenueRow
): GuideVenue | null {
  const id = cleanText(row.id)
  const name = cleanText(row.name)

  if (!id || !name) {
    return null
  }

  const explicitLink = cleanText(row.link)

  return {
    id,
    name,

    city: cleanText(row.city),
    slug: cleanText(row.slug),

    link:
      explicitLink ??
      `/venue-profile/${encodeURIComponent(id)}`,

    description: cleanText(row.description),
    cover: normalizeAssetPath(row.cover),
    type: normalizeVenueType(row.type),

    lat: toFiniteNumber(row.lat),
    lon: toFiniteNumber(row.lon),

    raw: { ...row },
  }
}

/* ------------------------------------------------ */
/* Visibility                                       */
/* ------------------------------------------------ */

function isCurrentlyVisible({
  visibleFrom,
  visibleUntil,
  now,
}: {
  visibleFrom: unknown
  visibleUntil: unknown
  now: Date
}) {
  const from = toDate(visibleFrom)
  const until = toDate(visibleUntil)

  if (from && now.getTime() < from.getTime()) {
    return false
  }

  if (until && now.getTime() > until.getTime()) {
    return false
  }

  return true
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function firstRow<T>(
  value: unknown
): T | null {
  const rows = rowsFrom<T>(value)
  return rows[0] ?? null
}

function rowsFrom<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : []
}

function cleanText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}

function toBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase()

    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes'
    ) {
      return true
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no'
    ) {
      return false
    }
  }

  return fallback
}

function toInteger(
  value: unknown,
  fallback: number
): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  return Number.isFinite(numericValue)
    ? Math.trunc(numericValue)
    : fallback
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

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function normalizeDate(
  value: Date | undefined
): Date {
  if (
    value instanceof Date &&
    Number.isFinite(value.getTime())
  ) {
    return value
  }

  return new Date()
}

function toDate(
  value: unknown
): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? value
      : null
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null
  }

  const date = new Date(value)

  return Number.isFinite(date.getTime())
    ? date
    : null
}

function toIsoString(
  value: unknown
): string | null {
  const date = toDate(value)

  return date
    ? date.toISOString()
    : null
}

function toRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>
  }

  return {}
}

function normalizeAssetPath(
  value: unknown
): string | null {
  const path = cleanText(value)

  if (!path) {
    return null
  }

  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('/')
  ) {
    return path
  }

  return `/${path}`
}

function normalizeCssColor(
  value: unknown
): string | null {
  const color = cleanText(value)

  if (!color) {
    return null
  }

  return color
}

function normalizeVenueType(
  value: unknown
): string | string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map(cleanText)
      .filter(
        (entry): entry is string =>
          entry !== null
      )

    return normalized.length > 0
      ? normalized
      : null
  }

  return cleanText(value)
}

function uniqueStrings(
  values: Array<string | null>
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          value !== null
      )
    )
  )
}