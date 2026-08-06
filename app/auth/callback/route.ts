// app/auth/callback/route.ts

import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_POST_AUTH_PATH = '/events'
const AUTH_ERROR_PATH = '/login'

/**
 * GET /auth/callback
 *
 * Exchanges a Supabase PKCE authorization code for a cookie-backed session,
 * then redirects to a validated same-origin destination.
 *
 * Supported examples:
 *
 * /auth/callback?code=...&next=/events
 * /auth/callback?code=...&next=/welcome
 * /auth/callback?code=...&next=/auth/update-password
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  const code =
    normalizeRequiredText(
      requestUrl.searchParams.get('code')
    )

  const nextPath =
    getSafeInternalPath(
      requestUrl.searchParams.get('next'),
      requestUrl.origin
    ) ?? DEFAULT_POST_AUTH_PATH

  if (!code) {
    console.warn(
      '[auth/callback] Authorization code missing.'
    )

    return redirectToAuthError({
      origin: requestUrl.origin,
      code: 'missing_code',
      nextPath,
    })
  }

  /**
   * The response must exist before the Supabase client is created.
   *
   * Your createServerClient(response) helper writes the exchanged session
   * cookies directly onto this response.
   */
  const redirectResponse = NextResponse.redirect(
    new URL(nextPath, requestUrl.origin),
    {
      status: 303,
      headers: {
        'Cache-Control':
          'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )

  const supabase =
    await createServerClient(
      redirectResponse
    )

  const {
    data,
    error: exchangeError,
  } =
    await supabase.auth.exchangeCodeForSession(
      code
    )

  if (exchangeError) {
    console.error(
      '[auth/callback] Authorization-code exchange failed:',
      {
        code:
          exchangeError.code,
        message:
          exchangeError.message,
      }
    )

    return redirectToAuthError({
      origin: requestUrl.origin,
      code: 'auth_exchange_failed',
      nextPath,
    })
  }

  if (
    !data.session ||
    !data.user
  ) {
    console.error(
      '[auth/callback] Code exchange completed without a valid session.'
    )

    return redirectToAuthError({
      origin: requestUrl.origin,
      code: 'session_missing',
      nextPath,
    })
  }

  return redirectResponse
}

/* =========================================================
 * Redirect safety
 * ======================================================= */

/**
 * Accepts only relative, same-origin application paths.
 *
 * Rejected examples:
 *
 * https://malicious.example
 * //malicious.example
 * \\malicious.example
 * javascript:alert(1)
 */
function getSafeInternalPath(
  value: string | null,
  origin: string
): string | null {
  const normalized =
    normalizeRequiredText(value)

  if (!normalized) {
    return null
  }

  if (
    !normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    normalized.includes('\\') ||
    containsControlCharacters(
      normalized
    )
  ) {
    return null
  }

  try {
    const destination =
      new URL(
        normalized,
        origin
      )

    if (
      destination.origin !==
      origin
    ) {
      return null
    }

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return null
  }
}

/* =========================================================
 * Failure redirects
 * ======================================================= */

function redirectToAuthError({
  origin,
  code,
  nextPath,
}: {
  origin: string
  code:
    | 'missing_code'
    | 'auth_exchange_failed'
    | 'session_missing'
  nextPath: string
}) {
  const loginUrl =
    new URL(
      AUTH_ERROR_PATH,
      origin
    )

  loginUrl.searchParams.set(
    'error',
    code
  )

  /**
   * Preserve only the validated internal destination so the login page may
   * resume the intended flow after a new authentication attempt.
   */
  loginUrl.searchParams.set(
    'next',
    nextPath
  )

  return NextResponse.redirect(
    loginUrl,
    {
      status: 303,
      headers: {
        'Cache-Control':
          'private, no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  )
}

/* =========================================================
 * Utilities
 * ======================================================= */

function normalizeRequiredText(
  value: string | null
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length > 0
    ? normalized
    : null
}

function containsControlCharacters(
  value: string
): boolean {
  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const characterCode =
      value.charCodeAt(index)

    if (
      characterCode <= 31 ||
      characterCode === 127
    ) {
      return true
    }
  }

  return false
}