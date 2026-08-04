// app/api/creator/onboarding/complete/route.ts

import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'

import {
  completeCreatorOnboardingSchema,
  formatCreatorOnboardingValidationError,
} from '@/lib/creator-onboarding/schemas'

import {
  completeCreatorOnboarding,
  CreatorOnboardingCompletionError,
} from '@/lib/creator-onboarding/completeCreatorOnboarding'

import type {
  CompleteCreatorOnboardingSuccessResponse,
  CreatorOnboardingApiErrorCode,
  CreatorOnboardingApiErrorResponse,
  JsonValue,
} from '@/lib/creator-onboarding/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

const CREATOR_ONBOARDING_REDIRECT = '/profile/creator' as const

/**
 * POST /api/creator/onboarding/complete
 *
 * Marks Creator Mode onboarding complete after the server independently
 * verifies that the authenticated creator has confirmed the required number
 * of onboarding answers.
 *
 * The browser is intentionally not allowed to control:
 * - creator identity;
 * - minimum confirmed-answer threshold;
 * - completion eligibility;
 * - completion timestamp;
 * - redirect destination;
 * - extraction requirements.
 *
 * Accepted body:
 *
 * {}
 *
 * An empty request body is also accepted and normalized to {}.
 */
export async function POST(request: Request) {
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
        error: 'You must be signed in to complete creator onboarding.',
      })
    }

    const parsedBody = await parseOptionalJsonBody(request)

    if (!parsedBody.success) {
      return apiError({
        status: parsedBody.status,
        code: 'INVALID_REQUEST',
        error: parsedBody.error,
      })
    }

    const parsedRequest =
      completeCreatorOnboardingSchema.safeParse(parsedBody.value)

    if (!parsedRequest.success) {
      return apiError({
        status: 400,
        code: 'INVALID_REQUEST',
        error: 'Invalid creator onboarding completion request.',
        details: formatCreatorOnboardingValidationError(
          parsedRequest.error
        ),
      })
    }

    const result = await completeCreatorOnboarding({
      supabase,
      creatorUserId: user.id,
    })

    const response: CompleteCreatorOnboardingSuccessResponse = {
      success: true,
      completedAt: result.completedAt,
      confirmedAnswerCount: result.confirmedAnswerCount,
      redirectTo: CREATOR_ONBOARDING_REDIRECT,
    }

    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    })
  } catch (error) {
    if (error instanceof CreatorOnboardingCompletionError) {
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

    console.error(
      '[creator-onboarding] Unexpected completion error',
      error
    )

    return apiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      error: 'Creator onboarding could not be completed.',
    })
  }
}

/**
 * Explicitly reject methods not supported by this route.
 *
 * Next.js already handles unsupported methods, but this response makes the
 * API contract predictable for clients and automated tests.
 */
export async function GET() {
  return methodNotAllowed()
}

export async function PUT() {
  return methodNotAllowed()
}

export async function PATCH() {
  return methodNotAllowed()
}

export async function DELETE() {
  return methodNotAllowed()
}

type ParseBodyResult =
  | {
      success: true
      value: unknown
    }
  | {
      success: false
      status: 400 | 415
      error: string
    }

/**
 * Allows either:
 *
 * POST with no body
 * POST with {}
 *
 * Rejects non-JSON bodies when content is present.
 */
async function parseOptionalJsonBody(
  request: Request
): Promise<ParseBodyResult> {
  const contentLength =
    request.headers.get('content-length')

  const contentType =
    request.headers.get('content-type') ?? ''

  const hasDeclaredBody =
    contentLength !== null &&
    contentLength !== '0'

  if (
    hasDeclaredBody &&
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    return {
      success: false,
      status: 415,
      error:
        'Content-Type must be application/json when a request body is provided.',
    }
  }

  let rawBody: string

  try {
    rawBody = await request.text()
  } catch {
    return {
      success: false,
      status: 400,
      error: 'The request body could not be read.',
    }
  }

  if (rawBody.trim().length === 0) {
    return {
      success: true,
      value: {},
    }
  }

  if (
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    return {
      success: false,
      status: 415,
      error: 'Content-Type must be application/json.',
    }
  }

  try {
    return {
      success: true,
      value: JSON.parse(rawBody) as unknown,
    }
  } catch {
    return {
      success: false,
      status: 400,
      error: 'The request body must contain valid JSON.',
    }
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    {
      success: false,
      code: 'INVALID_REQUEST',
      error: 'Method not allowed.',
    } satisfies CreatorOnboardingApiErrorResponse,
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow: 'POST',
      },
    }
  )
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
 * Validation and conflict details are safe to expose.
 *
 * Database internals are hidden in production because they may reveal table
 * names, constraints, policies, or implementation details.
 */
function exposeSafeDetails(
  details: JsonValue | undefined,
  status: number
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