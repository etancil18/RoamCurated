import {
  collaborationTagSchema,
  creatorProfileRowSchema,
  creatorSocialLinkRowSchema,
} from './schemas'

import {
  COLLABORATION_CATEGORY_DEFINITIONS,
} from './constants'

import {
  sortCreatorSocialLinks,
  type CollaborationTag,
  type CreatorProfile,
  type CreatorSettingsData,
  type CreatorSocialLink,
  type CreatorSettingsBaseProfile,
} from './types'

import {
  createServerClient,
} from '@/lib/supabase/server'

/**
 * Public-safe error thrown when Creator Mode settings cannot
 * be loaded.
 *
 * Detailed query information is logged server-side, while
 * callers receive a stable message that does not expose
 * database internals.
 */
export class CreatorSettingsLoadError extends Error {
  readonly code:
    | 'PROFILE_NOT_FOUND'
    | 'PROFILE_QUERY_FAILED'
    | 'CREATOR_PROFILE_QUERY_FAILED'
    | 'SOCIAL_LINKS_QUERY_FAILED'
    | 'SELECTED_TAGS_QUERY_FAILED'
    | 'AVAILABLE_TAGS_QUERY_FAILED'
    | 'INVALID_DATABASE_DATA'

  constructor({
    code,
    message,
    cause,
  }: {
    code: CreatorSettingsLoadError['code']
    message: string
    cause?: unknown
  }) {
    super(message, {
      cause,
    })

    this.name = 'CreatorSettingsLoadError'
    this.code = code
  }
}

/**
 * Loads the authenticated user's complete Creator Mode
 * settings bundle.
 *
 * Returns:
 *
 * - `null` when there is no authenticated user
 * - `CreatorSettingsData` when settings load successfully
 * - throws `CreatorSettingsLoadError` when the database
 *   returns an error or malformed data
 *
 * This function must only be called from server-side code.
 */
export async function getCreatorSettings(): Promise<
  CreatorSettingsData | null
> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(
      '[getCreatorSettings] Failed to resolve authenticated user:',
      authError
    )

    return null
  }

  if (!user) {
    return null
  }

  const [
    baseProfileResult,
    creatorProfileResult,
    socialLinksResult,
    selectedTagsResult,
    availableTagsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        username,
        creator_mode_enabled,
        creator_headline
      `)
      .eq('id', user.id)
      .maybeSingle(),

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
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: true,
      }),

    supabase
      .from('creator_collaboration_tags')
      .select('tag_id')
      .eq('user_id', user.id),

    supabase
      .from('collaboration_tags')
      .select(`
        id,
        slug,
        label,
        category,
        active,
        sort_order,
        created_at
      `)
      .eq('active', true)
      .order('sort_order', {
        ascending: true,
      }),
  ])

  if (baseProfileResult.error) {
    throwQueryError({
      code: 'PROFILE_QUERY_FAILED',
      operation: 'base profile',
      error: baseProfileResult.error,
    })
  }

  if (!baseProfileResult.data) {
    console.error(
      '[getCreatorSettings] Authenticated user has no matching profiles row:',
      {
        userId: user.id,
      }
    )

    throw new CreatorSettingsLoadError({
      code: 'PROFILE_NOT_FOUND',
      message:
        'Your profile could not be found. Complete your account setup and try again.',
    })
  }

  if (creatorProfileResult.error) {
    throwQueryError({
      code: 'CREATOR_PROFILE_QUERY_FAILED',
      operation: 'creator profile',
      error: creatorProfileResult.error,
    })
  }

  if (socialLinksResult.error) {
    throwQueryError({
      code: 'SOCIAL_LINKS_QUERY_FAILED',
      operation: 'creator social links',
      error: socialLinksResult.error,
    })
  }

  if (selectedTagsResult.error) {
    throwQueryError({
      code: 'SELECTED_TAGS_QUERY_FAILED',
      operation: 'selected collaboration tags',
      error: selectedTagsResult.error,
    })
  }

  if (availableTagsResult.error) {
    throwQueryError({
      code: 'AVAILABLE_TAGS_QUERY_FAILED',
      operation: 'available collaboration tags',
      error: availableTagsResult.error,
    })
  }

  const baseProfile = parseBaseProfile({
    value: baseProfileResult.data,
    authenticatedUserId: user.id,
  })

  const creatorProfile =
    creatorProfileResult.data === null
      ? null
      : parseCreatorProfile({
          value: creatorProfileResult.data,
          authenticatedUserId: user.id,
        })

  const socialLinks = parseSocialLinks({
    value: socialLinksResult.data,
    authenticatedUserId: user.id,
  })

  const availableTags = parseAvailableTags(
    availableTagsResult.data
  )

  const selectedTagIds = parseSelectedTagIds({
    value: selectedTagsResult.data,
    availableTags,
  })

  return {
    userId: user.id,
    baseProfile,
    creatorProfile,
    socialLinks,
    selectedTagIds,
    availableTags,
  }
}

/* =========================================================
 * Base profile parsing
 * ======================================================= */

function parseBaseProfile({
  value,
  authenticatedUserId,
}: {
  value: unknown
  authenticatedUserId: string
}): CreatorSettingsBaseProfile {
  if (!isRecord(value)) {
    throwInvalidDatabaseData({
      entity: 'profiles',
      value,
    })
  }

  if (
    typeof value.id !== 'string' ||
    value.id !== authenticatedUserId
  ) {
    throwInvalidDatabaseData({
      entity: 'profiles.id',
      value: value.id,
    })
  }

  const username =
    typeof value.username === 'string'
      ? nullableTrimmedString(value.username)
      : null

  const creatorHeadline =
    typeof value.creator_headline === 'string'
      ? nullableTrimmedString(
          value.creator_headline
        )
      : null

  return {
    id: value.id,
    username,
    creator_mode_enabled:
      value.creator_mode_enabled === true,
    creator_headline: creatorHeadline,
  }
}

/* =========================================================
 * Creator profile parsing
 * ======================================================= */

function parseCreatorProfile({
  value,
  authenticatedUserId,
}: {
  value: unknown
  authenticatedUserId: string
}): CreatorProfile {
  const result =
    creatorProfileRowSchema.safeParse(value)

  if (!result.success) {
    throwInvalidDatabaseData({
      entity: 'creator_profiles',
      value,
      validationError:
        result.error.flatten(),
    })
  }

  if (
    result.data.user_id !==
    authenticatedUserId
  ) {
    throwInvalidDatabaseData({
      entity: 'creator_profiles.user_id',
      value: result.data.user_id,
    })
  }

  return result.data
}

/* =========================================================
 * Social-link parsing
 * ======================================================= */

function parseSocialLinks({
  value,
  authenticatedUserId,
}: {
  value: unknown
  authenticatedUserId: string
}): CreatorSocialLink[] {
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
    (row, index) => {
      const result =
        creatorSocialLinkRowSchema.safeParse(
          row
        )

      if (!result.success) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}]`,
          value: row,
          validationError:
            result.error.flatten(),
        })
      }

      if (
        result.data.user_id !==
        authenticatedUserId
      ) {
        throwInvalidDatabaseData({
          entity:
            `creator_social_links[${index}].user_id`,
          value: result.data.user_id,
        })
      }

      return result.data
    }
  )

  return sortCreatorSocialLinks(parsedLinks)
}

/* =========================================================
 * Collaboration-tag parsing
 * ======================================================= */

function parseAvailableTags(
  value: unknown
): CollaborationTag[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throwInvalidDatabaseData({
      entity: 'collaboration_tags',
      value,
    })
  }

  const parsedTags = value.map(
    (row, index) => {
      const result =
        collaborationTagSchema.safeParse(row)

      if (!result.success) {
        throwInvalidDatabaseData({
          entity:
            `collaboration_tags[${index}]`,
          value: row,
          validationError:
            result.error.flatten(),
        })
      }

      return result.data
    }
  )

  return sortCollaborationTags(
    parsedTags.filter(
      (tag) => tag.active
    )
  )
}

function parseSelectedTagIds({
  value,
  availableTags,
}: {
  value: unknown
  availableTags: CollaborationTag[]
}): number[] {
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

  const activeTagIds = new Set(
    availableTags.map((tag) => tag.id)
  )

  const selectedIds = value.map(
    (row, index) => {
      if (!isRecord(row)) {
        throwInvalidDatabaseData({
          entity:
            `creator_collaboration_tags[${index}]`,
          value: row,
        })
      }

      const tagId = row.tag_id

      if (
        typeof tagId !== 'number' ||
        !Number.isInteger(tagId) ||
        tagId <= 0
      ) {
        throwInvalidDatabaseData({
          entity:
            `creator_collaboration_tags[${index}].tag_id`,
          value: tagId,
        })
      }

      return tagId
    }
  )

  /**
   * Inactive or deleted canonical tags are intentionally
   * omitted from the editable settings payload.
   *
   * This prevents deprecated selections from appearing in
   * the UI or being resubmitted during the next save.
   */
  return [
    ...new Set(
      selectedIds.filter((tagId) =>
        activeTagIds.has(tagId)
      )
    ),
  ].sort((first, second) => {
    const firstTag = availableTags.find(
      (tag) => tag.id === first
    )

    const secondTag = availableTags.find(
      (tag) => tag.id === second
    )

    if (!firstTag || !secondTag) {
      return first - second
    }

    return compareCollaborationTags(
      firstTag,
      secondTag
    )
  })
}

/* =========================================================
 * Sorting helpers
 * ======================================================= */

function sortCollaborationTags(
  tags: CollaborationTag[]
): CollaborationTag[] {
  return [...tags].sort(
    compareCollaborationTags
  )
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
 * Error helpers
 * ======================================================= */

function throwQueryError({
  code,
  operation,
  error,
}: {
  code:
    | 'PROFILE_QUERY_FAILED'
    | 'CREATOR_PROFILE_QUERY_FAILED'
    | 'SOCIAL_LINKS_QUERY_FAILED'
    | 'SELECTED_TAGS_QUERY_FAILED'
    | 'AVAILABLE_TAGS_QUERY_FAILED'
  operation: string
  error: unknown
}): never {
  console.error(
    `[getCreatorSettings] Failed to load ${operation}:`,
    error
  )

  throw new CreatorSettingsLoadError({
    code,
    message:
      'Creator Mode settings could not be loaded. Please try again.',
    cause: error,
  })
}

function throwInvalidDatabaseData({
  entity,
  value,
  validationError,
}: {
  entity: string
  value: unknown
  validationError?: unknown
}): never {
  console.error(
    '[getCreatorSettings] Invalid Creator Mode database data:',
    {
      entity,
      value,
      validationError,
    }
  )

  throw new CreatorSettingsLoadError({
    code: 'INVALID_DATABASE_DATA',
    message:
      'Creator Mode settings contain invalid data. Please contact support if the issue continues.',
    cause: validationError,
  })
}

/* =========================================================
 * General utilities
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

function nullableTrimmedString(
  value: string
): string | null {
  const trimmed = value.trim()

  return trimmed.length > 0
    ? trimmed
    : null
}