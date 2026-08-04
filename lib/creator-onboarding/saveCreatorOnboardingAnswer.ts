// lib/creator-onboarding/saveCreatorOnboardingAnswer.ts

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import {
  CREATOR_ONBOARDING_PROMPT_BY_KEY,
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
} from './constants'

import {
  creatorOnboardingAnswerRowSchema,
  formatCreatorOnboardingValidationError,
  saveCreatorOnboardingDraftSchema,
  type SaveCreatorOnboardingDraftData,
} from './schemas'

import {
  mapCreatorOnboardingAnswerFromRow,
  type CreatorOnboardingAnswer,
  type CreatorOnboardingAnswerRow,
  type CreatorOnboardingApiErrorCode,
  type JsonValue,
  type SaveCreatorOnboardingAnswerResult,
} from './types'

type AppSupabaseClient = SupabaseClient<Database>

type CreatorOnboardingAnswerInsert =
  Database['public']['Tables']['creator_onboarding_answers']['Insert']

type CreatorOnboardingAnswerUpdate =
  Database['public']['Tables']['creator_onboarding_answers']['Update']

export type SaveCreatorOnboardingAnswerOptions = {
  supabase: AppSupabaseClient

  /**
   * Must come from a trusted authentication source such as:
   *
   * const {
   *   data: { user },
   * } = await supabase.auth.getUser()
   *
   * Never accept this ID from the browser request body.
   */
  creatorUserId: string

  /**
   * Untrusted browser payload.
   *
   * This service validates the payload before any database operation.
   */
  input: unknown
}

type ExistingAnswerIdentityRow = {
  id: string
  answer_text: string
  answer_confirmed: boolean
  answer_confirmed_at: string | null
}

type CreatorOnboardingSaveErrorContext =
  | 'INVALID_INPUT'
  | 'LOAD_EXISTING_ANSWER'
  | 'CREATE_ANSWER'
  | 'UPDATE_ANSWER'
  | 'LOAD_SAVED_ANSWER'
  | 'COUNT_CONFIRMED_ANSWERS'
  | 'INVALID_DATABASE_ROW'

export class CreatorOnboardingSaveError extends Error {
  readonly code: CreatorOnboardingApiErrorCode
  readonly context: CreatorOnboardingSaveErrorContext
  readonly status: number
  readonly causeDetails?: JsonValue

  constructor({
    message,
    code,
    context,
    status,
    causeDetails,
  }: {
    message: string
    code: CreatorOnboardingApiErrorCode
    context: CreatorOnboardingSaveErrorContext
    status: number
    causeDetails?: JsonValue
  }) {
    super(message)

    this.name = 'CreatorOnboardingSaveError'
    this.code = code
    this.context = context
    this.status = status
    this.causeDetails = causeDetails
  }
}

/**
 * Creates or updates one creator-onboarding answer.
 *
 * Guarantees:
 *
 * 1. The creator ID comes from trusted server authentication.
 * 2. The prompt key must exist in the canonical prompt registry.
 * 3. Prompt text and prompt version always come from server constants.
 * 4. The client cannot write extraction fields or database timestamps.
 * 5. Editing answer text revokes prior confirmation.
 * 6. Confirmed answers satisfy prompt-specific length requirements.
 * 7. Database output is validated before being returned.
 */
export async function saveCreatorOnboardingAnswer({
  supabase,
  creatorUserId,
  input,
}: SaveCreatorOnboardingAnswerOptions): Promise<SaveCreatorOnboardingAnswerResult> {
  const normalizedCreatorUserId = creatorUserId.trim()

  if (!normalizedCreatorUserId) {
    throw new CreatorOnboardingSaveError({
      message: 'An authenticated creator is required.',
      code: 'UNAUTHORIZED',
      context: 'INVALID_INPUT',
      status: 401,
    })
  }

  const parsed = saveCreatorOnboardingDraftSchema.safeParse(input)

  if (!parsed.success) {
    throw new CreatorOnboardingSaveError({
      message: 'Invalid creator onboarding answer.',
      code: 'INVALID_REQUEST',
      context: 'INVALID_INPUT',
      status: 400,
      causeDetails: formatCreatorOnboardingValidationError(
        parsed.error
      ),
    })
  }

  const validatedInput = parsed.data
  const canonicalPrompt =
    CREATOR_ONBOARDING_PROMPT_BY_KEY[
      validatedInput.promptKey
    ]

  if (!canonicalPrompt) {
    throw new CreatorOnboardingSaveError({
      message: 'Unknown creator onboarding prompt.',
      code: 'UNKNOWN_PROMPT',
      context: 'INVALID_INPUT',
      status: 400,
    })
  }

  const existingAnswer = await loadExistingAnswer({
    supabase,
    creatorUserId: normalizedCreatorUserId,
    promptKey: validatedInput.promptKey,
  })

  const answerTextChanged =
    existingAnswer !== null &&
    normalizeComparableText(existingAnswer.answer_text) !==
      normalizeComparableText(validatedInput.answerText)

  let savedAnswerId: string

  if (existingAnswer) {
    savedAnswerId = existingAnswer.id

    await updateExistingAnswer({
      supabase,
      creatorUserId: normalizedCreatorUserId,
      answerId: existingAnswer.id,
      input: validatedInput,
      canonicalPrompt,
      answerTextChanged,
    })
  } else {
    savedAnswerId = await createAnswer({
      supabase,
      creatorUserId: normalizedCreatorUserId,
      input: validatedInput,
      canonicalPrompt,
    })
  }

  const [savedAnswer, confirmedAnswerCount] =
    await Promise.all([
      loadSavedAnswer({
        supabase,
        creatorUserId: normalizedCreatorUserId,
        answerId: savedAnswerId,
      }),

      countConfirmedAnswers({
        supabase,
        creatorUserId: normalizedCreatorUserId,
      }),
    ])

  return {
    answer: savedAnswer,
    confirmedAnswerCount,
    canComplete:
      confirmedAnswerCount >=
      MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
  }
}

async function loadExistingAnswer({
  supabase,
  creatorUserId,
  promptKey,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  promptKey: SaveCreatorOnboardingDraftData['promptKey']
}): Promise<ExistingAnswerIdentityRow | null> {
  const { data, error } = await supabase
    .from('creator_onboarding_answers')
    .select(
      `
        id,
        answer_text,
        answer_confirmed,
        answer_confirmed_at
      `
    )
    .eq('creator_user_id', creatorUserId)
    .eq('prompt_key', promptKey)
    .maybeSingle()

  if (error) {
    throw new CreatorOnboardingSaveError({
      message:
        'The existing creator onboarding answer could not be loaded.',
      code: 'DATABASE_ERROR',
      context: 'LOAD_EXISTING_ANSWER',
      status: 500,
      causeDetails: serializeSupabaseError(error),
    })
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    answer_text: data.answer_text,
    answer_confirmed: data.answer_confirmed,
    answer_confirmed_at: data.answer_confirmed_at,
  }
}

async function createAnswer({
  supabase,
  creatorUserId,
  input,
  canonicalPrompt,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  input: SaveCreatorOnboardingDraftData
  canonicalPrompt: (typeof CREATOR_ONBOARDING_PROMPT_BY_KEY)[SaveCreatorOnboardingDraftData['promptKey']]
}): Promise<string> {
  const now = new Date().toISOString()

  const insertPayload: CreatorOnboardingAnswerInsert = {
    creator_user_id: creatorUserId,

    prompt_key: canonicalPrompt.key,
    prompt_text: canonicalPrompt.promptText,
    prompt_version: canonicalPrompt.version,

    answer_text: input.answerText,
    answer_metadata:
      input.answerMetadata as CreatorOnboardingAnswerInsert['answer_metadata'],

    answer_confirmed: input.answerConfirmed,
    answer_confirmed_at: input.answerConfirmed
      ? now
      : null,

    is_public: input.isPublic,

    extraction_status: 'not_extracted',
    extracted_data: null,
    extraction_version: null,
    extraction_model: null,
    extracted_at: null,
    extraction_reviewed_at: null,
    extraction_error: null,
  }

  const { data, error } = await supabase
    .from('creator_onboarding_answers')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    throw new CreatorOnboardingSaveError({
      message:
        'The creator onboarding answer could not be created.',
      code: 'DATABASE_ERROR',
      context: 'CREATE_ANSWER',
      status: getDatabaseErrorStatus(error.code),
      causeDetails: serializeSupabaseError(error),
    })
  }

  return data.id
}

async function updateExistingAnswer({
  supabase,
  creatorUserId,
  answerId,
  input,
  canonicalPrompt,
  answerTextChanged,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  answerId: string
  input: SaveCreatorOnboardingDraftData
  canonicalPrompt: (typeof CREATOR_ONBOARDING_PROMPT_BY_KEY)[SaveCreatorOnboardingDraftData['promptKey']]
  answerTextChanged: boolean
}): Promise<void> {
  /**
   * Changing the source answer must invalidate:
   *
   * - answer confirmation;
   * - confirmation timestamp;
   * - all future extraction state derived from the old answer.
   *
   * The database trigger should enforce the same invariant. It is repeated
   * here intentionally so application behavior remains explicit.
   */
  const effectiveConfirmed =
    answerTextChanged
      ? false
      : input.answerConfirmed

  const updatePayload: CreatorOnboardingAnswerUpdate = {
    prompt_text: canonicalPrompt.promptText,
    prompt_version: canonicalPrompt.version,

    answer_text: input.answerText,

    answer_metadata:
      input.answerMetadata as CreatorOnboardingAnswerUpdate['answer_metadata'],

    answer_confirmed: effectiveConfirmed,

    answer_confirmed_at: effectiveConfirmed
      ? new Date().toISOString()
      : null,

    is_public: input.isPublic,
  }

  if (answerTextChanged) {
    Object.assign(updatePayload, {
      extraction_status: 'not_extracted',
      extracted_data: null,
      extraction_version: null,
      extraction_model: null,
      extracted_at: null,
      extraction_reviewed_at: null,
      extraction_error: null,
    } satisfies CreatorOnboardingAnswerUpdate)
  }

  const { error } = await supabase
    .from('creator_onboarding_answers')
    .update(updatePayload)
    .eq('id', answerId)
    .eq('creator_user_id', creatorUserId)

  if (error) {
    throw new CreatorOnboardingSaveError({
      message:
        'The creator onboarding answer could not be updated.',
      code: 'DATABASE_ERROR',
      context: 'UPDATE_ANSWER',
      status: getDatabaseErrorStatus(error.code),
      causeDetails: serializeSupabaseError(error),
    })
  }
}

async function loadSavedAnswer({
  supabase,
  creatorUserId,
  answerId,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  answerId: string
}): Promise<CreatorOnboardingAnswer> {
  const { data, error } = await supabase
    .from('creator_onboarding_answers')
    .select(
      `
        id,
        creator_user_id,
        prompt_key,
        prompt_text,
        prompt_version,
        answer_text,
        answer_metadata,
        answer_confirmed,
        answer_confirmed_at,
        is_public,
        extraction_status,
        extracted_data,
        extraction_version,
        extraction_model,
        extracted_at,
        extraction_reviewed_at,
        extraction_error,
        created_at,
        updated_at
      `
    )
    .eq('id', answerId)
    .eq('creator_user_id', creatorUserId)
    .single()

  if (error) {
    throw new CreatorOnboardingSaveError({
      message:
        'The saved creator onboarding answer could not be loaded.',
      code: 'DATABASE_ERROR',
      context: 'LOAD_SAVED_ANSWER',
      status: 500,
      causeDetails: serializeSupabaseError(error),
    })
  }

  const parsed =
    creatorOnboardingAnswerRowSchema.safeParse(data)

  if (!parsed.success) {
    throw new CreatorOnboardingSaveError({
      message:
        'The saved creator onboarding answer does not match the expected database structure.',
      code: 'DATABASE_ERROR',
      context: 'INVALID_DATABASE_ROW',
      status: 500,
      causeDetails: formatCreatorOnboardingValidationError(
        parsed.error
      ),
    })
  }

  return mapCreatorOnboardingAnswerFromRow(
    parsed.data as CreatorOnboardingAnswerRow
  )
}

async function countConfirmedAnswers({
  supabase,
  creatorUserId,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
}): Promise<number> {
  const { count, error } = await supabase
    .from('creator_onboarding_answers')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('creator_user_id', creatorUserId)
    .eq('answer_confirmed', true)

  if (error) {
    throw new CreatorOnboardingSaveError({
      message:
        'Confirmed creator onboarding answers could not be counted.',
      code: 'DATABASE_ERROR',
      context: 'COUNT_CONFIRMED_ANSWERS',
      status: 500,
      causeDetails: serializeSupabaseError(error),
    })
  }

  return count ?? 0
}

function normalizeComparableText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function serializeSupabaseError(error: {
  code?: string
  message?: string
  details?: string
  hint?: string
}): JsonValue {
  return {
    databaseCode: error.code ?? null,
    databaseMessage: error.message ?? null,
    databaseDetails: error.details ?? null,
    databaseHint: error.hint ?? null,
  }
}

function getDatabaseErrorStatus(code?: string): number {
  switch (code) {
    case '23505':
      return 409

    case '23503':
    case '23514':
    case '22P02':
      return 400

    case '42501':
      return 403

    default:
      return 500
  }
}