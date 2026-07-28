'use server'

import { revalidatePath } from 'next/cache'

import { createServerClient } from '@/lib/supabase/server'

import {
  creatorSettingsSchema,
  flattenCreatorSchemaError,
} from '@/lib/creator/schemas'

import {
  validateCreatorSocialUrl,
} from '@/lib/creator/validateSocialUrl'

import type {
  CreatorActionFieldErrors,
  CreatorActionResult,
  CreatorProfile,
  CreatorSettingsInput,
  CreatorSocialLink,
} from '@/lib/creator/types'

/* =========================================================
 * Public action result
 * ======================================================= */

export type SaveCreatorSettingsData = {
  creatorModeEnabled: boolean
  showPublicExplorationMap: boolean
  updatedAt: string
}

export type SaveCreatorSettingsResult =
  CreatorActionResult<SaveCreatorSettingsData>

/* =========================================================
 * Internal database snapshots
 * ======================================================= */

type ExistingBaseProfile = {
  id: string
  username: string | null
  creator_mode_enabled: boolean | null
  creator_headline: string | null
  show_public_exploration_map: boolean | null
}

type ExistingCreatorTagSelection = {
  tag_id: number
}

type CreatorSettingsSnapshot = {
  baseProfile: ExistingBaseProfile
  creatorProfile: CreatorProfile | null
  socialLinks: CreatorSocialLink[]
  collaborationTagIds: number[]
}

type NormalizedSocialLinkInsert = {
  user_id: string
  platform: CreatorSocialLink['platform']
  url: string
  handle: string | null
  sort_order: number
  is_public: boolean
  updated_at: string
}

/* =========================================================
 * Main save action
 * ======================================================= */

/**
 * Saves the authenticated user's complete Creator Mode settings.
 *
 * Security and integrity guarantees:
 *
 * - user_id is always derived from the authenticated session
 * - all input is runtime validated
 * - selected collaboration tags must exist and be active
 * - social URLs are platform-validated and normalized
 * - the public exploration map requires explicit creator opt-in
 * - disabling Creator Mode always disables the public map
 * - Creator Mode is enabled only after supporting data saves
 * - failures trigger a best-effort rollback
 * - public profile paths are revalidated after success
 */
export async function saveCreatorSettingsAction(
  input: unknown
): Promise<SaveCreatorSettingsResult> {
  const parsed = creatorSettingsSchema.safeParse(input)

  if (!parsed.success) {
    const flattened = flattenCreatorSchemaError(
      parsed.error
    )

    return {
      success: false,
      error:
        flattened.formErrors[0] ??
        'Some Creator Mode fields are invalid.',
      fieldErrors:
        mapSchemaFieldErrors(
          flattened.fieldErrors
        ),
    }
  }

  const values = parsed.data
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error(
      '[saveCreatorSettingsAction] Authentication lookup failed:',
      {
        code: authError.code,
        message: authError.message,
      }
    )

    return {
      success: false,
      error:
        'Your session could not be verified. Refresh the page and try again.',
    }
  }

  if (!user) {
    return {
      success: false,
      error: 'You must be signed in to manage Creator Mode.',
    }
  }

  const normalizedSocialLinksResult =
    normalizeSocialLinks(values)

  if (!normalizedSocialLinksResult.success) {
    return normalizedSocialLinksResult.result
  }

  const normalizedSocialLinks =
    normalizedSocialLinksResult.links

  const tagValidationResult =
    await validateCollaborationTagIds({
      supabase,
      tagIds:
        values.collaborationTagIds,
    })

  if (!tagValidationResult.success) {
    return tagValidationResult.result
  }

  const snapshotResult =
    await loadCreatorSettingsSnapshot({
      supabase,
      userId: user.id,
    })

  if (!snapshotResult.success) {
    return snapshotResult.result
  }

  const previousState = snapshotResult.snapshot
  const now = new Date().toISOString()

  /**
   * Defense in depth:
   *
   * The schema already rejects an enabled exploration map when
   * Creator Mode is disabled. This resolved value ensures the
   * database write still fails closed if that validation changes
   * or the action is refactored later.
   */
  const showPublicExplorationMap =
    values.creatorModeEnabled === true &&
    values.showPublicExplorationMap === true

  try {
    /**
     * When disabling Creator Mode, hide the public creator layer
     * and public exploration map before changing supporting rows.
     *
     * When enabling Creator Mode, keep the public creator layer
     * hidden until every supporting write has succeeded.
     */
    if (!values.creatorModeEnabled) {
      await updateBaseProfileOrThrow({
        supabase,
        userId: user.id,
        creatorModeEnabled: false,
        creatorHeadline:
          values.creatorHeadline,
        showPublicExplorationMap: false,
      })
    }

    await upsertCreatorProfileOrThrow({
      supabase,
      userId: user.id,
      values,
      updatedAt: now,
    })

    await replaceSocialLinksOrThrow({
      supabase,
      userId: user.id,
      links: normalizedSocialLinks,
      updatedAt: now,
    })

    await replaceCollaborationTagsOrThrow({
      supabase,
      userId: user.id,
      tagIds:
        tagValidationResult.tagIds,
    })

    /**
     * This final write exposes the completed creator profile and,
     * only when explicitly enabled, its public exploration map.
     *
     * It also updates the headline when Creator Mode was already
     * enabled.
     */
    await updateBaseProfileOrThrow({
      supabase,
      userId: user.id,
      creatorModeEnabled:
        values.creatorModeEnabled,
      creatorHeadline:
        values.creatorHeadline,
      showPublicExplorationMap,
    })
  } catch (error) {
    console.error(
      '[saveCreatorSettingsAction] Creator settings mutation failed:',
      {
        userId: user.id,
        error: serializeUnknownError(error),
      }
    )

    const rollbackSucceeded =
      await rollbackCreatorSettings({
        supabase,
        userId: user.id,
        snapshot: previousState,
      })

    if (!rollbackSucceeded) {
      console.error(
        '[saveCreatorSettingsAction] Creator settings rollback did not fully succeed:',
        {
          userId: user.id,
        }
      )

      return {
        success: false,
        error:
          'Creator Mode could not be saved and some settings may require review. Refresh the page before trying again.',
      }
    }

    return {
      success: false,
      error:
        'Creator Mode could not be saved. Your previous settings were restored.',
    }
  }

  revalidateCreatorPaths({
    username:
      previousState.baseProfile.username,
  })

  return {
    success: true,
    data: {
      creatorModeEnabled:
        values.creatorModeEnabled,
      showPublicExplorationMap,
      updatedAt: now,
    },
  }
}

/* =========================================================
 * Social-link validation and normalization
 * ======================================================= */

type NormalizeSocialLinksSuccess = {
  success: true
  links: Omit<
    NormalizedSocialLinkInsert,
    'user_id' | 'updated_at'
  >[]
}

type NormalizeSocialLinksFailure = {
  success: false
  result: SaveCreatorSettingsResult
}

function normalizeSocialLinks(
  values: CreatorSettingsInput
):
  | NormalizeSocialLinksSuccess
  | NormalizeSocialLinksFailure {
  const normalizedLinks: Omit<
    NormalizedSocialLinkInsert,
    'user_id' | 'updated_at'
  >[] = []

  for (
    let index = 0;
    index < values.socialLinks.length;
    index += 1
  ) {
    const link = values.socialLinks[index]

    const validation =
      validateCreatorSocialUrl({
        platform: link.platform,
        value: link.url,
      })

    if (!validation.valid) {
      return {
        success: false,
        result: {
          success: false,
          error: validation.error,
          fieldErrors: {
            socialLinks: [
              `Link ${index + 1}: ${validation.error}`,
            ],
          },
        },
      }
    }

    normalizedLinks.push({
      platform: link.platform,
      url: validation.normalizedUrl,
      handle: normalizeNullableText(
        link.handle
      ),
      sort_order: link.sort_order,
      is_public: link.is_public,
    })
  }

  return {
    success: true,
    links: normalizedLinks,
  }
}

/* =========================================================
 * Collaboration-tag validation
 * ======================================================= */

type TagValidationSuccess = {
  success: true
  tagIds: number[]
}

type TagValidationFailure = {
  success: false
  result: SaveCreatorSettingsResult
}

async function validateCollaborationTagIds({
  supabase,
  tagIds,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  tagIds: number[]
}): Promise<
  TagValidationSuccess | TagValidationFailure
> {
  const uniqueTagIds = [
    ...new Set(tagIds),
  ]

  if (uniqueTagIds.length === 0) {
    return {
      success: true,
      tagIds: [],
    }
  }

  const { data, error } = await supabase
    .from('collaboration_tags')
    .select('id')
    .in('id', uniqueTagIds)
    .eq('active', true)

  if (error) {
    console.error(
      '[saveCreatorSettingsAction] Failed to validate collaboration tags:',
      {
        code: error.code,
        message: error.message,
      }
    )

    return {
      success: false,
      result: {
        success: false,
        error:
          'Collaboration tags could not be validated. Please try again.',
      },
    }
  }

  const validTagIds = new Set(
    (data ?? [])
      .map((row) => row.id)
      .filter(
        (value): value is number =>
          typeof value === 'number' &&
          Number.isInteger(value)
      )
  )

  const invalidTagIds =
    uniqueTagIds.filter(
      (tagId) =>
        !validTagIds.has(tagId)
    )

  if (invalidTagIds.length > 0) {
    return {
      success: false,
      result: {
        success: false,
        error:
          'One or more selected collaboration tags are no longer available.',
        fieldErrors: {
          collaborationTagIds: [
            'Refresh the page and select active collaboration tags.',
          ],
        },
      },
    }
  }

  return {
    success: true,
    tagIds: uniqueTagIds,
  }
}

/* =========================================================
 * Existing-state snapshot
 * ======================================================= */

type SnapshotLoadSuccess = {
  success: true
  snapshot: CreatorSettingsSnapshot
}

type SnapshotLoadFailure = {
  success: false
  result: SaveCreatorSettingsResult
}

async function loadCreatorSettingsSnapshot({
  supabase,
  userId,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
}): Promise<
  SnapshotLoadSuccess | SnapshotLoadFailure
> {
  const [
    baseProfileResult,
    creatorProfileResult,
    socialLinksResult,
    tagsResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id,
        username,
        creator_mode_enabled,
        creator_headline,
        show_public_exploration_map
      `)
      .eq('id', userId)
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
      .eq('user_id', userId)
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
      .eq('user_id', userId)
      .order('sort_order', {
        ascending: true,
      }),

    supabase
      .from('creator_collaboration_tags')
      .select('tag_id')
      .eq('user_id', userId),
  ])

  const firstError =
    baseProfileResult.error ??
    creatorProfileResult.error ??
    socialLinksResult.error ??
    tagsResult.error

  if (firstError) {
    console.error(
      '[saveCreatorSettingsAction] Failed to snapshot existing settings:',
      {
        code: firstError.code,
        message: firstError.message,
      }
    )

    return {
      success: false,
      result: {
        success: false,
        error:
          'Your existing Creator Mode settings could not be loaded. No changes were made.',
      },
    }
  }

  if (!baseProfileResult.data) {
    return {
      success: false,
      result: {
        success: false,
        error:
          'Your base profile could not be found. Complete your profile setup before enabling Creator Mode.',
      },
    }
  }

  const baseProfileData =
    baseProfileResult.data as Record<
      string,
      unknown
    >

  const existingBaseProfile: ExistingBaseProfile = {
    id:
      typeof baseProfileData.id === 'string'
        ? baseProfileData.id
        : userId,

    username:
      typeof baseProfileData.username === 'string'
        ? baseProfileData.username
        : null,

    creator_mode_enabled:
      baseProfileData.creator_mode_enabled === true,

    creator_headline:
      typeof baseProfileData.creator_headline === 'string'
        ? baseProfileData.creator_headline
        : null,

    /**
     * Fail closed when reading the rollback snapshot.
     *
     * A null, missing, or malformed value must never be restored
     * as public.
     */
    show_public_exploration_map:
      baseProfileData.show_public_exploration_map === true,
  }

  const socialLinks = (
    socialLinksResult.data ?? []
  ) as CreatorSocialLink[]

  const collaborationTagIds = (
    tagsResult.data ?? []
  )
    .map(
      (
        row: ExistingCreatorTagSelection
      ) => row.tag_id
    )
    .filter(
      (tagId): tagId is number =>
        typeof tagId === 'number' &&
        Number.isInteger(tagId)
    )

  return {
    success: true,
    snapshot: {
      baseProfile:
        existingBaseProfile,

      creatorProfile:
        creatorProfileResult.data as
          | CreatorProfile
          | null,

      socialLinks,

      collaborationTagIds,
    },
  }
}

/* =========================================================
 * Database mutation helpers
 * ======================================================= */

async function updateBaseProfileOrThrow({
  supabase,
  userId,
  creatorModeEnabled,
  creatorHeadline,
  showPublicExplorationMap,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
  creatorModeEnabled: boolean
  creatorHeadline: string | null
  showPublicExplorationMap: boolean
}): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      creator_mode_enabled:
        creatorModeEnabled,
      creator_headline:
        normalizeNullableText(
          creatorHeadline
        ),
      show_public_exploration_map:
        creatorModeEnabled === true &&
        showPublicExplorationMap === true,
    })
    .eq('id', userId)

  if (error) {
    throw new CreatorSettingsMutationError({
      operation: 'update_base_profile',
      error,
    })
  }
}

async function upsertCreatorProfileOrThrow({
  supabase,
  userId,
  values,
  updatedAt,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
  values: CreatorSettingsInput
  updatedAt: string
}): Promise<void> {
  const { error } = await supabase
    .from('creator_profiles')
    .upsert(
      {
        user_id: userId,

        creator_bio:
          normalizeNullableText(
            values.creatorBio
          ),

        primary_city:
          normalizeNullableText(
            values.primaryCity
          ),

        available_for_travel:
          values.availableForTravel,

        accepting_collaborations:
          values.acceptingCollaborations,

        public_email:
          normalizeEmail(
            values.publicEmail
          ),

        updated_at: updatedAt,
      },
      {
        onConflict: 'user_id',
      }
    )

  if (error) {
    throw new CreatorSettingsMutationError({
      operation: 'upsert_creator_profile',
      error,
    })
  }
}

async function replaceSocialLinksOrThrow({
  supabase,
  userId,
  links,
  updatedAt,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
  links: Omit<
    NormalizedSocialLinkInsert,
    'user_id' | 'updated_at'
  >[]
  updatedAt: string
}): Promise<void> {
  const { error: deleteError } =
    await supabase
      .from('creator_social_links')
      .delete()
      .eq('user_id', userId)

  if (deleteError) {
    throw new CreatorSettingsMutationError({
      operation: 'delete_existing_social_links',
      error: deleteError,
    })
  }

  if (links.length === 0) {
    return
  }

  const rows: NormalizedSocialLinkInsert[] =
    links.map((link) => ({
      user_id: userId,
      platform: link.platform,
      url: link.url,
      handle: link.handle,
      sort_order: link.sort_order,
      is_public: link.is_public,
      updated_at: updatedAt,
    }))

  const { error: insertError } =
    await supabase
      .from('creator_social_links')
      .insert(rows)

  if (insertError) {
    throw new CreatorSettingsMutationError({
      operation: 'insert_social_links',
      error: insertError,
    })
  }
}

async function replaceCollaborationTagsOrThrow({
  supabase,
  userId,
  tagIds,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
  tagIds: number[]
}): Promise<void> {
  const { error: deleteError } =
    await supabase
      .from('creator_collaboration_tags')
      .delete()
      .eq('user_id', userId)

  if (deleteError) {
    throw new CreatorSettingsMutationError({
      operation:
        'delete_existing_collaboration_tags',
      error: deleteError,
    })
  }

  if (tagIds.length === 0) {
    return
  }

  const { error: insertError } =
    await supabase
      .from('creator_collaboration_tags')
      .insert(
        tagIds.map((tagId) => ({
          user_id: userId,
          tag_id: tagId,
        }))
      )

  if (insertError) {
    throw new CreatorSettingsMutationError({
      operation:
        'insert_collaboration_tags',
      error: insertError,
    })
  }
}

/* =========================================================
 * Best-effort rollback
 * ======================================================= */

async function rollbackCreatorSettings({
  supabase,
  userId,
  snapshot,
}: {
  supabase: Awaited<
    ReturnType<typeof createServerClient>
  >
  userId: string
  snapshot: CreatorSettingsSnapshot
}): Promise<boolean> {
  const rollbackErrors: unknown[] = []

  const capture = async (
    operation: () => PromiseLike<{
      error: unknown
    }>
  ) => {
    try {
      const result = await operation()

      if (result.error) {
        rollbackErrors.push(
          result.error
        )
      }
    } catch (error) {
      rollbackErrors.push(error)
    }
  }

  await capture(() =>
    supabase
      .from('profiles')
      .update({
        creator_mode_enabled:
          snapshot.baseProfile
            .creator_mode_enabled === true,

        creator_headline:
          snapshot.baseProfile
            .creator_headline,

        /**
         * Restore the exact prior public state, while failing
         * closed for null or malformed historical values.
         */
        show_public_exploration_map:
          snapshot.baseProfile
            .creator_mode_enabled === true &&
          snapshot.baseProfile
            .show_public_exploration_map === true,
      })
      .eq('id', userId)
  )

  if (snapshot.creatorProfile) {
    await capture(() =>
      supabase
        .from('creator_profiles')
        .upsert(
          {
            user_id:
              snapshot.creatorProfile!
                .user_id,

            creator_bio:
              snapshot.creatorProfile!
                .creator_bio,

            primary_city:
              snapshot.creatorProfile!
                .primary_city,

            available_for_travel:
              snapshot.creatorProfile!
                .available_for_travel,

            accepting_collaborations:
              snapshot.creatorProfile!
                .accepting_collaborations,

            public_email:
              snapshot.creatorProfile!
                .public_email,

            created_at:
              snapshot.creatorProfile!
                .created_at,

            updated_at:
              snapshot.creatorProfile!
                .updated_at,
          },
          {
            onConflict: 'user_id',
          }
        )
    )
  } else {
    await capture(() =>
      supabase
        .from('creator_profiles')
        .delete()
        .eq('user_id', userId)
    )
  }

  await capture(() =>
    supabase
      .from('creator_social_links')
      .delete()
      .eq('user_id', userId)
  )

  if (snapshot.socialLinks.length > 0) {
    await capture(() =>
      supabase
        .from('creator_social_links')
        .insert(
          snapshot.socialLinks.map(
            (link) => ({
              id: link.id,
              user_id: link.user_id,
              platform: link.platform,
              url: link.url,
              handle: link.handle,
              sort_order:
                link.sort_order,
              is_public:
                link.is_public,
              created_at:
                link.created_at,
              updated_at:
                link.updated_at,
            })
          )
        )
    )
  }

  await capture(() =>
    supabase
      .from('creator_collaboration_tags')
      .delete()
      .eq('user_id', userId)
  )

  if (
    snapshot.collaborationTagIds
      .length > 0
  ) {
    await capture(() =>
      supabase
        .from(
          'creator_collaboration_tags'
        )
        .insert(
          snapshot.collaborationTagIds.map(
            (tagId) => ({
              user_id: userId,
              tag_id: tagId,
            })
          )
        )
    )
  }

  if (rollbackErrors.length > 0) {
    console.error(
      '[saveCreatorSettingsAction] Rollback errors:',
      rollbackErrors.map(
        serializeUnknownError
      )
    )
  }

  return rollbackErrors.length === 0
}

/* =========================================================
 * Revalidation
 * ======================================================= */

function revalidateCreatorPaths({
  username,
}: {
  username: string | null
}): void {
  revalidatePath('/profile')
  revalidatePath('/profile/creator')
  revalidatePath(
    '/profile/creator/collections'
  )

  const normalizedUsername =
    normalizeNullableText(username)

  if (normalizedUsername) {
    revalidatePath(
      `/u/${encodeURIComponent(
        normalizedUsername
      )}`
    )
  }
}

/* =========================================================
 * Schema error mapping
 * ======================================================= */

function mapSchemaFieldErrors(
  errors: Record<string, string[]>
): CreatorActionFieldErrors {
  const mapped: CreatorActionFieldErrors = {}

  for (
    const [path, messages] of
    Object.entries(errors)
  ) {
    const rootField = path.split('.')[0]

    switch (rootField) {
      case 'creatorModeEnabled':
      case 'showPublicExplorationMap':
      case 'creatorHeadline':
      case 'creatorBio':
      case 'primaryCity':
      case 'availableForTravel':
      case 'acceptingCollaborations':
      case 'publicEmail':
      case 'socialLinks':
      case 'collaborationTagIds': {
        const field =
          rootField as keyof CreatorActionFieldErrors

        mapped[field] = [
          ...new Set([
            ...(mapped[field] ?? []),
            ...messages,
          ]),
        ]

        break
      }

      default:
        break
    }
  }

  return mapped
}

/* =========================================================
 * Normalization helpers
 * ======================================================= */

function normalizeNullableText(
  value: string | null | undefined
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

function normalizeEmail(
  value: string | null | undefined
): string | null {
  const normalized =
    normalizeNullableText(value)

  return normalized
    ? normalized.toLowerCase()
    : null
}

/* =========================================================
 * Internal errors
 * ======================================================= */

class CreatorSettingsMutationError extends Error {
  readonly operation: string
  readonly databaseError: unknown

  constructor({
    operation,
    error,
  }: {
    operation: string
    error: unknown
  }) {
    super(
      `Creator settings mutation failed during ${operation}.`
    )

    this.name =
      'CreatorSettingsMutationError'

    this.operation = operation
    this.databaseError = error
  }
}

function serializeUnknownError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof
    CreatorSettingsMutationError
  ) {
    return {
      name: error.name,
      message: error.message,
      operation: error.operation,
      databaseError:
        serializeUnknownError(
          error.databaseError
        ),
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const record =
      error as Record<
        string,
        unknown
      >

    return {
      code: record.code,
      message: record.message,
      details: record.details,
      hint: record.hint,
    }
  }

  return {
    value: String(error),
  }
}