/* =========================================================
 * Public contracts
 * ======================================================= */

export type CreatorCollectionMediaType =
  | 'image'
  | 'video'

export type CreatorCollectionMediaMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'video/mp4'
  | 'video/webm'

export type CreatorCollectionMediaRecord = {
  id: string
  collection_id: string
  user_id: string
  media_type:
    CreatorCollectionMediaType
  storage_path: string
  poster_path:
    | string
    | null
  caption:
    | string
    | null
  alt_text:
    | string
    | null
  width:
    | number
    | null
  height:
    | number
    | null
  duration_seconds:
    | number
    | null
  sort_order: number
  created_at: string
  updated_at: string
}

/* =========================================================
 * Limits
 * ======================================================= */

export const CREATOR_COLLECTION_MEDIA_LIMITS = {
  maximumItems: 10,

  maximumImageBytes:
    15 * 1024 * 1024,

  maximumVideoBytes:
    50 * 1024 * 1024,

  maximumVideoDurationSeconds:
    60,

  maximumCaptionLength:
    1_000,

  maximumAltTextLength:
    500,
} as const

/* =========================================================
 * Storage
 * ======================================================= */

export const CREATOR_COLLECTION_MEDIA_BUCKET =
  'creator-collection-media'

export const CREATOR_COLLECTION_MEDIA_ACCEPT =
  [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
  ].join(',')

/* =========================================================
 * MIME definitions
 * ======================================================= */

export const CREATOR_COLLECTION_MEDIA_DEFINITION_BY_MIME_TYPE: Record<
  CreatorCollectionMediaMimeType,
  {
    mediaType:
      CreatorCollectionMediaType
    extension: string
  }
> = {
  'image/jpeg': {
    mediaType: 'image',
    extension: 'jpg',
  },

  'image/png': {
    mediaType: 'image',
    extension: 'png',
  },

  'image/webp': {
    mediaType: 'image',
    extension: 'webp',
  },

  'image/avif': {
    mediaType: 'image',
    extension: 'avif',
  },

  'video/mp4': {
    mediaType: 'video',
    extension: 'mp4',
  },

  'video/webm': {
    mediaType: 'video',
    extension: 'webm',
  },
}

const SUPPORTED_MIME_TYPES =
  new Set<string>(
    Object.keys(
      CREATOR_COLLECTION_MEDIA_DEFINITION_BY_MIME_TYPE
    )
  )

/* =========================================================
 * MIME helpers
 * ======================================================= */

export function isCreatorCollectionMediaMimeType(
  value: string
): value is CreatorCollectionMediaMimeType {
  return SUPPORTED_MIME_TYPES.has(
    value
  )
}

export function getCreatorCollectionMediaDefinition(
  mimeType:
    CreatorCollectionMediaMimeType
) {
  return CREATOR_COLLECTION_MEDIA_DEFINITION_BY_MIME_TYPE[
    mimeType
  ]
}

/* =========================================================
 * Canonical Storage path
 * ======================================================= */

export function buildCreatorCollectionMediaStoragePath({
  userId,
  collectionId,
  mediaId,
  mimeType,
}: {
  userId: string
  collectionId: string
  mediaId: string
  mimeType:
    CreatorCollectionMediaMimeType
}): string {
  const definition =
    getCreatorCollectionMediaDefinition(
      mimeType
    )

  return `${userId}/${collectionId}/${mediaId}/original.${definition.extension}`
}

/* =========================================================
 * Public URL
 * ======================================================= */

export function getCreatorCollectionMediaPublicUrl({
  supabaseUrl,
  storagePath,
}: {
  supabaseUrl: string
  storagePath: string
}): string {
  const normalizedBaseUrl =
    supabaseUrl.replace(
      /\/+$/,
      ''
    )

  const encodedPath =
    storagePath
      .split('/')
      .map(
        (segment) =>
          encodeURIComponent(
            segment
          )
      )
      .join('/')

  return `${normalizedBaseUrl}/storage/v1/object/public/${CREATOR_COLLECTION_MEDIA_BUCKET}/${encodedPath}`
}