
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'
import { getLegalAcceptanceConfig } from '@/lib/legal/config'

import type { Database } from '@/types/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'nodejs'

/* =========================================================
 * Roam Legal Acceptance API
 *
 * POST /api/legal/accept
 *
 * Records affirmative acceptance of Roam's current
 * Terms of Service and Community Guidelines.
 *
 * Security:
 * - Requires an authenticated Supabase user
 * - Obtains user ID from the verified server session
 * - Reads account creation time from Supabase Auth
 * - Grandfathers accounts predating the rollout cutoff
 * - Requires an explicit affirmative acceptance
 * - Requires the exact current policy versions
 * - Uses server-controlled acceptance context
 * - Uses the database's server-generated accepted_at
 * - Preserves existing records without overwriting
 * - Prevents duplicate version combinations
 * - Uses service-role credentials only on the server
 * - Rejects cross-origin browser submissions
 *
 * Does not:
 * - Create accounts
 * - Change authentication sessions
 * - Redirect users
 * - Modify existing acceptance history
 * - Require existing users to reaccept policies
 * ======================================================= */

type AcceptanceRequest = {
  accepted: true
  termsVersion: string
  guidelinesVersion: string
}

const MAX_REQUEST_BYTES = 2048

const NO_STORE_HEADERS = {
  'Cache-Control':
    'private, no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  )
}

/* =========================================================
 * POST
 * ======================================================= */

export async function POST(
  request: Request
) {
  /* =====================================================
   * Same-origin request validation
   *
   * This endpoint is intended to be called by Roam's
   * authenticated application, not third-party websites.
   * =================================================== */

  const requestOrigin =
    new URL(request.url).origin

  const submittedOrigin =
    request.headers.get('origin')

  if (
    submittedOrigin &&
    submittedOrigin !== requestOrigin
  ) {
    return jsonResponse(
      {
        error:
          'Cross-origin requests are not permitted.',
      },
      403
    )
  }

  const fetchSite =
    request.headers.get('sec-fetch-site')

  if (
    fetchSite === 'cross-site'
  ) {
    return jsonResponse(
      {
        error:
          'Cross-site requests are not permitted.',
      },
      403
    )
  }

  /* =====================================================
   * Validate request format
   * =================================================== */

  const contentType =
    request.headers
      .get('content-type')
      ?.toLowerCase() ??
    ''

  if (
    !contentType.includes(
      'application/json'
    )
  ) {
    return jsonResponse(
      {
        error:
          'Content-Type must be application/json.',
      },
      415
    )
  }

  let body: unknown

  try {
    const rawBody =
      await request.text()

    if (
      new TextEncoder()
        .encode(rawBody)
        .byteLength >
      MAX_REQUEST_BYTES
    ) {
      return jsonResponse(
        {
          error:
            'Request body is too large.',
        },
        413
      )
    }

    body =
      JSON.parse(rawBody)
  } catch {
    return jsonResponse(
      {
        error:
          'Invalid JSON request body.',
      },
      400
    )
  }

  if (
    !isAcceptanceRequest(
      body
    )
  ) {
    return jsonResponse(
      {
        error:
          'Explicit acceptance and valid policy versions are required.',
      },
      400
    )
  }

  /* =====================================================
   * Resolve current legal configuration
   *
   * All versions and the rollout cutoff are controlled
   * by trusted server configuration.
   * =================================================== */

  let legalConfig:
    ReturnType<
      typeof getLegalAcceptanceConfig
    >

  try {
    legalConfig =
      getLegalAcceptanceConfig()
  } catch (error) {
    console.error(
      '[api/legal/accept] Invalid legal configuration:',
      error
    )

    return jsonResponse(
      {
        error:
          'Legal acceptance is temporarily unavailable.',
      },
      503
    )
  }

  const {
    rolloutCutoff,
    policyVersions,
  } = legalConfig

  /* =====================================================
   * Validate exact current policy versions
   *
   * Prevents a stale signup screen from recording an
   * outdated policy version.
   * =================================================== */

  if (
    body.termsVersion !==
      policyVersions.termsVersion ||
    body.guidelinesVersion !==
      policyVersions.guidelinesVersion
  ) {
    return jsonResponse(
      {
        error:
          'The legal policies have changed. Please review the current versions before continuing.',
        code:
          'policy_version_mismatch',
      },
      409
    )
  }

  /* =====================================================
   * Verify authenticated user
   *
   * Never accept a user ID from the browser.
   * =================================================== */

  let userId: string
  let accountCreatedAt: Date

  try {
    const supabase =
      await createServerClient()

    const {
      data: {
        user,
      },
      error: authError,
    } =
      await supabase.auth.getUser()

    if (
      authError ||
      !user
    ) {
      return jsonResponse(
        {
          error:
            'Authentication is required to accept the legal policies.',
        },
        401
      )
    }

    userId =
      user.id

    accountCreatedAt =
      new Date(
        user.created_at
      )

    if (
      !Number.isFinite(
        accountCreatedAt.getTime()
      )
    ) {
      console.error(
        '[api/legal/accept] Invalid authenticated account creation timestamp.'
      )

      return jsonResponse(
        {
          error:
            'Unable to verify account eligibility.',
        },
        500
      )
    }
  } catch (error) {
    console.error(
      '[api/legal/accept] Authentication verification failed:',
      error
    )

    return jsonResponse(
      {
        error:
          'Unable to verify your session. Please sign in again.',
      },
      401
    )
  }

  /* =====================================================
   * Existing-user grandfathering
   *
   * Accounts created before the fixed rollout cutoff
   * are exempt.
   *
   * Do not fabricate or insert acceptance records for
   * these users.
   * =================================================== */

  if (
    accountCreatedAt.getTime() <
    rolloutCutoff.getTime()
  ) {
    return jsonResponse({
      accepted: true,
      required: false,
      grandfathered: true,
      recorded: false,
      termsVersion:
        policyVersions.termsVersion,
      guidelinesVersion:
        policyVersions.guidelinesVersion,
    })
  }

  /* =====================================================
   * Create trusted server-side database client
   *
   * The user_legal_acceptances table deliberately
   * disallows regular authenticated INSERT operations.
   *
   * This server-only client performs the privileged write.
   * =================================================== */

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL

  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      '[api/legal/accept] Missing Supabase service-role configuration.'
    )

    return jsonResponse(
      {
        error:
          'Legal acceptance recording is temporarily unavailable.',
      },
      503
    )
  }

  try {
    const adminSupabase =
      createClient<Database>(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      )

    /* ===================================================
     * Append-only, duplicate-safe insert
     *
     * Existing records with this user/version pair
     * remain untouched.
     *
     * accepted_at is omitted intentionally so the
     * database generates the timestamp.
     *
     * Always use legal_onboarding: the server cannot
     * safely infer the original signup method from
     * an arbitrary POST request.
     * ================================================= */

    const {
      error: insertError,
    } =
      await adminSupabase
        .from(
          'user_legal_acceptances'
        )
        .upsert(
          {
            user_id:
              userId,
            terms_version:
              policyVersions.termsVersion,
            guidelines_version:
              policyVersions.guidelinesVersion,
            acceptance_context:
              'legal_onboarding',
          },
          {
            onConflict:
              'user_id,terms_version,guidelines_version',
            ignoreDuplicates:
              true,
          }
        )

    if (
      insertError
    ) {
      console.error(
        '[api/legal/accept] Acceptance insert failed:',
        {
          code:
            insertError.code,
          message:
            insertError.message,
        }
      )

      return jsonResponse(
        {
          error:
            'We could not save your agreement. Please try again.',
        },
        500
      )
    }

    /* ===================================================
     * Read back the authoritative record
     *
     * This works both for newly inserted records and
     * previously accepted version combinations.
     * ================================================= */

    const {
      data: acceptance,
      error: readError,
    } =
      await adminSupabase
        .from(
          'user_legal_acceptances'
        )
        .select(`
          id,
          terms_version,
          guidelines_version,
          accepted_at
        `)
        .eq(
          'user_id',
          userId
        )
        .eq(
          'terms_version',
          policyVersions.termsVersion
        )
        .eq(
          'guidelines_version',
          policyVersions.guidelinesVersion
        )
        .maybeSingle()

    if (
      readError ||
      !acceptance
    ) {
      console.error(
        '[api/legal/accept] Acceptance verification failed:',
        {
          code:
            readError?.code,
          message:
            readError?.message,
        }
      )

      return jsonResponse(
        {
          error:
            'Your agreement could not be verified. Please try again.',
        },
        500
      )
    }

    return jsonResponse({
      accepted: true,
      required: false,
      grandfathered: false,
      recorded: true,
      termsVersion:
        acceptance.terms_version,
      guidelinesVersion:
        acceptance.guidelines_version,
      acceptedAt:
        acceptance.accepted_at,
    })
  } catch (error) {
    console.error(
      '[api/legal/accept] Unexpected acceptance error:',
      error
    )

    return jsonResponse(
      {
        error:
          'We could not complete legal acceptance. Please try again.',
      },
      500
    )
  }
}

/* =========================================================
 * Request contract
 *
 * Expected JSON:
 *
 * {
 *   "accepted": true,
 *   "termsVersion": "v1",
 *   "guidelinesVersion": "v1"
 * }
 *
 * Policy versions must match server configuration.
 *
 * The request intentionally does not accept:
 * - userId
 * - acceptedAt
 * - acceptanceContext
 * - grandfathered
 * ======================================================= */

function isAcceptanceRequest(
  value: unknown
): value is AcceptanceRequest {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(value)
  ) {
    return false
  }

  const body =
    value as Record<
      string,
      unknown
    >

  return (
    body.accepted ===
      true &&
    typeof body.termsVersion ===
      'string' &&
    body.termsVersion.trim()
      .length > 0 &&
    typeof body.guidelinesVersion ===
      'string' &&
    body.guidelinesVersion.trim()
      .length > 0
  )
}
