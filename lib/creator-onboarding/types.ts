// lib/creator-onboarding/types.ts

import type {
  CreatorOnboardingPromptDefinition,
  CreatorOnboardingPromptKey,
} from './constants'

/**
 * JSON-compatible values accepted by Supabase json/jsonb columns.
 *
 * This is intentionally independent from generated Supabase types so the
 * creator-onboarding domain layer remains portable and easy to validate.
 */
export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue
    }

export type JsonObject = {
  [key: string]: JsonValue
}

/**
 * Lifecycle for optional future machine extraction.
 *
 * Creator onboarding does not require extraction. A creator can complete
 * onboarding while every answer remains `not_extracted`.
 */
export const CREATOR_ONBOARDING_EXTRACTION_STATUSES = [
  'not_extracted',
  'processing',
  'candidate',
  'approved',
  'rejected',
  'failed',
] as const

export type CreatorOnboardingExtractionStatus =
  (typeof CREATOR_ONBOARDING_EXTRACTION_STATUSES)[number]

/**
 * Safe, future-facing reference to a canonical Roam venue.
 *
 * The `name` is a display snapshot. The venue record identified by `id`
 * remains the canonical source of venue truth.
 */
export type CreatorOnboardingVenueReference = {
  id: string
  name: string
}

/**
 * Safe reference to a canonical neighborhood.
 *
 * The identifier may eventually be a UUID, slug, or another stable key,
 * depending on Roam's neighborhood model.
 */
export type CreatorOnboardingNeighborhoodReference = {
  id: string
  name: string
}

/**
 * Optional structured interpretation of a creator's written answer.
 *
 * This is derived and replaceable. `answerText` remains authoritative.
 */
export type CreatorOnboardingExtractedData = {
  occasion: string | null
  routeConcept: string | null
  venues: CreatorOnboardingVenueReference[]
  neighborhoods: CreatorOnboardingNeighborhoodReference[]
  themes: string[]
}

/**
 * Database-shaped extracted data.
 *
 * This uses snake_case because it maps directly to JSON stored in Supabase.
 */
export type CreatorOnboardingExtractedDataRecord = {
  occasion: string | null
  route_concept: string | null
  venue_ids: CreatorOnboardingVenueReference[]
  neighborhood_ids: CreatorOnboardingNeighborhoodReference[]
  themes: string[]
}

/**
 * Creator-approved structured metadata captured directly by the UI.
 *
 * Unlike `extractedData`, this does not need to come from AI. It may later
 * contain manually selected venues, neighborhoods, tags, budgets, or other
 * structured values explicitly supplied or approved by the creator.
 */
export type CreatorOnboardingAnswerMetadata = JsonObject

/**
 * Exact database row shape for `public.creator_onboarding_answers`.
 *
 * Keep this aligned with the migration and regenerated Supabase types.
 */
export type CreatorOnboardingAnswerRow = {
  id: string
  creator_user_id: string

  prompt_key: CreatorOnboardingPromptKey
  prompt_text: string
  prompt_version: number

  answer_text: string
  answer_metadata: CreatorOnboardingAnswerMetadata

  answer_confirmed: boolean
  answer_confirmed_at: string | null
  is_public: boolean

  extraction_status: CreatorOnboardingExtractionStatus
  extracted_data: CreatorOnboardingExtractedDataRecord | null
  extraction_version: number | null
  extraction_model: string | null
  extracted_at: string | null
  extraction_reviewed_at: string | null
  extraction_error: string | null

  created_at: string
  updated_at: string
}

/**
 * Insert payload used by the backend service layer.
 *
 * The server must derive `creator_user_id`, `prompt_text`, and
 * `prompt_version`. The browser must not control those values.
 */
export type CreatorOnboardingAnswerInsert = {
  creator_user_id: string

  prompt_key: CreatorOnboardingPromptKey
  prompt_text: string
  prompt_version: number

  answer_text: string
  answer_metadata?: CreatorOnboardingAnswerMetadata

  answer_confirmed?: boolean
  answer_confirmed_at?: string | null
  is_public?: boolean

  extraction_status?: CreatorOnboardingExtractionStatus
  extracted_data?: CreatorOnboardingExtractedDataRecord | null
  extraction_version?: number | null
  extraction_model?: string | null
  extracted_at?: string | null
  extraction_reviewed_at?: string | null
  extraction_error?: string | null
}

/**
 * Update payload used by trusted backend code.
 *
 * Creator ownership must still be enforced in the query and by RLS.
 */
export type CreatorOnboardingAnswerUpdate = Partial<
  Omit<
    CreatorOnboardingAnswerInsert,
    'creator_user_id' | 'prompt_key'
  >
>

/**
 * Client-facing representation returned by the onboarding API.
 *
 * This uses camelCase so React components do not depend on database naming.
 */
export type CreatorOnboardingAnswer = {
  id: string
  promptKey: CreatorOnboardingPromptKey
  promptText: string
  promptVersion: number

  answerText: string
  answerMetadata: CreatorOnboardingAnswerMetadata

  answerConfirmed: boolean
  answerConfirmedAt: string | null
  isPublic: boolean

  extractionStatus: CreatorOnboardingExtractionStatus
  extractedData: CreatorOnboardingExtractedData | null
  extractionVersion: number | null
  extractionModel: string | null
  extractedAt: string | null
  extractionReviewedAt: string | null
  extractionError: string | null

  createdAt: string
  updatedAt: string
}

/**
 * Editable state used by the creator-onboarding interface.
 */
export type CreatorOnboardingAnswerDraft = {
  promptKey: CreatorOnboardingPromptKey
  answerText: string
  answerMetadata: CreatorOnboardingAnswerMetadata
  answerConfirmed: boolean
  isPublic: boolean
}

/**
 * Fully composed prompt state used by the onboarding UI.
 */
export type CreatorOnboardingPromptState = {
  definition: CreatorOnboardingPromptDefinition
  answer: CreatorOnboardingAnswer | null
  draft: CreatorOnboardingAnswerDraft
}

/**
 * Authenticated creator-onboarding summary.
 */
export type CreatorOnboardingState = {
  answers: CreatorOnboardingAnswer[]
  completedAt: string | null
  confirmedAnswerCount: number
  totalAnswerCount: number
  minimumRequiredAnswers: number
  canComplete: boolean
  isComplete: boolean
}

/**
 * Request accepted by:
 *
 * POST /api/creator/onboarding
 *
 * The browser supplies only creator-controlled data. The server resolves
 * canonical prompt text, prompt version, ownership, and timestamps.
 */
export type SaveCreatorOnboardingAnswerRequest = {
  promptKey: CreatorOnboardingPromptKey
  answerText: string
  answerMetadata?: CreatorOnboardingAnswerMetadata
  answerConfirmed: boolean
  isPublic: boolean
}

/**
 * Successful response from:
 *
 * POST /api/creator/onboarding
 */
export type SaveCreatorOnboardingAnswerSuccessResponse = {
  success: true
  answer: CreatorOnboardingAnswer
  confirmedAnswerCount: number
  minimumRequiredAnswers: number
  canComplete: boolean
}

/**
 * Successful response from:
 *
 * GET /api/creator/onboarding
 */
export type GetCreatorOnboardingSuccessResponse = {
  success: true
  onboarding: CreatorOnboardingState
}

/**
 * Request accepted by:
 *
 * POST /api/creator/onboarding/complete
 *
 * No completion threshold is accepted from the client. The server owns that
 * rule through `MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS`.
 */
export type CompleteCreatorOnboardingRequest = Record<string, never>

/**
 * Successful response from:
 *
 * POST /api/creator/onboarding/complete
 */
export type CompleteCreatorOnboardingSuccessResponse = {
  success: true
  completedAt: string
  confirmedAnswerCount: number
  redirectTo: '/profile/creator' | string
}

/**
 * Optional future request accepted by:
 *
 * POST /api/creator/onboarding/extract
 */
export type ExtractCreatorOnboardingAnswerRequest = {
  promptKey: CreatorOnboardingPromptKey
  answerText: string
}

/**
 * Optional future response from:
 *
 * POST /api/creator/onboarding/extract
 */
export type ExtractCreatorOnboardingAnswerSuccessResponse = {
  success: true
  extractedData: CreatorOnboardingExtractedData
  extractionVersion: number
}

/**
 * Shared API error contract.
 */
export type CreatorOnboardingApiErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_PROMPT'
  | 'ANSWER_TOO_SHORT'
  | 'ANSWER_TOO_LONG'
  | 'ANSWER_NOT_FOUND'
  | 'INSUFFICIENT_CONFIRMED_ANSWERS'
  | 'DATABASE_ERROR'
  | 'EXTRACTION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

export type CreatorOnboardingApiErrorResponse = {
  success: false
  error: string
  code: CreatorOnboardingApiErrorCode
  details?: JsonValue
}

/**
 * Complete API unions for route handlers and client consumers.
 */
export type GetCreatorOnboardingResponse =
  | GetCreatorOnboardingSuccessResponse
  | CreatorOnboardingApiErrorResponse

export type SaveCreatorOnboardingAnswerResponse =
  | SaveCreatorOnboardingAnswerSuccessResponse
  | CreatorOnboardingApiErrorResponse

export type CompleteCreatorOnboardingResponse =
  | CompleteCreatorOnboardingSuccessResponse
  | CreatorOnboardingApiErrorResponse

export type ExtractCreatorOnboardingAnswerResponse =
  | ExtractCreatorOnboardingAnswerSuccessResponse
  | CreatorOnboardingApiErrorResponse

/**
 * Result returned by the server-side save service.
 */
export type SaveCreatorOnboardingAnswerResult = {
  answer: CreatorOnboardingAnswer
  confirmedAnswerCount: number
  canComplete: boolean
}

/**
 * Result returned by the server-side completion service.
 */
export type CompleteCreatorOnboardingResult = {
  completedAt: string
  confirmedAnswerCount: number
}

/**
 * Converts database JSON extraction data into the camelCase domain shape.
 */
export function mapCreatorOnboardingExtractedDataFromRow(
  value: CreatorOnboardingExtractedDataRecord | null
): CreatorOnboardingExtractedData | null {
  if (!value) {
    return null
  }

  return {
    occasion: value.occasion,
    routeConcept: value.route_concept,
    venues: value.venue_ids,
    neighborhoods: value.neighborhood_ids,
    themes: value.themes,
  }
}

/**
 * Converts camelCase domain extraction data into the JSON shape stored in
 * Supabase.
 */
export function mapCreatorOnboardingExtractedDataToRow(
  value: CreatorOnboardingExtractedData | null
): CreatorOnboardingExtractedDataRecord | null {
  if (!value) {
    return null
  }

  return {
    occasion: value.occasion,
    route_concept: value.routeConcept,
    venue_ids: value.venues,
    neighborhood_ids: value.neighborhoods,
    themes: value.themes,
  }
}

/**
 * Converts a database row into the client-safe camelCase representation.
 */
export function mapCreatorOnboardingAnswerFromRow(
  row: CreatorOnboardingAnswerRow
): CreatorOnboardingAnswer {
  return {
    id: row.id,
    promptKey: row.prompt_key,
    promptText: row.prompt_text,
    promptVersion: row.prompt_version,

    answerText: row.answer_text,
    answerMetadata: row.answer_metadata,

    answerConfirmed: row.answer_confirmed,
    answerConfirmedAt: row.answer_confirmed_at,
    isPublic: row.is_public,

    extractionStatus: row.extraction_status,
    extractedData: mapCreatorOnboardingExtractedDataFromRow(
      row.extracted_data
    ),
    extractionVersion: row.extraction_version,
    extractionModel: row.extraction_model,
    extractedAt: row.extracted_at,
    extractionReviewedAt: row.extraction_reviewed_at,
    extractionError: row.extraction_error,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Runtime guard for an extraction status received from an untrusted source.
 */
export function isCreatorOnboardingExtractionStatus(
  value: unknown
): value is CreatorOnboardingExtractionStatus {
  return (
    typeof value === 'string' &&
    CREATOR_ONBOARDING_EXTRACTION_STATUSES.some(
      (status) => status === value
    )
  )
}

/**
 * Creates an empty editable answer for a canonical prompt.
 */
export function createCreatorOnboardingAnswerDraft(
  prompt: CreatorOnboardingPromptDefinition
): CreatorOnboardingAnswerDraft {
  return {
    promptKey: prompt.key,
    answerText: '',
    answerMetadata: {},
    answerConfirmed: false,
    isPublic: prompt.defaultIsPublic,
  }
}