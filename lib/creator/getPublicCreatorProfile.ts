import type { SupabaseClient } from '@supabase/supabase-js'

import {
  collaborationTagSchema,
  creatorCollectionRowSchema,
  creatorProfileRowSchema,
  creatorSocialLinkRowSchema,
} from './schemas'

import {
  COLLABORATION_CATEGORY_DEFINITIONS,
} from './constants'

import {
  validateCreatorSocialUrl,
} from './validateSocialUrl'

import type {
  CollaborationTag,
  CreatorCollection,
  CreatorProfile,
  CreatorSocialLink,
  PublicCreatorBundle,
  PublicCreatorCollection,
  PublicCreatorSocialLink,
} from './types'

/* =========================================================
 * Public error contract
 * ======================================================= */

export type PublicCreatorProfileLoadErrorCode =
  | 'CREATOR_PROFILE_QUERY_FAILED'
  | 'SOCIAL_LINKS_QUERY_FAILED'
  | 'COLLABORATION_TAGS_QUERY_FAILED'
  | 'COLLECTIONS_QUERY_FAILED'
  | 'INVALID_DATABASE_DATA'

/**
 * Stable application-facing error for public Creator Mode
 * loading failures.
 *
 * Detailed Supabase and validation information is logged
 * server-side. Public callers receive a safe message that does
 * not expose database internals.
 */
export class PublicCreatorProfileLoadError extends Error {
  readonly code: PublicCreatorProfileLoadErrorCode

  constructor({
    code,
    message,
    cause,
  }: {
    code: PublicCreatorProfileLoadErrorCode
    message: string
    cause?: unknown
  }) {
    super(message, {
      cause,
    })

    this.name = 'PublicCreatorProfileLoadError'
    this.code = code
  }
}

/* =========================================================
 * Loader options
 * ======================================================= */

export type GetPublicCreatorProfileOptions = {
  /**
   * Existing server-side Supabase client.
   *
   * Pass the same client already used by:
   *
   *   app/u/[username]/page.tsx
   *
   * so authentication cookies and RLS context remain intact.
   */
  supabase: SupabaseClient

  /**
   * Profile owner whose Creator Mode data should be loaded.
   */
  userId: string

  /**
   * Maximum number of featured collections returned.
   *
   * Defaults to six and is constrained to a safe range.
   */
  featuredCollectionLimit?: number
}

/**
 * Loads the public Creator Mode bundle for one profile.
 *
 * Returns:
 *
 * - `null` when no accessible creator profile exists
 * - `PublicCreatorBundle` when Creator Mode data is available
 * - throws `PublicCreatorProfileLoadError` when an accessible
 *   query fails or returns malformed data
 *
 * Visibility and ownership protection are enforced through:
 *
 * 1. explicit query filters
 * 2. Supabase Row Level Security
 * 3. runtime row validation
 *
 * The caller should still check:
 *
 *   profile.creator_mode_enabled === true
 *
 * before invoking this loader.
 */
export async function getPublicCreatorProfile({
  supabase,
  userId,
  featuredCollectionLimit = 6,
}: GetPublicCreatorProfileOptions): Promise<
  PublicCreatorBundle | null
> {
  const normalizedUserId = userId.trim()

  if (!normalizedUserId) {
    return null
  }

  const collectionLimit = clampInteger({
    value: featuredCollectionLimit,
    minimum: 1,
    maximum: 12,
    fallback: 6,
  })

  const [
    creatorProfileResult,
    socialLinksResult,
    selectedTagsResult,
    collectionsResult,
  ] = await Promise.all([
    supabase
      .from('creator_profiles')
      .select(`
        user_id,
        creator_bio,
        primary_city,
        available_for_travel,
        accepting_collaborations,
        public_email,
        created_at,
        updated_at
      `)
      .eq('user_id', normalizedUserId)
      .maybeSingle(),

    supabase
      .from('creator_social_links')
      .select(`
        id,
        user_id,
        platform,
        url,
        handle,
        sort_order,
        is_public,
        created_at,
        updated_at
      `)
      .eq('user_id', normalizedUserId)
      .eq('is_public', true)
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('creator_collaboration_tags')
      .select(`
        tag_id,
        collaboration_tags (
          id,
          slug,
          label,
          category,
          active,
          sort_order,
          created_at
        )
      `)
      .eq('user_id', normalizedUserId),

    supabase
      .from('creator_collections')
      .select(`
        id,
        user_id,
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
      `)
      .eq('user_id', normalizedUserId)
      .eq('visibility', 'public')
      .eq('featured', true)
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: false,
      })
      .limit(collectionLimit),
  ])

  if (creatorProfileResult.error) {
    throwQueryError({
      code: 'CREATOR_PROFILE_QUERY_FAILED',
      operation: 'public creator profile',
      error: creatorProfileResult.error,
      userId: normalizedUserId,
    })
  }

  /**
   * A missing row is a valid state.
   *
   * This may occur when:
   *
   * - Creator Mode has never been configured
   * - Creator Mode is disabled and RLS hides the row
   * - the base profile is private
   * - the profile does not exist
   */
  if (!creatorProfileResult.data) {
    return null
  }

  if (socialLinksResult.error) {
    throwQueryError({
      code: 'SOCIAL_LINKS_QUERY_FAILED',
      operation: 'public creator social links',
      error: socialLinksResult.error,
      userId: normalizedUserId,
    })
  }

  if (selectedTagsResult.error) {
    throwQueryError({
      code: 'COLLABORATION_TAGS_QUERY_FAILED',
      operation: 'public creator collaboration tags',
      error: selectedTagsResult.error,
      userId: normalizedUserId,
    })
  }

  if (collectionsResult.error) {
    throwQueryError({
      code: 'COLLECTIONS_QUERY_FAILED',
      operation: 'public creator collections',
      error: collectionsResult.error,
      userId: normalizedUserId,
    })
  }

  const profile = parseCreatorProfile({
    value: creatorProfileResult.data,
    expectedUserId: normalizedUserId,
  })

  const socialLinks = parsePublicSocialLinks({
    value: socialLinksResult.data,
    expectedUserId: normalizedUserId,
  })

  const collaborationTags =
    parsePublicCollaborationTags(
      selectedTagsResult.data
    )

  const featuredCollections =
    parsePublicCollections({
      value: collectionsResult.data,
      expectedUserId: normalizedUserId,
    })

  return {
    profile,
    socialLinks,
    collaborationTags,
    featuredCollections,
  }
}

/* =========================================================
 * Creator profile parsing
 * ======================================================= */

function parseCreatorProfile({
  value,
  expectedUserId,
}: {
  value: unknown
  expectedUserId: string
}): CreatorProfile {
  const result =
    creatorProfileRowSchema.safeParse(value)

  if (!result.success) {
    throwInvalidDatabaseData({
      entity: 'creator_profiles',
      value,
      validationError: result.error.flatten(),
    })
  }

  if (result.data.user_id !== expectedUserId) {
    throwInvalidDatabaseData({
      entity: 'creator_profiles.user_id',
      value: result.data.user_id,
      expectedValue: expectedUserId,
    })
  }

  return result.data
}

/* =========================================================
 * Public social-link parsing
 * ======================================================= */

function parsePublicSocialLinks({
  value,
  expectedUserId,
}: {
  value: unknown
  expectedUserId: string
}): PublicCreatorSocialLink[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity: 'creator_social_links',
      value,
    })
  }

  const parsedLinks = value.map(
    (row, index): CreatorSocialLink => {
      const result =
        creatorSocialLinkRowSchema.safeParse(row)

      if (!result.success) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}]`,
          value: row,
          validationError:
            result.error.flatten(),
        })
      }

      const link = result.data

      if (link.user_id !== expectedUserId) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}].user_id`,
          value: link.user_id,
          expectedValue: expectedUserId,
        })
      }

      if (link.is_public !== true) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}].is_public`,
          value: link.is_public,
          expectedValue: true,
        })
      }

      const urlValidation =
        validateCreatorSocialUrl({
          platform: link.platform,
          value: link.url,
        })

      if (!urlValidation.valid) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}].url`,
          value: link.url,
          validationError: {
            code: urlValidation.code,
            message: urlValidation.error,
          },
        })
      }

      return {
        ...link,
        url: urlValidation.normalizedUrl,
      }
    }
  )

  return parsedLinks
    .sort(compareSocialLinks)
    .map(toPublicSocialLink)
}

function compareSocialLinks(
  first: CreatorSocialLink,
  second: CreatorSocialLink
): number {
  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const createdAtComparison =
    compareIsoDatesAscending(
      first.created_at,
      second.created_at
    )

  if (createdAtComparison !== 0) {
    return createdAtComparison
  }

  return first.id.localeCompare(second.id)
}

function toPublicSocialLink(
  link: CreatorSocialLink
): PublicCreatorSocialLink {
  return {
    id: link.id,
    platform: link.platform,
    url: link.url,
    handle: link.handle,
    sort_order: link.sort_order,
  }
}

/* =========================================================
 * Public collaboration-tag parsing
 * ======================================================= */

function parsePublicCollaborationTags(
  value: unknown
): CollaborationTag[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity:
        'creator_collaboration_tags',
      value,
    })
  }

  const parsedTags: CollaborationTag[] = []

  value.forEach((row, index) => {
    if (!isRecord(row)) {
      throwInvalidDatabaseData({
        entity:
          `creator_collaboration_tags[${index}]`,
        value: row,
      })
    }

    const relatedValue =
      normalizeSupabaseRelation(
        row.collaboration_tags
      )

    /**
     * A missing relation can happen when:
     *
     * - the referenced tag was deleted
     * - RLS hides the canonical tag
     * - the relationship is temporarily inconsistent
     *
     * Ignore missing relations rather than failing the entire
     * creator profile.
     */
    if (relatedValue === null) {
      return
    }

    const result =
      collaborationTagSchema.safeParse(
        relatedValue
      )

    if (!result.success) {
      throwInvalidDatabaseData({
        entity:
          `creator_collaboration_tags[${index}].collaboration_tags`,
        value: relatedValue,
        validationError:
          result.error.flatten(),
      })
    }

    if (!result.data.active) {
      return
    }

    parsedTags.push(result.data)
  })

  return deduplicateCollaborationTags(
    parsedTags
  ).sort(compareCollaborationTags)
}

/**
 * Supabase relationship responses may be represented as:
 *
 * - one object
 * - a one-element array
 * - an empty array
 * - null
 *
 * This helper normalizes those cases.
 */
function normalizeSupabaseRelation(
  value: unknown
): unknown | null {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value
}

function deduplicateCollaborationTags(
  tags: CollaborationTag[]
): CollaborationTag[] {
  const tagsById = new Map<
    number,
    CollaborationTag
  >()

  for (const tag of tags) {
    tagsById.set(tag.id, tag)
  }

  return [...tagsById.values()]
}

function compareCollaborationTags(
  first: CollaborationTag,
  second: CollaborationTag
): number {
  const firstCategoryOrder =
    COLLABORATION_CATEGORY_DEFINITIONS[
      first.category
    ].sortOrder

  const secondCategoryOrder =
    COLLABORATION_CATEGORY_DEFINITIONS[
      second.category
    ].sortOrder

  if (
    firstCategoryOrder !==
    secondCategoryOrder
  ) {
    return (
      firstCategoryOrder -
      secondCategoryOrder
    )
  }

  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  return first.label.localeCompare(
    second.label,
    undefined,
    {
      sensitivity: 'base',
    }
  )
}

/* =========================================================
 * Public collection parsing
 * ======================================================= */

function parsePublicCollections({
  value,
  expectedUserId,
}: {
  value: unknown
  expectedUserId: string
}): PublicCreatorCollection[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity: 'creator_collections',
      value,
    })
  }

  const parsedCollections = value.map(
    (row, index): CreatorCollection => {
      const result =
        creatorCollectionRowSchema.safeParse(
          row
        )

      if (!result.success) {
        throwInvalidDatabaseData({
          entity:
            `creator_collections[${index}]`,
          value: row,
          validationError:
            result.error.flatten(),
        })
      }

      const collection = result.data

      if (
        collection.user_id !==
        expectedUserId
      ) {
        throwInvalidDatabaseData({
          entity:
            `creator_collections[${index}].user_id`,
          value: collection.user_id,
          expectedValue: expectedUserId,
        })
      }

      if (
        collection.visibility !== 'public'
      ) {
        throwInvalidDatabaseData({
          entity:
            `creator_collections[${index}].visibility`,
          value: collection.visibility,
          expectedValue: 'public',
        })
      }

      if (collection.featured !== true) {
        throwInvalidDatabaseData({
          entity:
            `creator_collections[${index}].featured`,
          value: collection.featured,
          expectedValue: true,
        })
      }

      return collection
    }
  )

  return deduplicateCollections(
    parsedCollections
  )
    .sort(compareCollections)
    .map(toPublicCollection)
}

function deduplicateCollections(
  collections: CreatorCollection[]
): CreatorCollection[] {
  const collectionsById = new Map<
    string,
    CreatorCollection
  >()

  for (const collection of collections) {
    collectionsById.set(
      collection.id,
      collection
    )
  }

  return [...collectionsById.values()]
}

function compareCollections(
  first: CreatorCollection,
  second: CreatorCollection
): number {
  if (
    first.sort_order !==
    second.sort_order
  ) {
    return (
      first.sort_order -
      second.sort_order
    )
  }

  const createdAtComparison =
    compareIsoDatesDescending(
      first.created_at,
      second.created_at
    )

  if (createdAtComparison !== 0) {
    return createdAtComparison
  }

  return first.id.localeCompare(second.id)
}

function toPublicCollection(
  collection: CreatorCollection
): PublicCreatorCollection {
  return {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description,
    cover_image_url:
      collection.cover_image_url,
    city: collection.city,
    category: collection.category,
    featured: collection.featured,
    sort_order: collection.sort_order,
    created_at: collection.created_at,
    updated_at: collection.updated_at,
  }
}

/* =========================================================
 * Error helpers
 * ======================================================= */

function throwQueryError({
  code,
  operation,
  error,
  userId,
}: {
  code: Exclude<
    PublicCreatorProfileLoadErrorCode,
    'INVALID_DATABASE_DATA'
  >
  operation: string
  error: unknown
  userId: string
}): never {
  console.error(
    `[getPublicCreatorProfile] Failed to load ${operation}:`,
    {
      userId,
      error,
    }
  )

  throw new PublicCreatorProfileLoadError({
    code,
    message:
      'This creator profile could not be loaded. Please try again.',
    cause: error,
  })
}

function throwInvalidDatabaseData({
  entity,
  value,
  expectedValue,
  validationError,
}: {
  entity: string
  value: unknown
  expectedValue?: unknown
  validationError?: unknown
}): never {
  console.error(
    '[getPublicCreatorProfile] Invalid Creator Mode database data:',
    {
      entity,
      value,
      expectedValue,
      validationError,
    }
  )

  throw new PublicCreatorProfileLoadError({
    code: 'INVALID_DATABASE_DATA',
    message:
      'This creator profile contains invalid data and cannot currently be displayed.',
    cause: validationError,
  })
}

/* =========================================================
 * General helpers
 * ======================================================= */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function clampInteger({
  value,
  minimum,
  maximum,
  fallback,
}: {
  value: number
  minimum: number
  maximum: number
  fallback: number
}): number {
  if (
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}

function compareIsoDatesAscending(
  first: string,
  second: string
): number {
  const firstTime = Date.parse(first)
  const secondTime = Date.parse(second)

  if (
    Number.isNaN(firstTime) ||
    Number.isNaN(secondTime)
  ) {
    return first.localeCompare(second)
  }

  return firstTime - secondTime
}

function compareIsoDatesDescending(
  first: string,
  second: string
): number {
  return compareIsoDatesAscending(
    second,
    first
  )
}