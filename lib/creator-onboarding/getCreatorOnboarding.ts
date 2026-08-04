// lib/creator-onboarding/getCreatorOnboarding.ts

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import {
  CREATOR_ONBOARDING_PROMPTS,
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
} from './constants'

import {
  creatorOnboardingAnswerRowSchema,
  formatCreatorOnboardingValidationError,
} from './schemas'

import {
  mapCreatorOnboardingAnswerFromRow,
  type CreatorOnboardingAnswer,
  type CreatorOnboardingAnswerRow,
  type CreatorOnboardingState,
  type JsonValue,
} from './types'

type AppSupabaseClient = SupabaseClient<Database>

export type GetCreatorOnboardingOptions = {
  supabase: AppSupabaseClient

  /**
   * The authenticated creator whose onboarding state should be loaded.
   *
   * This must come from `supabase.auth.getUser()` or another trusted
   * server-side authentication source. Never accept it directly from an
   * untrusted browser payload.
   */
  creatorUserId: string

  /**
   * When true, returns all answers owned by the creator.
   *
   * When false, returns only answers that are both confirmed and public.
   *
   * Private creator-management pages should use `true`.
   * Public-facing projections should use `false`, although public Creator
   * Agent data should eventually be exposed through a narrower dedicated
   * loader or RPC.
   */
  includePrivate?: boolean
}

type CreatorOnboardingProfileRow = {
  creator_onboarding_completed_at: string | null
}

type CreatorOnboardingDatabaseErrorContext =
  | 'LOAD_ANSWERS'
  | 'LOAD_PROFILE'
  | 'INVALID_DATABASE_ROW'

export class CreatorOnboardingLoadError extends Error {
  readonly code: CreatorOnboardingDatabaseErrorContext
  readonly causeDetails?: JsonValue

  constructor({
    message,
    code,
    causeDetails,
  }: {
    message: string
    code: CreatorOnboardingDatabaseErrorContext
    causeDetails?: JsonValue
  }) {
    super(message)

    this.name = 'CreatorOnboardingLoadError'
    this.code = code
    this.causeDetails = causeDetails
  }
}

/**
 * Loads one creator's onboarding answers and completion state.
 *
 * This function:
 * - scopes every answer query to the supplied creator ID;
 * - relies on Supabase RLS as an additional ownership boundary;
 * - validates every returned database row;
 * - maps database snake_case fields to client-safe camelCase fields;
 * - preserves the canonical onboarding prompt order;
 * - computes completion eligibility on the server;
 * - supports private management and confirmed-public loading modes.
 */
export async function getCreatorOnboarding({
  supabase,
  creatorUserId,
  includePrivate = true,
}: GetCreatorOnboardingOptions): Promise<CreatorOnboardingState> {
  const normalizedCreatorUserId = creatorUserId.trim()

  if (!normalizedCreatorUserId) {
    throw new CreatorOnboardingLoadError({
      message: 'A creator user ID is required to load onboarding.',
      code: 'LOAD_ANSWERS',
    })
  }

  const answersPromise = loadCreatorOnboardingAnswers({
    supabase,
    creatorUserId: normalizedCreatorUserId,
    includePrivate,
  })

  const completionPromise = loadCreatorOnboardingCompletion({
    supabase,
    creatorUserId: normalizedCreatorUserId,
  })

  const [answers, completedAt] = await Promise.all([
    answersPromise,
    completionPromise,
  ])

  const confirmedAnswerCount = answers.filter(
    (answer) => answer.answerConfirmed
  ).length

  const canComplete =
    confirmedAnswerCount >=
    MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS

  return {
    answers,
    completedAt,
    confirmedAnswerCount,
    totalAnswerCount: answers.length,
    minimumRequiredAnswers:
      MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
    canComplete,
    isComplete: completedAt !== null,
  }
}

async function loadCreatorOnboardingAnswers({
  supabase,
  creatorUserId,
  includePrivate,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  includePrivate: boolean
}): Promise<CreatorOnboardingAnswer[]> {
  let query = supabase
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
    .eq('creator_user_id', creatorUserId)

  if (!includePrivate) {
    query = query
      .eq('answer_confirmed', true)
      .eq('is_public', true)
  }

  const { data, error } = await query.order('created_at', {
    ascending: true,
  })

  if (error) {
    throw new CreatorOnboardingLoadError({
      message: 'Creator onboarding answers could not be loaded.',
      code: 'LOAD_ANSWERS',
      causeDetails: {
        databaseCode: error.code,
        databaseMessage: error.message,
        databaseDetails: error.details,
        databaseHint: error.hint,
      },
    })
  }

  if (!data || data.length === 0) {
    return []
  }

  const answers = data.map((row, index) => {
    const parsed = creatorOnboardingAnswerRowSchema.safeParse(row)

    if (!parsed.success) {
      throw new CreatorOnboardingLoadError({
        message:
          'A creator onboarding answer does not match the expected database structure.',
        code: 'INVALID_DATABASE_ROW',
        causeDetails: {
          rowIndex: index,
          rowId:
            typeof row.id === 'string'
              ? row.id
              : null,
          validation:
            formatCreatorOnboardingValidationError(
              parsed.error
            ),
        },
      })
    }

    return mapCreatorOnboardingAnswerFromRow(
      parsed.data as CreatorOnboardingAnswerRow
    )
  })

  return sortAnswersByCanonicalPromptOrder(answers)
}

async function loadCreatorOnboardingCompletion({
  supabase,
  creatorUserId,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('creator_onboarding_completed_at')
    .eq('id', creatorUserId)
    .maybeSingle()

  if (error) {
    throw new CreatorOnboardingLoadError({
      message:
        'Creator onboarding completion status could not be loaded.',
      code: 'LOAD_PROFILE',
      causeDetails: {
        databaseCode: error.code,
        databaseMessage: error.message,
        databaseDetails: error.details,
        databaseHint: error.hint,
      },
    })
  }

  if (!data) {
    throw new CreatorOnboardingLoadError({
      message:
        'The authenticated creator profile could not be found.',
      code: 'LOAD_PROFILE',
    })
  }

  const profile =
    data as CreatorOnboardingProfileRow

  return profile.creator_onboarding_completed_at
}

function sortAnswersByCanonicalPromptOrder(
  answers: CreatorOnboardingAnswer[]
): CreatorOnboardingAnswer[] {
  const canonicalOrder = new Map(
    CREATOR_ONBOARDING_PROMPTS.map(
      (prompt, index) => [
        prompt.key,
        index,
      ]
    )
  )

  return [...answers].sort(
    (left, right) => {
      const leftIndex =
        canonicalOrder.get(
          left.promptKey
        ) ??
        Number.MAX_SAFE_INTEGER

      const rightIndex =
        canonicalOrder.get(
          right.promptKey
        ) ??
        Number.MAX_SAFE_INTEGER

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex
      }

      return left.createdAt.localeCompare(
        right.createdAt
      )
    }
  )
}

/**
 * Convenience loader for authenticated creator-management experiences.
 *
 * This includes drafts, private answers, confirmed answers, and future
 * extraction state.
 */
export async function getPrivateCreatorOnboarding({
  supabase,
  creatorUserId,
}: Omit<
  GetCreatorOnboardingOptions,
  'includePrivate'
>): Promise<CreatorOnboardingState> {
  return getCreatorOnboarding({
    supabase,
    creatorUserId,
    includePrivate: true,
  })
}

/**
 * Convenience loader for confirmed public creator knowledge.
 *
 * This still returns the creator's original answer text. Do not expose this
 * result anonymously until the public product rules and privacy projection
 * are finalized.
 */
export async function getConfirmedPublicCreatorOnboarding({
  supabase,
  creatorUserId,
}: Omit<
  GetCreatorOnboardingOptions,
  'includePrivate'
>): Promise<CreatorOnboardingState> {
  return getCreatorOnboarding({
    supabase,
    creatorUserId,
    includePrivate: false,
  })
}