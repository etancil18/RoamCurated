import { ImageResponse } from 'next/og'

import {
  CollectionShareArtwork,
} from '@/components/public-profile/creator/CollectionShareArtwork'
import {
  type CreatorCollectionMediaRecord,
} from '@/lib/creator/collectionMedia'
import {
  type PublicCollectionShareData,
} from '@/lib/creator/collectionShare'
import {
  resolveCollectionCover,
} from '@/lib/creator/resolveCollectionCover'
import {
  createServerClient,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920

type StoryRouteContext = {
  params: Promise<{
    username: string
    slug: string
  }>
}

type PublicCreatorProfileRow = {
  id: string
  username: string
  full_name: string | null
}

type PublicCollectionRow = {
  id: string
  user_id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  cover_media_id: string | null
  city: string | null
}

type CollectionVenueMembershipRow = {
  venue_id: string
}

type PublicVenueRow = {
  id: string
}

export async function GET(
  _request: Request,
  context: StoryRouteContext
): Promise<Response> {
  const params = await context.params

  const username = normalizeRouteSegment(
    params.username
  )

  const slug = normalizeRouteSegment(
    params.slug
  )

  if (!username || !slug) {
    return notFoundResponse()
  }

  try {
    const supabase = await createServerClient()

    const shareData =
      await loadPublicCollectionShareData({
        supabase,
        username,
        slug,
      })

    if (!shareData) {
      return notFoundResponse()
    }

    return new ImageResponse(
      (
        <CollectionShareArtwork
          data={shareData}
          variant="story"
        />
      ),
      {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        headers: {
          'Cache-Control':
            'public, max-age=0, must-revalidate',
          'Content-Disposition':
            `inline; filename="${buildStoryFilename(
              shareData
            )}"`,
        },
      }
    )
  } catch (error) {
    console.error(
      '[collection story] Failed to generate collection story:',
      {
        username,
        slug,
        error,
      }
    )

    return new Response(
      'Unable to generate collection story.',
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type':
            'text/plain; charset=utf-8',
        },
      }
    )
  }
}

async function loadPublicCollectionShareData({
  supabase,
  username,
  slug,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  username: string
  slug: string
}): Promise<PublicCollectionShareData | null> {
  const profileResult = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      full_name
    `)
    .ilike('username', username)
    .maybeSingle()

  if (profileResult.error) {
    throw profileResult.error
  }

  const profile =
    parsePublicCreatorProfile(
      profileResult.data
    )

  if (!profile) {
    return null
  }

  const collectionResult = await supabase
    .from('creator_collections')
    .select(`
      id,
      user_id,
      title,
      slug,
      description,
      cover_image_url,
      cover_media_id,
      city
    `)
    .eq('user_id', profile.id)
    .eq('slug', slug)
    .eq('visibility', 'public')
    .maybeSingle()

  if (collectionResult.error) {
    throw collectionResult.error
  }

  const collection =
    parsePublicCollection(
      collectionResult.data
    )

  if (
    !collection ||
    collection.user_id !== profile.id
  ) {
    return null
  }

  const [
    media,
    venueCount,
  ] = await Promise.all([
    loadPublicCollectionMedia({
      supabase,
      collectionId: collection.id,
      expectedUserId: profile.id,
    }),

    loadPublicCollectionVenueCount({
      supabase,
      collectionId: collection.id,
    }),
  ])

  const supabaseUrl =
    getSupabaseProjectUrl({
      supabase,
      media,
    })

  const coverImageUrl =
    resolveCollectionCover({
      supabaseUrl,
      coverMediaId:
        collection.cover_media_id,
      coverImageUrl:
        collection.cover_image_url,
      media,
    })

  return {
    collectionId: collection.id,
    title: collection.title,
    slug: collection.slug,
    description:
      collection.description,
    city: collection.city,
    venueCount,
    coverImageUrl,
    creator: {
      username: profile.username,
      displayName:
        profile.full_name,
    },
  }
}

async function loadPublicCollectionMedia({
  supabase,
  collectionId,
  expectedUserId,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  collectionId: string
  expectedUserId: string
}): Promise<CreatorCollectionMediaRecord[]> {
  const result = await supabase
    .from('creator_collection_media')
    .select(`
      id,
      collection_id,
      user_id,
      media_type,
      storage_path,
      poster_path,
      caption,
      alt_text,
      width,
      height,
      duration_seconds,
      sort_order,
      created_at,
      updated_at
    `)
    .eq('collection_id', collectionId)
    .eq('user_id', expectedUserId)
    .order('sort_order', {
      ascending: true,
    })
    .order('created_at', {
      ascending: true,
    })

  if (result.error) {
    throw result.error
  }

  if (!Array.isArray(result.data)) {
    return []
  }

  return result.data.flatMap(
    (
      value
    ): CreatorCollectionMediaRecord[] => {
      const media =
        parseCollectionMediaRecord(
          value
        )

      if (
        !media ||
        media.collection_id !==
          collectionId ||
        media.user_id !==
          expectedUserId
      ) {
        return []
      }

      return [media]
    }
  )
}

async function loadPublicCollectionVenueCount({
  supabase,
  collectionId,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  collectionId: string
}): Promise<number> {
  const membershipResult =
    await supabase
      .from('creator_collection_venues')
      .select('venue_id')
      .eq(
        'collection_id',
        collectionId
      )

  if (membershipResult.error) {
    throw membershipResult.error
  }

  if (
    !Array.isArray(
      membershipResult.data
    ) ||
    membershipResult.data.length === 0
  ) {
    return 0
  }

  const venueIds = Array.from(
    new Set(
      membershipResult.data.flatMap(
        (
          value
        ): string[] => {
          const membership =
            parseCollectionVenueMembership(
              value
            )

          return membership
            ? [membership.venue_id]
            : []
        }
      )
    )
  )

  if (venueIds.length === 0) {
    return 0
  }

  const venuesResult = await supabase
    .from('venues')
    .select('id')
    .in('id', venueIds)

  if (venuesResult.error) {
    throw venuesResult.error
  }

  if (!Array.isArray(venuesResult.data)) {
    return 0
  }

  const visibleVenueIds =
    new Set<string>()

  for (const value of venuesResult.data) {
    const venue =
      parsePublicVenue(value)

    if (venue) {
      visibleVenueIds.add(
        venue.id
      )
    }
  }

  return visibleVenueIds.size
}

function parsePublicCreatorProfile(
  value: unknown
): PublicCreatorProfileRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(value.id)

  const username =
    normalizeRequiredString(
      value.username
    )

  if (!id || !username) {
    return null
  }

  return {
    id,
    username,
    full_name:
      normalizeOptionalString(
        value.full_name
      ),
  }
}

function parsePublicCollection(
  value: unknown
): PublicCollectionRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(value.id)

  const userId =
    normalizeIdentifier(
      value.user_id
    )

  const title =
    normalizeRequiredString(
      value.title
    )

  const slug =
    normalizeRequiredString(
      value.slug
    )

  if (
    !id ||
    !userId ||
    !title ||
    !slug
  ) {
    return null
  }

  return {
    id,
    user_id: userId,
    title,
    slug,
    description:
      normalizeOptionalString(
        value.description
      ),
    cover_image_url:
      normalizeOptionalString(
        value.cover_image_url
      ),
    cover_media_id:
      normalizeIdentifier(
        value.cover_media_id
      ),
    city:
      normalizeOptionalString(
        value.city
      ),
  }
}

function parseCollectionMediaRecord(
  value: unknown
): CreatorCollectionMediaRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(value.id)

  const collectionId =
    normalizeIdentifier(
      value.collection_id
    )

  const userId =
    normalizeIdentifier(
      value.user_id
    )

  const storagePath =
    normalizeRequiredString(
      value.storage_path
    )

  const createdAt =
    normalizeRequiredString(
      value.created_at
    )

  const updatedAt =
    normalizeRequiredString(
      value.updated_at
    )

  if (
    !id ||
    !collectionId ||
    !userId ||
    !storagePath ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  if (
    value.media_type !== 'image' &&
    value.media_type !== 'video'
  ) {
    return null
  }

  const sortOrder =
    normalizeInteger(
      value.sort_order
    )

  if (sortOrder === null) {
    return null
  }

  return {
    id,
    collection_id:
      collectionId,
    user_id: userId,
    media_type:
      value.media_type,
    storage_path:
      storagePath,
    poster_path:
      normalizeOptionalString(
        value.poster_path
      ),
    caption:
      normalizeOptionalString(
        value.caption
      ),
    alt_text:
      normalizeOptionalString(
        value.alt_text
      ),
    width:
      normalizeNullableInteger(
        value.width
      ),
    height:
      normalizeNullableInteger(
        value.height
      ),
    duration_seconds:
      normalizeNullableNumber(
        value.duration_seconds
      ),
    sort_order:
      sortOrder,
    created_at:
      createdAt,
    updated_at:
      updatedAt,
  }
}

function parseCollectionVenueMembership(
  value: unknown
): CollectionVenueMembershipRow | null {
  if (!isRecord(value)) {
    return null
  }

  const venueId =
    normalizeIdentifier(
      value.venue_id
    )

  if (!venueId) {
    return null
  }

  return {
    venue_id: venueId,
  }
}

function parsePublicVenue(
  value: unknown
): PublicVenueRow | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeIdentifier(value.id)

  if (!id) {
    return null
  }

  return {
    id,
  }
}

function getSupabaseProjectUrl({
  supabase,
  media,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  media: CreatorCollectionMediaRecord[]
}): string {
  const firstStoragePath =
    media.find(
      (item) =>
        item.storage_path.trim()
          .length > 0
    )?.storage_path ?? null

  const sentinelStoragePath =
    firstStoragePath ??
    '__roam_collection_story__'

  const {
    data,
  } = supabase.storage
    .from(
      'creator-collection-media'
    )
    .getPublicUrl(
      sentinelStoragePath
    )

  const publicUrl =
    normalizeOptionalString(
      data.publicUrl
    )

  if (!publicUrl) {
    return ''
  }

  const encodedStoragePath =
    sentinelStoragePath
      .split('/')
      .map((segment) =>
        encodeURIComponent(segment)
      )
      .join('/')

  const suffix =
    `/storage/v1/object/public/creator-collection-media/${encodedStoragePath}`

  if (!publicUrl.endsWith(suffix)) {
    return ''
  }

  return publicUrl.slice(
    0,
    -suffix.length
  )
}

function buildStoryFilename(
  data: PublicCollectionShareData
): string {
  const normalizedSlug =
    data.slug
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9-]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )

  return `${
    normalizedSlug ||
    'collection'
  }-roam-story.png`
}

function normalizeRouteSegment(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let decoded: string

  try {
    decoded =
      decodeURIComponent(value)
  } catch {
    return null
  }

  const normalized =
    decoded.trim()

  if (
    !normalized ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    /[\r\n]/.test(normalized)
  ) {
    return null
  }

  return normalized
}

function normalizeIdentifier(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized || null
}

function normalizeRequiredString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(/\s+/g, ' ')

  return normalized || null
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized || null
}

function normalizeInteger(
  value: unknown
): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return null
  }

  return value
}

function normalizeNullableInteger(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return normalizeInteger(value)
}

function normalizeNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return value
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function notFoundResponse(): Response {
  return new Response(
    'Collection not found.',
    {
      status: 404,
      headers: {
        'Cache-Control':
          'no-store',
        'Content-Type':
          'text/plain; charset=utf-8',
      },
    }
  )
}