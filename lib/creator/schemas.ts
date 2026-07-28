import { z } from 'zod'

import {
  BLOCKED_PUBLIC_WEBSITE_HOSTS,
  CREATOR_FIELD_LIMITS,
  CREATOR_SOCIAL_PLATFORM_DEFINITIONS,
  hostnameMatchesAllowedHost,
} from './constants'

import {
  COLLABORATION_TAG_CATEGORIES,
  CREATOR_COLLECTION_SOURCE_TYPES,
  CREATOR_COLLECTION_VISIBILITIES,
  CREATOR_SOCIAL_PLATFORMS,
  type CreatorCollectionInput,
  type CreatorCollectionItemInput,
  type CreatorProfileInput,
  type CreatorSettingsInput,
  type CreatorSocialLinkInput,
} from './types'

/* =========================================================
 * Shared normalization helpers
 * ======================================================= */

function normalizeNullableString(
  value: unknown
): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function normalizeRequiredString(
  value: unknown
): unknown {
  if (typeof value !== 'string') {
    return value
  }

  return value.trim()
}

function normalizeUrlString(
  value: unknown
): unknown {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}

function normalizeHandle(
  value: unknown
): unknown {
  const normalized = normalizeNullableString(value)

  if (typeof normalized !== 'string') {
    return normalized
  }

  return normalized.replace(/^@+/, '')
}

function normalizeSlug(
  value: unknown
): unknown {
  if (typeof value !== 'string') {
    return value
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function normalizeInteger(
  value: unknown
): unknown {
  if (
    typeof value === 'string' &&
    value.trim().length > 0
  ) {
    const parsed = Number(value)

    return Number.isFinite(parsed)
      ? parsed
      : value
  }

  return value
}

function normalizeBoolean(
  value: unknown
): unknown {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase()

    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'on' ||
      normalized === 'yes'
    ) {
      return true
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'off' ||
      normalized === 'no'
    ) {
      return false
    }
  }

  if (value === 1) {
    return true
  }

  if (value === 0) {
    return false
  }

  return value
}

/* =========================================================
 * URL security helpers
 * ======================================================= */

function parseHttpUrl(
  value: string
): URL | null {
  try {
    const url = new URL(value)

    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

function isBlockedPublicHostname(
  hostname: string
): boolean {
  const normalizedHostname = hostname
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')

  if (
    BLOCKED_PUBLIC_WEBSITE_HOSTS.some(
      (blockedHost) =>
        hostnameMatchesAllowedHost(
          normalizedHostname,
          blockedHost
        )
    )
  ) {
    return true
  }

  if (
    normalizedHostname.endsWith('.local') ||
    normalizedHostname.endsWith('.localhost')
  ) {
    return true
  }

  /*
   * Reject common private IPv4 ranges.
   *
   * This is not intended to replace network-layer SSRF
   * protection. It prevents clearly private or local URLs
   * from being published as creator links.
   */
  if (
    /^10\./.test(normalizedHostname) ||
    /^127\./.test(normalizedHostname) ||
    /^169\.254\./.test(normalizedHostname) ||
    /^192\.168\./.test(normalizedHostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      normalizedHostname
    )
  ) {
    return true
  }

  return false
}

function validatePublicHttpUrl({
  value,
  context,
  allowAnyPublicHost,
  allowedHosts,
}: {
  value: string
  context: z.RefinementCtx
  allowAnyPublicHost: boolean
  allowedHosts?: readonly string[]
}): void {
  const url = parseHttpUrl(value)

  if (!url) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Enter a valid URL beginning with https:// or http://.',
    })

    return
  }

  if (url.username || url.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'URLs containing usernames or passwords are not allowed.',
    })
  }

  if (isBlockedPublicHostname(url.hostname)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Local and private-network URLs are not allowed.',
    })
  }

  if (
    !allowAnyPublicHost &&
    allowedHosts &&
    !allowedHosts.some((allowedHost) =>
      hostnameMatchesAllowedHost(
        url.hostname,
        allowedHost
      )
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'The URL does not match the selected social platform.',
    })
  }
}

/* =========================================================
 * Primitive schemas
 * ======================================================= */

export const creatorSocialPlatformSchema =
  z.enum(CREATOR_SOCIAL_PLATFORMS)

export const collaborationTagCategorySchema =
  z.enum(COLLABORATION_TAG_CATEGORIES)

export const creatorCollectionVisibilitySchema =
  z.enum(CREATOR_COLLECTION_VISIBILITIES)

export const creatorCollectionSourceTypeSchema =
  z.enum(CREATOR_COLLECTION_SOURCE_TYPES)

export const creatorBooleanSchema =
  z.preprocess(
    normalizeBoolean,
    z.boolean()
  )

export const creatorNonNegativeIntegerSchema =
  z.preprocess(
    normalizeInteger,
    z
      .number()
      .int('Must be a whole number.')
      .min(0, 'Must be zero or greater.')
  )

export const creatorPositiveIntegerSchema =
  z.preprocess(
    normalizeInteger,
    z
      .number()
      .int('Must be a whole number.')
      .positive('Must be greater than zero.')
  )

export const creatorUuidSchema = z
  .string()
  .trim()
  .uuid('Invalid identifier.')

export const optionalCreatorUuidSchema =
  z.preprocess(
    normalizeNullableString,
    creatorUuidSchema.nullable()
  )

/* =========================================================
 * Reusable text schemas
 * ======================================================= */

function nullableTextSchema({
  maximum,
  fieldLabel,
}: {
  maximum: number
  fieldLabel: string
}) {
  return z.preprocess(
    normalizeNullableString,
    z
      .string()
      .max(
        maximum,
        `${fieldLabel} must be ${maximum} characters or fewer.`
      )
      .nullable()
  )
}

function requiredTextSchema({
  minimum = 1,
  maximum,
  fieldLabel,
}: {
  minimum?: number
  maximum: number
  fieldLabel: string
}) {
  return z.preprocess(
    normalizeRequiredString,
    z
      .string()
      .min(
        minimum,
        `${fieldLabel} is required.`
      )
      .max(
        maximum,
        `${fieldLabel} must be ${maximum} characters or fewer.`
      )
  )
}

export const creatorHeadlineSchema =
  nullableTextSchema({
    maximum: CREATOR_FIELD_LIMITS.headline,
    fieldLabel: 'Creator headline',
  })

export const creatorBioSchema =
  nullableTextSchema({
    maximum: CREATOR_FIELD_LIMITS.bio,
    fieldLabel: 'Creator bio',
  })

export const creatorPrimaryCitySchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.primaryCity,
    fieldLabel: 'Primary city',
  })

export const creatorPublicEmailSchema =
  z.preprocess(
    normalizeNullableString,
    z
      .string()
      .email('Enter a valid public email address.')
      .max(
        CREATOR_FIELD_LIMITS.publicEmail,
        `Public email must be ${CREATOR_FIELD_LIMITS.publicEmail} characters or fewer.`
      )
      .nullable()
  )

export const creatorSocialHandleSchema =
  z.preprocess(
    normalizeHandle,
    z
      .string()
      .max(
        CREATOR_FIELD_LIMITS.socialHandle,
        `Social handle must be ${CREATOR_FIELD_LIMITS.socialHandle} characters or fewer.`
      )
      .regex(
        /^[^\s/?#]+$/,
        'Social handles cannot contain spaces, slashes, query strings, or fragments.'
      )
      .nullable()
  )

export const creatorCollectionTitleSchema =
  requiredTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionTitle,
    fieldLabel: 'Collection title',
  })

export const creatorCollectionDescriptionSchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionDescription,
    fieldLabel: 'Collection description',
  })

export const creatorCollectionCitySchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionCity,
    fieldLabel: 'Collection city',
  })

export const creatorCollectionCategorySchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionCategory,
    fieldLabel: 'Collection category',
  })

export const creatorCollectionItemTitleSchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionItemTitle,
    fieldLabel: 'Collection item title',
  })

export const creatorCollectionItemNoteSchema =
  nullableTextSchema({
    maximum:
      CREATOR_FIELD_LIMITS.collectionItemNote,
    fieldLabel: 'Creator note',
  })

/* =========================================================
 * Slug schemas
 * ======================================================= */

export const creatorCollectionSlugSchema =
  z.preprocess(
    normalizeSlug,
    z
      .string()
      .min(1, 'Collection slug is required.')
      .max(
        CREATOR_FIELD_LIMITS.collectionSlug,
        `Collection slug must be ${CREATOR_FIELD_LIMITS.collectionSlug} characters or fewer.`
      )
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use lowercase letters, numbers, and single hyphens only.'
      )
  )

export const creatorUsernameSchema =
  z.preprocess(
    normalizeRequiredString,
    z
      .string()
      .min(1, 'Username is required.')
      .max(100, 'Username is too long.')
  )

/* =========================================================
 * Generic public URL schemas
 * ======================================================= */

export const requiredPublicUrlSchema =
  z.preprocess(
    normalizeRequiredString,
    z
      .string()
      .max(
        CREATOR_FIELD_LIMITS.socialUrl,
        `URL must be ${CREATOR_FIELD_LIMITS.socialUrl} characters or fewer.`
      )
      .url('Enter a valid URL.')
      .superRefine((value, context) => {
        validatePublicHttpUrl({
          value,
          context,
          allowAnyPublicHost: true,
        })
      })
  )

export const nullablePublicUrlSchema =
  z.preprocess(
    normalizeUrlString,
    z
      .string()
      .max(
        CREATOR_FIELD_LIMITS.socialUrl,
        `URL must be ${CREATOR_FIELD_LIMITS.socialUrl} characters or fewer.`
      )
      .url('Enter a valid URL.')
      .superRefine((value, context) => {
        validatePublicHttpUrl({
          value,
          context,
          allowAnyPublicHost: true,
        })
      })
      .nullable()
  )

export const creatorCollectionCoverImageUrlSchema =
  z.preprocess(
    normalizeUrlString,
    z
      .string()
      .max(
        CREATOR_FIELD_LIMITS.collectionCoverImageUrl,
        `Cover image URL must be ${CREATOR_FIELD_LIMITS.collectionCoverImageUrl} characters or fewer.`
      )
      .url('Enter a valid cover image URL.')
      .superRefine((value, context) => {
        validatePublicHttpUrl({
          value,
          context,
          allowAnyPublicHost: true,
        })
      })
      .nullable()
  )

export const creatorCollectionItemImageUrlSchema =
  z.preprocess(
    normalizeUrlString,
    z
      .string()
      .max(
        CREATOR_FIELD_LIMITS.collectionItemImageUrl,
        `Image URL must be ${CREATOR_FIELD_LIMITS.collectionItemImageUrl} characters or fewer.`
      )
      .url('Enter a valid image URL.')
      .superRefine((value, context) => {
        validatePublicHttpUrl({
          value,
          context,
          allowAnyPublicHost: true,
        })
      })
      .nullable()
  )

/* =========================================================
 * Creator profile schemas
 * ======================================================= */

export const creatorProfileInputSchema = z
  .object({
    creator_bio: creatorBioSchema,
    primary_city: creatorPrimaryCitySchema,
    available_for_travel:
      creatorBooleanSchema,
    accepting_collaborations:
      creatorBooleanSchema,
    public_email: creatorPublicEmailSchema,
  })
  .strict() satisfies z.ZodType<CreatorProfileInput>

export const creatorProfileRowSchema = z
  .object({
    user_id: creatorUuidSchema,
    creator_bio: creatorBioSchema,
    primary_city: creatorPrimaryCitySchema,
    available_for_travel: z.boolean(),
    accepting_collaborations: z.boolean(),
    public_email: creatorPublicEmailSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

/* =========================================================
 * Social-link schemas
 * ======================================================= */

export const creatorSocialLinkInputSchema = z
  .object({
    id: creatorUuidSchema.optional(),

    platform:
      creatorSocialPlatformSchema,

    url: z.preprocess(
      normalizeRequiredString,
      z
        .string()
        .max(
          CREATOR_FIELD_LIMITS.socialUrl,
          `Social URL must be ${CREATOR_FIELD_LIMITS.socialUrl} characters or fewer.`
        )
        .url('Enter a valid social URL.')
    ),

    handle:
      creatorSocialHandleSchema,

    sort_order:
      creatorNonNegativeIntegerSchema,

    is_public:
      creatorBooleanSchema,
  })
  .strict()
  .superRefine((link, context) => {
    const definition =
      CREATOR_SOCIAL_PLATFORM_DEFINITIONS[
        link.platform
      ]

    validatePublicHttpUrl({
      value: link.url,
      context,
      allowAnyPublicHost:
        definition.isGeneralWebsite,
      allowedHosts: definition.allowedHosts,
    })

    if (
      !definition.supportsHandle &&
      link.handle !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['handle'],
        message:
          `${definition.label} does not use a social handle.`,
      })
    }
  }) satisfies z.ZodType<CreatorSocialLinkInput>

export const creatorSocialLinkRowSchema = z
  .object({
    id: creatorUuidSchema,
    user_id: creatorUuidSchema,
    platform:
      creatorSocialPlatformSchema,
    url: requiredPublicUrlSchema,
    handle:
      creatorSocialHandleSchema,
    sort_order:
      creatorNonNegativeIntegerSchema,
    is_public: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

/* =========================================================
 * Collaboration-tag schemas
 * ======================================================= */

export const collaborationTagIdSchema =
  creatorPositiveIntegerSchema

export const collaborationTagSchema = z
  .object({
    id: collaborationTagIdSchema,
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Invalid collaboration-tag slug.'
      ),
    label: z
      .string()
      .trim()
      .min(1)
      .max(120),
    category:
      collaborationTagCategorySchema,
    active: z.boolean(),
    sort_order:
      creatorNonNegativeIntegerSchema,
    created_at: z.string(),
  })
  .strict()

export const collaborationTagSelectionSchema =
  z
    .array(collaborationTagIdSchema)
    .max(
      CREATOR_FIELD_LIMITS.collaborationTagsPerCreator,
      `Select no more than ${CREATOR_FIELD_LIMITS.collaborationTagsPerCreator} collaboration tags.`
    )
    .transform((tagIds) => [
      ...new Set(tagIds),
    ])

/* =========================================================
 * Complete Creator Mode settings schema
 * ======================================================= */

export const creatorSettingsSchema = z
  .object({
    creatorModeEnabled:
      creatorBooleanSchema,

    showPublicExplorationMap:
      creatorBooleanSchema,

    creatorHeadline:
      creatorHeadlineSchema,

    creatorBio:
      creatorBioSchema,

    primaryCity:
      creatorPrimaryCitySchema,

    availableForTravel:
      creatorBooleanSchema,

    acceptingCollaborations:
      creatorBooleanSchema,

    publicEmail:
      creatorPublicEmailSchema,

    socialLinks: z
      .array(
        creatorSocialLinkInputSchema
      )
      .max(
        CREATOR_FIELD_LIMITS.socialLinksPerCreator,
        `Add no more than ${CREATOR_FIELD_LIMITS.socialLinksPerCreator} social links.`
      ),

    collaborationTagIds:
      collaborationTagSelectionSchema,
  })
  .strict()
  .superRefine((settings, context) => {
    const duplicatePlatforms = new Set<string>()
    const seenPlatforms = new Set<string>()
    const seenUrls = new Set<string>()

    settings.socialLinks.forEach(
      (link, index) => {
        const normalizedUrl =
          normalizeComparableUrl(link.url)

        if (seenPlatforms.has(link.platform)) {
          duplicatePlatforms.add(
            link.platform
          )
        } else {
          seenPlatforms.add(link.platform)
        }

        if (seenUrls.has(normalizedUrl)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['socialLinks', index, 'url'],
            message:
              'This social URL has already been added.',
          })
        } else {
          seenUrls.add(normalizedUrl)
        }
      }
    )

    settings.socialLinks.forEach(
      (link, index) => {
        if (
          duplicatePlatforms.has(
            link.platform
          )
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              'socialLinks',
              index,
              'platform',
            ],
            message:
              'Only one link per social platform is allowed.',
          })
        }
      }
    )

    if (
      settings.showPublicExplorationMap &&
      !settings.creatorModeEnabled
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['showPublicExplorationMap'],
        message:
          'Enable Creator Mode before publishing your exploration map.',
      })
    }

    if (!settings.creatorModeEnabled) {
      return
    }

    if (!settings.creatorHeadline) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['creatorHeadline'],
        message:
          'Add a creator headline before enabling Creator Mode.',
      })
    }

    if (
      settings.socialLinks.filter(
        (link) => link.is_public
      ).length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['socialLinks'],
        message:
          'Add at least one public social link before enabling Creator Mode.',
      })
    }

    if (
      settings.collaborationTagIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['collaborationTagIds'],
        message:
          'Select at least one collaboration tag before enabling Creator Mode.',
      })
    }
  }) satisfies z.ZodType<CreatorSettingsInput>

/* =========================================================
 * Creator collection schemas
 * ======================================================= */

export const creatorCollectionInputSchema = z
  .object({
    id: creatorUuidSchema.optional(),

    title:
      creatorCollectionTitleSchema,

    slug:
      creatorCollectionSlugSchema,

    description:
      creatorCollectionDescriptionSchema,

    cover_image_url:
      creatorCollectionCoverImageUrlSchema,

    city:
      creatorCollectionCitySchema,

    category:
      creatorCollectionCategorySchema,

    visibility:
      creatorCollectionVisibilitySchema,

    featured:
      creatorBooleanSchema,

    sort_order:
      creatorNonNegativeIntegerSchema,
  })
  .strict() satisfies z.ZodType<CreatorCollectionInput>

export const creatorCollectionRowSchema = z
  .object({
    id: creatorUuidSchema,
    user_id: creatorUuidSchema,
    title:
      creatorCollectionTitleSchema,
    slug:
      creatorCollectionSlugSchema,
    description:
      creatorCollectionDescriptionSchema,
    cover_image_url:
      creatorCollectionCoverImageUrlSchema,
    city:
      creatorCollectionCitySchema,
    category:
      creatorCollectionCategorySchema,
    visibility:
      creatorCollectionVisibilitySchema,
    featured: z.boolean(),
    sort_order:
      creatorNonNegativeIntegerSchema,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

/* =========================================================
 * Creator collection-item schemas
 * ======================================================= */

export const creatorCollectionSourceIdSchema =
  requiredTextSchema({
    maximum: 500,
    fieldLabel: 'Source identifier',
  })

export const creatorCollectionItemInputSchema =
  z
    .object({
      id: creatorUuidSchema.optional(),

      collection_id:
        creatorUuidSchema.optional(),

      source_type:
        creatorCollectionSourceTypeSchema,

      source_id:
        creatorCollectionSourceIdSchema,

      custom_title:
        creatorCollectionItemTitleSchema,

      creator_note:
        creatorCollectionItemNoteSchema,

      image_url:
        creatorCollectionItemImageUrlSchema,

      sort_order:
        creatorNonNegativeIntegerSchema,
    })
    .strict() satisfies z.ZodType<CreatorCollectionItemInput>

export const creatorCollectionItemRowSchema =
  z
    .object({
      id: creatorUuidSchema,
      collection_id: creatorUuidSchema,
      source_type:
        creatorCollectionSourceTypeSchema,
      source_id:
        creatorCollectionSourceIdSchema,
      custom_title:
        creatorCollectionItemTitleSchema,
      creator_note:
        creatorCollectionItemNoteSchema,
      image_url:
        creatorCollectionItemImageUrlSchema,
      sort_order:
        creatorNonNegativeIntegerSchema,
      created_at: z.string(),
    })
    .strict()

export const creatorCollectionItemsInputSchema =
  z
    .array(creatorCollectionItemInputSchema)
    .max(
      CREATOR_FIELD_LIMITS.collectionItemsPerCollection,
      `A collection can contain no more than ${CREATOR_FIELD_LIMITS.collectionItemsPerCollection} items.`
    )
    .superRefine((items, context) => {
      const seenSources = new Set<string>()

      items.forEach((item, index) => {
        const sourceKey =
          `${item.source_type}:${item.source_id}`

        if (seenSources.has(sourceKey)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'source_id'],
            message:
              'This item is already in the collection.',
          })

          return
        }

        seenSources.add(sourceKey)
      })
    })

/* =========================================================
 * Collection action schemas
 * ======================================================= */

export const createCreatorCollectionSchema =
  creatorCollectionInputSchema.omit({
    id: true,
  })

export const updateCreatorCollectionSchema =
  creatorCollectionInputSchema.extend({
    id: creatorUuidSchema,
  })

export const deleteCreatorCollectionSchema =
  z
    .object({
      collectionId:
        creatorUuidSchema,
    })
    .strict()

export const setCreatorCollectionFeaturedSchema =
  z
    .object({
      collectionId:
        creatorUuidSchema,
      featured:
        creatorBooleanSchema,
    })
    .strict()

export const addCreatorCollectionItemSchema =
  creatorCollectionItemInputSchema
    .omit({
      id: true,
    })
    .extend({
      collection_id:
        creatorUuidSchema,
    })

export const updateCreatorCollectionItemSchema =
  creatorCollectionItemInputSchema
    .extend({
      id: creatorUuidSchema,
      collection_id:
        creatorUuidSchema,
    })

export const removeCreatorCollectionItemSchema =
  z
    .object({
      collectionId:
        creatorUuidSchema,
      itemId:
        creatorUuidSchema,
    })
    .strict()

export const reorderCreatorCollectionItemsSchema =
  z
    .object({
      collectionId:
        creatorUuidSchema,

      itemIds: z
        .array(creatorUuidSchema)
        .max(
          CREATOR_FIELD_LIMITS.collectionItemsPerCollection,
          `A collection can contain no more than ${CREATOR_FIELD_LIMITS.collectionItemsPerCollection} items.`
        )
        .refine(
          (itemIds) =>
            new Set(itemIds).size ===
            itemIds.length,
          'Collection item identifiers must be unique.'
        ),
    })
    .strict()

export const reorderCreatorCollectionsSchema =
  z
    .object({
      collectionIds: z
        .array(creatorUuidSchema)
        .max(
          250,
          'Too many collections were supplied.'
        )
        .refine(
          (collectionIds) =>
            new Set(collectionIds).size ===
            collectionIds.length,
          'Collection identifiers must be unique.'
        ),
    })
    .strict()

/* =========================================================
 * Public route parameter schemas
 * ======================================================= */

export const publicCreatorProfileParamsSchema =
  z
    .object({
      username:
        creatorUsernameSchema,
    })
    .strict()

export const publicCreatorCollectionParamsSchema =
  z
    .object({
      username:
        creatorUsernameSchema,
      slug:
        creatorCollectionSlugSchema,
    })
    .strict()

export const creatorCollectionEditorParamsSchema =
  z
    .object({
      collectionId:
        creatorUuidSchema,
    })
    .strict()

/* =========================================================
 * Analytics schemas
 * ======================================================= */

export const creatorAnalyticsMetadataSchema =
  z
    .object({
      creatorUserId:
        creatorUuidSchema,

      viewerUserId:
        creatorUuidSchema.nullable().optional(),

      username: z
        .string()
        .trim()
        .max(100)
        .nullable()
        .optional(),

      platform:
        creatorSocialPlatformSchema.optional(),

      collectionId:
        creatorUuidSchema.optional(),

      collectionItemId:
        creatorUuidSchema.optional(),

      sourceType:
        creatorCollectionSourceTypeSchema.optional(),

      sourceId: z
        .string()
        .trim()
        .max(500)
        .optional(),

      city: z
        .string()
        .trim()
        .max(100)
        .nullable()
        .optional(),

      source: z
        .string()
        .trim()
        .max(100)
        .nullable()
        .optional(),
    })
    .strict()

/* =========================================================
 * Inferred schema types
 *
 * Use these when a type must reflect the exact normalized
 * schema output.
 * ======================================================= */

export type CreatorSettingsSchemaInput =
  z.input<typeof creatorSettingsSchema>

export type CreatorSettingsSchemaOutput =
  z.output<typeof creatorSettingsSchema>

export type CreatorSocialLinkSchemaInput =
  z.input<typeof creatorSocialLinkInputSchema>

export type CreatorSocialLinkSchemaOutput =
  z.output<typeof creatorSocialLinkInputSchema>

export type CreatorCollectionSchemaInput =
  z.input<typeof creatorCollectionInputSchema>

export type CreatorCollectionSchemaOutput =
  z.output<typeof creatorCollectionInputSchema>

export type CreatorCollectionItemSchemaInput =
  z.input<typeof creatorCollectionItemInputSchema>

export type CreatorCollectionItemSchemaOutput =
  z.output<typeof creatorCollectionItemInputSchema>

/* =========================================================
 * Error helpers
 * ======================================================= */

export type FlattenedCreatorSchemaErrors = {
  formErrors: string[]
  fieldErrors: Record<string, string[]>
}

export function flattenCreatorSchemaError(
  error: z.ZodError
): FlattenedCreatorSchemaErrors {
  const fieldErrors: Record<string, string[]> = {}
  const formErrors: string[] = []

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      formErrors.push(issue.message)
      continue
    }

    const path = issue.path
      .map(String)
      .join('.')

    fieldErrors[path] ??= []
    fieldErrors[path].push(issue.message)
  }

  return {
    formErrors: [...new Set(formErrors)],
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).map(
        ([path, messages]) => [
          path,
          [...new Set(messages)],
        ]
      )
    ),
  }
}

export function getFirstCreatorSchemaError(
  error: z.ZodError,
  fallback = 'Some Creator Mode fields are invalid.'
): string {
  return error.issues[0]?.message ?? fallback
}

/* =========================================================
 * Internal utilities
 * ======================================================= */

function normalizeComparableUrl(
  value: string
): string {
  try {
    const url = new URL(value)

    url.hash = ''

    const normalizedPathname =
      url.pathname.length > 1
        ? url.pathname.replace(/\/+$/, '')
        : url.pathname

    return [
      url.protocol.toLowerCase(),
      '//',
      url.hostname.toLowerCase(),
      url.port ? `:${url.port}` : '',
      normalizedPathname,
      url.search,
    ].join('')
  } catch {
    return value.trim().toLowerCase()
  }
}