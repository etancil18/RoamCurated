
import 'server-only'

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

export type PublicEditionCreator = {
  id: string
  username: string | null
  full_name: string | null
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

  return new Map(
    ((data ?? []) as PublicEditionCreator[]).map(
      (creator) => [creator.id, creator],
    ),
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

  const creators = await loadCreators([edition])

  return {
    ...withCreators([edition], creators)[0],
    items: publicItems,
  }
}
