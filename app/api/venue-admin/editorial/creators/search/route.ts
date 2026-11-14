
import 'server-only'

import { NextResponse } from 'next/server'
import { requireVenueAdmin } from '@/lib/admin/requireVenueAdmin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 80
const MAX_RESULTS = 20

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: Request) {
  try {
    const auth = await requireVenueAdmin()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)

    const query = (
      searchParams.get('query') ?? ''
    ).trim()

    if (query.length < MIN_QUERY_LENGTH) {
      return json(
        {
          error: 'Enter at least 2 characters to search users.',
        },
        400,
      )
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return json(
        {
          error: 'Search query is too long.',
        },
        400,
      )
    }

    // Escape PostgREST filter syntax and SQL LIKE
    // wildcards so the input is treated as a literal
    // username/name search, not filter expressions.
    const escapedQuery = query
      .replace(/\\/g, '\\\\')
      .replace(/[%_]/g, '\\$&')
      .replace(/[,().]/g, ' ')

    const searchTerm = `%${escapedQuery.trim()}%`

    const { data: creators, error } =
      await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name')
        .or(
          `username.ilike.${searchTerm},full_name.ilike.${searchTerm}`,
        )
        .order('username', {
          ascending: true,
          nullsFirst: false,
        })
        .limit(MAX_RESULTS)

    if (error) throw error

    return json({
      creators: creators ?? [],
    })
  } catch (error) {
    console.error(
      '[editorial/creators/search] GET failed:',
      error,
    )

    return json(
      {
        error: 'Could not search Roam users.',
      },
      500,
    )
  }
}
