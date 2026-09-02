import 'server-only'

import {
  NextResponse,
} from 'next/server'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  createServerClient,
} from '@/lib/supabase/server'


// ============================================================
// ADMIN CONFIG
// ============================================================

const ALLOWED_ADMIN_EMAILS =
  new Set([
    'evantancil@gmail.com',
    'etancil92@gmail.com',
    'evantancil@roamcurated.com',
    'fyejono@gmail.com',
    'jonathangordon@roamcurated.com',
  ])


// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_LIMIT =
  20

const MAX_LIMIT =
  50

const MIN_QUERY_LENGTH =
  2

const MAX_QUERY_LENGTH =
  120


// ============================================================
// TYPES
// ============================================================

type VenueSearchRow = {
  id: string
  name: string | null
  city: string | null
}


// ============================================================
// GET
// GET /api/venue-admin/venues/search?q=perc&limit=20
// ============================================================

export async function GET(
  request: Request,
) {
  try {
    const auth =
      await requireAdmin()

    if (!auth.ok) {
      return auth.response
    }


    const url =
      new URL(
        request.url,
      )


    const rawQuery =
      url.searchParams.get(
        'q',
      )


    const query =
      normalizeSearchQuery(
        rawQuery,
      )


    if (!query) {
      return noStoreJson(
        {
          error:
            `q must contain at least ${MIN_QUERY_LENGTH} non-whitespace characters.`,
        },
        {
          status: 400,
        },
      )
    }


    if (
      query.length >
      MAX_QUERY_LENGTH
    ) {
      return noStoreJson(
        {
          error:
            `q must be ${MAX_QUERY_LENGTH} characters or fewer.`,
        },
        {
          status: 400,
        },
      )
    }


    const limit =
      parseLimit(
        url.searchParams.get(
          'limit',
        ),
      )


    if (
      limit ===
      null
    ) {
      return noStoreJson(
        {
          error:
            `limit must be an integer between 1 and ${MAX_LIMIT}.`,
        },
        {
          status: 400,
        },
      )
    }


    const serviceSupabase =
      createVenueServiceClient()


    /**
     * Escape PostgREST LIKE metacharacters so admin-entered
     * search text is treated as literal search input rather than
     * an arbitrary wildcard expression.
     */
    const escapedQuery =
      escapeLikePattern(
        query,
      )


    const {
      data,
      error,
    } =
      await serviceSupabase
        .from(
          'venues',
        )
        .select(`
          id,
          name,
          city
        `)
        .ilike(
          'name',
          `%${escapedQuery}%`,
        )
        .order(
          'name',
          {
            ascending:
              true,
            nullsFirst:
              false,
          },
        )
        .order(
          'city',
          {
            ascending:
              true,
            nullsFirst:
              false,
          },
        )
        .limit(
          limit,
        )


    if (
      error
    ) {
      console.error(
        '[venue-admin/venues/search] Venue search failed:',
        {
          adminUserId:
            auth.user.id,

          adminEmail:
            auth.user.email,

          query,

          limit,

          error,
        },
      )


      return noStoreJson(
        {
          error:
            'Could not search venues.',
        },
        {
          status: 500,
        },
      )
    }


    const venues =
      (
        data ??
        []
      )
        .map(
          normalizeVenueRow,
        )
        .filter(
          (
            venue,
          ): venue is VenueSearchRow =>
            venue !==
            null,
        )


    return noStoreJson(
      {
        venues,
      },
      {
        status: 200,
      },
    )
  } catch (error) {
    console.error(
      '[venue-admin/venues/search] Unexpected error:',
      error,
    )


    return noStoreJson(
      {
        error:
          'Unexpected error searching venues.',
      },
      {
        status: 500,
      },
    )
  }
}


// ============================================================
// ADMIN AUTH
// ============================================================

async function requireAdmin(): Promise<
  | {
      ok: true

      user: {
        id: string
        email: string
      }
    }
  | {
      ok: false

      response:
        NextResponse
    }
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
    return {
      ok:
        false,

      response:
        noStoreJson(
          {
            error:
              'User not authenticated.',
          },
          {
            status: 401,
          },
        ),
    }
  }


  const email =
    user.email
      ?.trim()
      .toLowerCase()
    ?? ''


  if (
    !email ||
    !ALLOWED_ADMIN_EMAILS.has(
      email,
    )
  ) {
    return {
      ok:
        false,

      response:
        noStoreJson(
          {
            error:
              'Admin access required.',
          },
          {
            status: 403,
          },
        ),
    }
  }


  return {
    ok:
      true,

    user: {
      id:
        user.id,

      email,
    },
  }
}


// ============================================================
// SERVICE CLIENT
// ============================================================

function createVenueServiceClient() {
  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL


  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY


  if (
    !supabaseUrl ||
    supabaseUrl
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not configured.',
    )
  }


  if (
    !serviceRoleKey ||
    serviceRoleKey
      .trim()
      .length ===
      0
  ) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured.',
    )
  }


  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    },
  )
}


// ============================================================
// RESPONSE HELPERS
// ============================================================

function noStoreJson(
  body: unknown,
  init: {
    status: number
  },
) {
  return NextResponse.json(
    body,
    {
      status:
        init.status,

      headers: {
        'Cache-Control':
          'no-store, max-age=0',

        'X-Content-Type-Options':
          'nosniff',
      },
    },
  )
}


// ============================================================
// NORMALIZATION
// ============================================================

function normalizeSearchQuery(
  value:
    string | null,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }


  const normalized =
    value
      .replace(
        /\s+/g,
        ' ',
      )
      .trim()


  if (
    normalized.length <
    MIN_QUERY_LENGTH
  ) {
    return null
  }


  return normalized
}


function parseLimit(
  value:
    string | null,
): number | null {
  if (
    value ===
    null ||
    value.trim() ===
    ''
  ) {
    return DEFAULT_LIMIT
  }


  if (
    !/^\d+$/.test(
      value,
    )
  ) {
    return null
  }


  const parsed =
    Number(
      value,
    )


  if (
    !Number.isSafeInteger(
      parsed,
    ) ||
    parsed <
      1 ||
    parsed >
      MAX_LIMIT
  ) {
    return null
  }


  return parsed
}


function normalizeVenueRow(
  value:
    unknown,
): VenueSearchRow | null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }


  const row =
    value as Record<
      string,
      unknown
    >


  if (
    typeof row.id !==
      'string' ||
    row.id.trim()
      .length ===
      0
  ) {
    return null
  }


  const name =
    typeof row.name ===
      'string'
      ? row.name.trim()
      : ''


  /**
   * The venue selector cannot present a meaningful result without
   * a display name.
   */
  if (
    !name
  ) {
    return null
  }


  return {
    id:
      row.id,

    name,

    city:
      typeof row.city ===
        'string' &&
      row.city.trim()
        .length >
        0
        ? row.city.trim()
        : null,
  }
}


// ============================================================
// SEARCH SAFETY
// ============================================================

function escapeLikePattern(
  value: string,
): string {
  return value
    .replace(
      /\\/g,
      '\\\\',
    )
    .replace(
      /%/g,
      '\\%',
    )
    .replace(
      /_/g,
      '\\_',
    )
}