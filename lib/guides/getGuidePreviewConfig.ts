// lib/guides/getGuidePreviewConfig.ts

import 'server-only'

import { unstable_noStore as noStore } from 'next/cache'

import { createServerClient } from '@/lib/supabase/server'
import { buildGuideConfig } from '@/lib/guides/buildGuideConfig'

import type {
  GuideBrandRow,
  GuideConfig,
  GuideFeaturedVenueRow,
  GuideLookupResult,
  GuidePropertySummary,
  GuideVenueSummary,
  PropertyGuideRow,
  PropertyGuideSectionRow,
} from '@/lib/guides/types'

/* ------------------------------------------------ */
/* Admin Authorization                              */
/* ------------------------------------------------ */

/**
 * Temporary administrative authorization boundary.
 *
 * Move this list into a shared requireVenueAdmin() helper or a
 * database-backed admin role system once that infrastructure exists.
 */
const ALLOWED_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

/* ------------------------------------------------ */
/* Public Loader                                    */
/* ------------------------------------------------ */

/**
 * Loads a complete property-guide configuration for authenticated
 * administrative preview.
 *
 * Unlike the public guide loader, this function allows:
 *
 * - draft guides
 * - active guides
 * - archived guides
 *
 * It still renders through buildGuideConfig(), ensuring preview and
 * public output share the same normalization and rendering contract.
 *
 * Unauthorized users receive null so the caller can return notFound()
 * without revealing whether the guide exists.
 */
export async function getGuidePreviewConfig(
  guideId: string
): Promise<GuideConfig | null> {
  noStore()

  if (!isUuid(guideId)) {
    return null
  }

  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? ''

  if (!normalizedEmail || !ALLOWED_ADMIN_EMAILS.has(normalizedEmail)) {
    return null
  }

  /* ---------------------------------------------- */
  /* Guide                                          */
  /* ---------------------------------------------- */

  const { data: rawGuide, error: guideError } = await supabase
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
    .eq('id', guideId)
    .maybeSingle()

  if (guideError) {
    console.error(
      '[getGuidePreviewConfig] Failed to load property guide:',
      {
        guideId,
        message: guideError.message,
        details: guideError.details,
        hint: guideError.hint,
      }
    )

    return null
  }

  const guide = normalizePropertyGuideRow(rawGuide)

  if (!guide) {
    return null
  }

  /* ---------------------------------------------- */
  /* Parallel Related Data                          */
  /* ---------------------------------------------- */

  const [
    propertyResult,
    brandResult,
    sectionsResult,
    featuredVenuesResult,
  ] = await Promise.all([
    supabase
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
      .eq('id', guide.property_id)
      .maybeSingle(),

    guide.brand_id
      ? supabase
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
          .eq('id', guide.brand_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
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
      .eq('guide_id', guide.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
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
        updated_at,
        venues (
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
        )
      `
      )
      .eq('guide_id', guide.id)
      .order('section_key', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  /* ---------------------------------------------- */
  /* Error Handling                                 */
  /* ---------------------------------------------- */

  if (propertyResult.error) {
    console.error(
      '[getGuidePreviewConfig] Failed to load guide property:',
      {
        guideId,
        propertyId: guide.property_id,
        message: propertyResult.error.message,
        details: propertyResult.error.details,
        hint: propertyResult.error.hint,
      }
    )

    return null
  }

  if (brandResult.error) {
    console.error(
      '[getGuidePreviewConfig] Failed to load guide brand:',
      {
        guideId,
        brandId: guide.brand_id,
        message: brandResult.error.message,
        details: brandResult.error.details,
        hint: brandResult.error.hint,
      }
    )

    return null
  }

  if (sectionsResult.error) {
    console.error(
      '[getGuidePreviewConfig] Failed to load guide sections:',
      {
        guideId,
        message: sectionsResult.error.message,
        details: sectionsResult.error.details,
        hint: sectionsResult.error.hint,
      }
    )

    return null
  }

  if (featuredVenuesResult.error) {
    console.error(
      '[getGuidePreviewConfig] Failed to load featured venues:',
      {
        guideId,
        message: featuredVenuesResult.error.message,
        details: featuredVenuesResult.error.details,
        hint: featuredVenuesResult.error.hint,
      }
    )

    return null
  }

  /* ---------------------------------------------- */
  /* Normalize Lookup Data                          */
  /* ---------------------------------------------- */

  const property = normalizePropertySummary(propertyResult.data)

  if (!property) {
    return null
  }

  const brand = normalizeGuideBrandRow(brandResult.data)

  const sections = ((sectionsResult.data ?? []) as unknown[])
    .map(normalizeGuideSectionRow)
    .filter(
      (section): section is PropertyGuideSectionRow =>
        section !== null
    )

  const featuredVenues = (
    (featuredVenuesResult.data ?? []) as unknown[]
  )
    .map(normalizeFeaturedVenueRow)
    .filter(
      (
        featuredVenue
      ): featuredVenue is GuideFeaturedVenueRow & {
        venue?: GuideVenueSummary | null
      } => featuredVenue !== null
    )

  const lookup: GuideLookupResult = {
    guide,
    property,
    brand,
    sections,
    featuredVenues,
  }

  /* ---------------------------------------------- */
  /* Shared Configuration Builder                   */
  /* ---------------------------------------------- */

  const result = buildGuideConfig(lookup, {
    accessMode: 'preview',

    /**
     * Preview should match exactly what would be visible if the guide
     * were published at this moment.
     */
    includeHiddenSections: false,
    includeHiddenFeaturedVenues: false,
    enforceVisibilityWindows: true,
  })

  if (!result.found) {
    console.error(
      '[getGuidePreviewConfig] Guide configuration could not be built:',
      {
        guideId,
        reason: result.reason,
      }
    )

    return null
  }

  return result.config
}

/* ------------------------------------------------ */
/* Optional Admin Inspection Loader                 */
/* ------------------------------------------------ */

/**
 * Loads the guide with hidden sections, hidden venues, and scheduled
 * content included.
 *
 * This is useful for a future "show hidden content" admin inspection
 * mode. The standard preview route should normally use
 * getGuidePreviewConfig() instead.
 */
export async function getGuideAdminConfig(
  guideId: string
): Promise<GuideConfig | null> {
  noStore()

  if (!isUuid(guideId)) {
    return null
  }

  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const normalizedEmail = user.email?.trim().toLowerCase() ?? ''

  if (!normalizedEmail || !ALLOWED_ADMIN_EMAILS.has(normalizedEmail)) {
    return null
  }

  const lookup = await loadGuideLookupById({
    guideId,
    supabase,
  })

  if (!lookup) {
    return null
  }

  const result = buildGuideConfig(lookup, {
    accessMode: 'admin',
    includeHiddenSections: true,
    includeHiddenFeaturedVenues: true,
    enforceVisibilityWindows: false,
  })

  return result.found ? result.config : null
}

/* ------------------------------------------------ */
/* Shared Lookup Helper                             */
/* ------------------------------------------------ */

async function loadGuideLookupById({
  guideId,
  supabase,
}: {
  guideId: string
  supabase: Awaited<ReturnType<typeof createServerClient>>
}): Promise<GuideLookupResult | null> {
  const { data: rawGuide, error: guideError } = await supabase
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
    .eq('id', guideId)
    .maybeSingle()

  if (guideError) {
    console.error(
      '[getGuidePreviewConfig] Shared guide lookup failed:',
      guideError
    )

    return null
  }

  const guide = normalizePropertyGuideRow(rawGuide)

  if (!guide) {
    return null
  }

  const [
    propertyResult,
    brandResult,
    sectionsResult,
    featuredResult,
  ] = await Promise.all([
    supabase
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
      .eq('id', guide.property_id)
      .maybeSingle(),

    guide.brand_id
      ? supabase
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
          .eq('id', guide.brand_id)
          .maybeSingle()
      : Promise.resolve({
          data: null,
          error: null,
        }),

    supabase
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
      .eq('guide_id', guide.id)
      .order('position', { ascending: true }),

    supabase
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
        updated_at,
        venues (
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
        )
      `
      )
      .eq('guide_id', guide.id)
      .order('section_key', { ascending: true })
      .order('position', { ascending: true }),
  ])

  if (
    propertyResult.error ||
    brandResult.error ||
    sectionsResult.error ||
    featuredResult.error
  ) {
    console.error(
      '[getGuidePreviewConfig] Shared lookup relation failure:',
      {
        propertyError: propertyResult.error,
        brandError: brandResult.error,
        sectionsError: sectionsResult.error,
        featuredError: featuredResult.error,
      }
    )

    return null
  }

  const property = normalizePropertySummary(propertyResult.data)

  if (!property) {
    return null
  }

  return {
    guide,
    property,
    brand: normalizeGuideBrandRow(brandResult.data),

    sections: ((sectionsResult.data ?? []) as unknown[])
      .map(normalizeGuideSectionRow)
      .filter(
        (section): section is PropertyGuideSectionRow =>
          section !== null
      ),

    featuredVenues: ((featuredResult.data ?? []) as unknown[])
      .map(normalizeFeaturedVenueRow)
      .filter(
        (
          featuredVenue
        ): featuredVenue is GuideFeaturedVenueRow & {
          venue?: GuideVenueSummary | null
        } => featuredVenue !== null
      ),
  }
}

/* ------------------------------------------------ */
/* Guide Row Normalization                          */
/* ------------------------------------------------ */

function normalizePropertyGuideRow(
  value: unknown
): PropertyGuideRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const propertyId = getRequiredString(value.property_id)
  const title = getRequiredString(value.title)
  const slug = getRequiredString(value.slug)

  if (!id || !propertyId || !title || !slug) {
    return null
  }

  const status =
    value.status === 'draft' ||
    value.status === 'active' ||
    value.status === 'archived'
      ? value.status
      : null

  const guideMode =
    value.guide_mode === 'roam' ||
    value.guide_mode === 'hotel' ||
    value.guide_mode === 'partner' ||
    value.guide_mode === 'concierge'
      ? value.guide_mode
      : null

  const travelMode =
    value.default_travel_mode === 'walking' ||
    value.default_travel_mode === 'driving' ||
    value.default_travel_mode === 'transit' ||
    value.default_travel_mode === 'rideshare'
      ? value.default_travel_mode
      : null

  if (!status || !guideMode || !travelMode) {
    return null
  }

  return {
    id,
    property_id: propertyId,
    brand_id: getOptionalString(value.brand_id),

    title,
    subtitle: getOptionalString(value.subtitle),
    slug,

    status,
    guide_mode: guideMode,

    welcome_heading: getOptionalString(value.welcome_heading),
    welcome_description: getOptionalString(
      value.welcome_description
    ),
    hero_image_url: getOptionalString(value.hero_image_url),

    show_property_favorites:
      value.show_property_favorites !== false,

    show_suggested_routes:
      value.show_suggested_routes !== false,

    show_nearby_events:
      value.show_nearby_events !== false,

    show_partner_offers:
      value.show_partner_offers === true,

    default_travel_mode: travelMode,

    powered_by_roam:
      value.powered_by_roam !== false,

    published_at: getOptionalString(value.published_at),

    created_at:
      getOptionalString(value.created_at) ?? '',

    updated_at:
      getOptionalString(value.updated_at) ?? '',
  }
}

/* ------------------------------------------------ */
/* Property Normalization                           */
/* ------------------------------------------------ */

function normalizePropertySummary(
  value: unknown
): GuidePropertySummary | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const name = getRequiredString(value.name)
  const slug = getRequiredString(value.slug)
  const city = getRequiredString(value.city)

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

    address: getOptionalString(value.address),
    website: getOptionalString(value.website),

    welcomeDescription:
      getOptionalString(value.welcome_description),

    hostName:
      getOptionalString(value.host_name),
  }
}

/* ------------------------------------------------ */
/* Brand Normalization                              */
/* ------------------------------------------------ */

function normalizeGuideBrandRow(
  value: unknown
): GuideBrandRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const name = getRequiredString(value.name)
  const slug = getRequiredString(value.slug)

  if (!id || !name || !slug) {
    return null
  }

  const brandingMode =
    value.branding_mode === 'roam' ||
    value.branding_mode === 'co_branded' ||
    value.branding_mode === 'white_label'
      ? value.branding_mode
      : 'co_branded'

  return {
    id,
    name,
    slug,

    logo_url: getOptionalString(value.logo_url),
    favicon_url: getOptionalString(value.favicon_url),

    primary_color: getOptionalString(value.primary_color),
    secondary_color: getOptionalString(value.secondary_color),
    accent_color: getOptionalString(value.accent_color),
    background_color: getOptionalString(value.background_color),
    surface_color: getOptionalString(value.surface_color),
    text_color: getOptionalString(value.text_color),
    muted_text_color: getOptionalString(value.muted_text_color),
    button_text_color: getOptionalString(value.button_text_color),

    font_family: getOptionalString(value.font_family),

    branding_mode: brandingMode,

    powered_by_roam:
      value.powered_by_roam !== false,

    custom_css: getOptionalString(value.custom_css),

    created_at:
      getOptionalString(value.created_at) ?? '',

    updated_at:
      getOptionalString(value.updated_at) ?? '',
  }
}

/* ------------------------------------------------ */
/* Section Normalization                            */
/* ------------------------------------------------ */

function normalizeGuideSectionRow(
  value: unknown
): PropertyGuideSectionRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const guideId = getRequiredString(value.guide_id)

  if (!id || !guideId || !isGuideSectionKey(value.section_key)) {
    return null
  }

  return {
    id,
    guide_id: guideId,

    section_key: value.section_key,

    title: getOptionalString(value.title),
    subtitle: getOptionalString(value.subtitle),

    position: toInteger(value.position, 0),

    is_visible:
      value.is_visible !== false,

    config:
      isGuideJson(value.config)
        ? value.config
        : null,

    created_at:
      getOptionalString(value.created_at) ?? '',

    updated_at:
      getOptionalString(value.updated_at) ?? '',
  }
}

/* ------------------------------------------------ */
/* Featured Venue Normalization                     */
/* ------------------------------------------------ */

function normalizeFeaturedVenueRow(
  value: unknown
):
  | (GuideFeaturedVenueRow & {
      venue?: GuideVenueSummary | null
    })
  | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const guideId = getRequiredString(value.guide_id)
  const venueId = getRequiredString(value.venue_id)

  if (
    !id ||
    !guideId ||
    !venueId ||
    !isGuideSectionKey(value.section_key)
  ) {
    return null
  }

  const rawVenue = Array.isArray(value.venues)
    ? value.venues[0]
    : value.venues

  return {
    id,
    guide_id: guideId,
    venue_id: venueId,

    section_key: value.section_key,

    label: getOptionalString(value.label),
    description: getOptionalString(value.description),
    concierge_note: getOptionalString(value.concierge_note),

    position: toInteger(value.position, 0),

    is_featured:
      value.is_featured === true,

    is_visible:
      value.is_visible !== false,

    visible_from:
      getOptionalString(value.visible_from),

    visible_until:
      getOptionalString(value.visible_until),

    created_at:
      getOptionalString(value.created_at) ?? '',

    updated_at:
      getOptionalString(value.updated_at) ?? '',

    venue: normalizeVenueSummary(rawVenue),
  }
}

/* ------------------------------------------------ */
/* Venue Normalization                              */
/* ------------------------------------------------ */

function normalizeVenueSummary(
  value: unknown
): GuideVenueSummary | null {
  if (!isRecord(value)) {
    return null
  }

  const id = getRequiredString(value.id)
  const name = getRequiredString(value.name)

  if (!id || !name) {
    return null
  }

  return {
    id,
    name,

    city: getOptionalString(value.city),

    description:
      getOptionalString(value.description),

    address:
      getOptionalString(value.address),

    cover:
      getOptionalString(value.cover),

    link: `/venue-profile/${id}`,

    type: normalizeStringOrStringArray(value.type),
    tags: normalizeStringOrStringArray(value.tags),
    vibe: normalizeStringOrStringArray(value.vibe),

    lat: toFiniteNumber(value.lat),
    lon: toFiniteNumber(value.lon),
  }
}

/* ------------------------------------------------ */
/* Type Guards and Helpers                          */
/* ------------------------------------------------ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value)
  )
}

function getRequiredString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()

  return normalized || null
}

function getOptionalString(
  value: unknown
): string | null {
  return getRequiredString(value)
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

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function toInteger(
  value: unknown,
  fallback: number
): number {
  const number = toFiniteNumber(value)

  return number === null
    ? fallback
    : Math.trunc(number)
}

function normalizeStringOrStringArray(
  value: unknown
): string | string[] | null {
  if (typeof value === 'string') {
    const normalized = value.trim()

    return normalized || null
  }

  if (Array.isArray(value)) {
    const normalized = value
      .filter(
        (item): item is string =>
          typeof item === 'string'
      )
      .map((item) => item.trim())
      .filter(Boolean)

    return normalized.length > 0
      ? normalized
      : null
  }

  return null
}

function isGuideSectionKey(
  value: unknown
): value is PropertyGuideSectionRow['section_key'] {
  return (
    value === 'welcome' ||
    value === 'favorites' ||
    value === 'suggested_routes' ||
    value === 'coffee' ||
    value === 'dining' ||
    value === 'bars' ||
    value === 'wellness' ||
    value === 'events' ||
    value === 'map' ||
    value === 'partner_offers' ||
    value === 'custom'
  )
}

function isGuideJson(
  value: unknown
): value is PropertyGuideSectionRow['config'] {
  if (value === null) {
    return true
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((item) => isGuideJson(item))
  }

  if (isRecord(value)) {
    return Object.values(value).every(
      (item) =>
        typeof item === 'undefined' ||
        isGuideJson(item)
    )
  }

  return false
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}