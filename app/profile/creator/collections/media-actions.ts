'use server'

import {
  revalidatePath,
} from 'next/cache'
import {
  z,
} from 'zod'

import {
  buildCreatorCollectionMediaStoragePath,
  CREATOR_COLLECTION_MEDIA_BUCKET,
  CREATOR_COLLECTION_MEDIA_DEFINITION_BY_MIME_TYPE,
  CREATOR_COLLECTION_MEDIA_LIMITS,
  type CreatorCollectionMediaRecord,
} from '@/lib/creator/collectionMedia'
import {
  createServerClient,
} from '@/lib/supabase/server'

/* =========================================================
 * Public contracts
 * ======================================================= */

export type CreatorCollectionMediaActionFailure = {
  success: false
  error: string

  fieldErrors?: Partial<
    Record<
      | 'collectionId'
      | 'mediaId'
      | 'mediaType'
      | 'mimeType'
      | 'caption'
      | 'altText'
      | 'width'
      | 'height'
      | 'durationSeconds'
      | 'mediaIds',
      string[]
    >
  >
}

export type RegisterCreatorCollectionMediaResult =
  | {
      success: true
      media:
        CreatorCollectionMediaRecord
    }
  | CreatorCollectionMediaActionFailure

export type UpdateCreatorCollectionMediaResult =
  | {
      success: true
      media:
        CreatorCollectionMediaRecord
    }
  | CreatorCollectionMediaActionFailure

export type ReorderCreatorCollectionMediaResult =
  | {
      success: true
      collectionId: string
      mediaIds: string[]
    }
  | CreatorCollectionMediaActionFailure

export type DeleteCreatorCollectionMediaResult =
  | {
      success: true
      collectionId: string
      mediaId: string
    }
  | CreatorCollectionMediaActionFailure

export type SetCreatorCollectionCoverMediaResult =
  | {
      success: true
      collectionId: string
      mediaId: string
    }
  | CreatorCollectionMediaActionFailure

/* =========================================================
 * Validation
 * ======================================================= */

const uuidSchema =
  z
    .string()
    .trim()
    .uuid()

const mediaTypeSchema =
  z.enum([
    'image',
    'video',
  ])

const mimeTypeSchema =
  z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'video/mp4',
    'video/webm',
  ])

const nullableCaptionSchema =
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(
        CREATOR_COLLECTION_MEDIA_LIMITS
          .maximumCaptionLength,
        `Captions must be ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumCaptionLength.toLocaleString()} characters or fewer.`
      )
      .nullable()
  )

const nullableAltTextSchema =
  z.preprocess(
    normalizeNullableText,
    z
      .string()
      .max(
        CREATOR_COLLECTION_MEDIA_LIMITS
          .maximumAltTextLength,
        `Alt text must be ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumAltTextLength.toLocaleString()} characters or fewer.`
      )
      .nullable()
  )

const nullablePositiveIntegerSchema =
  z.preprocess(
    normalizeNullableNumber,
    z
      .number()
      .int()
      .positive()
      .nullable()
  )

const nullableNonNegativeNumberSchema =
  z.preprocess(
    normalizeNullableNumber,
    z
      .number()
      .finite()
      .nonnegative()
      .nullable()
  )

const registerMediaSchema =
  z
    .object({
      collectionId:
        uuidSchema,

      mediaId:
        uuidSchema,

      mediaType:
        mediaTypeSchema,

      mimeType:
        mimeTypeSchema,

      caption:
        nullableCaptionSchema,

      altText:
        nullableAltTextSchema,

      width:
        nullablePositiveIntegerSchema,

      height:
        nullablePositiveIntegerSchema,

      durationSeconds:
        nullableNonNegativeNumberSchema,
    })
    .superRefine(
      (
        value,
        context
      ) => {
        const definition =
          CREATOR_COLLECTION_MEDIA_DEFINITION_BY_MIME_TYPE[
            value.mimeType
          ]

        if (
          definition.mediaType !==
          value.mediaType
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'mediaType',
            ],

            message:
              'The media type does not match the uploaded file type.',
          })
        }

        if (
          value.mediaType ===
            'image' &&
          value.durationSeconds !==
            null
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'durationSeconds',
            ],

            message:
              'Images cannot have a video duration.',
          })
        }

        if (
          value.mediaType ===
            'video' &&
          value.durationSeconds !==
            null &&
          value.durationSeconds >
            CREATOR_COLLECTION_MEDIA_LIMITS
              .maximumVideoDurationSeconds
        ) {
          context.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'durationSeconds',
            ],

            message:
              `Videos must be ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumVideoDurationSeconds} seconds or shorter.`,
          })
        }
      }
    )

const updateMediaSchema =
  z.object({
    collectionId:
      uuidSchema,

    mediaId:
      uuidSchema,

    caption:
      nullableCaptionSchema,

    altText:
      nullableAltTextSchema,
  })

const reorderMediaSchema =
  z.object({
    collectionId:
      uuidSchema,

    mediaIds:
      z
        .array(
          uuidSchema
        )
        .max(
          CREATOR_COLLECTION_MEDIA_LIMITS
            .maximumItems
        ),
  })

const deleteMediaSchema =
  z.object({
    collectionId:
      uuidSchema,

    mediaId:
      uuidSchema,
  })

const setCoverMediaSchema =
  z.object({
    collectionId:
      uuidSchema,

    mediaId:
      uuidSchema,
  })

/* =========================================================
 * Register uploaded media
 * ======================================================= */

export async function registerCreatorCollectionMediaAction(
  input: unknown
): Promise<RegisterCreatorCollectionMediaResult> {
  const parsed =
    registerMediaSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return validationFailure(
      parsed.error
    )
  }

  const {
    collectionId,
    mediaId,
    mediaType,
    mimeType,
    caption,
    altText,
    width,
    height,
    durationSeconds,
  } = parsed.data

  const supabase =
    await createServerClient()

  const auth =
    await requireAuthenticatedUser(
      supabase
    )

  if (!auth.success) {
    return auth.result
  }

  const ownership =
    await loadOwnedCollection({
      supabase,
      userId:
        auth.userId,
      collectionId,
    })

  if (!ownership.success) {
    return ownership.result
  }

  const existingMediaResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .select(
        'id, sort_order'
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .order(
        'sort_order',
        {
          ascending: false,
        }
      )

  if (
    existingMediaResult.error
  ) {
    console.error(
      '[creator collection media] Failed to load existing media:',
      serializeDatabaseError(
        existingMediaResult.error
      )
    )

    return {
      success: false,
      error:
        'Collection media could not be loaded. Please try again.',
    }
  }

  const existingMedia =
    existingMediaResult.data ??
    []

  if (
    existingMedia.some(
      (media) =>
        media.id ===
        mediaId
    )
  ) {
    return {
      success: false,
      error:
        'That media item has already been registered.',
    }
  }

  if (
    existingMedia.length >=
    CREATOR_COLLECTION_MEDIA_LIMITS
      .maximumItems
  ) {
    return {
      success: false,
      error:
        `Collections can contain up to ${CREATOR_COLLECTION_MEDIA_LIMITS.maximumItems} photos or videos.`,
    }
  }

  const storagePath =
    buildCreatorCollectionMediaStoragePath({
      userId:
        auth.userId,

      collectionId,

      mediaId,

      mimeType,
    })

  const nextSortOrder =
    existingMedia.length > 0
      ? Math.max(
          ...existingMedia.map(
            (media) =>
              normalizeNonNegativeInteger(
                media.sort_order
              )
          )
        ) + 1
      : 0

  const insertResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .insert({
        id:
          mediaId,

        collection_id:
          collectionId,

        user_id:
          auth.userId,

        media_type:
          mediaType,

        storage_path:
          storagePath,

        poster_path:
          null,

        caption,

        alt_text:
          altText,

        width,

        height,

        duration_seconds:
          mediaType ===
          'video'
            ? durationSeconds
            : null,

        metadata: {},

        sort_order:
          nextSortOrder,
      })
      .select(
        MEDIA_SELECT
      )
      .single()

  if (
    insertResult.error
  ) {
    console.error(
      '[creator collection media] Failed to register media:',
      serializeDatabaseError(
        insertResult.error
      )
    )

    return {
      success: false,
      error:
        'The upload completed, but the media could not be added to the collection.',
    }
  }

  const media =
    normalizeMediaRecord(
      insertResult.data
    )

  if (!media) {
    return {
      success: false,
      error:
        'The media was added, but its saved record could not be verified.',
    }
  }

  const username =
    await loadCollectionOwnerUsername({
      supabase,
      userId:
        auth.userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      ownership.collection.slug,
    collectionId,
  })

  return {
    success: true,
    media,
  }
}

/* =========================================================
 * Update media metadata
 * ======================================================= */

export async function updateCreatorCollectionMediaAction(
  input: unknown
): Promise<UpdateCreatorCollectionMediaResult> {
  const parsed =
    updateMediaSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return validationFailure(
      parsed.error
    )
  }

  const {
    collectionId,
    mediaId,
    caption,
    altText,
  } = parsed.data

  const supabase =
    await createServerClient()

  const auth =
    await requireAuthenticatedUser(
      supabase
    )

  if (!auth.success) {
    return auth.result
  }

  const ownership =
    await loadOwnedCollection({
      supabase,
      userId:
        auth.userId,
      collectionId,
    })

  if (!ownership.success) {
    return ownership.result
  }

  const mediaResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .select('id')
      .eq(
        'id',
        mediaId
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .maybeSingle()

  if (
    mediaResult.error
  ) {
    console.error(
      '[creator collection media] Failed to load media for update:',
      serializeDatabaseError(
        mediaResult.error
      )
    )

    return {
      success: false,
      error:
        'The media item could not be loaded. Please try again.',
    }
  }

  if (!mediaResult.data) {
    return {
      success: false,
      error:
        'The media item was not found or you no longer have permission to edit it.',
    }
  }

  const updateResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .update({
        caption,
        alt_text:
          altText,
      })
      .eq(
        'id',
        mediaId
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .select(
        MEDIA_SELECT
      )
      .single()

  if (
    updateResult.error
  ) {
    console.error(
      '[creator collection media] Failed to update media:',
      serializeDatabaseError(
        updateResult.error
      )
    )

    return {
      success: false,
      error:
        'The media item could not be updated. Please try again.',
    }
  }

  const media =
    normalizeMediaRecord(
      updateResult.data
    )

  if (!media) {
    return {
      success: false,
      error:
        'The media item was updated, but its saved record could not be verified.',
    }
  }

  const username =
    await loadCollectionOwnerUsername({
      supabase,
      userId:
        auth.userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      ownership.collection.slug,
    collectionId,
  })

  return {
    success: true,
    media,
  }
}

/* =========================================================
 * Reorder media
 * ======================================================= */

export async function reorderCreatorCollectionMediaAction(
  input: unknown
): Promise<ReorderCreatorCollectionMediaResult> {
  const parsed =
    reorderMediaSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return validationFailure(
      parsed.error
    )
  }

  const {
    collectionId,
    mediaIds,
  } = parsed.data

  const uniqueMediaIds = [
    ...new Set(
      mediaIds
    ),
  ]

  if (
    uniqueMediaIds.length !==
    mediaIds.length
  ) {
    return {
      success: false,
      error:
        'The media order contains duplicate items.',

      fieldErrors: {
        mediaIds: [
          'Each media item may appear only once.',
        ],
      },
    }
  }

  const supabase =
    await createServerClient()

  const auth =
    await requireAuthenticatedUser(
      supabase
    )

  if (!auth.success) {
    return auth.result
  }

  const ownership =
    await loadOwnedCollection({
      supabase,
      userId:
        auth.userId,
      collectionId,
    })

  if (!ownership.success) {
    return ownership.result
  }

  const currentResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .select('id')
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )

  if (
    currentResult.error
  ) {
    console.error(
      '[creator collection media] Failed to load media for reorder:',
      serializeDatabaseError(
        currentResult.error
      )
    )

    return {
      success: false,
      error:
        'The collection media order could not be loaded. Please try again.',
    }
  }

  const currentIds = (
    currentResult.data ??
    []
  )
    .map(
      (media) =>
        normalizeUuid(
          media.id
        )
    )
    .filter(
      (
        mediaId
      ): mediaId is string =>
        mediaId !== null
    )

  if (
    !haveSameStringSet(
      currentIds,
      uniqueMediaIds
    )
  ) {
    return {
      success: false,
      error:
        'The media list changed before the new order could be saved. Refresh and try again.',

      fieldErrors: {
        mediaIds: [
          'The submitted media list does not match the current collection.',
        ],
      },
    }
  }

  const updateResults =
    await Promise.all(
      uniqueMediaIds.map(
        (
          mediaId,
          index
        ) =>
          supabase
            .from(
              'creator_collection_media'
            )
            .update({
              sort_order:
                index,
            })
            .eq(
              'id',
              mediaId
            )
            .eq(
              'collection_id',
              collectionId
            )
            .eq(
              'user_id',
              auth.userId
            )
      )
    )

  const failedUpdate =
    updateResults.find(
      (result) =>
        result.error
    )

  if (
    failedUpdate?.error
  ) {
    console.error(
      '[creator collection media] Failed to reorder media:',
      serializeDatabaseError(
        failedUpdate.error
      )
    )

    return {
      success: false,
      error:
        'The media order could not be saved completely. Refresh and try again.',
    }
  }

  const username =
    await loadCollectionOwnerUsername({
      supabase,
      userId:
        auth.userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      ownership.collection.slug,
    collectionId,
  })

  return {
    success: true,
    collectionId,
    mediaIds:
      uniqueMediaIds,
  }
}

/* =========================================================
 * Set collection cover media
 * ======================================================= */

export async function setCreatorCollectionCoverMediaAction(
  input: unknown
): Promise<SetCreatorCollectionCoverMediaResult> {
  const parsed =
    setCoverMediaSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return validationFailure(
      parsed.error
    )
  }

  const {
    collectionId,
    mediaId,
  } = parsed.data

  const supabase =
    await createServerClient()

  const auth =
    await requireAuthenticatedUser(
      supabase
    )

  if (!auth.success) {
    return auth.result
  }

  const ownership =
    await loadOwnedCollection({
      supabase,
      userId:
        auth.userId,
      collectionId,
    })

  if (!ownership.success) {
    return ownership.result
  }

  /*
   * Cover selection is intentionally restricted to images.
   *
   * The collection_id + user_id filters independently verify
   * that the requested media belongs to this collection and
   * authenticated creator before the collection is updated.
   *
   * The database composite foreign key remains the final
   * integrity guarantee against cross-collection assignment.
   */
  const mediaResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .select(
        'id, media_type'
      )
      .eq(
        'id',
        mediaId
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .maybeSingle()

  if (
    mediaResult.error
  ) {
    console.error(
      '[creator collection media] Failed to load media for cover selection:',
      serializeDatabaseError(
        mediaResult.error
      )
    )

    return {
      success: false,
      error:
        'The cover photo could not be loaded. Please try again.',
    }
  }

  if (!mediaResult.data) {
    return {
      success: false,
      error:
        'The cover photo was not found or you no longer have permission to use it.',
    }
  }

  if (
    mediaResult.data
      .media_type !==
    'image'
  ) {
    return {
      success: false,
      error:
        'Only photos can be used as the collection cover.',

      fieldErrors: {
        mediaId: [
          'Choose an uploaded photo as the collection cover.',
        ],
      },
    }
  }

  const updateResult =
    await supabase
      .from(
        'creator_collections'
      )
      .update({
        cover_media_id:
          mediaId,
      })
      .eq(
        'id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .select(
        'id, cover_media_id'
      )
      .maybeSingle()

  if (
    updateResult.error
  ) {
    console.error(
      '[creator collection media] Failed to set collection cover:',
      serializeDatabaseError(
        updateResult.error
      )
    )

    return {
      success: false,
      error:
        'The collection cover could not be updated. Please try again.',
    }
  }

  if (
    !updateResult.data ||
    normalizeUuid(
      updateResult.data.id
    ) !== collectionId ||
    normalizeUuid(
      updateResult.data
        .cover_media_id
    ) !== mediaId
  ) {
    return {
      success: false,
      error:
        'The collection cover could not be verified after saving. Please try again.',
    }
  }

  const username =
    await loadCollectionOwnerUsername({
      supabase,
      userId:
        auth.userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      ownership.collection.slug,
    collectionId,
  })

  return {
    success: true,
    collectionId,
    mediaId,
  }
}

/* =========================================================
 * Delete media
 * ======================================================= */

export async function deleteCreatorCollectionMediaAction(
  input: unknown
): Promise<DeleteCreatorCollectionMediaResult> {
  const parsed =
    deleteMediaSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return validationFailure(
      parsed.error
    )
  }

  const {
    collectionId,
    mediaId,
  } = parsed.data

  const supabase =
    await createServerClient()

  const auth =
    await requireAuthenticatedUser(
      supabase
    )

  if (!auth.success) {
    return auth.result
  }

  const ownership =
    await loadOwnedCollection({
      supabase,
      userId:
        auth.userId,
      collectionId,
    })

  if (!ownership.success) {
    return ownership.result
  }

  const mediaResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .select(
        'id, storage_path, poster_path'
      )
      .eq(
        'id',
        mediaId
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .maybeSingle()

  if (
    mediaResult.error
  ) {
    console.error(
      '[creator collection media] Failed to load media for deletion:',
      serializeDatabaseError(
        mediaResult.error
      )
    )

    return {
      success: false,
      error:
        'The media item could not be loaded. Please try again.',
    }
  }

  if (!mediaResult.data) {
    return {
      success: false,
      error:
        'The media item was not found or you no longer have permission to delete it.',
    }
  }

  const storagePaths = [
    normalizeStoragePath(
      mediaResult.data
        .storage_path
    ),

    normalizeStoragePath(
      mediaResult.data
        .poster_path
    ),
  ].filter(
    (
      path
    ): path is string =>
      path !== null
  )

  /*
   * Delete the database row first.
   *
   * This prevents a failed Storage cleanup from leaving a public
   * collection pointing at a missing object. If Storage cleanup
   * subsequently fails, the consequence is an orphaned object,
   * not a broken collection record.
   *
   * If this media item is the collection's selected cover, the
   * database foreign key clears cover_media_id automatically via
   * ON DELETE SET NULL.
   */
  const deleteResult =
    await supabase
      .from(
        'creator_collection_media'
      )
      .delete()
      .eq(
        'id',
        mediaId
      )
      .eq(
        'collection_id',
        collectionId
      )
      .eq(
        'user_id',
        auth.userId
      )
      .select('id')
      .maybeSingle()

  if (
    deleteResult.error
  ) {
    console.error(
      '[creator collection media] Failed to delete media record:',
      serializeDatabaseError(
        deleteResult.error
      )
    )

    return {
      success: false,
      error:
        'The media item could not be deleted. Please try again.',
    }
  }

  if (!deleteResult.data) {
    return {
      success: false,
      error:
        'The media item was not found or you no longer have permission to delete it.',
    }
  }

  if (
    storagePaths.length >
    0
  ) {
    const {
      error:
        storageError,
    } =
      await supabase.storage
        .from(
          CREATOR_COLLECTION_MEDIA_BUCKET
        )
        .remove(
          storagePaths
        )

    if (
      storageError
    ) {
      /*
       * The database record is already gone, so this is cleanup
       * debt rather than a failed user-visible deletion.
       */
      console.warn(
        '[creator collection media] Media record deleted, but Storage cleanup failed:',
        {
          collectionId,
          mediaId,
          paths:
            storagePaths,

          error:
            serializeDatabaseError(
              storageError
            ),
        }
      )
    }
  }

  const username =
    await loadCollectionOwnerUsername({
      supabase,
      userId:
        auth.userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      ownership.collection.slug,
    collectionId,
  })

  return {
    success: true,
    collectionId,
    mediaId,
  }
}

/* =========================================================
 * Authentication
 * ======================================================= */

type AuthenticatedUserResult =
  | {
      success: true
      userId: string
    }
  | {
      success: false
      result:
        CreatorCollectionMediaActionFailure
    }

async function requireAuthenticatedUser(
  supabase:
    SupabaseServerClient
): Promise<AuthenticatedUserResult> {
  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser()

  if (error) {
    console.error(
      '[creator collection media] Authentication lookup failed:',
      serializeDatabaseError(
        error
      )
    )

    return {
      success: false,
      result: {
        success: false,
        error:
          'Your session could not be verified. Refresh the page and try again.',
      },
    }
  }

  if (!user) {
    return {
      success: false,
      result: {
        success: false,
        error:
          'You must be signed in to manage creator collection media.',
      },
    }
  }

  return {
    success: true,
    userId:
      user.id,
  }
}

/* =========================================================
 * Ownership
 * ======================================================= */

type OwnedCollectionResult =
  | {
      success: true
      collection: {
        id: string
        slug: string
        visibility:
          | 'public'
          | 'private'
      }
    }
  | {
      success: false
      result:
        CreatorCollectionMediaActionFailure
    }

async function loadOwnedCollection({
  supabase,
  userId,
  collectionId,
}: {
  supabase:
    SupabaseServerClient
  userId: string
  collectionId: string
}): Promise<OwnedCollectionResult> {
  const result =
    await supabase
      .from(
        'creator_collections'
      )
      .select(
        'id, slug, visibility'
      )
      .eq(
        'id',
        collectionId
      )
      .eq(
        'user_id',
        userId
      )
      .maybeSingle()

  if (result.error) {
    console.error(
      '[creator collection media] Owned collection lookup failed:',
      {
        userId,
        collectionId,

        error:
          serializeDatabaseError(
            result.error
          ),
      }
    )

    return {
      success: false,
      result: {
        success: false,
        error:
          'The collection could not be loaded. Please try again.',
      },
    }
  }

  const id =
    normalizeUuid(
      result.data?.id
    )

  const slug =
    normalizeRequiredText(
      result.data?.slug
    )

  const visibility =
    result.data
      ?.visibility ===
      'public' ||
    result.data
      ?.visibility ===
      'private'
      ? result.data
          .visibility
      : null

  if (
    id !==
      collectionId ||
    !slug ||
    !visibility
  ) {
    return {
      success: false,
      result: {
        success: false,
        error:
          'The collection was not found or you no longer have permission to edit it.',
      },
    }
  }

  return {
    success: true,
    collection: {
      id,
      slug,
      visibility,
    },
  }
}

/* =========================================================
 * Username
 * ======================================================= */

async function loadCollectionOwnerUsername({
  supabase,
  userId,
}: {
  supabase:
    SupabaseServerClient
  userId: string
}): Promise<string | null> {
  const result =
    await supabase
      .from('profiles')
      .select('username')
      .eq(
        'id',
        userId
      )
      .maybeSingle()

  if (result.error) {
    console.error(
      '[creator collection media] Collection owner username lookup failed:',
      {
        userId,

        error:
          serializeDatabaseError(
            result.error
          ),
      }
    )

    return null
  }

  return normalizeNullableText(
    result.data?.username
  )
}

/* =========================================================
 * Cache revalidation
 * ======================================================= */

function revalidateCreatorCollectionPaths({
  username,
  slug,
  collectionId,
}: {
  username: string | null
  slug?: string
  collectionId?: string
}): void {
  revalidatePath('/profile')

  revalidatePath(
    '/profile/creator'
  )

  revalidatePath(
    '/profile/creator/collections'
  )

  if (collectionId) {
    revalidatePath(
      `/profile/creator/collections/${encodeURIComponent(
        collectionId
      )}`
    )
  }

  if (!username) {
    return
  }

  const encodedUsername =
    encodeURIComponent(
      username
    )

  revalidatePath(
    `/u/${encodedUsername}`
  )

  revalidatePath(
    `/u/${encodedUsername}/collections`
  )

  if (slug) {
    revalidatePath(
      `/u/${encodedUsername}/collections/${encodeURIComponent(
        slug
      )}`
    )
  }
}

/* =========================================================
 * Media normalization
 * ======================================================= */

const MEDIA_SELECT = `
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
`

function normalizeMediaRecord(
  value: unknown
): CreatorCollectionMediaRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeUuid(
      value.id
    )

  const collectionId =
    normalizeUuid(
      value.collection_id
    )

  const userId =
    normalizeUuid(
      value.user_id
    )

  const mediaType =
    value.media_type ===
      'image' ||
    value.media_type ===
      'video'
      ? value.media_type
      : null

  const storagePath =
    normalizeStoragePath(
      value.storage_path
    )

  const createdAt =
    normalizeIsoDate(
      value.created_at
    )

  const updatedAt =
    normalizeIsoDate(
      value.updated_at
    )

  if (
    !id ||
    !collectionId ||
    !userId ||
    !mediaType ||
    !storagePath ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  return {
    id,

    collection_id:
      collectionId,

    user_id:
      userId,

    media_type:
      mediaType,

    storage_path:
      storagePath,

    poster_path:
      normalizeStoragePath(
        value.poster_path
      ),

    caption:
      normalizeNullableText(
        value.caption
      ),

    alt_text:
      normalizeNullableText(
        value.alt_text
      ),

    width:
      normalizePositiveInteger(
        value.width
      ),

    height:
      normalizePositiveInteger(
        value.height
      ),

    duration_seconds:
      normalizeNonNegativeNumber(
        value.duration_seconds
      ),

    sort_order:
      normalizeNonNegativeInteger(
        value.sort_order
      ),

    created_at:
      createdAt,

    updated_at:
      updatedAt,
  }
}

/* =========================================================
 * Validation helpers
 * ======================================================= */

function validationFailure(
  error: z.ZodError
): CreatorCollectionMediaActionFailure {
  const flattened =
    error.flatten()

  const fieldErrors:
    CreatorCollectionMediaActionFailure['fieldErrors'] =
      {}

  for (
    const [
      field,
      messages,
    ] of Object.entries(
      flattened.fieldErrors
    )
  ) {
    if (
      !Array.isArray(
        messages
      ) ||
      messages.length ===
        0
    ) {
      continue
    }

    if (
      !isMediaFieldErrorKey(
        field
      )
    ) {
      continue
    }

    fieldErrors[field] =
      messages
  }

  return {
    success: false,

    error:
      flattened.formErrors[0] ??
      getFirstFieldError(
        fieldErrors
      ) ??
      'The media request was invalid.',

    fieldErrors:
      Object.keys(
        fieldErrors
      ).length > 0
        ? fieldErrors
        : undefined,
  }
}

function isMediaFieldErrorKey(
  value: string
): value is keyof NonNullable<
  CreatorCollectionMediaActionFailure[
    'fieldErrors'
  ]
> {
  return [
    'collectionId',
    'mediaId',
    'mediaType',
    'mimeType',
    'caption',
    'altText',
    'width',
    'height',
    'durationSeconds',
    'mediaIds',
  ].includes(
    value
  )
}

function getFirstFieldError(
  fieldErrors:
    CreatorCollectionMediaActionFailure[
      'fieldErrors'
    ]
): string | null {
  if (!fieldErrors) {
    return null
  }

  for (
    const messages of
      Object.values(
        fieldErrors
      )
  ) {
    const message =
      messages?.[0]

    if (message) {
      return message
    }
  }

  return null
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createServerClient
    >
  >

function normalizeRequiredText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length >
    0
    ? normalized
    : null
}

function normalizeNullableNumber(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  if (
    typeof value ===
      'number'
  ) {
    return value
  }

  if (
    typeof value ===
      'string'
  ) {
    const normalized =
      value.trim()

    if (!normalized) {
      return null
    }

    const numberValue =
      Number(
        normalized
      )

    return Number.isFinite(
      numberValue
    )
      ? numberValue
      : value
  }

  return value
}

function normalizeUuid(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return isUuid(
    normalized
  )
    ? normalized
    : null
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function normalizeStoragePath(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  if (
    !normalized ||
    normalized.startsWith(
      '/'
    ) ||
    normalized.includes(
      '..'
    )
  ) {
    return null
  }

  return normalized
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return null
  }

  const normalized =
    Math.trunc(
      value
    )

  return normalized > 0
    ? normalized
    : null
}

function normalizeNonNegativeInteger(
  value: unknown
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(
      value
    )
  )
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    ) ||
    value < 0
  ) {
    return null
  }

  return value
}

function normalizeIsoDate(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const timestamp =
    Date.parse(
      value
    )

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

function haveSameStringSet(
  first: string[],
  second: string[]
): boolean {
  if (
    first.length !==
    second.length
  ) {
    return false
  }

  const secondSet =
    new Set(
      second
    )

  return first.every(
    (value) =>
      secondSet.has(
        value
      )
  )
}

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function serializeDatabaseError(
  error: unknown
): unknown {
  if (!isRecord(error)) {
    return error
  }

  return {
    message:
      typeof error.message ===
        'string'
        ? error.message
        : undefined,

    code:
      typeof error.code ===
        'string'
        ? error.code
        : undefined,

    details:
      typeof error.details ===
        'string'
        ? error.details
        : undefined,

    hint:
      typeof error.hint ===
        'string'
        ? error.hint
        : undefined,
  }
}