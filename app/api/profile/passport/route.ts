import { NextResponse } from 'next/server'

import {
  rebuildPublicPassportStats,
} from '@/lib/passport/rebuildPublicPassportStats'
import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'

export async function GET() {
  try {
    const supabase =
      await supabaseServerApi()

    const {
      data: {
        user,
      },
      error:
        authenticationError,
    } =
      await supabase.auth.getUser()

    if (
      authenticationError ||
      !user
    ) {
      return jsonResponse(
        {
          error:
            'Unauthorized',
        },
        401
      )
    }

    const result =
      await rebuildPublicPassportStats(
        user.id
      )

    return jsonResponse(
      {
        stats:
          result.stats,

        snapshot:
          result.snapshot,
      },
      200
    )
  } catch (error) {
    console.error(
      '[profile/passport] Failed to rebuild Passport:',
      serializeUnknownError(
        error
      )
    )

    return jsonResponse(
      {
        error:
          'Unexpected error loading Passport.',
      },
      500
    )
  }
}

function jsonResponse(
  body: unknown,
  status: number
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
      },
    }
  )
}

function serializeUnknownError(
  error: unknown
): Record<string, unknown> {
  if (
    error instanceof Error
  ) {
    return {
      name:
        error.name,

      message:
        error.message,

      stack:
        error.stack ??
        null,
    }
  }

  return {
    value:
      String(
        error
      ),
  }
}