import 'server-only'

import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin-runtime'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ADMIN_EMAILS =
  new Set([
    'evantancil@gmail.com',
    'etancil92@gmail.com',
    'evantancil@roamcurated.com',
    'fyejono@gmail.com',
    'jonathangordon@roamcurated.com',
  ])

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

type FoundingTastemakerBody = {
  designated?: unknown
}

type FoundingTastemakerProfileRow = {
  id: string
  full_name: string | null
  username: string | null
  is_founding_tastemaker: boolean
  founding_tastemaker_designated_at: string | null
  founding_tastemaker_designated_by: string | null
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const adminUser =
      await requireAdmin()

    if (
      adminUser instanceof
      NextResponse
    ) {
      return adminUser
    }

    const {
      userId,
    } =
      await context.params

    const normalizedUserId =
      userId.trim()

    if (
      !isUuid(
        normalizedUserId
      )
    ) {
      return jsonResponse(
        {
          error:
            'Invalid user ID.',
        },
        400
      )
    }

    const admin =
      getSupabaseAdmin()

    const {
      data:
        profile,
      error,
    } =
      await admin
        .from(
          'profiles'
        )
        .select(`
          id,
          full_name,
          username,
          is_founding_tastemaker,
          founding_tastemaker_designated_at,
          founding_tastemaker_designated_by
        `)
        .eq(
          'id',
          normalizedUserId
        )
        .maybeSingle<FoundingTastemakerProfileRow>()

    if (
      error
    ) {
      console.error(
        '[admin/founding-tastemaker] GET profile lookup failed:',
        {
          userId:
            normalizedUserId,

          code:
            error.code,

          message:
            error.message,
        }
      )

      return jsonResponse(
        {
          error:
            'Could not load Founding Tastemaker status.',
        },
        500
      )
    }

    if (
      !profile
    ) {
      return jsonResponse(
        {
          error:
            'User profile not found.',
        },
        404
      )
    }

    return jsonResponse(
      {
        user: {
          id:
            profile.id,

          fullName:
            profile.full_name,

          username:
            profile.username,

          isFoundingTastemaker:
            profile.is_founding_tastemaker ===
            true,

          designatedAt:
            profile.founding_tastemaker_designated_at,

          designatedBy:
            profile.founding_tastemaker_designated_by,
        },
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[admin/founding-tastemaker] GET unexpected failure:',
      {
        error,
      }
    )

    return jsonResponse(
      {
        error:
          'Could not load Founding Tastemaker status.',
      },
      500
    )
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const adminUser =
      await requireAdmin()

    if (
      adminUser instanceof
      NextResponse
    ) {
      return adminUser
    }

    const {
      userId,
    } =
      await context.params

    const normalizedUserId =
      userId.trim()

    if (
      !isUuid(
        normalizedUserId
      )
    ) {
      return jsonResponse(
        {
          error:
            'Invalid user ID.',
        },
        400
      )
    }

    const body =
      (await request
        .json()
        .catch(
          () =>
            null
        )) as
        | FoundingTastemakerBody
        | null

    if (
      !body ||
      typeof body.designated !==
        'boolean'
    ) {
      return jsonResponse(
        {
          error:
            'designated must be a boolean.',
        },
        400
      )
    }

    const designated =
      body.designated

    const admin =
      getSupabaseAdmin()

    const {
      data:
        existingProfile,
      error:
        existingError,
    } =
      await admin
        .from(
          'profiles'
        )
        .select(`
          id,
          full_name,
          username,
          is_founding_tastemaker,
          founding_tastemaker_designated_at,
          founding_tastemaker_designated_by
        `)
        .eq(
          'id',
          normalizedUserId
        )
        .maybeSingle<FoundingTastemakerProfileRow>()

    if (
      existingError
    ) {
      console.error(
        '[admin/founding-tastemaker] PATCH profile lookup failed:',
        {
          userId:
            normalizedUserId,

          code:
            existingError.code,

          message:
            existingError.message,
        }
      )

      return jsonResponse(
        {
          error:
            'Could not load user profile.',
        },
        500
      )
    }

    if (
      !existingProfile
    ) {
      return jsonResponse(
        {
          error:
            'User profile not found.',
        },
        404
      )
    }

    if (
      existingProfile.is_founding_tastemaker ===
      designated
    ) {
      return jsonResponse(
        {
          user: {
            id:
              existingProfile.id,

            fullName:
              existingProfile.full_name,

            username:
              existingProfile.username,

            isFoundingTastemaker:
              existingProfile.is_founding_tastemaker,

            designatedAt:
              existingProfile.founding_tastemaker_designated_at,

            designatedBy:
              existingProfile.founding_tastemaker_designated_by,

            changed:
              false,
          },
        }
      )
    }

    const now =
      new Date()
        .toISOString()

    const update =
      designated
        ? {
            is_founding_tastemaker:
              true,

            founding_tastemaker_designated_at:
              now,

            founding_tastemaker_designated_by:
              adminUser.id,
          }
        : {
            is_founding_tastemaker:
              false,

            founding_tastemaker_designated_at:
              null,

            founding_tastemaker_designated_by:
              null,
          }

    const {
      data:
        updatedProfile,
      error:
        updateError,
    } =
      await admin
        .from(
          'profiles'
        )
        .update(
          update
        )
        .eq(
          'id',
          normalizedUserId
        )
        .select(`
          id,
          full_name,
          username,
          is_founding_tastemaker,
          founding_tastemaker_designated_at,
          founding_tastemaker_designated_by
        `)
        .single<FoundingTastemakerProfileRow>()

    if (
      updateError
    ) {
      console.error(
        '[admin/founding-tastemaker] PATCH update failed:',
        {
          userId:
            normalizedUserId,

          designated,

          code:
            updateError.code,

          message:
            updateError.message,
        }
      )

      return jsonResponse(
        {
          error:
            'Could not update Founding Tastemaker designation.',
        },
        500
      )
    }

    return jsonResponse(
      {
        user: {
          id:
            updatedProfile.id,

          fullName:
            updatedProfile.full_name,

          username:
            updatedProfile.username,

          isFoundingTastemaker:
            updatedProfile.is_founding_tastemaker,

          designatedAt:
            updatedProfile.founding_tastemaker_designated_at,

          designatedBy:
            updatedProfile.founding_tastemaker_designated_by,

          changed:
            true,
        },
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[admin/founding-tastemaker] PATCH unexpected failure:',
      {
        error,
      }
    )

    return jsonResponse(
      {
        error:
          'Could not update Founding Tastemaker designation.',
      },
      500
    )
  }
}

async function requireAdmin(): Promise<
  | {
      id: string
      email: string
    }
  | NextResponse
> {
  const supabase =
    await createServerClient()

  const {
    data: {
      user,
    },
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !user
  ) {
    return jsonResponse(
      {
        error:
          'User not authenticated.',
      },
      401
    )
  }

  const email =
    user.email
      ?.trim()
      .toLowerCase() ??
    ''

  if (
    !email ||
    !ALLOWED_ADMIN_EMAILS.has(
      email
    )
  ) {
    return jsonResponse(
      {
        error:
          'Admin access required.',
      },
      403
    )
  }

  return {
    id:
      user.id,

    email,
  }
}

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  )
}

function jsonResponse(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers: {
        'Cache-Control':
          'private, no-store, max-age=0',

        Pragma:
          'no-cache',

        'X-Content-Type-Options':
          'nosniff',
      },
    }
  )
}