// lib/creator-onboarding/schemas.ts

import { z } from 'zod'

import {
  CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
  CREATOR_ONBOARDING_MIN_ANSWER_LENGTH,
  CREATOR_ONBOARDING_PROMPT_BY_KEY,
  CREATOR_ONBOARDING_PROMPT_KEYS,
  getCreatorOnboardingPrompt,
} from './constants'

/**
 * ---------------------------------------------------------------------------
 * Shared primitives
 * ---------------------------------------------------------------------------
 */

const trimmedString = z
  .string()
  .transform((value) => value.trim())

const nonEmptyTrimmedString = trimmedString.pipe(
  z.string().min(1, 'This value is required.')
)

const uuidSchema = z
  .string()
  .trim()
  .uuid('Expected a valid UUID.')

const nullableTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()

/**
 * JSON-compatible values accepted by Supabase json/jsonb columns.
 *
 * This deliberately rejects:
 * - undefined
 * - functions
 * - symbols
 * - bigint
 * - Date instances
 * - class instances
 * - circular structures
 */
export const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

export type JsonPrimitiveInput = z.input<typeof jsonPrimitiveSchema>

export const jsonValueSchema: z.ZodType<
  | string
  | number
  | boolean
  | null
  | Array<unknown>
  | Record<string, unknown>
> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

export const jsonObjectSchema = z.record(
  z.string(),
  jsonValueSchema
)

/**
 * ---------------------------------------------------------------------------
 * Canonical prompt validation
 * ---------------------------------------------------------------------------
 */

export const creatorOnboardingPromptKeySchema = z.enum(
  CREATOR_ONBOARDING_PROMPT_KEYS
)

export const creatorOnboardingPromptVersionSchema = z
  .number()
  .int()
  .min(1)

function addPromptSpecificAnswerIssues(
  value: {
    promptKey: string
    answerText: string
  },
  context: z.RefinementCtx
) {
  const prompt = getCreatorOnboardingPrompt(value.promptKey)

  if (!prompt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['promptKey'],
      message: 'Unknown creator onboarding prompt.',
    })

    return
  }

  const answerLength = value.answerText.trim().length

  if (answerLength < prompt.minimumAnswerLength) {
    context.addIssue({
    code: 'too_small',
    origin: 'string',
    minimum: prompt.minimumAnswerLength,
    inclusive: true,
    path: ['answerText'],
    message: `Answer must be at least ${prompt.minimumAnswerLength} characters.`,
    })
  }

  if (answerLength > prompt.maximumAnswerLength) {
    context.addIssue({
    code: 'too_big',
    origin: 'string',
    maximum: prompt.maximumAnswerLength,
    inclusive: true,
    path: ['answerText'],
    message: `Answer must be no more than ${prompt.maximumAnswerLength} characters.`,
    })
  }
}

/**
 * ---------------------------------------------------------------------------
 * Save-answer request
 *
 * POST /api/creator/onboarding
 *
 * The browser is intentionally not allowed to send:
 * - creator_user_id
 * - prompt_text
 * - prompt_version
 * - timestamps
 * - extraction state
 *
 * Those values belong to trusted server code.
 * ---------------------------------------------------------------------------
 */

export const saveCreatorOnboardingAnswerSchema = z
  .object({
    promptKey: creatorOnboardingPromptKeySchema,

    answerText: z
      .string()
      .max(
        CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
        `Answer must be no more than ${CREATOR_ONBOARDING_MAX_ANSWER_LENGTH} characters.`
      )
      .transform((value) => value.trim()),

    answerMetadata: jsonObjectSchema.optional().default({}),

    answerConfirmed: z.boolean(),

    isPublic: z.boolean(),
  })
  .strict()
  .superRefine(addPromptSpecificAnswerIssues)

export type SaveCreatorOnboardingAnswerInput = z.input<
  typeof saveCreatorOnboardingAnswerSchema
>

export type SaveCreatorOnboardingAnswerData = z.output<
  typeof saveCreatorOnboardingAnswerSchema
>

/**
 * ---------------------------------------------------------------------------
 * Optional draft-save request
 *
 * Use this only when the product intentionally supports saving blank or
 * incomplete answers before confirmation.
 *
 * A confirmed answer must still satisfy the canonical prompt-specific limits.
 * ---------------------------------------------------------------------------
 */

export const saveCreatorOnboardingDraftSchema = z
  .object({
    promptKey: creatorOnboardingPromptKeySchema,

    answerText: z
      .string()
      .max(
        CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
        `Answer must be no more than ${CREATOR_ONBOARDING_MAX_ANSWER_LENGTH} characters.`
      )
      .transform((value) => value.trim()),

    answerMetadata: jsonObjectSchema.optional().default({}),

    answerConfirmed: z.boolean().default(false),

    isPublic: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.answerConfirmed) {
      return
    }

    addPromptSpecificAnswerIssues(value, context)
  })

export type SaveCreatorOnboardingDraftInput = z.input<
  typeof saveCreatorOnboardingDraftSchema
>

export type SaveCreatorOnboardingDraftData = z.output<
  typeof saveCreatorOnboardingDraftSchema
>

/**
 * ---------------------------------------------------------------------------
 * Complete-onboarding request
 *
 * POST /api/creator/onboarding/complete
 *
 * Completion rules are server-owned. The client sends no threshold,
 * creator ID, or completion timestamp.
 * ---------------------------------------------------------------------------
 */

export const completeCreatorOnboardingSchema = z
  .object({})
  .strict()

export type CompleteCreatorOnboardingInput = z.input<
  typeof completeCreatorOnboardingSchema
>

/**
 * ---------------------------------------------------------------------------
 * Future extraction schemas
 *
 * These can exist now without requiring the extraction route to be built.
 * They establish a stable contract for later AI interpretation.
 * ---------------------------------------------------------------------------
 */

export const creatorOnboardingEntityReferenceSchema = z
  .object({
    id: uuidSchema,
    name: nonEmptyTrimmedString.pipe(
      z.string().max(200, 'Entity name is too long.')
    ),
  })
  .strict()

export const creatorOnboardingVenueReferenceSchema =
  creatorOnboardingEntityReferenceSchema

export const creatorOnboardingNeighborhoodReferenceSchema =
  creatorOnboardingEntityReferenceSchema

export const creatorOnboardingThemeSchema = nonEmptyTrimmedString.pipe(
  z.string().max(100, 'Theme is too long.')
)

export const creatorOnboardingExtractedDataSchema = z
  .object({
    occasion: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable(),

    routeConcept: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .nullable(),

    venues: z
      .array(creatorOnboardingVenueReferenceSchema)
      .max(25, 'Too many linked venues.')
      .default([]),

    neighborhoods: z
      .array(creatorOnboardingNeighborhoodReferenceSchema)
      .max(25, 'Too many linked neighborhoods.')
      .default([]),

    themes: z
      .array(creatorOnboardingThemeSchema)
      .max(25, 'Too many extracted themes.')
      .default([]),
  })
  .strict()
  .transform((value) => ({
    ...value,

    venues: dedupeEntityReferences(value.venues),

    neighborhoods: dedupeEntityReferences(value.neighborhoods),

    themes: dedupeStrings(value.themes),
  }))

export type CreatorOnboardingExtractedDataInput = z.input<
  typeof creatorOnboardingExtractedDataSchema
>

export type CreatorOnboardingExtractedDataData = z.output<
  typeof creatorOnboardingExtractedDataSchema
>

/**
 * Database-shaped JSONB extraction contract.
 *
 * Use this schema when validating data read from or written directly to the
 * `extracted_data` JSONB column.
 */
export const creatorOnboardingExtractedDataRecordSchema = z
  .object({
    occasion: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable(),

    route_concept: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .nullable(),

    venue_ids: z
      .array(creatorOnboardingVenueReferenceSchema)
      .max(25)
      .default([]),

    neighborhood_ids: z
      .array(creatorOnboardingNeighborhoodReferenceSchema)
      .max(25)
      .default([]),

    themes: z
      .array(creatorOnboardingThemeSchema)
      .max(25)
      .default([]),
  })
  .strict()
  .transform((value) => ({
    ...value,

    venue_ids: dedupeEntityReferences(value.venue_ids),

    neighborhood_ids: dedupeEntityReferences(
      value.neighborhood_ids
    ),

    themes: dedupeStrings(value.themes),
  }))

export type CreatorOnboardingExtractedDataRecordInput =
  z.input<typeof creatorOnboardingExtractedDataRecordSchema>

export type CreatorOnboardingExtractedDataRecordData =
  z.output<typeof creatorOnboardingExtractedDataRecordSchema>

/**
 * Future extraction request.
 *
 * POST /api/creator/onboarding/extract
 */
export const extractCreatorOnboardingAnswerSchema = z
  .object({
    promptKey: creatorOnboardingPromptKeySchema,

    answerText: z
      .string()
      .max(
        CREATOR_ONBOARDING_MAX_ANSWER_LENGTH,
        `Answer must be no more than ${CREATOR_ONBOARDING_MAX_ANSWER_LENGTH} characters.`
      )
      .transform((value) => value.trim()),
  })
  .strict()
  .superRefine(addPromptSpecificAnswerIssues)

export type ExtractCreatorOnboardingAnswerInput = z.input<
  typeof extractCreatorOnboardingAnswerSchema
>

export type ExtractCreatorOnboardingAnswerData = z.output<
  typeof extractCreatorOnboardingAnswerSchema
>

/**
 * ---------------------------------------------------------------------------
 * Future extraction persistence
 *
 * This should only be used by trusted server-side code.
 * ---------------------------------------------------------------------------
 */

export const creatorOnboardingExtractionStatusSchema = z.enum([
  'not_extracted',
  'processing',
  'candidate',
  'approved',
  'rejected',
  'failed',
])

export const updateCreatorOnboardingExtractionSchema = z
  .object({
    promptKey: creatorOnboardingPromptKeySchema,

    extractionStatus: creatorOnboardingExtractionStatusSchema,

    extractedData:
      creatorOnboardingExtractedDataSchema.nullable(),

    extractionVersion: z
      .number()
      .int()
      .min(1)
      .nullable(),

    extractionModel: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable(),

    extractedAt: nullableTimestampSchema,

    extractionReviewedAt: nullableTimestampSchema,

    extractionError: z
      .string()
      .trim()
      .min(1)
      .max(2_000)
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const requiresExtractedData = [
      'candidate',
      'approved',
      'rejected',
    ].includes(value.extractionStatus)

    if (requiresExtractedData && !value.extractedData) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extractedData'],
        message:
          'Extracted data is required for candidate, approved, or rejected extraction states.',
      })
    }

    if (
      value.extractionStatus === 'approved' &&
      !value.extractionReviewedAt
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extractionReviewedAt'],
        message:
          'An approved extraction must include a review timestamp.',
      })
    }

    if (
      value.extractionStatus === 'failed' &&
      !value.extractionError
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extractionError'],
        message:
          'A failed extraction must include an error message.',
      })
    }

    if (
      value.extractionStatus === 'not_extracted' &&
      (
        value.extractedData !== null ||
        value.extractionVersion !== null ||
        value.extractionModel !== null ||
        value.extractedAt !== null ||
        value.extractionReviewedAt !== null ||
        value.extractionError !== null
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extractionStatus'],
        message:
          'A not_extracted record cannot include extraction data or extraction metadata.',
      })
    }
  })

export type UpdateCreatorOnboardingExtractionInput = z.input<
  typeof updateCreatorOnboardingExtractionSchema
>

export type UpdateCreatorOnboardingExtractionData = z.output<
  typeof updateCreatorOnboardingExtractionSchema
>

/**
 * ---------------------------------------------------------------------------
 * Query parameter schemas
 * ---------------------------------------------------------------------------
 */

export const getCreatorOnboardingQuerySchema = z
  .object({
    includePrivate: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
  })
  .strict()

export type GetCreatorOnboardingQueryInput = z.input<
  typeof getCreatorOnboardingQuerySchema
>

export type GetCreatorOnboardingQueryData = z.output<
  typeof getCreatorOnboardingQuerySchema
>

/**
 * ---------------------------------------------------------------------------
 * Database row validation
 *
 * Useful when mapping untrusted database JSON or service-role responses into
 * the creator-onboarding domain layer.
 * ---------------------------------------------------------------------------
 */

export const creatorOnboardingAnswerRowSchema = z
  .object({
    id: uuidSchema,

    creator_user_id: uuidSchema,

    prompt_key: creatorOnboardingPromptKeySchema,

    prompt_text: nonEmptyTrimmedString.pipe(
      z.string().max(1_000)
    ),

    prompt_version: creatorOnboardingPromptVersionSchema,

    answer_text: z
      .string()
      .trim()
      .min(1)
      .max(CREATOR_ONBOARDING_MAX_ANSWER_LENGTH),

    answer_metadata: jsonObjectSchema,

    answer_confirmed: z.boolean(),

    answer_confirmed_at: nullableTimestampSchema,

    is_public: z.boolean(),

    extraction_status:
      creatorOnboardingExtractionStatusSchema,

    extracted_data:
      creatorOnboardingExtractedDataRecordSchema.nullable(),

    extraction_version: z
      .number()
      .int()
      .min(1)
      .nullable(),

    extraction_model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable(),

    extracted_at: nullableTimestampSchema,

    extraction_reviewed_at: nullableTimestampSchema,

    extraction_error: z
      .string()
      .trim()
      .min(1)
      .max(2_000)
      .nullable(),

    created_at: z.string().datetime({ offset: true }),

    updated_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((row, context) => {
    const canonicalPrompt =
      CREATOR_ONBOARDING_PROMPT_BY_KEY[row.prompt_key]

    if (row.prompt_text !== canonicalPrompt.promptText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt_text'],
        message:
          'Stored prompt text does not match the current canonical prompt.',
      })
    }

    if (row.prompt_version !== canonicalPrompt.version) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt_version'],
        message:
          'Stored prompt version does not match the current canonical prompt version.',
      })
    }

    if (
      row.answer_confirmed &&
      row.answer_confirmed_at === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answer_confirmed_at'],
        message:
          'A confirmed answer must include a confirmation timestamp.',
      })
    }

    if (
      !row.answer_confirmed &&
      row.answer_confirmed_at !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['answer_confirmed_at'],
        message:
          'An unconfirmed answer cannot include a confirmation timestamp.',
      })
    }

    const requiresExtractedData = [
      'candidate',
      'approved',
      'rejected',
    ].includes(row.extraction_status)

    if (
      requiresExtractedData &&
      row.extracted_data === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extracted_data'],
        message:
          'This extraction state requires extracted data.',
      })
    }

    if (
      row.extraction_status === 'approved' &&
      row.extraction_reviewed_at === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extraction_reviewed_at'],
        message:
          'An approved extraction must include a review timestamp.',
      })
    }
  })

export type CreatorOnboardingAnswerRowData = z.output<
  typeof creatorOnboardingAnswerRowSchema
>

/**
 * ---------------------------------------------------------------------------
 * Utility helpers
 * ---------------------------------------------------------------------------
 */

function dedupeEntityReferences<
  T extends {
    id: string
    name: string
  },
>(items: T[]): T[] {
  const byId = new Map<string, T>()

  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    }
  }

  return [...byId.values()]
}

function dedupeStrings(values: string[]): string[] {
  const normalized = new Map<string, string>()

  for (const value of values) {
    const trimmed = value.trim()

    if (!trimmed) {
      continue
    }

    const key = trimmed.toLowerCase()

    if (!normalized.has(key)) {
      normalized.set(key, trimmed)
    }
  }

  return [...normalized.values()]
}

/**
 * Safely converts a Zod failure into a serializable API error payload.
 */
export function formatCreatorOnboardingValidationError(
  error: z.ZodError
) {
  return {
    fieldErrors: error.flatten().fieldErrors,
    formErrors: error.flatten().formErrors,
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  }
}