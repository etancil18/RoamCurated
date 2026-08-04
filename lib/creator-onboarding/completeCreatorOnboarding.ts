// lib/creator-onboarding/completeCreatorOnboarding.ts

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

import {
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
} from './constants'

import type {
  CompleteCreatorOnboardingResult,
  CreatorOnboardingApiErrorCode,
  JsonValue,
} from './types'

type AppSupabaseClient = SupabaseClient<Database>

type CreatorOnboardingProfileRow = {
  id: string
  creator_onboarding_completed_at: string | null
}

export type CompleteCreatorOnboardingOptions = {
  supabase: AppSupabaseClient

  /**
   * Must come from a trusted server-side authentication source.
   *
   * Never accept this value from the request body.
   */
  creatorUserId: string
}

type CreatorOnboardingCompletionErrorContext =
  | 'INVALID_CREATOR'
  | 'LOAD_PROFILE'
  | 'COUNT_CONFIRMED_ANSWERS'
  | 'INSUFFICIENT_CONFIRMED_ANSWERS'
  | 'UPDATE_PROFILE'
  | 'VERIFY_COMPLETION'

export class CreatorOnboardingCompletionError extends Error {
  readonly code: CreatorOnboardingApiErrorCode
  readonly context: CreatorOnboardingCompletionErrorContext
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
    context: CreatorOnboardingCompletionErrorContext
    status: number
    causeDetails?: JsonValue
  }) {
    super(message)

    this.name = 'CreatorOnboardingCompletionError'
    this.code = code
    this.context = context
    this.status = status
    this.causeDetails = causeDetails
  }
}

/**
 * Marks creator onboarding complete after independently verifying that the
 * authenticated creator has confirmed the required number of answers.
 *
 * Guarantees:
 *
 * 1. Completion eligibility is calculated entirely on the server.
 * 2. The client cannot provide or override the required answer threshold.
 * 3. Only answers owned by the authenticated creator are counted.
 * 4. Only creator-confirmed answers count toward completion.
 * 5. AI extraction is not required.
 * 6. Existing completion timestamps are preserved.
 * 7. Repeated completion requests return the original timestamp.
 */
export async function completeCreatorOnboarding({
  supabase,
  creatorUserId,
}: CompleteCreatorOnboardingOptions): Promise<CompleteCreatorOnboardingResult> {
  const normalizedCreatorUserId = creatorUserId.trim()

  if (!normalizedCreatorUserId) {
    throw new CreatorOnboardingCompletionError({
      message: 'An authenticated creator is required.',
      code: 'UNAUTHORIZED',
      context: 'INVALID_CREATOR',
      status: 401,
    })
  }

  /*
   * Load the creator profile first.
   *
   * This confirms that the authenticated user has a corresponding profile
   * and allows the operation to return idempotently when onboarding was
   * already completed.
   */
  const profile = await loadCreatorProfile({
    supabase,
    creatorUserId: normalizedCreatorUserId,
  })

  const confirmedAnswerCount = await countConfirmedAnswers({
    supabase,
    creatorUserId: normalizedCreatorUserId,
  })

  if (
    confirmedAnswerCount <
    MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS
  ) {
    throw new CreatorOnboardingCompletionError({
      message:
        `Confirm at least ${MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS} creator onboarding answers before completing setup.`,
      code: 'INSUFFICIENT_CONFIRMED_ANSWERS',
      context: 'INSUFFICIENT_CONFIRMED_ANSWERS',
      status: 409,
      causeDetails: {
        confirmedAnswerCount,
        minimumRequiredAnswers:
          MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
        remainingAnswerCount: Math.max(
          0,
          MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS -
            confirmedAnswerCount
        ),
      },
    })
  }

  /*
   * Preserve the original completion timestamp.
   *
   * Completion is a one-way milestone unless a separate, deliberate reset
   * workflow is introduced later.
   */
  if (profile.creator_onboarding_completed_at) {
    return {
      completedAt:
        profile.creator_onboarding_completed_at,
      confirmedAnswerCount,
    }
  }

  const requestedCompletedAt =
    new Date().toISOString()

  /*
   * The null condition makes the update idempotent under concurrent requests.
   *
   * When two requests arrive simultaneously, only one should update the row.
   * The other request will reload the profile and return the timestamp written
   * by the winning request.
   */
  const { data: updatedProfile, error: updateError } =
    await supabase
      .from('profiles')
      .update({
        creator_onboarding_completed_at:
          requestedCompletedAt,
      })
      .eq('id', normalizedCreatorUserId)
      .is(
        'creator_onboarding_completed_at',
        null
      )
      .select(
        `
          id,
          creator_onboarding_completed_at
        `
      )
      .maybeSingle()

  if (updateError) {
    throw new CreatorOnboardingCompletionError({
      message:
        'Creator onboarding could not be marked complete.',
      code: 'DATABASE_ERROR',
      context: 'UPDATE_PROFILE',
      status: getDatabaseErrorStatus(
        updateError.code
      ),
      causeDetails:
        serializeSupabaseError(
          updateError
        ),
    })
  }

  if (
    updatedProfile
      ?.creator_onboarding_completed_at
  ) {
    return {
      completedAt:
        updatedProfile.creator_onboarding_completed_at,
      confirmedAnswerCount,
    }
  }

  /*
   * No row may be returned when another concurrent request completed the
   * profile first. Reload before treating that situation as a failure.
   */
  const verifiedProfile =
    await loadCreatorProfile({
      supabase,
      creatorUserId:
        normalizedCreatorUserId,
      context: 'VERIFY_COMPLETION',
    })

  if (
    !verifiedProfile
      .creator_onboarding_completed_at
  ) {
    throw new CreatorOnboardingCompletionError({
      message:
        'Creator onboarding completion could not be verified.',
      code: 'DATABASE_ERROR',
      context: 'VERIFY_COMPLETION',
      status: 500,
    })
  }

  return {
    completedAt:
      verifiedProfile
        .creator_onboarding_completed_at,
    confirmedAnswerCount,
  }
}

async function loadCreatorProfile({
  supabase,
  creatorUserId,
  context = 'LOAD_PROFILE',
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
  context?:
    | 'LOAD_PROFILE'
    | 'VERIFY_COMPLETION'
}): Promise<CreatorOnboardingProfileRow> {
  const { data, error } =
    await supabase
      .from('profiles')
      .select(
        `
          id,
          creator_onboarding_completed_at
        `
      )
      .eq('id', creatorUserId)
      .maybeSingle()

  if (error) {
    throw new CreatorOnboardingCompletionError({
      message:
        'The creator profile could not be loaded.',
      code: 'DATABASE_ERROR',
      context,
      status: getDatabaseErrorStatus(
        error.code
      ),
      causeDetails:
        serializeSupabaseError(error),
    })
  }

  if (!data) {
    throw new CreatorOnboardingCompletionError({
      message:
        'The authenticated creator profile could not be found.',
      code: 'INVALID_REQUEST',
      context,
      status: 404,
    })
  }

  return {
    id: data.id,
    creator_onboarding_completed_at:
      data.creator_onboarding_completed_at,
  }
}

async function countConfirmedAnswers({
  supabase,
  creatorUserId,
}: {
  supabase: AppSupabaseClient
  creatorUserId: string
}): Promise<number> {
  const { count, error } =
    await supabase
      .from(
        'creator_onboarding_answers'
      )
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq(
        'creator_user_id',
        creatorUserId
      )
      .eq(
        'answer_confirmed',
        true
      )

  if (error) {
    throw new CreatorOnboardingCompletionError({
      message:
        'Confirmed creator onboarding answers could not be counted.',
      code: 'DATABASE_ERROR',
      context:
        'COUNT_CONFIRMED_ANSWERS',
      status: getDatabaseErrorStatus(
        error.code
      ),
      causeDetails:
        serializeSupabaseError(error),
    })
  }

  return count ?? 0
}

function serializeSupabaseError(error: {
  code?: string
  message?: string
  details?: string
  hint?: string
}): JsonValue {
  return {
    databaseCode:
      error.code ?? null,
    databaseMessage:
      error.message ?? null,
    databaseDetails:
      error.details ?? null,
    databaseHint:
      error.hint ?? null,
  }
}

function getDatabaseErrorStatus(
  code?: string
): number {
  switch (code) {
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