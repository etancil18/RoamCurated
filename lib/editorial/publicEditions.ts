
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const EDITION_SELECT = `
  id,
  edition_type,
  title,
  subtitle,
  description,
  city,
  theme_key,
  featured_creator_id,
  credit_mode,
  design_settings,
  published_at
`

const ITEM_SELECT = `
  id,
  venue_id,
  position,
  display_title,
  editorial_blurb,
  badge,
  image_override_url
`

// =====================================================
// PUBLIC EDITIONS — CONTEXT SLIDES
//
// Additional fields are loaded separately to preserve
// the existing public Edition listing query.
// =====================================================

const CONTEXT_SLIDE_SELECT = `
  id,
  edition_id,
  after_item_id,
  position,
  heading,
  body,
  image_source,
  creator_media_id
`

type PublicEditionContextImageSource =
  | 'none'
  | 'venue_cover'
  | 'creator_media'

export type PublicEditionContextSlide = {
  id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: PublicEditionContextImageSource
  creator_media_id: string | null
  image_url: string | null
}

type ContextSlideRow = {
  id: string
  edition_id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: PublicEditionContextImageSource
  creator_media_id: string | null
}

type ContextEditionEligibilityRow = {
  edition_type: string
  featured_creator_id: string | null
  source_collection_id: string | null
  creator_permission_status: string
}

type ContextCollectionRow = {
  id: string
  user_id: string
  visibility: string
}

type ContextMediaRow = {
  id: string
  collection_id: string
  user_id: string
  venue_id: string | null
  media_type: string
  storage_path: string
}

// The context-slide table may not yet appear in the
// project's generated Supabase Database types.
// Limit this compatibility cast to new context functionality.
const contextDb =
  supabaseAdmin as unknown as SupabaseClient

// =====================================================
// PUBLIC EDITIONS — CREATOR SOCIAL LINKS
// =====================================================

export type PublicEditionCreatorSocialLink = {
  platform: 'instagram' | 'tiktok'
  url: string
}

export type PublicEditionCreator = {
  id: string
  username: string | null
  full_name: string | null

  // Only explicitly public Instagram/TikTok links.
  social_links: PublicEditionCreatorSocialLink[]
}

export type PublicEdition = {
  id: string
  edition_type: string
  title: string
  subtitle: string | null
  description: string | null
  city: string | null
  theme_key: string | null
  featured_creator_id: string | null
  credit_mode: string
  design_settings: Record<string, unknown> | null
  published_at: string
  creator: PublicEditionCreator | null
}

export type PublicEditionItem = {
  id: string
  venue_id: string
  position: number
  display_title: string | null
  editorial_blurb: string | null
  badge: string | null
  image_override_url: string | null
  venue_name: string
  venue_city: string | null
  venue_cover_url: string | null
  venue_description: string | null
  image_url: string | null
  venue_href: string
}

export type PublicEditionDetail = PublicEdition & {
  items: PublicEditionItem[]

  // Optional additional slides following venue items.
  // Existing editions without context slides return [].
  context_slides: PublicEditionContextSlide[]
}

type EditionRow = Omit<PublicEdition, 'creator'>

type ItemRow = {
  id: string
  venue_id: string
  position: number
  display_title: string | null
  editorial_blurb: string | null
  badge: string | null
  image_override_url: string | null
}

type VenueRow = {
  id: string
  name: string | null
  city: string | null
  cover: string | null
  description: string | null
}

// =====================================================
// PUBLIC EDITIONS — CREATOR SOCIAL URL VALIDATION
//
// Use only saved, explicitly public Instagram/TikTok URLs.
// Do not derive social accounts from Roam usernames.
// =====================================================

function normalizePublicCreatorSocialLink(
  platform: string,
  value: string,
): PublicEditionCreatorSocialLink | null {
  if (
    platform !== 'instagram' &&
    platform !== 'tiktok'
  ) {
    return null
  }

  try {
    const url = new URL(value.trim())

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null
    }

    const hostname = url.hostname.toLowerCase()

    const validHostname =
      platform === 'instagram'
        ? hostname === 'instagram.com' ||
          hostname === 'www.instagram.com'
        : hostname === 'tiktok.com' ||
          hostname === 'www.tiktok.com'

    if (!validHostname) {
      return null
    }

    return {
      platform,
      url: url.href,
    }
  } catch {
    return null
  }
}

async function loadCreators(
  editions: EditionRow[],
): Promise<Map<string, PublicEditionCreator>> {
  const creatorIds = [
    ...new Set(
      editions
        .map((edition) => edition.featured_creator_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  if (creatorIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, full_name')
    .in('id', creatorIds)

  if (error) throw error

  // =====================================================
  // PUBLIC EDITIONS — LOAD CREATOR SOCIAL LINKS
  //
  // Match the existing public creator-profile privacy
  // rule: only links with is_public = true may be shown.
  //
  // Preserve the saved platform URL and display order.
  // =====================================================

  const {
    data: socialData,
    error: socialError,
  } = await supabaseAdmin
    .from('creator_social_links')
    .select('user_id, platform, url, sort_order')
    .in('user_id', creatorIds)
    .eq('is_public', true)
    .in('platform', ['instagram', 'tiktok'])
    .order('sort_order', { ascending: true })

  if (socialError) throw socialError

  type CreatorSocialRow = {
    user_id: string
    platform: string
    url: string
    sort_order: number | null
  }

  const socialLinksByCreator = new Map<
    string,
    PublicEditionCreatorSocialLink[]
  >()

  for (
    const row of (socialData ?? []) as CreatorSocialRow[]
  ) {
    const link = normalizePublicCreatorSocialLink(
      row.platform,
      row.url,
    )

    if (!link) continue

    const existing =
      socialLinksByCreator.get(row.user_id) ?? []

    // Show at most one link per social platform.
    if (
      existing.some(
        (item) => item.platform === link.platform,
      )
    ) {
      continue
    }

    existing.push(link)

    socialLinksByCreator.set(
      row.user_id,
      existing,
    )
  }

  return new Map(
    ((data ?? []) as {
      id: string
      username: string | null
      full_name: string | null
    }[]).map((creator) => [
      creator.id,
      {
        ...creator,
        social_links:
          socialLinksByCreator.get(creator.id) ?? [],
      },
    ]),
  )
}

function withCreators(
  editions: EditionRow[],
  creators: Map<string, PublicEditionCreator>,
): PublicEdition[] {
  return editions.map((edition) => ({
    ...edition,
    creator: edition.featured_creator_id
      ? creators.get(edition.featured_creator_id) ?? null
      : null,
  }))
}

/**
 * Normalize editorial image URLs for public browser rendering.
 *
 * Canonical Roam venue covers are stored as relative paths:
 *   img/venues/Krog Bar.jpg
 *
 * Public edition routes require root-relative paths:
 *   /img/venues/Krog Bar.jpg
 *
 * Absolute URLs and existing root-relative paths are preserved.
 */
function normalizeEditorialImageUrl(
  value: string | null | undefined,
): string | null {
  const image = value?.trim()

  if (!image) return null

  if (
    /^https?:\/\//i.test(image) ||
    image.startsWith('data:image/') ||
    image.startsWith('blob:')
  ) {
    return image
  }

  if (image.startsWith('/')) {
    return image
  }

  return `/${image}`
}

// =====================================================
// PUBLIC EDITIONS — CONTEXT IMAGE PATH VALIDATION
//
// New context-media references must resolve through the
// existing public creator-collection-media bucket.
//
// Unlike existing venue image URLs, arbitrary external
// URLs are not accepted for creator media.
// =====================================================

function validContextStoragePath(
  value: string,
): boolean {
  if (
    !value ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return false
  }

  return value.split('/').every(
    (segment) =>
      segment.length > 0 &&
      segment !== '.' &&
      segment !== '..',
  )
}

function publicContextMediaUrl(
  storagePath: string,
): string | null {
  if (!validContextStoragePath(storagePath)) {
    return null
  }

  const { data } = contextDb.storage
    .from('creator-collection-media')
    .getPublicUrl(storagePath)

  return data.publicUrl || null
}

// =====================================================
// PUBLIC EDITIONS — LOAD CONTEXT SLIDES
//
// This helper:
// - Loads only context slides belonging to this Edition.
// - Associates each context with a real public venue item.
// - Preserves order within each parent venue.
// - Resolves creator photographs through existing media.
// - Revalidates creator ownership, source collection,
//   public collection visibility, image type, and venue tag.
// - Falls back to the canonical venue cover if creator
//   media becomes ineligible.
// - Never exposes creator media storage paths.
//
// No changes are made to existing venue-item records.
// =====================================================

async function loadPublicContextSlides(
  editionId: string,
  items: PublicEditionItem[],
): Promise<PublicEditionContextSlide[]> {
  if (items.length === 0) {
    return []
  }

  const { data: slideData, error: slideError } =
    await contextDb
      .from('roam_editorial_edition_context_slides')
      .select(CONTEXT_SLIDE_SELECT)
      .eq('edition_id', editionId)
      .order('position', { ascending: true })
      .order('id', { ascending: true })

  if (slideError) throw slideError

  const slides =
    (slideData ?? []) as ContextSlideRow[]

  if (slides.length === 0) {
    return []
  }

  const itemMap = new Map(
    items.map((item) => [item.id, item]),
  )

  // Do not expose contexts whose parent venue item
  // is not present in the public Edition.
  const validSlides = slides.filter(
    (slide) => itemMap.has(slide.after_item_id),
  )

  if (validSlides.length === 0) {
    return []
  }

  const creatorMediaIds = [
    ...new Set(
      validSlides
        .filter(
          (slide) =>
            slide.image_source === 'creator_media' &&
            typeof slide.creator_media_id === 'string' &&
            UUID_PATTERN.test(slide.creator_media_id),
        )
        .map(
          (slide) => slide.creator_media_id as string,
        ),
    ),
  ]

  const eligibleMedia = new Map<string, string>()

  if (creatorMediaIds.length > 0) {
    // The original public Edition query deliberately
    // remains unchanged. Only fetch the extra fields
    // when context slides actually reference photos.
    const {
      data: eligibilityData,
      error: eligibilityError,
    } = await contextDb
      .from('roam_editorial_editions')
      .select(
        `
          edition_type,
          featured_creator_id,
          source_collection_id,
          creator_permission_status
        `,
      )
      .eq('id', editionId)
      .maybeSingle()

    if (eligibilityError) throw eligibilityError

    const eligibility =
      (eligibilityData ??
        null) as ContextEditionEligibilityRow | null

    // Mirror the conservative eligibility rules used
    // by the dedicated context-slide admin API.
    if (
      eligibility?.edition_type ===
        'featured_collection' &&
      eligibility.creator_permission_status ===
        'approved' &&
      eligibility.featured_creator_id &&
      eligibility.source_collection_id
    ) {
      const {
        data: collectionData,
        error: collectionError,
      } = await contextDb
        .from('creator_collections')
        .select('id, user_id, visibility')
        .eq(
          'id',
          eligibility.source_collection_id,
        )
        .eq(
          'user_id',
          eligibility.featured_creator_id,
        )
        .eq('visibility', 'public')
        .maybeSingle()

      if (collectionError) throw collectionError

      const collection =
        (collectionData ??
          null) as ContextCollectionRow | null

      if (collection) {
        const {
          data: mediaData,
          error: mediaError,
        } = await contextDb
          .from('creator_collection_media')
          .select(
            `
              id,
              collection_id,
              user_id,
              venue_id,
              media_type,
              storage_path
            `,
          )
          .in('id', creatorMediaIds)
          .eq('collection_id', collection.id)
          .eq('user_id', collection.user_id)
          .eq('media_type', 'image')

        if (mediaError) throw mediaError

        const mediaRows =
          (mediaData ?? []) as ContextMediaRow[]

        const referencedVenueByMedia =
          new Map<string, Set<string>>()

        for (const slide of validSlides) {
          if (
            slide.image_source !== 'creator_media' ||
            !slide.creator_media_id
          ) {
            continue
          }

          const parent = itemMap.get(
            slide.after_item_id,
          )

          if (!parent) continue

          const venues =
            referencedVenueByMedia.get(
              slide.creator_media_id,
            ) ?? new Set<string>()

          venues.add(parent.venue_id)

          referencedVenueByMedia.set(
            slide.creator_media_id,
            venues,
          )
        }

        for (const media of mediaRows) {
          if (
            media.collection_id !== collection.id ||
            media.user_id !== collection.user_id ||
            media.user_id !==
              eligibility.featured_creator_id ||
            media.media_type !== 'image' ||
            !media.venue_id ||
            !referencedVenueByMedia
              .get(media.id)
              ?.has(media.venue_id)
          ) {
            continue
          }

          const imageUrl = publicContextMediaUrl(
            media.storage_path,
          )

          if (imageUrl) {
            eligibleMedia.set(
              `${media.id}:${media.venue_id}`,
              imageUrl,
            )
          }
        }
      }
    }
  }

  const publicSlides: PublicEditionContextSlide[] =
    validSlides.map((slide) => {
      const parent = itemMap.get(
        slide.after_item_id,
      )!

      const coverUrl =
        parent.venue_cover_url

      // Text-only context: no photography required.
      if (slide.image_source === 'none') {
        return {
          id: slide.id,
          after_item_id: slide.after_item_id,
          position: slide.position,
          heading: slide.heading,
          body: slide.body,
          image_source: 'none',
          creator_media_id: null,
          image_url: null,
        }
      }

      // Official venue cover: always use the same
      // canonical image already loaded for the venue.
      if (slide.image_source === 'venue_cover') {
        return {
          id: slide.id,
          after_item_id: slide.after_item_id,
          position: slide.position,
          heading: slide.heading,
          body: slide.body,
          image_source: coverUrl
            ? 'venue_cover'
            : 'none',
          creator_media_id: null,
          image_url: coverUrl,
        }
      }

      // Creator media must still be eligible at read time.
      const creatorImageUrl =
        slide.creator_media_id
          ? eligibleMedia.get(
              `${slide.creator_media_id}:${parent.venue_id}`,
            ) ?? null
          : null

      if (creatorImageUrl) {
        return {
          id: slide.id,
          after_item_id: slide.after_item_id,
          position: slide.position,
          heading: slide.heading,
          body: slide.body,
          image_source: 'creator_media',
          creator_media_id: slide.creator_media_id,
          image_url: creatorImageUrl,
        }
      }

      // If media eligibility changes, safely fall back.
      // Never expose the previously selected media ID
      // or its storage location in the public payload.
      return {
        id: slide.id,
        after_item_id: slide.after_item_id,
        position: slide.position,
        heading: slide.heading,
        body: slide.body,
        image_source: coverUrl
          ? 'venue_cover'
          : 'none',
        creator_media_id: null,
        image_url: coverUrl,
      }
    })

  // The venue positions are authoritative.
  // Context positions are local to their parent venue.
  return publicSlides.sort((a, b) => {
    const aPosition =
      itemMap.get(a.after_item_id)?.position ??
      Number.MAX_SAFE_INTEGER

    const bPosition =
      itemMap.get(b.after_item_id)?.position ??
      Number.MAX_SAFE_INTEGER

    return (
      aPosition - bPosition ||
      a.position - b.position ||
      a.id.localeCompare(b.id)
    )
  })
}

/**
 * Public library listing.
 *
 * Only explicitly published, approved editions
 * or previously approved archived editions appear.
 *
 * This is deliberately separate from the admin API.
 */
export async function getPublicEditions(
  limit = 60,
): Promise<PublicEdition[]> {
  const safeLimit = Math.min(
    Math.max(Math.trunc(Number.isFinite(limit) ? limit : 60), 1),
    100,
  )

  const { data, error } = await supabaseAdmin
    .from('roam_editorial_editions')
    .select(EDITION_SELECT)
    .eq('is_public', true)
    .not('published_at', 'is', null)
    .not('approved_at', 'is', null)
    .in('status', ['approved', 'archived'])
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(safeLimit)

  if (error) throw error

  const editions = (data ?? []) as EditionRow[]
  const creators = await loadCreators(editions)

  return withCreators(editions, creators)
}

/**
 * Load one public issue, including its ordered
 * venue slides and canonical venue-profile URLs.
 *
 * Unpublished editions, drafts, and editions
 * in review are not returned.
 */
export async function getPublicEdition(
  editionId: string,
): Promise<PublicEditionDetail | null> {
  if (!UUID_PATTERN.test(editionId)) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from('roam_editorial_editions')
    .select(EDITION_SELECT)
    .eq('id', editionId)
    .eq('is_public', true)
    .not('published_at', 'is', null)
    .not('approved_at', 'is', null)
    .in('status', ['approved', 'archived'])
    .maybeSingle()

  if (error) throw error

  if (!data) {
    return null
  }

  const edition = data as EditionRow

  const { data: itemData, error: itemError } =
    await supabaseAdmin
      .from('roam_editorial_edition_items')
      .select(ITEM_SELECT)
      .eq('edition_id', editionId)
      .order('position', { ascending: true })
      .order('id', { ascending: true })

  if (itemError) throw itemError

  const items = (itemData ?? []) as ItemRow[]

  const venueIds = [
    ...new Set(items.map((item) => item.venue_id)),
  ]

  let venues: VenueRow[] = []

  if (venueIds.length > 0) {
    const { data: venueData, error: venueError } =
      await supabaseAdmin
        .from('venues')
        .select('id, name, city, cover, description')
        .in('id', venueIds)

    if (venueError) throw venueError

    venues = (venueData ?? []) as VenueRow[]
  }

  const venueMap = new Map(
    venues.map((venue) => [venue.id, venue]),
  )

  const publicItems: PublicEditionItem[] = items.map(
    (item) => {
      const venue = venueMap.get(item.venue_id)

      return {
        ...item,
        image_override_url: normalizeEditorialImageUrl(
          item.image_override_url,
        ),
        venue_name: venue?.name ?? 'Unavailable venue',
        venue_city: venue?.city ?? null,
        venue_cover_url: normalizeEditorialImageUrl(
          venue?.cover,
        ),
        venue_description: venue?.description ?? null,
        image_url: normalizeEditorialImageUrl(
          item.image_override_url ??
          venue?.cover ??
          null,
        ),
        venue_href:
          `/venue-profile/${encodeURIComponent(item.venue_id)}`,
      }
    },
  )

  // =====================================================
  // PUBLIC EDITIONS — CONTEXT SLIDE INTEGRATION
  //
  // The original venue query and data mapping above
  // remain completely unchanged.
  //
  // Context slides are loaded separately, validated
  // against these public venue items, and returned
  // for interleaving by the swipeable reader.
  // =====================================================

  const contextSlides = await loadPublicContextSlides(
    editionId,
    publicItems,
  )

  const creators = await loadCreators([edition])

  return {
    ...withCreators([edition], creators)[0],
    items: publicItems,
    context_slides: contextSlides,
  }
}
