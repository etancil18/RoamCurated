import {
  getCreatorCollectionMediaPublicUrl,
  type CreatorCollectionMediaRecord,
} from '@/lib/creator/collectionMedia'

export type ResolveCollectionCoverParams = {
  supabaseUrl: string
  coverMediaId: string | null
  coverImageUrl: string | null
  media: CreatorCollectionMediaRecord[]
}

export type ResolvedCollectionCover = {
  url: string | null
  source:
    | 'explicit_media'
    | 'first_media'
    | 'legacy'
    | null
  mediaId: string | null
}

export function resolveCollectionCover({
  supabaseUrl,
  coverMediaId,
  coverImageUrl,
  media,
}: ResolveCollectionCoverParams): string | null {
  return resolveCollectionCoverDetails({
    supabaseUrl,
    coverMediaId,
    coverImageUrl,
    media,
  }).url
}

export function resolveCollectionCoverDetails({
  supabaseUrl,
  coverMediaId,
  coverImageUrl,
  media,
}: ResolveCollectionCoverParams): ResolvedCollectionCover {
  const normalizedSupabaseUrl =
    normalizeOptionalString(supabaseUrl)
  const normalizedCoverMediaId =
    normalizeOptionalString(coverMediaId)
  const normalizedLegacyCoverUrl =
    normalizeOptionalString(coverImageUrl)

  const orderedImageMedia =
    getOrderedCollectionImageMedia(media)

  if (
    normalizedSupabaseUrl &&
    normalizedCoverMediaId
  ) {
    const explicitCover =
      orderedImageMedia.find(
        (item) =>
          item.id ===
          normalizedCoverMediaId
      ) ?? null

    if (explicitCover) {
      return {
        url: getMediaPublicUrl({
          supabaseUrl:
            normalizedSupabaseUrl,
          media: explicitCover,
        }),
        source: 'explicit_media',
        mediaId: explicitCover.id,
      }
    }
  }

  if (
    normalizedSupabaseUrl &&
    orderedImageMedia.length > 0
  ) {
    const firstImage =
      orderedImageMedia[0]

    return {
      url: getMediaPublicUrl({
        supabaseUrl:
          normalizedSupabaseUrl,
        media: firstImage,
      }),
      source: 'first_media',
      mediaId: firstImage.id,
    }
  }

  if (normalizedLegacyCoverUrl) {
    return {
      url: normalizedLegacyCoverUrl,
      source: 'legacy',
      mediaId: null,
    }
  }

  return {
    url: null,
    source: null,
    mediaId: null,
  }
}

function getOrderedCollectionImageMedia(
  media: CreatorCollectionMediaRecord[]
): CreatorCollectionMediaRecord[] {
  return media
    .filter(
      (item) =>
        item.media_type === 'image'
    )
    .sort(compareCollectionMedia)
}

function compareCollectionMedia(
  a: CreatorCollectionMediaRecord,
  b: CreatorCollectionMediaRecord
): number {
  if (
    a.sort_order !==
    b.sort_order
  ) {
    return (
      a.sort_order -
      b.sort_order
    )
  }

  const createdAtComparison =
    compareTimestamps(
      a.created_at,
      b.created_at
    )

  if (createdAtComparison !== 0) {
    return createdAtComparison
  }

  return a.id.localeCompare(b.id)
}

function compareTimestamps(
  a: string,
  b: string
): number {
  const aTimestamp =
    Date.parse(a)
  const bTimestamp =
    Date.parse(b)

  const normalizedATimestamp =
    Number.isFinite(aTimestamp)
      ? aTimestamp
      : Number.MAX_SAFE_INTEGER

  const normalizedBTimestamp =
    Number.isFinite(bTimestamp)
      ? bTimestamp
      : Number.MAX_SAFE_INTEGER

  return (
    normalizedATimestamp -
    normalizedBTimestamp
  )
}

function getMediaPublicUrl({
  supabaseUrl,
  media,
}: {
  supabaseUrl: string
  media: CreatorCollectionMediaRecord
}): string {
  return getCreatorCollectionMediaPublicUrl({
    supabaseUrl,
    storagePath:
      media.storage_path,
  })
}

function normalizeOptionalString(
  value: unknown
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const trimmed =
    value.trim()

  return trimmed || null
}