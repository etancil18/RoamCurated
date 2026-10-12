import 'server-only'

import { NextResponse } from 'next/server'
import type {
  SupabaseClient,
  User,
} from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin-runtime'

// ============================================================
// ROUTE POLICY
// ============================================================

export const dynamic =
  'force-dynamic'

export const runtime =
  'nodejs'

const SEARCH_RESULT_LIMIT =
  12

const AUTH_PAGE_SIZE =
  200

/**
 * Defensive ceiling for partial email directory scans.
 *
 * UUID lookups do not scan.
 * Full-name lookups do not scan the Auth directory.
 *
 * Email-oriented searches may scan Auth users because Supabase's
 * admin listUsers API is paginated rather than a public identity
 * search surface.
 *
 * 50 * 200 = 10,000 users maximum per request.
 *
 * If Roam grows beyond this point, replace the email scan with a
 * dedicated server-side database search RPC / indexed private
 * directory projection. Do not expose auth.users to PostgREST.
 */
const MAX_AUTH_SCAN_PAGES =
  50

const MIN_SEARCH_LENGTH =
  2

const MAX_SEARCH_LENGTH =
  200

// ============================================================
// ADMIN ACCESS
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
// INTERNAL TYPES
// ============================================================

type ProfileSearchRow = {
  id: string
  full_name: string | null
}

type AdminUserSearchResult = {
  id: string
  email: string | null
  fullName: string | null
}

type CandidateUser = {
  id: string
  email: string | null
  fullName: string | null
  matchedById: boolean
  matchedByEmail: boolean
  matchedByFullName: boolean
}

// ============================================================
// GET /api/admin/users/search?q=...
// ============================================================

export async function GET(
  request: Request
) {
  try {
    // ========================================================
    // AUTHENTICATE CALLER
    // ========================================================

    const authSupabase =
      await createServerClient()

    const {
      data: {
        user:
          adminUser,
      },
      error:
        authError,
    } =
      await authSupabase.auth.getUser()

    if (
      authError ||
      !adminUser
    ) {
      return jsonResponse(
        {
          error:
            'User not authenticated.',
        },
        401
      )
    }

    const adminEmail =
      adminUser.email
        ?.trim()
        .toLowerCase() ??
      ''

    if (
      !adminEmail ||
      !ALLOWED_ADMIN_EMAILS.has(
        adminEmail
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

    // ========================================================
    // SEARCH INPUT
    // ========================================================

    const url =
      new URL(
        request.url
      )

    const query =
      cleanQuery(
        url.searchParams.get(
          'q'
        )
      )

    if (
      !query ||
      query.length <
        MIN_SEARCH_LENGTH
    ) {
      return jsonResponse(
        {
          users: [],
        }
      )
    }

    if (
      query.length >
      MAX_SEARCH_LENGTH
    ) {
      return jsonResponse(
        {
          error:
            `Search query must be ${MAX_SEARCH_LENGTH} characters or fewer.`,
        },
        400
      )
    }

    // ========================================================
    // PRIVILEGED DIRECTORY CLIENT
    // ========================================================

    const admin =
      getSupabaseAdmin()

    /**
     * Results are merged by canonical auth/profile UUID.
     *
     * The route deliberately returns only:
     *
     *   id
     *   email
     *   fullName
     *
     * No auth metadata, timestamps, phone numbers, provider data,
     * profile privacy flags, or other account details leave the
     * server.
     */
    const candidates =
      new Map<
        string,
        CandidateUser
      >()

    // ========================================================
    // 1. EXACT UUID SEARCH
    //
    // This is the cheapest and most authoritative lookup.
    // ========================================================

    if (
      isUuid(
        query
      )
    ) {
      const exactUser =
        await loadAuthUserById(
          admin,
          query
        )

      if (
        exactUser
      ) {
        const profile =
          await loadProfileById(
            admin,
            exactUser.id
          )

        addCandidate(
          candidates,
          {
            id:
              exactUser.id,

            email:
              normalizeNullableString(
                exactUser.email
              ),

            fullName:
              normalizeNullableString(
                profile?.full_name
              ),

            matchedById:
              true,

            matchedByEmail:
              false,

            matchedByFullName:
              false,
          }
        )
      }

      return jsonResponse(
        {
          users:
            rankAndLimitCandidates(
              candidates,
              query
            ),
        }
      )
    }

    // ========================================================
    // 2. FULL-NAME SEARCH
    //
    // profiles.full_name is searched directly through the
    // service-role client.
    // ========================================================

    const profiles =
      await searchProfilesByFullName(
        admin,
        query
      )

    if (
      profiles.length >
      0
    ) {
      /**
       * Only enrich the matched profile IDs with their Auth email.
       *
       * This avoids scanning the entire private Auth directory for
       * ordinary name searches.
       */
      const authUsers =
        await loadAuthUsersByIds(
          admin,
          profiles.map(
            (
              profile
            ) =>
              profile.id
          )
        )

      const authUsersById =
        new Map(
          authUsers.map(
            (
              user
            ) => [
              user.id,
              user,
            ] as const
          )
        )

      for (
        const profile of
        profiles
      ) {
        const authUser =
          authUsersById.get(
            profile.id
          )

        addCandidate(
          candidates,
          {
            id:
              profile.id,

            email:
              normalizeNullableString(
                authUser?.email
              ),

            fullName:
              normalizeNullableString(
                profile.full_name
              ),

            matchedById:
              false,

            matchedByEmail:
              false,

            matchedByFullName:
              true,
          }
        )
      }
    }

    // ========================================================
    // 3. EMAIL SEARCH
    //
    // Search the private Auth directory when:
    //
    // - the query clearly looks email-oriented, OR
    // - full-name search returned nothing.
    //
    // This avoids an Auth-directory scan for every ordinary name
    // keystroke while still supporting partial email lookup.
    // ========================================================

    const shouldSearchEmail =
      looksEmailOriented(
        query
      ) ||
      candidates.size ===
        0

    if (
      shouldSearchEmail &&
      candidates.size <
        SEARCH_RESULT_LIMIT
    ) {
      const emailUsers =
        await searchAuthUsersByEmail(
          admin,
          query,
          SEARCH_RESULT_LIMIT
        )

      if (
        emailUsers.length >
        0
      ) {
        const emailUserIds =
          emailUsers.map(
            (
              user
            ) =>
              user.id
          )

        const emailProfiles =
          await loadProfilesByIds(
            admin,
            emailUserIds
          )

        const profilesById =
          new Map(
            emailProfiles.map(
              (
                profile
              ) => [
                profile.id,
                profile,
              ] as const
            )
          )

        for (
          const authUser of
          emailUsers
        ) {
          const profile =
            profilesById.get(
              authUser.id
            )

          addCandidate(
            candidates,
            {
              id:
                authUser.id,

              email:
                normalizeNullableString(
                  authUser.email
                ),

              fullName:
                normalizeNullableString(
                  profile?.full_name
                ),

              matchedById:
                false,

              matchedByEmail:
                true,

              matchedByFullName:
                false,
            }
          )
        }
      }
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return jsonResponse(
      {
        users:
          rankAndLimitCandidates(
            candidates,
            query
          ),
      }
    )
  } catch (
    error
  ) {
    console.error(
      '[admin/users/search] Unexpected failure:',
      {
        error,
      }
    )

    return jsonResponse(
      {
        error:
          'Could not search users.',
      },
      500
    )
  }
}

// ============================================================
// PROFILE SEARCH
// ============================================================

async function searchProfilesByFullName(
  admin: SupabaseClient,
  query: string
): Promise<ProfileSearchRow[]> {
  const escapedQuery =
    escapeLikePattern(
      query
    )

  const {
    data,
    error,
  } =
    await admin
      .from(
        'profiles'
      )
      .select(
        'id, full_name'
      )
      .not(
        'full_name',
        'is',
        null
      )
      .ilike(
        'full_name',
        `%${escapedQuery}%`
      )
      .limit(
        SEARCH_RESULT_LIMIT
      )
      .returns<
        ProfileSearchRow[]
      >()

  if (
    error
  ) {
    console.error(
      '[admin/users/search] Profile full-name lookup failed:',
      {
        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'PROFILE_SEARCH_FAILED'
    )
  }

  return data ?? []
}

async function loadProfileById(
  admin: SupabaseClient,
  userId: string
): Promise<ProfileSearchRow | null> {
  const {
    data,
    error,
  } =
    await admin
      .from(
        'profiles'
      )
      .select(
        'id, full_name'
      )
      .eq(
        'id',
        userId
      )
      .maybeSingle<
        ProfileSearchRow
      >()

  if (
    error
  ) {
    console.error(
      '[admin/users/search] Profile ID lookup failed:',
      {
        userId,

        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'PROFILE_LOOKUP_FAILED'
    )
  }

  return data ?? null
}

async function loadProfilesByIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<ProfileSearchRow[]> {
  const uniqueIds =
    Array.from(
      new Set(
        userIds
      )
    )

  if (
    uniqueIds.length ===
    0
  ) {
    return []
  }

  const {
    data,
    error,
  } =
    await admin
      .from(
        'profiles'
      )
      .select(
        'id, full_name'
      )
      .in(
        'id',
        uniqueIds
      )
      .returns<
        ProfileSearchRow[]
      >()

  if (
    error
  ) {
    console.error(
      '[admin/users/search] Profile enrichment lookup failed:',
      {
        userCount:
          uniqueIds.length,

        code:
          error.code,

        message:
          error.message,
      }
    )

    throw new Error(
      'PROFILE_ENRICHMENT_FAILED'
    )
  }

  return data ?? []
}

// ============================================================
// AUTH USER LOOKUPS
// ============================================================

async function loadAuthUserById(
  admin: SupabaseClient,
  userId: string
): Promise<User | null> {
  const {
    data,
    error,
  } =
    await admin.auth.admin.getUserById(
      userId
    )

  if (
    error
  ) {
    /**
     * A missing UUID should behave as an empty search result rather
     * than as a server failure.
     */
    if (
      isAuthUserNotFoundError(
        error
      )
    ) {
      return null
    }

    console.error(
      '[admin/users/search] Auth user ID lookup failed:',
      {
        userId,

        message:
          error.message,
      }
    )

    throw new Error(
      'AUTH_USER_LOOKUP_FAILED'
    )
  }

  return data.user ?? null
}

async function loadAuthUsersByIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<User[]> {
  const uniqueIds =
    Array.from(
      new Set(
        userIds
      )
    ).slice(
      0,
      SEARCH_RESULT_LIMIT
    )

  const results =
    await Promise.all(
      uniqueIds.map(
        async (
          userId
        ) => {
          try {
            return await loadAuthUserById(
              admin,
              userId
            )
          } catch (
            error
          ) {
            /**
             * A single stale/broken account should not make every
             * otherwise valid full-name result disappear.
             */
            console.error(
              '[admin/users/search] Auth enrichment failed for profile:',
              {
                userId,

                error,
              }
            )

            return null
          }
        }
      )
    )

  return results.filter(
    (
      user
    ): user is User =>
      Boolean(
        user
      )
  )
}

async function searchAuthUsersByEmail(
  admin: SupabaseClient,
  query: string,
  limit: number
): Promise<User[]> {
  const normalizedQuery =
    query
      .trim()
      .toLowerCase()

  const matches: User[] =
    []

  let exactMatch:
    User | null =
    null

  for (
    let page = 1;
    page <=
    MAX_AUTH_SCAN_PAGES;
    page +=
    1
  ) {
    const {
      data,
      error,
    } =
      await admin.auth.admin.listUsers(
        {
          page,
          perPage:
            AUTH_PAGE_SIZE,
        }
      )

    if (
      error
    ) {
      console.error(
        '[admin/users/search] Auth email directory lookup failed:',
        {
          page,

          message:
            error.message,
        }
      )

      throw new Error(
        'AUTH_EMAIL_SEARCH_FAILED'
      )
    }

    const users =
      data.users ??
      []

    for (
      const user of
      users
    ) {
      const email =
        user.email
          ?.trim()
          .toLowerCase()

      if (
        !email
      ) {
        continue
      }

      if (
        email ===
        normalizedQuery
      ) {
        exactMatch =
          user

        break
      }

      if (
        email.includes(
          normalizedQuery
        )
      ) {
        matches.push(
          user
        )

        if (
          matches.length >=
          limit
        ) {
          break
        }
      }
    }

    if (
      exactMatch
    ) {
      break
    }

    if (
      matches.length >=
      limit
    ) {
      break
    }

    if (
      users.length <
      AUTH_PAGE_SIZE
    ) {
      break
    }
  }

  if (
    exactMatch
  ) {
    return [
      exactMatch,
      ...matches.filter(
        (
          user
        ) =>
          user.id !==
          exactMatch?.id
      ),
    ].slice(
      0,
      limit
    )
  }

  return matches.slice(
    0,
    limit
  )
}

// ============================================================
// RESULT MERGE / RANKING
// ============================================================

function addCandidate(
  candidates: Map<
    string,
    CandidateUser
  >,
  candidate: CandidateUser
) {
  const existing =
    candidates.get(
      candidate.id
    )

  if (
    !existing
  ) {
    candidates.set(
      candidate.id,
      candidate
    )

    return
  }

  candidates.set(
    candidate.id,
    {
      id:
        existing.id,

      email:
        existing.email ??
        candidate.email,

      fullName:
        existing.fullName ??
        candidate.fullName,

      matchedById:
        existing.matchedById ||
        candidate.matchedById,

      matchedByEmail:
        existing.matchedByEmail ||
        candidate.matchedByEmail,

      matchedByFullName:
        existing.matchedByFullName ||
        candidate.matchedByFullName,
    }
  )
}

function rankAndLimitCandidates(
  candidates: Map<
    string,
    CandidateUser
  >,
  query: string
): AdminUserSearchResult[] {
  const normalizedQuery =
    query
      .trim()
      .toLowerCase()

  return Array.from(
    candidates.values()
  )
    .sort(
      (
        left,
        right
      ) => {
        const leftScore =
          scoreCandidate(
            left,
            normalizedQuery
          )

        const rightScore =
          scoreCandidate(
            right,
            normalizedQuery
          )

        if (
          leftScore !==
          rightScore
        ) {
          return (
            rightScore -
            leftScore
          )
        }

        const leftName =
          left.fullName ??
          left.email ??
          left.id

        const rightName =
          right.fullName ??
          right.email ??
          right.id

        return leftName.localeCompare(
          rightName
        )
      }
    )
    .slice(
      0,
      SEARCH_RESULT_LIMIT
    )
    .map(
      (
        candidate
      ) => ({
        id:
          candidate.id,

        email:
          candidate.email,

        fullName:
          candidate.fullName,
      })
    )
}

function scoreCandidate(
  candidate: CandidateUser,
  normalizedQuery: string
): number {
  const normalizedEmail =
    candidate.email
      ?.toLowerCase() ??
    ''

  const normalizedFullName =
    candidate.fullName
      ?.toLowerCase() ??
    ''

  if (
    candidate.id.toLowerCase() ===
    normalizedQuery
  ) {
    return 1000
  }

  if (
    normalizedEmail ===
    normalizedQuery
  ) {
    return 900
  }

  if (
    normalizedFullName ===
    normalizedQuery
  ) {
    return 800
  }

  if (
    normalizedEmail.startsWith(
      normalizedQuery
    )
  ) {
    return 700
  }

  if (
    normalizedFullName.startsWith(
      normalizedQuery
    )
  ) {
    return 600
  }

  if (
    candidate.matchedByEmail
  ) {
    return 500
  }

  if (
    candidate.matchedByFullName
  ) {
    return 400
  }

  if (
    candidate.matchedById
  ) {
    return 300
  }

  return 0
}

// ============================================================
// SEARCH NORMALIZATION
// ============================================================

function cleanQuery(
  value: string | null
): string {
  return (
    value
      ?.trim()
      .replace(
        /\s+/g,
        ' '
      )
      .slice(
        0,
        MAX_SEARCH_LENGTH +
          1
      ) ??
    ''
  )
}

function looksEmailOriented(
  query: string
): boolean {
  return (
    query.includes(
      '@'
    ) ||
    query.includes(
      '.com'
    ) ||
    query.includes(
      '.net'
    ) ||
    query.includes(
      '.org'
    ) ||
    query.includes(
      '.co'
    )
  )
}

/**
 * Escape PostgreSQL LIKE/ILIKE wildcard characters so user input is
 * treated as literal search text rather than as a pattern language.
 */
function escapeLikePattern(
  value: string
): string {
  return value.replace(
    /[\\%_]/g,
    (
      match
    ) =>
      `\\${match}`
  )
}

// ============================================================
// AUTH ERROR NORMALIZATION
// ============================================================

function isAuthUserNotFoundError(
  error: {
    message?: string
    status?: number
  }
): boolean {
  const message =
    error.message
      ?.toLowerCase() ??
    ''

  return (
    error.status ===
      404 ||
    message.includes(
      'user not found'
    ) ||
    message.includes(
      'not found'
    )
  )
}

// ============================================================
// VALUES
// ============================================================

function normalizeNullableString(
  value:
    | string
    | null
    | undefined
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized
    ? normalized
    : null
}

// ============================================================
// IDENTIFIERS
// ============================================================

function isUuid(
  value: string
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

// ============================================================
// RESPONSE
// ============================================================

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