'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createServerClient } from '@/lib/supabase/server'

/* =========================================================
 * Limits
 * ======================================================= */

const COLLECTION_LIMITS = {
  title: 160,
  slug: 160,
  description: 1_000,
  city: 160,
  category: 120,
  coverImageUrl: 2_048,
  maximumCollectionsPerCreator: 100,
  maximumReorderBatch: 100,
} as const

const MAXIMUM_SLUG_ATTEMPTS = 25

/* =========================================================
 * Public result contracts
 * ======================================================= */

export type CollectionActionFieldErrors = Partial<
  Record<
    | 'collectionId'
    | 'title'
    | 'description'
    | 'cover_image_url'
    | 'city'
    | 'category'
    | 'visibility'
    | 'featured'
    | 'sort_order'
    | 'collectionIds',
    string[]
  >
>

export type CollectionActionFailure = {
  success: false
  error: string
  fieldErrors?: CollectionActionFieldErrors
}

export type CollectionActionSuccess<T> = {
  success: true
  data: T
}

export type CollectionActionResult<T> =
  | CollectionActionSuccess<T>
  | CollectionActionFailure

export type CreatorCollectionActionRecord = {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image_url: string | null
  city: string | null
  category: string | null
  visibility: 'public' | 'private'
  featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CreateCreatorCollectionResult =
  CollectionActionResult<{
    collection: CreatorCollectionActionRecord
  }>

export type UpdateCreatorCollectionResult =
  CollectionActionResult<{
    collection: CreatorCollectionActionRecord
  }>

export type DeleteCreatorCollectionResult =
  CollectionActionResult<{
    collectionId: string
  }>

export type ReorderCreatorCollectionsResult =
  CollectionActionResult<{
    collectionIds: string[]
    updatedAt: string
  }>

export type SetCreatorCollectionVisibilityResult =
  CollectionActionResult<{
    collectionId: string
    visibility: 'public' | 'private'
    updatedAt: string
  }>

export type SetCreatorCollectionFeaturedResult =
  CollectionActionResult<{
    collectionId: string
    featured: boolean
    updatedAt: string
  }>

/* =========================================================
 * Public input contracts
 * ======================================================= */

export type CreateCreatorCollectionInput = {
  title: string
  description?: string | null
  cover_image_url?: string | null
  city?: string | null
  category?: string | null
  visibility?: 'public' | 'private'
  featured?: boolean
  sort_order?: number
}

export type UpdateCreatorCollectionInput = {
  collectionId: string
  title: string
  description?: string | null
  cover_image_url?: string | null
  city?: string | null
  category?: string | null
  visibility: 'public' | 'private'
  featured: boolean
  sort_order: number
}

export type DeleteCreatorCollectionInput = {
  collectionId: string
}

export type ReorderCreatorCollectionsInput = {
  collectionIds: string[]
}

export type SetCreatorCollectionVisibilityInput = {
  collectionId: string
  visibility: 'public' | 'private'
}

export type SetCreatorCollectionFeaturedInput = {
  collectionId: string
  featured: boolean
}

/* =========================================================
 * Validation schemas
 * ======================================================= */

const collectionIdSchema = z
  .string()
  .trim()
  .uuid('Collection ID is invalid.')

const nullableTextSchema = (
  maximumLength: number,
  fieldLabel: string
) =>
  z.preprocess(
    normalizeNullableInput,
    z
      .string()
      .max(
        maximumLength,
        `${fieldLabel} must be ${maximumLength} characters or fewer.`
      )
      .nullable()
  )

const titleSchema = z.preprocess(
  normalizeRequiredInput,
  z
    .string()
    .min(1, 'Collection title is required.')
    .max(
      COLLECTION_LIMITS.title,
      `Collection title must be ${COLLECTION_LIMITS.title} characters or fewer.`
    )
)

const coverImageUrlSchema = z
  .preprocess(
    normalizeNullableInput,
    z
      .string()
      .max(
        COLLECTION_LIMITS.coverImageUrl,
        `Cover image URL must be ${COLLECTION_LIMITS.coverImageUrl} characters or fewer.`
      )
      .nullable()
  )
  .superRefine((value, context) => {
    if (value === null) {
      return
    }

    const validation = validatePublicImageUrl(value)

    if (!validation.valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: validation.error,
      })
    }
  })
  .transform((value) => {
    if (value === null) {
      return null
    }

    const validation = validatePublicImageUrl(value)

    return validation.valid
      ? validation.normalizedUrl
      : value
  })

const visibilitySchema = z.enum([
  'public',
  'private',
])

const sortOrderSchema = z.preprocess(
  normalizeIntegerInput,
  z
    .number()
    .int('Sort order must be a whole number.')
    .min(0, 'Sort order cannot be negative.')
    .max(
      Number.MAX_SAFE_INTEGER,
      'Sort order is too large.'
    )
)

const createCreatorCollectionSchema = z
  .object({
    title: titleSchema,

    description: nullableTextSchema(
      COLLECTION_LIMITS.description,
      'Description'
    ).default(null),

    cover_image_url:
      coverImageUrlSchema.default(null),

    city: nullableTextSchema(
      COLLECTION_LIMITS.city,
      'City'
    ).default(null),

    category: nullableTextSchema(
      COLLECTION_LIMITS.category,
      'Category'
    ).default(null),

    visibility:
      visibilitySchema.default('private'),

    featured:
      z.boolean().default(false),

    sort_order:
      sortOrderSchema.optional(),
  })
  .strict()

const updateCreatorCollectionSchema = z
  .object({
    collectionId:
      collectionIdSchema,

    title: titleSchema,

    description: nullableTextSchema(
      COLLECTION_LIMITS.description,
      'Description'
    ).default(null),

    cover_image_url:
      coverImageUrlSchema.default(null),

    city: nullableTextSchema(
      COLLECTION_LIMITS.city,
      'City'
    ).default(null),

    category: nullableTextSchema(
      COLLECTION_LIMITS.category,
      'Category'
    ).default(null),

    visibility:
      visibilitySchema,

    featured:
      z.boolean(),

    sort_order:
      sortOrderSchema,
  })
  .strict()

const deleteCreatorCollectionSchema = z
  .object({
    collectionId:
      collectionIdSchema,
  })
  .strict()

const reorderCreatorCollectionsSchema = z
  .object({
    collectionIds: z
      .array(collectionIdSchema)
      .max(
        COLLECTION_LIMITS.maximumReorderBatch,
        `You can reorder at most ${COLLECTION_LIMITS.maximumReorderBatch} collections at once.`
      ),
  })
  .strict()
  .superRefine((value, context) => {
    const uniqueIds = new Set(
      value.collectionIds
    )

    if (
      uniqueIds.size !==
      value.collectionIds.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['collectionIds'],
        message:
          'Collection order contains duplicate IDs.',
      })
    }
  })

const setCreatorCollectionVisibilitySchema = z
  .object({
    collectionId:
      collectionIdSchema,

    visibility:
      visibilitySchema,
  })
  .strict()

const setCreatorCollectionFeaturedSchema = z
  .object({
    collectionId:
      collectionIdSchema,

    featured:
      z.boolean(),
  })
  .strict()

/* =========================================================
 * Create collection
 * ======================================================= */

export async function createCreatorCollectionAction(
  input: unknown
): Promise<CreateCreatorCollectionResult> {
  const parsed =
    createCreatorCollectionSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  const collectionCountResult =
    await supabase
      .from('creator_collections')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('user_id', userId)

  if (collectionCountResult.error) {
    logDatabaseError({
      operation:
        'count_creator_collections',
      userId,
      error:
        collectionCountResult.error,
    })

    return {
      success: false,
      error:
        'Your collections could not be checked. Please try again.',
    }
  }

  if (
    (collectionCountResult.count ?? 0) >=
    COLLECTION_LIMITS.maximumCollectionsPerCreator
  ) {
    return {
      success: false,
      error: `You can create at most ${COLLECTION_LIMITS.maximumCollectionsPerCreator} collections.`,
    }
  }

  const nextSortOrder =
    parsed.data.sort_order ??
    (await getNextCollectionSortOrder({
      supabase,
      userId,
    }))

  if (nextSortOrder === null) {
    return {
      success: false,
      error:
        'The collection order could not be determined. Please try again.',
    }
  }

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  const now =
    new Date().toISOString()

  const baseSlug =
    createSlug(parsed.data.title) ||
    'collection'

  for (
    let attempt = 1;
    attempt <= MAXIMUM_SLUG_ATTEMPTS;
    attempt += 1
  ) {
    const slug =
      buildSlugCandidate({
        baseSlug,
        attempt,
      })

    const insertResult =
      await supabase
        .from('creator_collections')
        .insert({
          user_id: userId,
          title: parsed.data.title,
          slug,
          description:
            parsed.data.description,
          cover_image_url:
            parsed.data.cover_image_url,
          city: parsed.data.city,
          category:
            parsed.data.category,
          visibility:
            parsed.data.visibility,
          featured:
            parsed.data.featured,
          sort_order:
            nextSortOrder,
          updated_at: now,
        })
        .select(COLLECTION_SELECT)
        .single()

    if (
      !insertResult.error &&
      insertResult.data
    ) {
      const collection =
        normalizeCollectionRecord(
          insertResult.data
        )

      if (!collection) {
        logInvalidDatabaseData({
          operation:
            'create_creator_collection',
          userId,
          value: insertResult.data,
        })

        return {
          success: false,
          error:
            'The collection was created but its response was invalid. Refresh the page before trying again.',
        }
      }

      revalidateCreatorCollectionPaths({
        username,
        slug:
          collection.slug,
      })

      return {
        success: true,
        data: {
          collection,
        },
      }
    }

    if (
      isUniqueConstraintViolation(
        insertResult.error
      )
    ) {
      continue
    }

    logDatabaseError({
      operation:
        'create_creator_collection',
      userId,
      error:
        insertResult.error,
    })

    return {
      success: false,
      error:
        'The collection could not be created. Please try again.',
    }
  }

  return {
    success: false,
    error:
      'A unique collection URL could not be generated. Change the title and try again.',
    fieldErrors: {
      title: [
        'Use a more distinctive collection title.',
      ],
    },
  }
}

/* =========================================================
 * Update collection
 * ======================================================= */

export async function updateCreatorCollectionAction(
  input: unknown
): Promise<UpdateCreatorCollectionResult> {
  const parsed =
    updateCreatorCollectionSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  const existingResult =
    await loadOwnedCollection({
      supabase,
      userId,
      collectionId:
        parsed.data.collectionId,
    })

  if (!existingResult.success) {
    return existingResult.result
  }

  const existing =
    existingResult.collection

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  const now =
    new Date().toISOString()

  const updateResult =
    await supabase
      .from('creator_collections')
      .update({
        title: parsed.data.title,
        description:
          parsed.data.description,
        cover_image_url:
          parsed.data.cover_image_url,
        city: parsed.data.city,
        category:
          parsed.data.category,
        visibility:
          parsed.data.visibility,
        featured:
          parsed.data.featured,
        sort_order:
          parsed.data.sort_order,
        updated_at: now,
      })
      .eq(
        'id',
        parsed.data.collectionId
      )
      .eq('user_id', userId)
      .select(COLLECTION_SELECT)
      .maybeSingle()

  if (updateResult.error) {
    logDatabaseError({
      operation:
        'update_creator_collection',
      userId,
      collectionId:
        parsed.data.collectionId,
      error:
        updateResult.error,
    })

    return {
      success: false,
      error:
        'The collection could not be updated. Please try again.',
    }
  }

  if (!updateResult.data) {
    return {
      success: false,
      error:
        'The collection was not found or you no longer have permission to edit it.',
    }
  }

  const collection =
    normalizeCollectionRecord(
      updateResult.data
    )

  if (!collection) {
    logInvalidDatabaseData({
      operation:
        'update_creator_collection',
      userId,
      value: updateResult.data,
    })

    return {
      success: false,
      error:
        'The collection was updated but its response was invalid. Refresh the page.',
    }
  }

  revalidateCreatorCollectionPaths({
    username,
    slug: existing.slug,
  })

  if (
    collection.slug !==
    existing.slug
  ) {
    revalidateCreatorCollectionPaths({
      username,
      slug:
        collection.slug,
    })
  }

  return {
    success: true,
    data: {
      collection,
    },
  }
}

/* =========================================================
 * Delete collection
 * ======================================================= */

export async function deleteCreatorCollectionAction(
  input: unknown
): Promise<DeleteCreatorCollectionResult> {
  const parsed =
    deleteCreatorCollectionSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  const existingResult =
    await loadOwnedCollection({
      supabase,
      userId,
      collectionId:
        parsed.data.collectionId,
    })

  if (!existingResult.success) {
    return existingResult.result
  }

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  const deleteResult =
    await supabase
      .from('creator_collections')
      .delete()
      .eq(
        'id',
        parsed.data.collectionId
      )
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

  if (deleteResult.error) {
    logDatabaseError({
      operation:
        'delete_creator_collection',
      userId,
      collectionId:
        parsed.data.collectionId,
      error:
        deleteResult.error,
    })

    return {
      success: false,
      error:
        'The collection could not be deleted. Please try again.',
    }
  }

  if (!deleteResult.data) {
    return {
      success: false,
      error:
        'The collection was not found or you no longer have permission to delete it.',
    }
  }

  revalidateCreatorCollectionPaths({
    username,
    slug:
      existingResult.collection.slug,
  })

  return {
    success: true,
    data: {
      collectionId:
        parsed.data.collectionId,
    },
  }
}

/* =========================================================
 * Reorder collections
 * ======================================================= */

export async function reorderCreatorCollectionsAction(
  input: unknown
): Promise<ReorderCreatorCollectionsResult> {
  const parsed =
    reorderCreatorCollectionsSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  if (
    parsed.data.collectionIds.length === 0
  ) {
    return {
      success: true,
      data: {
        collectionIds: [],
        updatedAt:
          new Date().toISOString(),
      },
    }
  }

  const ownershipResult =
    await supabase
      .from('creator_collections')
      .select('id')
      .eq('user_id', userId)
      .in(
        'id',
        parsed.data.collectionIds
      )

  if (ownershipResult.error) {
    logDatabaseError({
      operation:
        'verify_collection_reorder_ownership',
      userId,
      error:
        ownershipResult.error,
    })

    return {
      success: false,
      error:
        'Collection ownership could not be verified. Please try again.',
    }
  }

  const ownedIds = new Set(
    (ownershipResult.data ?? [])
      .map((row) => row.id)
      .filter(
        (value): value is string =>
          typeof value === 'string'
      )
  )

  const containsForeignOrMissingId =
    parsed.data.collectionIds.some(
      (collectionId) =>
        !ownedIds.has(collectionId)
    )

  if (containsForeignOrMissingId) {
    return {
      success: false,
      error:
        'One or more collections could not be reordered because they were not found.',
      fieldErrors: {
        collectionIds: [
          'Refresh the page before reordering collections again.',
        ],
      },
    }
  }

  const now =
    new Date().toISOString()

  const reorderResults =
    await Promise.all(
        parsed.data.collectionIds.map(
        async (
            collectionId,
            index
        ) => {
            return supabase
            .from(
                'creator_collections'
            )
            .update({
                sort_order: index,
                updated_at: now,
            })
            .eq('id', collectionId)
            .eq('user_id', userId)
            .select('id')
            .maybeSingle()
        }
        )
    )

    const failedReorderResult =
    reorderResults.find(
        (result) =>
        result.error ||
        !result.data
    )

    if (failedReorderResult) {
    logDatabaseError({
        operation:
        'reorder_creator_collections',
        userId,
        error:
        failedReorderResult.error ??
        new Error(
            'A collection was not updated during reordering.'
        ),
    })

    return {
        success: false,
        error:
        'The collection order could not be saved completely. Refresh the page and try again.',
        }
    }

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  revalidateCreatorCollectionPaths({
    username,
  })

  return {
    success: true,
    data: {
      collectionIds:
        parsed.data.collectionIds,
      updatedAt: now,
    },
  }
}

/* =========================================================
 * Set visibility
 * ======================================================= */

export async function setCreatorCollectionVisibilityAction(
  input: unknown
): Promise<SetCreatorCollectionVisibilityResult> {
  const parsed =
    setCreatorCollectionVisibilitySchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  const existingResult =
    await loadOwnedCollection({
      supabase,
      userId,
      collectionId:
        parsed.data.collectionId,
    })

  if (!existingResult.success) {
    return existingResult.result
  }

  const now =
    new Date().toISOString()

  const updateResult =
    await supabase
      .from('creator_collections')
      .update({
        visibility:
          parsed.data.visibility,
        updated_at: now,
      })
      .eq(
        'id',
        parsed.data.collectionId
      )
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

  if (updateResult.error) {
    logDatabaseError({
      operation:
        'set_creator_collection_visibility',
      userId,
      collectionId:
        parsed.data.collectionId,
      error:
        updateResult.error,
    })

    return {
      success: false,
      error:
        'Collection visibility could not be updated. Please try again.',
    }
  }

  if (!updateResult.data) {
    return {
      success: false,
      error:
        'The collection was not found or you no longer have permission to edit it.',
    }
  }

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      existingResult.collection.slug,
  })

  return {
    success: true,
    data: {
      collectionId:
        parsed.data.collectionId,
      visibility:
        parsed.data.visibility,
      updatedAt: now,
    },
  }
}

/* =========================================================
 * Set featured status
 * ======================================================= */

export async function setCreatorCollectionFeaturedAction(
  input: unknown
): Promise<SetCreatorCollectionFeaturedResult> {
  const parsed =
    setCreatorCollectionFeaturedSchema.safeParse(
      input
    )

  if (!parsed.success) {
    return schemaFailure(parsed.error)
  }

  const supabase =
    await createServerClient()

  const authentication =
    await requireAuthenticatedUser(
      supabase
    )

  if (!authentication.success) {
    return authentication.result
  }

  const userId =
    authentication.userId

  const existingResult =
    await loadOwnedCollection({
      supabase,
      userId,
      collectionId:
        parsed.data.collectionId,
    })

  if (!existingResult.success) {
    return existingResult.result
  }

  const now =
    new Date().toISOString()

  const updateResult =
    await supabase
      .from('creator_collections')
      .update({
        featured:
          parsed.data.featured,
        updated_at: now,
      })
      .eq(
        'id',
        parsed.data.collectionId
      )
      .eq('user_id', userId)
      .select('id')
      .maybeSingle()

  if (updateResult.error) {
    logDatabaseError({
      operation:
        'set_creator_collection_featured',
      userId,
      collectionId:
        parsed.data.collectionId,
      error:
        updateResult.error,
    })

    return {
      success: false,
      error:
        'The featured collection setting could not be updated. Please try again.',
    }
  }

  if (!updateResult.data) {
    return {
      success: false,
      error:
        'The collection was not found or you no longer have permission to edit it.',
    }
  }

  const username =
    await loadProfileUsername({
      supabase,
      userId,
    })

  revalidateCreatorCollectionPaths({
    username,
    slug:
      existingResult.collection.slug,
  })

  return {
    success: true,
    data: {
      collectionId:
        parsed.data.collectionId,
      featured:
        parsed.data.featured,
      updatedAt: now,
    },
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
      result: CollectionActionFailure
    }

async function requireAuthenticatedUser(
  supabase: SupabaseServerClient
): Promise<AuthenticatedUserResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    console.error(
      '[creator collection actions] Authentication lookup failed:',
      serializeDatabaseError(error)
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
          'You must be signed in to manage creator collections.',
      },
    }
  }

  return {
    success: true,
    userId: user.id,
  }
}

/* =========================================================
 * Ownership loading
 * ======================================================= */

type OwnedCollectionResult =
  | {
      success: true
      collection: {
        id: string
        slug: string
      }
    }
  | {
      success: false
      result: CollectionActionFailure
    }

async function loadOwnedCollection({
  supabase,
  userId,
  collectionId,
}: {
  supabase: SupabaseServerClient
  userId: string
  collectionId: string
}): Promise<OwnedCollectionResult> {
  const result =
    await supabase
      .from('creator_collections')
      .select('id, slug')
      .eq('id', collectionId)
      .eq('user_id', userId)
      .maybeSingle()

  if (result.error) {
    logDatabaseError({
      operation:
        'load_owned_creator_collection',
      userId,
      collectionId,
      error: result.error,
    })

    return {
      success: false,
      result: {
        success: false,
        error:
          'The collection could not be loaded. Please try again.',
      },
    }
  }

  if (
    !result.data ||
    typeof result.data.id !==
      'string' ||
    typeof result.data.slug !==
      'string'
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
      id: result.data.id,
      slug: result.data.slug,
    },
  }
}

/* =========================================================
 * Collection ordering
 * ======================================================= */

async function getNextCollectionSortOrder({
  supabase,
  userId,
}: {
  supabase: SupabaseServerClient
  userId: string
}): Promise<number | null> {
  const result =
    await supabase
      .from('creator_collections')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

  if (result.error) {
    logDatabaseError({
      operation:
        'load_next_collection_sort_order',
      userId,
      error: result.error,
    })

    return null
  }

  const currentMaximum =
    typeof result.data?.sort_order ===
      'number' &&
    Number.isFinite(
      result.data.sort_order
    )
      ? Math.max(
          0,
          Math.trunc(
            result.data.sort_order
          )
        )
      : -1

  return currentMaximum + 1
}

/* =========================================================
 * Profile username
 * ======================================================= */

async function loadProfileUsername({
  supabase,
  userId,
}: {
  supabase: SupabaseServerClient
  userId: string
}): Promise<string | null> {
  const result =
    await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()

  if (result.error) {
    logDatabaseError({
      operation:
        'load_collection_owner_username',
      userId,
      error: result.error,
    })

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
}: {
  username: string | null
  slug?: string
}): void {
  revalidatePath('/profile')
  revalidatePath('/profile/creator')
  revalidatePath(
    '/profile/creator/collections'
  )

  if (!username) {
    return
  }

  const encodedUsername =
    encodeURIComponent(username)

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
 * Collection response normalization
 * ======================================================= */

const COLLECTION_SELECT = `
  id,
  title,
  slug,
  description,
  cover_image_url,
  city,
  category,
  visibility,
  featured,
  sort_order,
  created_at,
  updated_at
`

function normalizeCollectionRecord(
  value: unknown
): CreatorCollectionActionRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeRequiredText(
      value.id
    )

  const title =
    normalizeRequiredText(
      value.title
    )

  const slug =
    normalizeRequiredText(
      value.slug
    )

  const visibility =
    value.visibility === 'public' ||
    value.visibility === 'private'
      ? value.visibility
      : null

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
    !title ||
    !slug ||
    !visibility ||
    !createdAt ||
    !updatedAt
  ) {
    return null
  }

  return {
    id,
    title,
    slug,

    description:
      normalizeNullableText(
        value.description
      ),

    cover_image_url:
      normalizeNullableText(
        value.cover_image_url
      ),

    city:
      normalizeNullableText(
        value.city
      ),

    category:
      normalizeNullableText(
        value.category
      ),

    visibility,

    featured:
      value.featured === true,

    sort_order:
      normalizeNonNegativeInteger(
        value.sort_order
      ),

    created_at: createdAt,
    updated_at: updatedAt,
  }
}

/* =========================================================
 * Slug generation
 * ======================================================= */

function createSlug(
  value: string
): string {
  return value
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(/^-+|-+$/g, '')
    .slice(
      0,
      COLLECTION_LIMITS.slug
    )
    .replace(/-+$/g, '')
}

function buildSlugCandidate({
  baseSlug,
  attempt,
}: {
  baseSlug: string
  attempt: number
}): string {
  if (attempt <= 1) {
    return baseSlug.slice(
      0,
      COLLECTION_LIMITS.slug
    )
  }

  const suffix = `-${attempt}`

  const availableLength =
    COLLECTION_LIMITS.slug -
    suffix.length

  return `${baseSlug
    .slice(0, availableLength)
    .replace(/-+$/g, '')}${suffix}`
}

/* =========================================================
 * Public image URL validation
 * ======================================================= */

type PublicImageUrlValidation =
  | {
      valid: true
      normalizedUrl: string
    }
  | {
      valid: false
      error: string
    }

function validatePublicImageUrl(
  value: string
): PublicImageUrlValidation {
  try {
    const parsed =
      new URL(value)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return {
        valid: false,
        error:
          'Cover image URL must begin with https:// or http://.',
      }
    }

    if (
      parsed.username ||
      parsed.password
    ) {
      return {
        valid: false,
        error:
          'Cover image URLs containing credentials are not allowed.',
      }
    }

    const hostname =
      normalizeHostname(
        parsed.hostname
      )

    if (!hostname) {
      return {
        valid: false,
        error:
          'Cover image URL must include a valid hostname.',
      }
    }

    if (
      isPrivateOrLocalHostname(
        hostname
      )
    ) {
      return {
        valid: false,
        error:
          'Local and private-network image URLs are not allowed.',
      }
    }

    parsed.hash = ''

    if (
      parsed.protocol === 'https:' &&
      parsed.port === '443'
    ) {
      parsed.port = ''
    }

    if (
      parsed.protocol === 'http:' &&
      parsed.port === '80'
    ) {
      parsed.port = ''
    }

    return {
      valid: true,
      normalizedUrl:
        parsed.toString(),
    }
  } catch {
    return {
      valid: false,
      error:
        'Enter a valid cover image URL.',
    }
  }
}

function isPrivateOrLocalHostname(
  hostname: string
): boolean {
  const normalized =
    normalizeHostname(hostname)

  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith(
      '.localhost'
    ) ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  if (
    /^10\./.test(normalized) ||
    /^127\./.test(normalized) ||
    /^169\.254\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalized
    )
  ) {
    return true
  }

  if (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  ) {
    return true
  }

  return false
}

/* =========================================================
 * Schema errors
 * ======================================================= */

function schemaFailure(
  error: z.ZodError
): CollectionActionFailure {
  const flattened =
    error.flatten()

  const fieldErrors:
    CollectionActionFieldErrors = {}

  const rawFieldErrors =
    flattened.fieldErrors as Record<
      string,
      unknown
    >

  for (
    const [
      field,
      rawMessages,
    ] of Object.entries(
      rawFieldErrors
    )
  ) {
    if (
      !isCollectionActionField(
        field
      ) ||
      !Array.isArray(rawMessages)
    ) {
      continue
    }

    const messages =
      rawMessages.filter(
        (
          message
        ): message is string =>
          typeof message ===
            'string' &&
          message.trim().length > 0
      )

    if (messages.length === 0) {
      continue
    }

    fieldErrors[field] = [
      ...new Set(messages),
    ]
  }

  const firstFieldError =
    Object.values(
      fieldErrors
    ).find(
      (
        messages
      ): messages is string[] =>
        Array.isArray(messages) &&
        messages.length > 0
    )?.[0]

  return {
    success: false,

    error:
      flattened.formErrors[0] ??
      firstFieldError ??
      'One or more collection fields are invalid.',

    ...(Object.keys(fieldErrors)
      .length > 0
      ? {
          fieldErrors,
        }
      : {}),
  }
}

function isCollectionActionField(
  value: string
): value is keyof CollectionActionFieldErrors {
  return (
    value === 'collectionId' ||
    value === 'title' ||
    value === 'description' ||
    value === 'cover_image_url' ||
    value === 'city' ||
    value === 'category' ||
    value === 'visibility' ||
    value === 'featured' ||
    value === 'sort_order' ||
    value === 'collectionIds'
  )
}

/* =========================================================
 * Error logging
 * ======================================================= */

function logDatabaseError({
  operation,
  userId,
  collectionId,
  error,
}: {
  operation: string
  userId: string
  collectionId?: string
  error: unknown
}): void {
  console.error(
    '[creator collection actions] Database operation failed:',
    {
      operation,
      userId,
      collectionId,
      error:
        serializeDatabaseError(
          error
        ),
    }
  )
}

function logInvalidDatabaseData({
  operation,
  userId,
  value,
}: {
  operation: string
  userId: string
  value: unknown
}): void {
  console.error(
    '[creator collection actions] Invalid database response:',
    {
      operation,
      userId,
      value,
    }
  )
}

function serializeDatabaseError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof Error
  ) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  if (isRecord(error)) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    }
  }

  return {
    value: String(error),
  }
}

function isUniqueConstraintViolation(
  error: unknown
): boolean {
  return (
    isRecord(error) &&
    error.code === '23505'
  )
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

function normalizeRequiredInput(
  value: unknown
): unknown {
  if (typeof value !== 'string') {
    return value
  }

  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeNullableInput(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeIntegerInput(
  value: unknown
): unknown {
  if (
    typeof value === 'string' &&
    value.trim() !== ''
  ) {
    const parsed =
      Number(value)

    return Number.isFinite(parsed)
      ? parsed
      : value
  }

  return value
}

function normalizeRequiredText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeNonNegativeInteger(
  value: unknown
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return 0
  }

  return Math.max(
    0,
    Math.trunc(value)
  )
}

function normalizeIsoDate(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const timestamp =
    Date.parse(value)

  if (Number.isNaN(timestamp)) {
    return null
  }

  return new Date(
    timestamp
  ).toISOString()
}

function normalizeHostname(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
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