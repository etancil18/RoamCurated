
import 'server-only'

import { NextResponse } from 'next/server'

import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type VenueSearchResult = {
  id: string
  name: string
  city: string | null
  matched_on: string | null
}

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function normalizeVenue(
  value: unknown,
): VenueSearchResult | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null
  }

  const row = value as Record<string, unknown>

  if (
    typeof row.id !== 'string' ||
    typeof row.name !== 'string' ||
    !row.name.trim()
  ) {
    return null
  }

  return {
    id: row.id,
    name: row.name.trim(),
    city:
      typeof row.city === 'string'
        ? row.city
        : null,
    matched_on:
      typeof row.matched_on === 'string'
        ? row.matched_on
        : null,
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireVenueAdmin()

    if (!auth.ok) {
      return auth.response
    }

    const url = new URL(request.url)

    const query = (url.searchParams.get('q') ?? '')
      .replace(/\s+/g, ' ')
      .trim()

    if (
      query.length < MIN_QUERY_LENGTH ||
      query.length > MAX_QUERY_LENGTH
    ) {
      return json(
        {
          error:
            `Search must contain ${MIN_QUERY_LENGTH}–${MAX_QUERY_LENGTH} characters.`,
        },
        400,
      )
    }

    const rawLimit = url.searchParams.get('limit')

    const limit =
      rawLimit === null
        ? DEFAULT_LIMIT
        : Number(rawLimit)

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_LIMIT
    ) {
      return json(
        {
          error:
            `Limit must be an integer between 1 and ${MAX_LIMIT}.`,
        },
        400,
      )
    }

    const { data, error } = await supabaseAdmin.rpc(
      'roam_editorial_search_venues',
      {
        p_query: query,
        p_limit: limit,
      },
    )

    if (error) {
      console.error(
        '[venue-admin/editorial/venues/search] Failed:',
        error,
      )

      return json(
        { error: 'Could not search editorial venues.' },
        500,
      )
    }

    const venues = (Array.isArray(data) ? data : [])
      .map((value: unknown) => normalizeVenue(value))
      .filter(
        (venue): venue is VenueSearchResult =>
          venue !== null,
      )

    return json({ venues })
  } catch (error) {
    console.error(
      '[venue-admin/editorial/venues/search] Unexpected error:',
      error,
    )

    return json(
      { error: 'Unexpected error searching venues.' },
      500,
    )
  }
}
