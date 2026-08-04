// app/api/creator/onboarding/route.ts

import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'

import {
  MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
} from '@/lib/creator-onboarding/constants'

import {
  CreatorOnboardingLoadError,
  getPrivateCreatorOnboarding,
} from '@/lib/creator-onboarding/getCreatorOnboarding'

import {
  CreatorOnboardingSaveError,
  saveCreatorOnboardingAnswer,
} from '@/lib/creator-onboarding/saveCreatorOnboardingAnswer'

import type {
  CreatorOnboardingApiErrorCode,
  CreatorOnboardingApiErrorResponse,
  GetCreatorOnboardingSuccessResponse,
  JsonValue,
  SaveCreatorOnboardingAnswerSuccessResponse,
} from '@/lib/creator-onboarding/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

/**
 * GET /api/creator/onboarding
 *
 * Loads the authenticated creator's complete onboarding state, including:
 * - drafts;
 * - confirmed answers;
 * - private answers;
 * - public/private preferences;
 * - optional future extraction state;
 * - onboarding completion status.
 *
 * The creator ID always comes from the authenticated Supabase session.
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError({
        status: 401,
        code: 'UNAUTHORIZED',
        error: 'You must be signed in to load creator onboarding.',
      })
    }

    const onboarding = await getPrivateCreatorOnboarding({
      supabase,
      creatorUserId: user.id,
    })

    const response: GetCreatorOnboardingSuccessResponse = {
      success: true,
      onboarding,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    if (error instanceof CreatorOnboardingLoadError) {
      return apiError({
        status: getLoadErrorStatus(error),
        code: 'DATABASE_ERROR',
        error: error.message,
        details: exposeSafeDetails(error.causeDetails),
      })
    }

    logUnexpectedError('GET', error)

    return apiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      error: 'Creator onboarding could not be loaded.',
    })
  }
}

/**
 * POST /api/creator/onboarding
 *
 * Creates or updates one creator-onboarding answer.
 *
 * Accepted browser payload:
 *
 * {
 *   promptKey: string
 *   answerText: string
 *   answerMetadata?: Record<string, JsonValue>
 *   answerConfirmed: boolean
 *   isPublic: boolean
 * }
 *
 * The browser is intentionally not allowed to control:
 * - creator_user_id;
 * - prompt_text;
 * - prompt_version;
 * - confirmation timestamps;
 * - extraction fields;
 * - completion thresholds.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    if (!contentType.toLowerCase().includes('application/json')) {
      return apiError({
        status: 415,
        code: 'INVALID_REQUEST',
        error: 'Content-Type must be application/json.',
      })
    }

    const supabase = await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return apiError({
        status: 401,
        code: 'UNAUTHORIZED',
        error: 'You must be signed in to save creator onboarding.',
      })
    }

    let body: unknown

    try {
      body = await request.json()
    } catch {
      return apiError({
        status: 400,
        code: 'INVALID_REQUEST',
        error: 'The request body must contain valid JSON.',
      })
    }

    const result = await saveCreatorOnboardingAnswer({
      supabase,
      creatorUserId: user.id,
      input: body,
    })

    const response: SaveCreatorOnboardingAnswerSuccessResponse = {
      success: true,
      answer: result.answer,
      confirmedAnswerCount: result.confirmedAnswerCount,
      minimumRequiredAnswers:
        MIN_CONFIRMED_CREATOR_ONBOARDING_ANSWERS,
      canComplete: result.canComplete,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    if (error instanceof CreatorOnboardingSaveError) {
      return apiError({
        status: error.status,
        code: error.code,
        error: error.message,
        details: exposeSafeDetails(
          error.causeDetails,
          error.status
        ),
      })
    }

    logUnexpectedError('POST', error)

    return apiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      error: 'Creator onboarding could not be saved.',
    })
  }
}

function apiError({
  status,
  code,
  error,
  details,
}: {
  status: number
  code: CreatorOnboardingApiErrorCode
  error: string
  details?: JsonValue
}) {
  const body: CreatorOnboardingApiErrorResponse = {
    success: false,
    code,
    error,
    ...(details !== undefined
      ? {
          details,
        }
      : {}),
  }

  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  })
}

/**
 * Loader failures are generally server-side database failures.
 *
 * A missing profile is treated as a not-found state rather than exposing
 * database internals to the browser.
 */
function getLoadErrorStatus(error: CreatorOnboardingLoadError): number {
  switch (error.code) {
    case 'LOAD_PROFILE':
      return error.message.toLowerCase().includes('could not be found')
        ? 404
        : 500

    case 'LOAD_ANSWERS':
    case 'INVALID_DATABASE_ROW':
    default:
      return 500
  }
}

/**
 * Validation details are safe to expose for client errors.
 *
 * Database error details are hidden in production because they may contain
 * table names, constraints, policy information, or implementation details.
 */
function exposeSafeDetails(
  details: JsonValue | undefined,
  status = 500
): JsonValue | undefined {
  if (details === undefined) {
    return undefined
  }

  if (status < 500) {
    return details
  }

  if (process.env.NODE_ENV !== 'production') {
    return details
  }

  return undefined
}

function logUnexpectedError(
  method: 'GET' | 'POST',
  error: unknown
) {
  console.error(
    `[creator-onboarding] Unexpected ${method} error`,
    error
  )
}