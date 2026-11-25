
import 'server-only'

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

// ============================================================
// ROAM EDITIONS — CONTEXT SLIDES API
//
// GET:
//   List context slides.
//   Optionally list eligible creator photos for a venue item.
//
// POST:
//   Add a context slide after an existing venue item.
//
// PATCH:
//   Update a context slide's writing and/or image selection.
//
// DELETE:
//   Remove a context slide.
//
// Safeguards:
//   - Venue admin authentication on every request
//   - Draft-only mutations
//   - Strict request-body validation
//   - Same-Edition parent item validation
//   - No arbitrary image URLs
//   - Creator/collection/venue media eligibility checks
//   - No changes to existing venue item endpoints
// ============================================================

type Context = {
  params: Promise<{ editionId: string }>
}

type JsonRecord = Record<string, unknown>

type ImageSource =
  | 'none'
  | 'venue_cover'
  | 'creator_media'

type EditionRow = {
  id: string
  status: string
  edition_type: string
  featured_creator_id: string | null
  source_collection_id: string | null
  creator_permission_status: string
}

type ItemRow = {
  id: string
  edition_id: string
  venue_id: string
  position: number
}

type ContextSlideRow = {
  id: string
  edition_id: string
  after_item_id: string
  position: number
  heading: string | null
  body: string
  image_source: ImageSource
  creator_media_id: string | null
  created_at: string
  updated_at: string
}

type CollectionRow = {
  id: string
  user_id: string
  visibility: string
}

type MediaRow = {
  id: string
  collection_id: string
  user_id: string
  venue_id: string | null
  media_type: string
  storage_path: string
  caption: string | null
  alt_text: string | null
  width: number | null
  height: number | null
}

type EligibleMedia = {
  id: string
  venue_id: string
  image_url: string
  caption: string | null
  alt_text: string | null
  width: number | null
  height: number | null
}

type SlideOutput = ContextSlideRow & {
  image_url: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const IMAGE_SOURCES = new Set<string>([
  'none',
  'venue_cover',
  'creator_media',
])

const MAX_HEADING_LENGTH = 160
const MAX_BODY_LENGTH = 1500
const MAX_CONTEXT_SLIDES_PER_ITEM = 12
const MAX_MEDIA_OPTIONS = 100

const SLIDE_SELECT = `
  id,
  edition_id,
  after_item_id,
  position,
  heading,
  body,
  image_source,
  creator_media_id,
  created_at,
  updated_at
`

const EDITION_SELECT = `
  id,
  status,
  edition_type,
  featured_creator_id,
  source_collection_id,
  creator_permission_status
`

const MEDIA_SELECT = `
  id,
  collection_id,
  user_id,
  venue_id,
  media_type,
  storage_path,
  caption,
  alt_text,
  width,
  height
`

// ------------------------------------------------------------
// The new table may not yet be represented in a project's
// generated Supabase Database types.
//
// Use an unparameterized SupabaseClient only for this route,
// while retaining the existing authenticated admin client.
//
// After regenerating Database types, this can be replaced
// with the project's fully typed Supabase client.
// ------------------------------------------------------------

const db = supabaseAdmin as unknown as SupabaseClient

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID_PATTERN.test(value)
  )
}

function hasOnlyKeys(
  body: JsonRecord,
  allowed: readonly string[],
): boolean {
  const allowedSet = new Set(allowed)

  return Object.keys(body).every((key) =>
    allowedSet.has(key),
  )
}

function readHeading(
  value: unknown,
): string | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()

  if (trimmed.length > MAX_HEADING_LENGTH) {
    return undefined
  }

  return trimmed || null
}

function readBody(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()

  if (
    trimmed.length < 1 ||
    trimmed.length > MAX_BODY_LENGTH
  ) {
    return null
  }

  return trimmed
}

function readImageSource(
  value: unknown,
): ImageSource | null {
  return (
    typeof value === 'string' &&
    IMAGE_SOURCES.has(value)
  )
    ? (value as ImageSource)
    : null
}

function validImagePair(
  source: ImageSource,
  mediaId: string | null,
): boolean {
  if (source === 'creator_media') {
    return validId(mediaId)
  }

  return mediaId === null
}

// ------------------------------------------------------------
// Storage paths must be relative to the existing
// creator-collection-media bucket.
//
// Do not accept arbitrary URLs or path traversal.
// ------------------------------------------------------------

function validStoragePath(
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

function publicMediaUrl(
  storagePath: string,
): string | null {
  if (!validStoragePath(storagePath)) {
    return null
  }

  const { data } = db.storage
    .from('creator-collection-media')
    .getPublicUrl(storagePath)

  return data.publicUrl || null
}

function isUniqueConflict(
  error: { code?: string } | null,
): boolean {
  return error?.code === '23505'
}

// ============================================================
// EDITION AUTHORIZATION
// ============================================================

async function getEdition(
  editionId: string,
): Promise<EditionRow | null> {
  const { data, error } = await db
    .from('roam_editorial_editions')
    .select(EDITION_SELECT)
    .eq('id', editionId)
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as EditionRow | null
}

async function authorizeEdition(
  editionId: string,
  requireDraft: boolean,
): Promise<
  | {
      ok: true
      edition: EditionRow
    }
  | {
      ok: false
      response: NextResponse
    }
> {
  if (!validId(editionId)) {
    return {
      ok: false,
      response: json(
        { error: 'Invalid edition ID.' },
        400,
      ),
    }
  }

  const edition = await getEdition(editionId)

  if (!edition) {
    return {
      ok: false,
      response: json(
        { error: 'Edition not found.' },
        404,
      ),
    }
  }

  if (requireDraft && edition.status !== 'draft') {
    return {
      ok: false,
      response: json(
        {
          error:
            'Only draft editions can be modified.',
        },
        409,
      ),
    }
  }

  return {
    ok: true,
    edition,
  }
}

// ============================================================
// VENUE ITEM OWNERSHIP
// ============================================================

async function getParentItem(
  editionId: string,
  itemId: string,
): Promise<ItemRow | null> {
  const { data, error } = await db
    .from('roam_editorial_edition_items')
    .select('id, edition_id, venue_id, position')
    .eq('edition_id', editionId)
    .eq('id', itemId)
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as ItemRow | null
}

async function getEditionItems(
  editionId: string,
): Promise<ItemRow[]> {
  const { data, error } = await db
    .from('roam_editorial_edition_items')
    .select('id, edition_id, venue_id, position')
    .eq('edition_id', editionId)
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error

  return (data ?? []) as ItemRow[]
}

// ============================================================
// CREATOR PHOTO ELIGIBILITY
//
// First-release policy:
//
// - Featured collection Edition
// - Linked source collection
// - Explicitly approved creator permission
// - Featured creator matches collection owner
// - Collection is public
// - Media belongs to that same creator and collection
// - Image type only
// - Exact canonical venue tag
//
// A public bucket alone does not imply publishing rights.
// ============================================================

async function getEligibleCollection(
  edition: EditionRow,
): Promise<CollectionRow | null> {
  if (
    edition.edition_type !== 'featured_collection' ||
    edition.creator_permission_status !== 'approved' ||
    !edition.featured_creator_id ||
    !edition.source_collection_id
  ) {
    return null
  }

  const { data, error } = await db
    .from('creator_collections')
    .select('id, user_id, visibility')
    .eq('id', edition.source_collection_id)
    .eq('user_id', edition.featured_creator_id)
    .eq('visibility', 'public')
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as CollectionRow | null
}

function eligibleMediaRow(
  media: MediaRow,
  edition: EditionRow,
  collection: CollectionRow,
  venueId: string,
): boolean {
  return (
    media.collection_id === collection.id &&
    media.user_id === collection.user_id &&
    media.user_id === edition.featured_creator_id &&
    media.venue_id === venueId &&
    media.media_type === 'image' &&
    publicMediaUrl(media.storage_path) !== null
  )
}

function formatEligibleMedia(
  media: MediaRow,
): EligibleMedia {
  return {
    id: media.id,
    venue_id: media.venue_id as string,
    image_url: publicMediaUrl(
      media.storage_path,
    ) as string,
    caption: media.caption,
    alt_text: media.alt_text,
    width: media.width,
    height: media.height,
  }
}

async function findEligibleMedia(
  edition: EditionRow,
  parent: ItemRow,
  mediaId: string,
): Promise<EligibleMedia | null> {
  const collection = await getEligibleCollection(
    edition,
  )

  if (!collection) {
    return null
  }

  const { data, error } = await db
    .from('creator_collection_media')
    .select(MEDIA_SELECT)
    .eq('id', mediaId)
    .eq('collection_id', collection.id)
    .eq('user_id', collection.user_id)
    .eq('venue_id', parent.venue_id)
    .eq('media_type', 'image')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const media = data as MediaRow

  if (
    !eligibleMediaRow(
      media,
      edition,
      collection,
      parent.venue_id,
    )
  ) {
    return null
  }

  return formatEligibleMedia(media)
}

async function listEligibleMedia(
  edition: EditionRow,
  parent: ItemRow,
): Promise<EligibleMedia[]> {
  const collection = await getEligibleCollection(
    edition,
  )

  if (!collection) return []

  const { data, error } = await db
    .from('creator_collection_media')
    .select(MEDIA_SELECT)
    .eq('collection_id', collection.id)
    .eq('user_id', collection.user_id)
    .eq('venue_id', parent.venue_id)
    .eq('media_type', 'image')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(MAX_MEDIA_OPTIONS)

  if (error) throw error

  return ((data ?? []) as MediaRow[])
    .filter((media) =>
      eligibleMediaRow(
        media,
        edition,
        collection,
        parent.venue_id,
      ),
    )
    .map(formatEligibleMedia)
}

// ============================================================
// CONTEXT-SLIDE LOADING
//
// Returns database slide fields plus a resolved creator
// image URL only when the media is still eligible.
//
// Public reader loading must independently repeat this
// eligibility check before showing creator media.
// ============================================================

async function loadSlides(
  edition: EditionRow,
  itemId?: string,
): Promise<SlideOutput[]> {
  const items = await getEditionItems(edition.id)

  const itemMap = new Map(
    items.map((item) => [item.id, item]),
  )

  let query = db
    .from('roam_editorial_edition_context_slides')
    .select(SLIDE_SELECT)
    .eq('edition_id', edition.id)
    .order('position', { ascending: true })
    .order('id', { ascending: true })

  if (itemId) {
    query = query.eq('after_item_id', itemId)
  }

  const { data, error } = await query

  if (error) throw error

  const slides =
    (data ?? []) as ContextSlideRow[]

  const collection = await getEligibleCollection(
    edition,
  )

  const mediaIds = [
    ...new Set(
      slides
        .filter(
          (slide) =>
            slide.image_source === 'creator_media' &&
            validId(slide.creator_media_id),
        )
        .map(
          (slide) => slide.creator_media_id as string,
        ),
    ),
  ]

  const mediaMap = new Map<string, MediaRow>()

  if (collection && mediaIds.length > 0) {
    const mediaResult = await db
      .from('creator_collection_media')
      .select(MEDIA_SELECT)
      .in('id', mediaIds)
      .eq('collection_id', collection.id)
      .eq('user_id', collection.user_id)
      .eq('media_type', 'image')

    if (mediaResult.error) throw mediaResult.error

    for (
      const media of
      (mediaResult.data ?? []) as MediaRow[]
    ) {
      mediaMap.set(media.id, media)
    }
  }

  return slides
    .map((slide): SlideOutput => {
      const parent = itemMap.get(
        slide.after_item_id,
      )

      let imageUrl: string | null = null

      if (
        parent &&
        collection &&
        slide.image_source === 'creator_media' &&
        slide.creator_media_id
      ) {
        const media = mediaMap.get(
          slide.creator_media_id,
        )

        if (
          media &&
          eligibleMediaRow(
            media,
            edition,
            collection,
            parent.venue_id,
          )
        ) {
          imageUrl = publicMediaUrl(
            media.storage_path,
          )
        }
      }

      return {
        ...slide,
        image_url: imageUrl,
      }
    })
    .sort((a, b) => {
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

async function getSlide(
  editionId: string,
  slideId: string,
): Promise<ContextSlideRow | null> {
  const { data, error } = await db
    .from('roam_editorial_edition_context_slides')
    .select(SLIDE_SELECT)
    .eq('edition_id', editionId)
    .eq('id', slideId)
    .maybeSingle()

  if (error) throw error

  return (data ?? null) as ContextSlideRow | null
}

// ============================================================
// GET — LIST CONTEXT SLIDES AND OPTIONAL ELIGIBLE PHOTOS
//
// GET /context-slides
//
// GET /context-slides?item_id=<venue-item-uuid>
//
// GET /context-slides?item_id=<venue-item-uuid>&include_media=true
//
// Media choices are scoped to the associated venue item.
// ============================================================

export async function GET(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await authorizeEdition(
      editionId,
      false,
    )

    if (!check.ok) return check.response

    const url = new URL(request.url)

    const itemId = url.searchParams.get('item_id')

    const includeMedia =
      url.searchParams.get('include_media') === 'true'

    const allowedParams = new Set([
      'item_id',
      'include_media',
    ])

    for (const key of url.searchParams.keys()) {
      if (!allowedParams.has(key)) {
        return json(
          { error: 'Unsupported query parameter.' },
          400,
        )
      }
    }

    const mediaParam =
      url.searchParams.get('include_media')

    if (
      mediaParam !== null &&
      mediaParam !== 'true' &&
      mediaParam !== 'false'
    ) {
      return json(
        { error: 'Invalid include_media value.' },
        400,
      )
    }

    if (
      (itemId !== null && !validId(itemId)) ||
      (includeMedia && !itemId)
    ) {
      return json(
        {
          error:
            'A valid item_id is required for this request.',
        },
        400,
      )
    }

    let parent: ItemRow | null = null

    if (itemId) {
      parent = await getParentItem(
        editionId,
        itemId,
      )

      if (!parent) {
        return json(
          { error: 'Edition venue item not found.' },
          404,
        )
      }
    }

    const slides = await loadSlides(
      check.edition,
      itemId ?? undefined,
    )

    if (!includeMedia || !parent) {
      return json({ slides })
    }

    const media = await listEligibleMedia(
      check.edition,
      parent,
    )

    return json({
      slides,
      media,
    })
  } catch (error) {
    console.error(
      '[editorial/context-slides] GET failed:',
      error,
    )

    return json(
      { error: 'Could not load context slides.' },
      500,
    )
  }
}

// ============================================================
// POST — CREATE A CONTEXT SLIDE
//
// Body:
// {
//   "after_item_id": "uuid",
//   "heading": "Optional heading",
//   "body": "Written perspective",
//   "image_source": "none" | "venue_cover" | "creator_media",
//   "creator_media_id": "uuid" | null
// }
//
// image_source defaults to "none".
// New slides append after existing contexts for the parent.
// ============================================================

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await authorizeEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      !hasOnlyKeys(body, [
        'after_item_id',
        'heading',
        'body',
        'image_source',
        'creator_media_id',
      ]) ||
      !validId(body.after_item_id)
    ) {
      return json(
        { error: 'Invalid context-slide request.' },
        400,
      )
    }

    const heading = readHeading(
      body.heading ?? null,
    )

    const writtenBody = readBody(body.body)

    const imageSource = readImageSource(
      body.image_source ?? 'none',
    )

    const creatorMediaId =
      body.creator_media_id ?? null

    if (
      heading === undefined ||
      writtenBody === null ||
      imageSource === null ||
      !(
        creatorMediaId === null ||
        validId(creatorMediaId)
      ) ||
      !validImagePair(
        imageSource,
        creatorMediaId,
      )
    ) {
      return json(
        {
          error:
            'Invalid heading, written perspective, or image selection.',
        },
        400,
      )
    }

    const parent = await getParentItem(
      editionId,
      body.after_item_id,
    )

    if (!parent) {
      return json(
        {
          error:
            'The selected venue item does not belong to this Edition.',
        },
        404,
      )
    }

    if (imageSource === 'creator_media') {
      const eligible = await findEligibleMedia(
        check.edition,
        parent,
        creatorMediaId as string,
      )

      if (!eligible) {
        return json(
          {
            error:
              'This photo is not eligible for this venue and Edition.',
          },
          403,
        )
      }
    }

    const { data: existing, error: listError } =
      await db
        .from('roam_editorial_edition_context_slides')
        .select('position')
        .eq('edition_id', editionId)
        .eq('after_item_id', parent.id)
        .order('position', { ascending: false })
        .limit(1)

    if (listError) throw listError

    const { count, error: countError } = await db
      .from('roam_editorial_edition_context_slides')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('edition_id', editionId)
      .eq('after_item_id', parent.id)

    if (countError) throw countError

    if (
      (count ?? 0) >= MAX_CONTEXT_SLIDES_PER_ITEM
    ) {
      return json(
        {
          error:
            `A venue can have at most ${MAX_CONTEXT_SLIDES_PER_ITEM} context slides.`,
        },
        409,
      )
    }

    const lastPosition =
      existing?.[0]?.position ?? -1

    const { error: insertError } = await db
      .from('roam_editorial_edition_context_slides')
      .insert({
        edition_id: editionId,
        after_item_id: parent.id,
        position: lastPosition + 1,
        heading,
        body: writtenBody,
        image_source: imageSource,
        creator_media_id: creatorMediaId,
      })

    if (insertError) {
      if (isUniqueConflict(insertError)) {
        return json(
          {
            error:
              'Context-slide position conflict. Refresh and try again.',
          },
          409,
        )
      }

      throw insertError
    }

    return json(
      {
        slides: await loadSlides(check.edition),
      },
      201,
    )
  } catch (error) {
    console.error(
      '[editorial/context-slides] POST failed:',
      error,
    )

    return json(
      { error: 'Could not add context slide.' },
      500,
    )
  }
}

// ============================================================
// PATCH — UPDATE A CONTEXT SLIDE
//
// Body:
// {
//   "slide_id": "uuid",
//   "heading"?: "..." | null,
//   "body"?: "...",
//   "image_source"?: "none" | "venue_cover" | "creator_media",
//   "creator_media_id"?: "uuid" | null
// }
//
// Positions and parent venue references cannot be changed.
// ============================================================

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await authorizeEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      !validId(body.slide_id) ||
      !hasOnlyKeys(body, [
        'slide_id',
        'heading',
        'body',
        'image_source',
        'creator_media_id',
      ])
    ) {
      return json(
        { error: 'A valid slide_id is required.' },
        400,
      )
    }

    const slide = await getSlide(
      editionId,
      body.slide_id,
    )

    if (!slide) {
      return json(
        { error: 'Context slide not found.' },
        404,
      )
    }

    const parent = await getParentItem(
      editionId,
      slide.after_item_id,
    )

    if (!parent) {
      return json(
        { error: 'Parent venue item not found.' },
        409,
      )
    }

    const changes: JsonRecord = {}

    if ('heading' in body) {
      const heading = readHeading(
        body.heading,
      )

      if (heading === undefined) {
        return json(
          { error: 'Invalid heading.' },
          400,
        )
      }

      changes.heading = heading
    }

    if ('body' in body) {
      const writtenBody = readBody(
        body.body,
      )

      if (writtenBody === null) {
        return json(
          {
            error:
              'Written perspective must contain 1–1500 characters.',
          },
          400,
        )
      }

      changes.body = writtenBody
    }

    let nextImageSource: ImageSource =
      slide.image_source

    if ('image_source' in body) {
      const source = readImageSource(
        body.image_source,
      )

      if (!source) {
        return json(
          { error: 'Invalid image source.' },
          400,
        )
      }

      nextImageSource = source
      changes.image_source = source
    }

    let nextMediaId: string | null =
      slide.creator_media_id

    if ('creator_media_id' in body) {
      const suppliedId = body.creator_media_id

      if (
        suppliedId !== null &&
        !validId(suppliedId)
      ) {
        return json(
          { error: 'Invalid creator media ID.' },
          400,
        )
      }

      nextMediaId = suppliedId
      changes.creator_media_id = suppliedId
    } else if (
      'image_source' in body &&
      nextImageSource !== 'creator_media'
    ) {
      // Switching away from a creator photo clears
      // its reference automatically.
      nextMediaId = null
      changes.creator_media_id = null
    }

    if (
      Object.keys(changes).length === 0
    ) {
      return json(
        { error: 'No editable fields supplied.' },
        400,
      )
    }

    if (
      !validImagePair(
        nextImageSource,
        nextMediaId,
      )
    ) {
      return json(
        {
          error:
            'The selected image source and media ID do not match.',
        },
        400,
      )
    }

    if (
      nextImageSource === 'creator_media' &&
      nextMediaId
    ) {
      const eligible = await findEligibleMedia(
        check.edition,
        parent,
        nextMediaId,
      )

      if (!eligible) {
        return json(
          {
            error:
              'This creator photo is not eligible for this venue and Edition.',
          },
          403,
        )
      }
    }

    const { data, error } = await db
      .from('roam_editorial_edition_context_slides')
      .update(changes)
      .eq('edition_id', editionId)
      .eq('id', slide.id)
      .select('id')
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return json(
        { error: 'Context slide not found.' },
        404,
      )
    }

    return json({
      slides: await loadSlides(check.edition),
    })
  } catch (error) {
    console.error(
      '[editorial/context-slides] PATCH failed:',
      error,
    )

    return json(
      { error: 'Could not update context slide.' },
      500,
    )
  }
}

// ============================================================
// DELETE — REMOVE A CONTEXT SLIDE
//
// Body:
// {
//   "slide_id": "uuid"
// }
//
// Deletion affects only the selected slide.
// Existing venue items remain unchanged.
// ============================================================

export async function DELETE(
  request: Request,
  context: Context,
) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { editionId } = await context.params

    const check = await authorizeEdition(
      editionId,
      true,
    )

    if (!check.ok) return check.response

    const body: unknown = await request
      .json()
      .catch(() => null)

    if (
      !isRecord(body) ||
      !hasOnlyKeys(body, ['slide_id']) ||
      !validId(body.slide_id)
    ) {
      return json(
        { error: 'A valid slide_id is required.' },
        400,
      )
    }

    const { data, error } = await db
      .from('roam_editorial_edition_context_slides')
      .delete()
      .eq('edition_id', editionId)
      .eq('id', body.slide_id)
      .select('id')
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return json(
        { error: 'Context slide not found.' },
        404,
      )
    }

    return json({
      slides: await loadSlides(check.edition),
    })
  } catch (error) {
    console.error(
      '[editorial/context-slides] DELETE failed:',
      error,
    )

    return json(
      { error: 'Could not delete context slide.' },
      500,
    )
  }
}
