// app/api/user/onboarding/path/route.ts

import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'

import {
  evaluateOnboardingNextPath,
  isOnboardingPath,
  normalizeOnboardingPath,
  type OnboardingPath,
  type OnboardingRoutingResult,
} from '@/lib/onboarding/getOnboardingNextPath'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MAX_REQUEST_BODY_BYTES = 4_096

const NO_STORE_HEADERS = {
  'Cache-Control':
    'private, no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
} as const

const PROFILE_ROUTING_COLUMNS = `
  full_name,
  username,
  home_neighborhood,
  preferred_vibes,
  interest_categories,
  deleted_at,
  has_seen_roam_intro,
  onboarding_path,
  onboarding_path_selected_at,
  creator_onboarding_completed_at
` as const

type PathSelectionRequest = {
  path: OnboardingPath
}

type PathSelectionSuccessResponse = {
  success: true
  path: OnboardingPath
  selectedAt: string
  changed: boolean
  nextPath: string
  routing: OnboardingRoutingResult
}

type PathSelectionErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_CONTENT_TYPE'
  | 'INVALID_REQUEST'
  | 'PROFILE_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'
  | 'METHOD_NOT_ALLOWED'

type PathSelectionErrorResponse = {
  success: false
  code: PathSelectionErrorCode
  error: string
}

/**
 * POST /api/user/onboarding/path
 *
 * Accepted body:
 *
 * {
 *   "path": "explorer" | "creator"
 * }
 *
 * The authenticated user ID is always derived from Supabase auth.
 */
export async function POST(request: Request) {
  try {
    const parsedBody =
      await parsePathSelectionRequest(request)

    if (!parsedBody.success) {
      return apiError({
        status: parsedBody.status,
        code: parsedBody.code,
        error: parsedBody.error,
      })
    }

    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      if (authError) {
        console.warn(
          '[api/user/onboarding/path] Authentication failed:',
          {
            code: authError.code,
            message: authError.message,
          }
        )
      }

      return apiError({
        status: 401,
        code: 'UNAUTHORIZED',
        error:
          'You must be signed in to choose an onboarding path.',
      })
    }

    const {
      data: existingProfile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select(PROFILE_ROUTING_COLUMNS)
      .eq('id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (profileError) {
      console.error(
        '[api/user/onboarding/path] Failed to load profile:',
        {
          userId: user.id,
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint,
        }
      )

      return apiError({
        status: getDatabaseErrorStatus(
          profileError.code
        ),
        code: 'DATABASE_ERROR',
        error:
          'Your onboarding path could not be loaded.',
      })
    }

    if (!existingProfile) {
      return apiError({
        status: 404,
        code: 'PROFILE_NOT_FOUND',
        error:
          'Your Roam profile could not be found.',
      })
    }

    const selectedPath =
      parsedBody.value.path

    const existingPath =
      normalizeOnboardingPath(
        existingProfile.onboarding_path
      )

    /**
     * Preserve the original timestamp for an idempotent repeat request.
     */
    if (
      existingPath === selectedPath &&
      existingProfile.onboarding_path_selected_at
    ) {
      const routing =
        evaluateOnboardingNextPath(
          existingProfile
        )

      return NextResponse.json(
        {
          success: true,
          path: selectedPath,
          selectedAt:
            existingProfile.onboarding_path_selected_at,
          changed: false,
          nextPath: routing.nextPath,
          routing,
        } satisfies PathSelectionSuccessResponse,
        {
          status: 200,
          headers: NO_STORE_HEADERS,
        }
      )
    }

    const selectedAt =
      new Date().toISOString()

    const {
      data: updatedProfile,
      error: updateError,
    } = await supabase
      .from('profiles')
      .update({
        onboarding_path:
          selectedPath,
        onboarding_path_selected_at:
          selectedAt,
      })
      .eq('id', user.id)
      .is('deleted_at', null)
      .select(PROFILE_ROUTING_COLUMNS)
      .maybeSingle()

    if (updateError) {
      console.error(
        '[api/user/onboarding/path] Failed to update onboarding path:',
        {
          userId: user.id,
          selectedPath,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        }
      )

      return apiError({
        status: getDatabaseErrorStatus(
          updateError.code
        ),
        code: 'DATABASE_ERROR',
        error:
          'Your onboarding path could not be saved.',
      })
    }

    if (!updatedProfile) {
      return apiError({
        status: 404,
        code: 'PROFILE_NOT_FOUND',
        error:
          'Your Roam profile could not be updated.',
      })
    }

    const persistedPath =
      normalizeOnboardingPath(
        updatedProfile.onboarding_path
      )

    if (
      persistedPath !== selectedPath ||
      !updatedProfile.onboarding_path_selected_at
    ) {
      console.error(
        '[api/user/onboarding/path] Updated profile returned an inconsistent path:',
        {
          userId: user.id,
          requestedPath:
            selectedPath,
          persistedPath,
          selectedAt:
            updatedProfile.onboarding_path_selected_at,
        }
      )

      return apiError({
        status: 500,
        code: 'DATABASE_ERROR',
        error:
          'Your onboarding selection could not be verified.',
      })
    }

    const routing =
      evaluateOnboardingNextPath(
        updatedProfile
      )

    /**
     * A successful selection must move the user beyond the chooser.
     * Returning /onboarding here would create a redirect loop.
     */
    if (
      routing.nextPath ===
      '/onboarding'
    ) {
      console.error(
        '[api/user/onboarding/path] Selection did not advance onboarding routing:',
        {
          userId: user.id,
          selectedPath,
          routing,
        }
      )

      return apiError({
        status: 500,
        code: 'INTERNAL_ERROR',
        error:
          'Your next onboarding step could not be determined.',
      })
    }

    return NextResponse.json(
      {
        success: true,
        path: selectedPath,
        selectedAt:
          updatedProfile.onboarding_path_selected_at,
        changed: true,
        nextPath: routing.nextPath,
        routing,
      } satisfies PathSelectionSuccessResponse,
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      }
    )
  } catch (error) {
    console.error(
      '[api/user/onboarding/path] Unexpected error:',
      error
    )

    return apiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      error:
        'Your onboarding path could not be saved.',
    })
  }
}

/* =========================================================
 * Unsupported methods
 * ======================================================= */

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

/* =========================================================
 * Request parsing
 * ======================================================= */

type ParseRequestResult =
  | {
      success: true
      value: PathSelectionRequest
    }
  | {
      success: false
      status: 400 | 413 | 415
      code:
        | 'INVALID_CONTENT_TYPE'
        | 'INVALID_REQUEST'
      error: string
    }

async function parsePathSelectionRequest(
  request: Request
): Promise<ParseRequestResult> {
  const contentType =
    request.headers.get(
      'content-type'
    ) ?? ''

  if (
    !contentType
      .toLowerCase()
      .includes(
        'application/json'
      )
  ) {
    return {
      success: false,
      status: 415,
      code:
        'INVALID_CONTENT_TYPE',
      error:
        'Content-Type must be application/json.',
    }
  }

  const declaredContentLength =
    parseContentLength(
      request.headers.get(
        'content-length'
      )
    )

  if (
    declaredContentLength !== null &&
    declaredContentLength >
      MAX_REQUEST_BODY_BYTES
  ) {
    return {
      success: false,
      status: 413,
      code: 'INVALID_REQUEST',
      error:
        'The request body is too large.',
    }
  }

  let rawBody: string

  try {
    rawBody =
      await request.text()
  } catch {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'The request body could not be read.',
    }
  }

  if (
    new TextEncoder().encode(
      rawBody
    ).byteLength >
    MAX_REQUEST_BODY_BYTES
  ) {
    return {
      success: false,
      status: 413,
      code: 'INVALID_REQUEST',
      error:
        'The request body is too large.',
    }
  }

  if (!rawBody.trim()) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'The request body is required.',
    }
  }

  let value: unknown

  try {
    value =
      JSON.parse(rawBody) as unknown
  } catch {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'The request body must contain valid JSON.',
    }
  }

  if (
    !isPlainObject(value)
  ) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'The request body must be a JSON object.',
    }
  }

  const keys =
    Object.keys(value)

  if (
    keys.length !== 1 ||
    keys[0] !== 'path'
  ) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'The request body may contain only the path field.',
    }
  }

  if (
    !isOnboardingPath(
      value.path
    )
  ) {
    return {
      success: false,
      status: 400,
      code: 'INVALID_REQUEST',
      error:
        'Path must be either explorer or creator.',
    }
  }

  return {
    success: true,
    value: {
      path: value.path,
    },
  }
}

/* =========================================================
 * Responses
 * ======================================================= */

function apiError({
  status,
  code,
  error,
}: {
  status: number
  code: PathSelectionErrorCode
  error: string
}) {
  return NextResponse.json(
    {
      success: false,
      code,
      error,
    } satisfies PathSelectionErrorResponse,
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  )
}

function methodNotAllowed() {
  return NextResponse.json(
    {
      success: false,
      code:
        'METHOD_NOT_ALLOWED',
      error:
        'Method not allowed.',
    } satisfies PathSelectionErrorResponse,
    {
      status: 405,
      headers: {
        ...NO_STORE_HEADERS,
        Allow: 'POST',
      },
    }
  )
}

/* =========================================================
 * Utilities
 * ======================================================= */

function isPlainObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }

  const prototype =
    Object.getPrototypeOf(value)

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  )
}

function parseContentLength(
  value: string | null
): number | null {
  if (!value) {
    return null
  }

  const parsed =
    Number.parseInt(
      value,
      10
    )

  return Number.isFinite(
    parsed
  ) &&
    parsed >= 0
    ? parsed
    : null
}

function getDatabaseErrorStatus(
  code?: string
): number {
  switch (code) {
    case '22P02':
    case '23503':
    case '23514':
      return 400

    case '42501':
      return 403

    default:
      return 500
  }
}