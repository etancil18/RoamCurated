
import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  createServerClient,
} from '@/lib/supabase/server'

import {
  isAllowedAdminEmail,
} from '@/lib/auth/adminAccess'

export const dynamic = 'force-dynamic'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50
const MAX_SEARCH_LENGTH = 120

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum: number
) {
  if (!value || !/^\d+$/.test(value)) {
    return fallback
  }

  const parsed = Number(value)

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    return fallback
  }

  return Math.min(parsed, maximum)
}

export async function GET(
  request: NextRequest
) {
  try {
    const supabase =
      await createServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return json(
        { error: 'Authentication required.' },
        401
      )
    }

    if (!isAllowedAdminEmail(user.email?.trim())) {
      return json(
        { error: 'Admin access required.' },
        403
      )
    }

    const params =
      request.nextUrl.searchParams

    const page = parsePositiveInteger(
      params.get('page'),
      1,
      100000
    )

    const pageSize = parsePositiveInteger(
      params.get('pageSize'),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    )

    const rawSearch =
      (params.get('search') ?? '').trim()

    if (rawSearch.length > MAX_SEARCH_LENGTH) {
      return json(
        {
          error: `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`,
        },
        400
      )
    }

    const ownership =
      params.get('ownership') ?? 'all'

    if (
      ![
        'all',
        'assigned',
        'unassigned',
      ].includes(ownership)
    ) {
      return json(
        { error: 'Invalid ownership filter.' },
        400
      )
    }

    /*
     * PostgREST .or() accepts a filter expression.
     * Remove expression control characters and ILIKE
     * wildcard characters from user-supplied search.
     */
    const search = rawSearch
      .replace(/[^a-zA-Z0-9 \-]/g, '')
      .trim()

    const db = supabase as any

    let query = db
      .from('properties')
      .select(
        [
          'id',
          'name',
          'city',
          'slug',
          'address',
          'owner_user_id',
          'approved',
          'featured',
          'created_at',
        ].join(', '),
        {
          count: 'exact',
        }
      )

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,city.ilike.%${search}%`
      )
    }

    if (ownership === 'unassigned') {
      query = query.is(
        'owner_user_id',
        null
      )
    }

    if (ownership === 'assigned') {
      query = query.not(
        'owner_user_id',
        'is',
        null
      )
    }

    const offset =
      (page - 1) * pageSize

    const {
      data,
      count,
      error,
    } = await query
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .range(
        offset,
        offset + pageSize - 1
      )

    if (error) {
      console.error(
        '[hotel-shortterm-rentals] Inventory query failed:',
        error
      )

      return json(
        {
          error:
            'Unable to load property inventory.',
        },
        500
      )
    }

    const total = count ?? 0

    return json({
      properties: data ?? [],
      page,
      pageSize,
      total,
      totalPages:
        Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error(
      '[hotel-shortterm-rentals] Unexpected error:',
      error
    )

    return json(
      {
        error:
          'Unexpected error loading properties.',
      },
      500
    )
  }
}
