// app/venue-admin/guide-actions.ts

'use server'

import { revalidatePath } from 'next/cache'

import { createServerClient } from '@/lib/supabase/server'

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const GUIDE_ADMIN_EMAILS = new Set([
  'evantancil@gmail.com',
  'etancil92@gmail.com',
  'evantancil@roamcurated.com',
  'fyejono@gmail.com',
  'jonathangordon@roamcurated.com',
])

const GUIDE_STATUSES = ['draft', 'active', 'archived'] as const

const GUIDE_MODES = [
  'roam',
  'hotel',
  'partner',
  'concierge',
] as const

const BRANDING_MODES = [
  'roam',
  'co_branded',
  'white_label',
] as const

const TRAVEL_MODES = [
  'walking',
  'driving',
  'transit',
  'rideshare',
] as const

const GUIDE_SECTION_KEYS = [
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
] as const

const GUIDE_DISPLAY_STYLES = [
  'grid',
  'list',
  'carousel',
  'compact',
  'featured',
] as const

const MAX_CUSTOM_CSS_LENGTH = 20_000
const MAX_SECTION_CONFIG_LENGTH = 20_000

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideStatus = (typeof GUIDE_STATUSES)[number]
export type GuideMode = (typeof GUIDE_MODES)[number]
export type GuideBrandingMode = (typeof BRANDING_MODES)[number]
export type GuideTravelMode = (typeof TRAVEL_MODES)[number]
export type GuideSectionKey = (typeof GUIDE_SECTION_KEYS)[number]
export type GuideDisplayStyle = (typeof GUIDE_DISPLAY_STYLES)[number]

export type GuideActionSuccess<T = undefined> = {
  success: true
  data: T
}

export type GuideActionFailure = {
  success: false
  error: string
  fieldErrors?: Record<string, string>
}

export type GuideActionResult<T = undefined> =
  | GuideActionSuccess<T>
  | GuideActionFailure

export type GuideBrandInput = {
  id?: string | null

  name: string
  slug: string

  logoUrl?: string | null
  faviconUrl?: string | null

  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null

  backgroundColor?: string | null
  surfaceColor?: string | null
  textColor?: string | null
  mutedTextColor?: string | null
  buttonTextColor?: string | null

  fontFamily?: string | null

  brandingMode?: GuideBrandingMode
  poweredByRoam?: boolean

  customCss?: string | null
}

export type PropertyGuideInput = {
  id?: string | null

  propertyId: string
  brandId?: string | null

  title: string
  subtitle?: string | null
  slug: string

  status?: GuideStatus
  guideMode?: GuideMode

  welcomeHeading?: string | null
  welcomeDescription?: string | null
  heroImageUrl?: string | null

  showPropertyFavorites?: boolean
  showSuggestedRoutes?: boolean
  showNearbyEvents?: boolean
  showPartnerOffers?: boolean

  defaultTravelMode?: GuideTravelMode
  poweredByRoam?: boolean

  publishedAt?: string | null
}

export type GuideSectionInput = {
  id?: string | null

  guideId: string
  sectionKey: GuideSectionKey

  title?: string | null
  subtitle?: string | null

  position?: number
  isVisible?: boolean

  config?: Record<string, unknown>
}

export type GuideFeaturedVenueInput = {
  id?: string | null

  guideId: string
  venueId: string
  sectionKey: GuideSectionKey

  label?: string | null
  description?: string | null
  conciergeNote?: string | null

  position?: number

  isFeatured?: boolean
  isVisible?: boolean

  visibleFrom?: string | null
  visibleUntil?: string | null
}

export type GuideBrandRecord = {
  id: string
  name: string
  slug: string
}

export type PropertyGuideRecord = {
  id: string
  property_id: string
  brand_id: string | null
  title: string
  subtitle: string | null
  slug: string
  status: GuideStatus
  guide_mode: GuideMode
  published_at: string | null
}

export type GuideSectionRecord = {
  id: string
  guide_id: string
  section_key: GuideSectionKey
  title: string | null
  subtitle: string | null
  position: number
  is_visible: boolean
  config: Record<string, unknown>
}

export type GuideFeaturedVenueRecord = {
  id: string
  guide_id: string
  venue_id: string
  section_key: GuideSectionKey
  label: string | null
  description: string | null
  concierge_note: string | null
  position: number
  is_featured: boolean
  is_visible: boolean
  visible_from: string | null
  visible_until: string | null
}

/* ------------------------------------------------ */
/* Authentication                                   */
/* ------------------------------------------------ */

async function getAuthorizedAdminClient() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('You must be signed in to manage guides.')
  }

  const email = user.email?.trim().toLowerCase() ?? ''

  if (!email || !GUIDE_ADMIN_EMAILS.has(email)) {
    throw new Error('You are not authorized to manage guides.')
  }

  return {
    supabase,
    db: supabase as any,
    user,
    email,
  }
}

/* ------------------------------------------------ */
/* Guide Brand Actions                              */
/* ------------------------------------------------ */

export async function saveGuideBrandAction(
  input: GuideBrandInput
): Promise<GuideActionResult<GuideBrandRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const validation = validateGuideBrandInput(input)

    if (!validation.success) {
      return validation
    }

    const payload = {
      name: validation.data.name,
      slug: validation.data.slug,

      logo_url: validation.data.logoUrl,
      favicon_url: validation.data.faviconUrl,

      primary_color: validation.data.primaryColor,
      secondary_color: validation.data.secondaryColor,
      accent_color: validation.data.accentColor,

      background_color: validation.data.backgroundColor,
      surface_color: validation.data.surfaceColor,
      text_color: validation.data.textColor,
      muted_text_color: validation.data.mutedTextColor,
      button_text_color: validation.data.buttonTextColor,

      font_family: validation.data.fontFamily,

      branding_mode: validation.data.brandingMode,
      powered_by_roam: validation.data.poweredByRoam,

      custom_css: validation.data.customCss,
    }

    const id = normalizeOptionalUuid(input.id)

    const query = id
      ? db
          .from('guide_brands')
          .update(payload)
          .eq('id', id)
      : db
          .from('guide_brands')
          .insert(payload)

    const { data, error } = await query
      .select('id, name, slug')
      .single()

    if (error) {
      return databaseFailure(
        'Unable to save the guide brand.',
        error
      )
    }

    revalidateGuidePaths()

    return {
      success: true,
      data: data as GuideBrandRecord,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deleteGuideBrandAction(
  brandId: string
): Promise<GuideActionResult<{ id: string }>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(brandId, 'brandId')

    const { count: linkedGuideCount, error: linkedGuideError } = await db
      .from('property_guides')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('brand_id', id)

    if (linkedGuideError) {
      return databaseFailure(
        'Unable to verify whether the brand is in use.',
        linkedGuideError
      )
    }

    if ((linkedGuideCount ?? 0) > 0) {
      return {
        success: false,
        error:
          'This brand is assigned to one or more property guides. Reassign those guides before deleting the brand.',
      }
    }

    const { error } = await db
      .from('guide_brands')
      .delete()
      .eq('id', id)

    if (error) {
      return databaseFailure(
        'Unable to delete the guide brand.',
        error
      )
    }

    revalidateGuidePaths()

    return {
      success: true,
      data: { id },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

/* ------------------------------------------------ */
/* Property Guide Actions                           */
/* ------------------------------------------------ */

export async function savePropertyGuideAction(
  input: PropertyGuideInput
): Promise<GuideActionResult<PropertyGuideRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const validation = validatePropertyGuideInput(input)

    if (!validation.success) {
      return validation
    }

    const existingId = normalizeOptionalUuid(input.id)

    const status = validation.data.status
    const publishedAt =
      status === 'active'
        ? validation.data.publishedAt ?? new Date().toISOString()
        : validation.data.publishedAt

    const payload = {
      property_id: validation.data.propertyId,
      brand_id: validation.data.brandId,

      title: validation.data.title,
      subtitle: validation.data.subtitle,
      slug: validation.data.slug,

      status,
      guide_mode: validation.data.guideMode,

      welcome_heading: validation.data.welcomeHeading,
      welcome_description: validation.data.welcomeDescription,
      hero_image_url: validation.data.heroImageUrl,

      show_property_favorites:
        validation.data.showPropertyFavorites,
      show_suggested_routes:
        validation.data.showSuggestedRoutes,
      show_nearby_events:
        validation.data.showNearbyEvents,
      show_partner_offers:
        validation.data.showPartnerOffers,

      default_travel_mode:
        validation.data.defaultTravelMode,

      powered_by_roam:
        validation.data.poweredByRoam,

      published_at: publishedAt,
    }

    const query = existingId
      ? db
          .from('property_guides')
          .update(payload)
          .eq('id', existingId)
      : db
          .from('property_guides')
          .insert(payload)

    const { data, error } = await query
      .select(`
        id,
        property_id,
        brand_id,
        title,
        subtitle,
        slug,
        status,
        guide_mode,
        published_at
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to save the property guide.',
        error
      )
    }

    const guide = data as PropertyGuideRecord

    if (!existingId) {
      const sectionResult =
        await createDefaultGuideSectionsInternal({
          db,
          guideId: guide.id,
        })

      if (!sectionResult.success) {
        await db
          .from('property_guides')
          .delete()
          .eq('id', guide.id)

        return sectionResult
      }
    }

    revalidateGuidePaths(guide.slug)

    return {
      success: true,
      data: guide,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function publishPropertyGuideAction(
  guideId: string
): Promise<GuideActionResult<PropertyGuideRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(guideId, 'guideId')

    const { data, error } = await db
      .from('property_guides')
      .update({
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        id,
        property_id,
        brand_id,
        title,
        subtitle,
        slug,
        status,
        guide_mode,
        published_at
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to publish the property guide.',
        error
      )
    }

    const guide = data as PropertyGuideRecord

    revalidateGuidePaths(guide.slug)

    return {
      success: true,
      data: guide,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function unpublishPropertyGuideAction(
  guideId: string
): Promise<GuideActionResult<PropertyGuideRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(guideId, 'guideId')

    const { data, error } = await db
      .from('property_guides')
      .update({
        status: 'draft',
      })
      .eq('id', id)
      .select(`
        id,
        property_id,
        brand_id,
        title,
        subtitle,
        slug,
        status,
        guide_mode,
        published_at
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to unpublish the property guide.',
        error
      )
    }

    const guide = data as PropertyGuideRecord

    revalidateGuidePaths(guide.slug)

    return {
      success: true,
      data: guide,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function archivePropertyGuideAction(
  guideId: string
): Promise<GuideActionResult<PropertyGuideRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(guideId, 'guideId')

    const { data, error } = await db
      .from('property_guides')
      .update({
        status: 'archived',
      })
      .eq('id', id)
      .select(`
        id,
        property_id,
        brand_id,
        title,
        subtitle,
        slug,
        status,
        guide_mode,
        published_at
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to archive the property guide.',
        error
      )
    }

    const guide = data as PropertyGuideRecord

    revalidateGuidePaths(guide.slug)

    return {
      success: true,
      data: guide,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deletePropertyGuideAction(
  guideId: string
): Promise<GuideActionResult<{ id: string; slug: string | null }>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(guideId, 'guideId')

    const { data: existingGuide, error: lookupError } = await db
      .from('property_guides')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return databaseFailure(
        'Unable to find the property guide.',
        lookupError
      )
    }

    if (!existingGuide) {
      return {
        success: false,
        error: 'The property guide does not exist.',
      }
    }

    const { error } = await db
      .from('property_guides')
      .delete()
      .eq('id', id)

    if (error) {
      return databaseFailure(
        'Unable to delete the property guide.',
        error
      )
    }

    const slug =
      typeof existingGuide.slug === 'string'
        ? existingGuide.slug
        : null

    revalidateGuidePaths(slug)

    return {
      success: true,
      data: {
        id,
        slug,
      },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

/* ------------------------------------------------ */
/* Guide Section Actions                            */
/* ------------------------------------------------ */

export async function saveGuideSectionAction(
  input: GuideSectionInput
): Promise<GuideActionResult<GuideSectionRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const validation = validateGuideSectionInput(input)

    if (!validation.success) {
      return validation
    }

    const existingId = normalizeOptionalUuid(input.id)

    const payload = {
      guide_id: validation.data.guideId,
      section_key: validation.data.sectionKey,

      title: validation.data.title,
      subtitle: validation.data.subtitle,

      position: validation.data.position,
      is_visible: validation.data.isVisible,

      config: validation.data.config,
    }

    const query = existingId
      ? db
          .from('property_guide_sections')
          .update(payload)
          .eq('id', existingId)
      : db
          .from('property_guide_sections')
          .upsert(payload, {
            onConflict: 'guide_id,section_key',
          })

    const { data, error } = await query
      .select(`
        id,
        guide_id,
        section_key,
        title,
        subtitle,
        position,
        is_visible,
        config
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to save the guide section.',
        error
      )
    }

    const section = data as GuideSectionRecord

    const guideSlug = await getGuideSlugById(
      db,
      section.guide_id
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: section,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function reorderGuideSectionsAction(
  guideId: string,
  orderedSectionIds: string[]
): Promise<GuideActionResult<{ guideId: string }>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const normalizedGuideId =
      requireUuid(guideId, 'guideId')

    if (!Array.isArray(orderedSectionIds)) {
      return {
        success: false,
        error: 'Section order must be an array.',
      }
    }

    const uniqueSectionIds = [
      ...new Set(
        orderedSectionIds.map((id) =>
          requireUuid(id, 'sectionId')
        )
      ),
    ]

    for (
      let position = 0;
      position < uniqueSectionIds.length;
      position += 1
    ) {
      const sectionId = uniqueSectionIds[position]

      const { error } = await db
        .from('property_guide_sections')
        .update({
          position: position * 10,
        })
        .eq('id', sectionId)
        .eq('guide_id', normalizedGuideId)

      if (error) {
        return databaseFailure(
          'Unable to reorder the guide sections.',
          error
        )
      }
    }

    const guideSlug = await getGuideSlugById(
      db,
      normalizedGuideId
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: {
        guideId: normalizedGuideId,
      },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function toggleGuideSectionVisibilityAction(
  sectionId: string,
  isVisible: boolean
): Promise<GuideActionResult<GuideSectionRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(sectionId, 'sectionId')

    const { data, error } = await db
      .from('property_guide_sections')
      .update({
        is_visible: Boolean(isVisible),
      })
      .eq('id', id)
      .select(`
        id,
        guide_id,
        section_key,
        title,
        subtitle,
        position,
        is_visible,
        config
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to update the section visibility.',
        error
      )
    }

    const section = data as GuideSectionRecord

    const guideSlug = await getGuideSlugById(
      db,
      section.guide_id
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: section,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deleteGuideSectionAction(
  sectionId: string
): Promise<
  GuideActionResult<{
    id: string
    guideId: string
  }>
> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(sectionId, 'sectionId')

    const { data: section, error: lookupError } = await db
      .from('property_guide_sections')
      .select('id, guide_id')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return databaseFailure(
        'Unable to find the guide section.',
        lookupError
      )
    }

    if (!section) {
      return {
        success: false,
        error: 'The guide section does not exist.',
      }
    }

    const { error } = await db
      .from('property_guide_sections')
      .delete()
      .eq('id', id)

    if (error) {
      return databaseFailure(
        'Unable to delete the guide section.',
        error
      )
    }

    const guideId = String(section.guide_id)

    const guideSlug = await getGuideSlugById(
      db,
      guideId
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: {
        id,
        guideId,
      },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function createDefaultGuideSectionsAction(
  guideId: string
): Promise<GuideActionResult<GuideSectionRecord[]>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const normalizedGuideId =
      requireUuid(guideId, 'guideId')

    const result =
      await createDefaultGuideSectionsInternal({
        db,
        guideId: normalizedGuideId,
      })

    if (!result.success) {
      return result
    }

    const guideSlug = await getGuideSlugById(
      db,
      normalizedGuideId
    )

    revalidateGuidePaths(guideSlug)

    return result
  } catch (error) {
    return actionFailure(error)
  }
}

/* ------------------------------------------------ */
/* Featured Venue Actions                           */
/* ------------------------------------------------ */

export async function saveGuideFeaturedVenueAction(
  input: GuideFeaturedVenueInput
): Promise<GuideActionResult<GuideFeaturedVenueRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const validation =
      validateGuideFeaturedVenueInput(input)

    if (!validation.success) {
      return validation
    }

    const existingId = normalizeOptionalUuid(input.id)

    const payload = {
      guide_id: validation.data.guideId,
      venue_id: validation.data.venueId,
      section_key: validation.data.sectionKey,

      label: validation.data.label,
      description: validation.data.description,
      concierge_note: validation.data.conciergeNote,

      position: validation.data.position,

      is_featured: validation.data.isFeatured,
      is_visible: validation.data.isVisible,

      visible_from: validation.data.visibleFrom,
      visible_until: validation.data.visibleUntil,
    }

    const query = existingId
      ? db
          .from('guide_featured_venues')
          .update(payload)
          .eq('id', existingId)
      : db
          .from('guide_featured_venues')
          .upsert(payload, {
            onConflict: 'guide_id,section_key,venue_id',
          })

    const { data, error } = await query
      .select(`
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
        visible_until
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to save the featured venue.',
        error
      )
    }

    const featuredVenue =
      data as GuideFeaturedVenueRecord

    const guideSlug = await getGuideSlugById(
      db,
      featuredVenue.guide_id
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: featuredVenue,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function reorderGuideFeaturedVenuesAction(
  guideId: string,
  sectionKey: GuideSectionKey,
  orderedFeaturedVenueIds: string[]
): Promise<
  GuideActionResult<{
    guideId: string
    sectionKey: GuideSectionKey
  }>
> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const normalizedGuideId =
      requireUuid(guideId, 'guideId')

    const normalizedSectionKey =
      requireGuideSectionKey(sectionKey)

    if (!Array.isArray(orderedFeaturedVenueIds)) {
      return {
        success: false,
        error: 'Featured venue order must be an array.',
      }
    }

    const uniqueIds = [
      ...new Set(
        orderedFeaturedVenueIds.map((id) =>
          requireUuid(id, 'featuredVenueId')
        )
      ),
    ]

    for (
      let position = 0;
      position < uniqueIds.length;
      position += 1
    ) {
      const featuredVenueId = uniqueIds[position]

      const { error } = await db
        .from('guide_featured_venues')
        .update({
          position: position * 10,
        })
        .eq('id', featuredVenueId)
        .eq('guide_id', normalizedGuideId)
        .eq('section_key', normalizedSectionKey)

      if (error) {
        return databaseFailure(
          'Unable to reorder the featured venues.',
          error
        )
      }
    }

    const guideSlug = await getGuideSlugById(
      db,
      normalizedGuideId
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: {
        guideId: normalizedGuideId,
        sectionKey: normalizedSectionKey,
      },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function toggleGuideFeaturedVenueVisibilityAction(
  featuredVenueId: string,
  isVisible: boolean
): Promise<GuideActionResult<GuideFeaturedVenueRecord>> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(
      featuredVenueId,
      'featuredVenueId'
    )

    const { data, error } = await db
      .from('guide_featured_venues')
      .update({
        is_visible: Boolean(isVisible),
      })
      .eq('id', id)
      .select(`
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
        visible_until
      `)
      .single()

    if (error) {
      return databaseFailure(
        'Unable to update the featured venue visibility.',
        error
      )
    }

    const featuredVenue =
      data as GuideFeaturedVenueRecord

    const guideSlug = await getGuideSlugById(
      db,
      featuredVenue.guide_id
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: featuredVenue,
    }
  } catch (error) {
    return actionFailure(error)
  }
}

export async function deleteGuideFeaturedVenueAction(
  featuredVenueId: string
): Promise<
  GuideActionResult<{
    id: string
    guideId: string
  }>
> {
  try {
    const { db } = await getAuthorizedAdminClient()

    const id = requireUuid(
      featuredVenueId,
      'featuredVenueId'
    )

    const {
      data: featuredVenue,
      error: lookupError,
    } = await db
      .from('guide_featured_venues')
      .select('id, guide_id')
      .eq('id', id)
      .maybeSingle()

    if (lookupError) {
      return databaseFailure(
        'Unable to find the featured venue.',
        lookupError
      )
    }

    if (!featuredVenue) {
      return {
        success: false,
        error: 'The featured venue does not exist.',
      }
    }

    const { error } = await db
      .from('guide_featured_venues')
      .delete()
      .eq('id', id)

    if (error) {
      return databaseFailure(
        'Unable to delete the featured venue.',
        error
      )
    }

    const guideId = String(featuredVenue.guide_id)

    const guideSlug = await getGuideSlugById(
      db,
      guideId
    )

    revalidateGuidePaths(guideSlug)

    return {
      success: true,
      data: {
        id,
        guideId,
      },
    }
  } catch (error) {
    return actionFailure(error)
  }
}

/* ------------------------------------------------ */
/* Default Section Creation                         */
/* ------------------------------------------------ */

async function createDefaultGuideSectionsInternal({
  db,
  guideId,
}: {
  db: any
  guideId: string
}): Promise<GuideActionResult<GuideSectionRecord[]>> {
  const defaultSections = buildDefaultGuideSections(
    guideId
  )

  const { data, error } = await db
    .from('property_guide_sections')
    .upsert(defaultSections, {
      onConflict: 'guide_id,section_key',
    })
    .select(`
      id,
      guide_id,
      section_key,
      title,
      subtitle,
      position,
      is_visible,
      config
    `)

  if (error) {
    return databaseFailure(
      'Unable to create the default guide sections.',
      error
    )
  }

  return {
    success: true,
    data: (data ?? []) as GuideSectionRecord[],
  }
}

function buildDefaultGuideSections(
  guideId: string
) {
  return [
    {
      guide_id: guideId,
      section_key: 'welcome',
      title: 'Welcome',
      subtitle:
        'A local introduction to your stay and the neighborhood around you.',
      position: 0,
      is_visible: true,
      config: {
        displayStyle: 'featured',
      },
    },
    {
      guide_id: guideId,
      section_key: 'favorites',
      title: 'Hotel Picks',
      subtitle:
        'Places specifically selected by the hotel team.',
      position: 10,
      is_visible: true,
      config: {
        displayStyle: 'grid',
        limit: 6,
      },
    },
    {
      guide_id: guideId,
      section_key: 'suggested_routes',
      title: 'Suggested Flows',
      subtitle:
        'Easy, contextual plans based on time, proximity, and sequence quality.',
      position: 20,
      is_visible: true,
      config: {
        displayStyle: 'list',
        limit: 4,
      },
    },
    {
      guide_id: guideId,
      section_key: 'coffee',
      title: 'Coffee & Breakfast',
      subtitle:
        'Nearby options for coffee, breakfast, and an easy start.',
      position: 30,
      is_visible: true,
      config: {
        displayStyle: 'carousel',
        limit: 8,
        venueTypes: [
          'coffee',
          'cafe',
          'café',
          'bakery',
          'breakfast',
          'brunch',
        ],
      },
    },
    {
      guide_id: guideId,
      section_key: 'dining',
      title: 'Nearby Dining',
      subtitle:
        'Reliable restaurants and local dining options close to the hotel.',
      position: 40,
      is_visible: true,
      config: {
        displayStyle: 'grid',
        limit: 8,
        venueTypes: [
          'restaurant',
          'dinner',
          'lunch',
          'kitchen',
        ],
      },
    },
    {
      guide_id: guideId,
      section_key: 'bars',
      title: 'Drinks Nearby',
      subtitle:
        'Cocktail bars, wine bars, breweries, and relaxed evening options.',
      position: 50,
      is_visible: true,
      config: {
        displayStyle: 'carousel',
        limit: 8,
        venueTypes: [
          'bar',
          'cocktail',
          'wine bar',
          'brewery',
          'pub',
          'lounge',
        ],
      },
    },
    {
      guide_id: guideId,
      section_key: 'wellness',
      title: 'Wellness & Reset',
      subtitle:
        'Movement, recovery, parks, spas, and slower nearby experiences.',
      position: 60,
      is_visible: true,
      config: {
        displayStyle: 'grid',
        limit: 6,
        venueTypes: [
          'fitness',
          'yoga',
          'pilates',
          'spa',
          'wellness',
          'park',
        ],
      },
    },
    {
      guide_id: guideId,
      section_key: 'events',
      title: 'What’s Happening',
      subtitle:
        'Upcoming events and timely local experiences near the hotel.',
      position: 70,
      is_visible: true,
      config: {
        displayStyle: 'carousel',
        limit: 10,
      },
    },
    {
      guide_id: guideId,
      section_key: 'partner_offers',
      title: 'Guest Perks',
      subtitle:
        'Offers and partner benefits available through this guide.',
      position: 80,
      is_visible: false,
      config: {
        displayStyle: 'compact',
        limit: 6,
      },
    },
    {
      guide_id: guideId,
      section_key: 'map',
      title: 'Explore the Area',
      subtitle:
        'See the hotel, recommended venues, and nearby experiences together.',
      position: 90,
      is_visible: true,
      config: {
        displayStyle: 'featured',
        limit: 40,
        defaultZoom: 15,
      },
    },
  ]
}

/* ------------------------------------------------ */
/* Validation                                       */
/* ------------------------------------------------ */

function validateGuideBrandInput(
  input: GuideBrandInput
):
  | GuideActionFailure
  | GuideActionSuccess<RequiredValidatedGuideBrandInput> {
  const fieldErrors: Record<string, string> = {}

  const name = cleanRequiredText(
    input.name,
    'Brand name',
    fieldErrors,
    'name',
    160
  )

  const slug = normalizeSlug(input.slug)

  if (!slug) {
    fieldErrors.slug =
      'Enter a valid lowercase slug using letters, numbers, and hyphens.'
  }

  const brandingMode =
    input.brandingMode ?? 'co_branded'

  if (!BRANDING_MODES.includes(brandingMode)) {
    fieldErrors.brandingMode =
      'Select a valid branding mode.'
  }

  const customCss =
    cleanOptionalText(input.customCss)

  if (
    customCss &&
    customCss.length > MAX_CUSTOM_CSS_LENGTH
  ) {
    fieldErrors.customCss =
      `Custom CSS cannot exceed ${MAX_CUSTOM_CSS_LENGTH.toLocaleString()} characters.`
  }

  const colorFields = {
    primaryColor: input.primaryColor ?? '#22D3EE',
    secondaryColor:
      input.secondaryColor ?? '#6366F1',
    accentColor: input.accentColor ?? '#22D3EE',
    backgroundColor:
      input.backgroundColor ?? '#0A0A0A',
    surfaceColor: input.surfaceColor ?? '#171717',
    textColor: input.textColor ?? '#FAFAFA',
    mutedTextColor:
      input.mutedTextColor ?? '#A3A3A3',
    buttonTextColor:
      input.buttonTextColor ?? '#0A0A0A',
  }

  for (const [field, value] of Object.entries(
    colorFields
  )) {
    if (!isHexColor(value)) {
      fieldErrors[field] =
        'Use a six-character hex color such as #22D3EE.'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: 'Correct the highlighted brand fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      name,
      slug,

      logoUrl: normalizeOptionalUrl(input.logoUrl),
      faviconUrl: normalizeOptionalUrl(input.faviconUrl),

      primaryColor: colorFields.primaryColor,
      secondaryColor: colorFields.secondaryColor,
      accentColor: colorFields.accentColor,
      backgroundColor: colorFields.backgroundColor,
      surfaceColor: colorFields.surfaceColor,
      textColor: colorFields.textColor,
      mutedTextColor: colorFields.mutedTextColor,
      buttonTextColor: colorFields.buttonTextColor,

      fontFamily: cleanOptionalText(input.fontFamily),

      brandingMode,
      poweredByRoam:
        input.poweredByRoam ?? true,

      customCss,
    },
  }
}

type RequiredValidatedGuideBrandInput = {
  name: string
  slug: string

  logoUrl: string | null
  faviconUrl: string | null

  primaryColor: string
  secondaryColor: string
  accentColor: string

  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  buttonTextColor: string

  fontFamily: string | null

  brandingMode: GuideBrandingMode
  poweredByRoam: boolean

  customCss: string | null
}

function validatePropertyGuideInput(
  input: PropertyGuideInput
):
  | GuideActionFailure
  | GuideActionSuccess<RequiredValidatedPropertyGuideInput> {
  const fieldErrors: Record<string, string> = {}

  const propertyId = validateUuidField(
    input.propertyId,
    'Property',
    fieldErrors,
    'propertyId'
  )

  const brandId =
    cleanOptionalText(input.brandId) === null
      ? null
      : validateUuidField(
          input.brandId as string,
          'Brand',
          fieldErrors,
          'brandId'
        )

  const title = cleanRequiredText(
    input.title,
    'Guide title',
    fieldErrors,
    'title',
    160
  )

  const subtitle = cleanOptionalLimitedText(
    input.subtitle,
    500,
    fieldErrors,
    'subtitle',
    'Subtitle'
  )

  const slug = normalizeSlug(input.slug)

  if (!slug) {
    fieldErrors.slug =
      'Enter a valid lowercase slug using letters, numbers, and hyphens.'
  }

  const status = input.status ?? 'draft'
  const guideMode = input.guideMode ?? 'hotel'

  const defaultTravelMode =
    input.defaultTravelMode ?? 'walking'

  if (!GUIDE_STATUSES.includes(status)) {
    fieldErrors.status =
      'Select a valid guide status.'
  }

  if (!GUIDE_MODES.includes(guideMode)) {
    fieldErrors.guideMode =
      'Select a valid guide mode.'
  }

  if (
    !TRAVEL_MODES.includes(defaultTravelMode)
  ) {
    fieldErrors.defaultTravelMode =
      'Select a valid travel mode.'
  }

  const publishedAt =
    normalizeOptionalIsoDate(input.publishedAt)

  if (
    cleanOptionalText(input.publishedAt) &&
    !publishedAt
  ) {
    fieldErrors.publishedAt =
      'Enter a valid publication date.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: 'Correct the highlighted guide fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      propertyId,
      brandId,

      title,
      subtitle,
      slug,

      status,
      guideMode,

      welcomeHeading:
        cleanOptionalLimitedText(
          input.welcomeHeading,
          200,
          fieldErrors,
          'welcomeHeading',
          'Welcome heading'
        ),

      welcomeDescription:
        cleanOptionalLimitedText(
          input.welcomeDescription,
          5000,
          fieldErrors,
          'welcomeDescription',
          'Welcome description'
        ),

      heroImageUrl:
        normalizeOptionalUrl(input.heroImageUrl),

      showPropertyFavorites:
        input.showPropertyFavorites ?? true,
      showSuggestedRoutes:
        input.showSuggestedRoutes ?? true,
      showNearbyEvents:
        input.showNearbyEvents ?? true,
      showPartnerOffers:
        input.showPartnerOffers ?? false,

      defaultTravelMode,
      poweredByRoam:
        input.poweredByRoam ?? true,

      publishedAt,
    },
  }
}

type RequiredValidatedPropertyGuideInput = {
  propertyId: string
  brandId: string | null

  title: string
  subtitle: string | null
  slug: string

  status: GuideStatus
  guideMode: GuideMode

  welcomeHeading: string | null
  welcomeDescription: string | null
  heroImageUrl: string | null

  showPropertyFavorites: boolean
  showSuggestedRoutes: boolean
  showNearbyEvents: boolean
  showPartnerOffers: boolean

  defaultTravelMode: GuideTravelMode
  poweredByRoam: boolean

  publishedAt: string | null
}

function validateGuideSectionInput(
  input: GuideSectionInput
):
  | GuideActionFailure
  | GuideActionSuccess<RequiredValidatedGuideSectionInput> {
  const fieldErrors: Record<string, string> = {}

  const guideId = validateUuidField(
    input.guideId,
    'Guide',
    fieldErrors,
    'guideId'
  )

  const sectionKey =
    requireGuideSectionKey(input.sectionKey)

  const position =
    normalizeNonNegativeInteger(input.position, 0)

  const config = normalizeSectionConfig(
    input.config,
    fieldErrors
  )

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: 'Correct the highlighted section fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      guideId,
      sectionKey,

      title: cleanOptionalLimitedText(
        input.title,
        160,
        fieldErrors,
        'title',
        'Section title'
      ),

      subtitle: cleanOptionalLimitedText(
        input.subtitle,
        500,
        fieldErrors,
        'subtitle',
        'Section subtitle'
      ),

      position,
      isVisible: input.isVisible ?? true,

      config,
    },
  }
}

type RequiredValidatedGuideSectionInput = {
  guideId: string
  sectionKey: GuideSectionKey

  title: string | null
  subtitle: string | null

  position: number
  isVisible: boolean

  config: Record<string, unknown>
}

function validateGuideFeaturedVenueInput(
  input: GuideFeaturedVenueInput
):
  | GuideActionFailure
  | GuideActionSuccess<RequiredValidatedGuideFeaturedVenueInput> {
  const fieldErrors: Record<string, string> = {}

  const guideId = validateUuidField(
    input.guideId,
    'Guide',
    fieldErrors,
    'guideId'
  )

  const venueId = validateUuidField(
    input.venueId,
    'Venue',
    fieldErrors,
    'venueId'
  )

  const sectionKey =
    requireGuideSectionKey(input.sectionKey)

  const visibleFrom =
    normalizeOptionalIsoDate(input.visibleFrom)

  const visibleUntil =
    normalizeOptionalIsoDate(input.visibleUntil)

  if (
    cleanOptionalText(input.visibleFrom) &&
    !visibleFrom
  ) {
    fieldErrors.visibleFrom =
      'Enter a valid visibility start date.'
  }

  if (
    cleanOptionalText(input.visibleUntil) &&
    !visibleUntil
  ) {
    fieldErrors.visibleUntil =
      'Enter a valid visibility end date.'
  }

  if (
    visibleFrom &&
    visibleUntil &&
    new Date(visibleUntil).getTime() <=
      new Date(visibleFrom).getTime()
  ) {
    fieldErrors.visibleUntil =
      'The visibility end must be later than the start.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error:
        'Correct the highlighted featured venue fields.',
      fieldErrors,
    }
  }

  return {
    success: true,
    data: {
      guideId,
      venueId,
      sectionKey,

      label: cleanOptionalLimitedText(
        input.label,
        120,
        fieldErrors,
        'label',
        'Label'
      ),

      description: cleanOptionalLimitedText(
        input.description,
        5000,
        fieldErrors,
        'description',
        'Description'
      ),

      conciergeNote:
        cleanOptionalLimitedText(
          input.conciergeNote,
          2000,
          fieldErrors,
          'conciergeNote',
          'Concierge note'
        ),

      position:
        normalizeNonNegativeInteger(
          input.position,
          0
        ),

      isFeatured:
        input.isFeatured ?? false,

      isVisible:
        input.isVisible ?? true,

      visibleFrom,
      visibleUntil,
    },
  }
}

type RequiredValidatedGuideFeaturedVenueInput = {
  guideId: string
  venueId: string
  sectionKey: GuideSectionKey

  label: string | null
  description: string | null
  conciergeNote: string | null

  position: number

  isFeatured: boolean
  isVisible: boolean

  visibleFrom: string | null
  visibleUntil: string | null
}

/* ------------------------------------------------ */
/* Section Config Validation                        */
/* ------------------------------------------------ */

function normalizeSectionConfig(
  value: Record<string, unknown> | undefined,
  fieldErrors: Record<string, string>
): Record<string, unknown> {
  if (!value) {
    return {}
  }

  if (
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    fieldErrors.config =
      'Section configuration must be an object.'

    return {}
  }

  let serialized = ''

  try {
    serialized = JSON.stringify(value)
  } catch {
    fieldErrors.config =
      'Section configuration must be valid JSON.'

    return {}
  }

  if (
    serialized.length > MAX_SECTION_CONFIG_LENGTH
  ) {
    fieldErrors.config =
      `Section configuration cannot exceed ${MAX_SECTION_CONFIG_LENGTH.toLocaleString()} characters.`
  }

  const displayStyle = value.displayStyle

  if (
    displayStyle !== undefined &&
    !GUIDE_DISPLAY_STYLES.includes(
      displayStyle as GuideDisplayStyle
    )
  ) {
    fieldErrors.config =
      'The section display style is invalid.'
  }

  const limit = value.limit

  if (
    limit !== undefined &&
    (
      typeof limit !== 'number' ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
  ) {
    fieldErrors.config =
      'The section limit must be an integer between 1 and 100.'
  }

  const venueTypes = value.venueTypes

  if (
    venueTypes !== undefined &&
    (
      !Array.isArray(venueTypes) ||
      !venueTypes.every(
        (entry) =>
          typeof entry === 'string' &&
          entry.trim().length > 0
      )
    )
  ) {
    fieldErrors.config =
      'Venue types must be an array of non-empty strings.'
  }

  return value
}

/* ------------------------------------------------ */
/* Database Helpers                                 */
/* ------------------------------------------------ */

async function getGuideSlugById(
  db: any,
  guideId: string
): Promise<string | null> {
  const { data } = await db
    .from('property_guides')
    .select('slug')
    .eq('id', guideId)
    .maybeSingle()

  return typeof data?.slug === 'string'
    ? data.slug
    : null
}

function databaseFailure(
  message: string,
  error: unknown
): GuideActionFailure {
  console.error('[guide-actions] Database error:', error)

  const detail =
    getDatabaseErrorMessage(error)

  return {
    success: false,
    error: detail
      ? `${message} ${detail}`
      : message,
  }
}

function getDatabaseErrorMessage(
  error: unknown
): string | null {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return null
  }

  const candidate = error as {
    code?: unknown
    message?: unknown
    details?: unknown
    hint?: unknown
  }

  const code =
    typeof candidate.code === 'string'
      ? candidate.code
      : null

  if (code === '23505') {
    return 'A record with the same unique value already exists.'
  }

  if (code === '23503') {
    return 'A related guide, section, property, brand, or venue could not be found.'
  }

  if (code === '23514') {
    return 'One or more values violate a database constraint.'
  }

  if (code === '42501') {
    return 'Your account does not have permission to perform this action.'
  }

  if (
    typeof candidate.message === 'string' &&
    candidate.message.trim()
  ) {
    return candidate.message.trim()
  }

  return null
}

/* ------------------------------------------------ */
/* Revalidation                                     */
/* ------------------------------------------------ */

function revalidateGuidePaths(
  guideSlug?: string | null
) {
  revalidatePath('/venue-admin')
  revalidatePath('/guide')

  if (guideSlug) {
    revalidatePath(`/guide/${guideSlug}`)
  }
}

/* ------------------------------------------------ */
/* General Validation Helpers                       */
/* ------------------------------------------------ */

function actionFailure(
  error: unknown
): GuideActionFailure {
  console.error('[guide-actions] Action failed:', error)

  return {
    success: false,
    error:
      error instanceof Error
        ? error.message
        : 'The guide operation could not be completed.',
  }
}

function validateUuidField(
  value: string,
  label: string,
  fieldErrors: Record<string, string>,
  field: string
): string {
  const normalized = cleanOptionalText(value)

  if (!normalized || !isUuid(normalized)) {
    fieldErrors[field] =
      `Select a valid ${label.toLowerCase()}.`

    return ''
  }

  return normalized
}

function requireUuid(
  value: string,
  fieldName: string
): string {
  const normalized = cleanOptionalText(value)

  if (!normalized || !isUuid(normalized)) {
    throw new Error(
      `Invalid ${fieldName}.`
    )
  }

  return normalized
}

function normalizeOptionalUuid(
  value: string | null | undefined
): string | null {
  const normalized = cleanOptionalText(value)

  if (!normalized) {
    return null
  }

  if (!isUuid(normalized)) {
    throw new Error('Invalid record ID.')
  }

  return normalized
}

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function requireGuideSectionKey(
  value: string
): GuideSectionKey {
  const normalized =
    value.trim().toLowerCase()

  if (
    !GUIDE_SECTION_KEYS.includes(
      normalized as GuideSectionKey
    )
  ) {
    throw new Error(
      `Invalid guide section key: ${value}`
    )
  }

  return normalized as GuideSectionKey
}

function cleanRequiredText(
  value: string,
  label: string,
  fieldErrors: Record<string, string>,
  field: string,
  maxLength: number
) {
  const cleaned = cleanOptionalText(value)

  if (!cleaned) {
    fieldErrors[field] = `${label} is required.`
    return ''
  }

  if (cleaned.length > maxLength) {
    fieldErrors[field] =
      `${label} cannot exceed ${maxLength} characters.`
  }

  return cleaned
}

function cleanOptionalLimitedText(
  value: string | null | undefined,
  maxLength: number,
  fieldErrors: Record<string, string>,
  field: string,
  label: string
): string | null {
  const cleaned = cleanOptionalText(value)

  if (
    cleaned &&
    cleaned.length > maxLength
  ) {
    fieldErrors[field] =
      `${label} cannot exceed ${maxLength} characters.`
  }

  return cleaned
}

function cleanOptionalText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed || null
}

function normalizeSlug(
  value: string
): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (
    !normalized ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      normalized
    )
  ) {
    return ''
  }

  return normalized
}

function normalizeOptionalUrl(
  value: string | null | undefined
): string | null {
  const cleaned = cleanOptionalText(value)

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

  return `https://${cleaned}`
}

function normalizeOptionalIsoDate(
  value: string | null | undefined
): string | null {
  const cleaned = cleanOptionalText(value)

  if (!cleaned) {
    return null
  }

  const parsed = new Date(cleaned)

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null
  }

  return parsed.toISOString()
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return fallback
  }

  return Math.max(
    0,
    Math.round(value)
  )
}

function isHexColor(
  value: string
) {
  return /^#[0-9a-f]{6}$/i.test(value)
}