import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  loadCurrentCommunityHappeningsForVenue,
  loadCurrentCommunityPlaceIntelligenceForVenue,
} from '@/lib/community-signals/liveIntelligence.server'

import {
  supabaseServerApi,
} from '@/lib/supabase/server-api'

function normalizeVenueId(
  value: string | null
): string | null {
  if (!value) {
    return null
  }

  const normalized =
    value.trim()

  if (
    normalized.length === 0 ||
    normalized.length > 100
  ) {
    return null
  }

  return normalized
}

export async function GET(
  req: NextRequest
) {
  const venueId =
    normalizeVenueId(
      req.nextUrl.searchParams.get(
        'venue_id'
      )
    )

  if (!venueId) {
    return NextResponse.json(
      {
        error:
          'A venue is required.',
      },
      {
        status: 400,
      }
    )
  }

  try {
    /**
     * Viewer identity is optional because this live-intelligence
     * endpoint remains readable without authentication.
     *
     * When an authenticated session exists, only the server-derived
     * user id may be used to decorate occurrence-based happenings
     * with durable viewer response state.
     *
     * No client-supplied viewer identity is accepted.
     */
    const supabase =
      await supabaseServerApi()

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser()

    const viewerUserId =
      user?.id ??
      null

    const [
      placeSignals,
      happenings,
    ] = await Promise.all([
      loadCurrentCommunityPlaceIntelligenceForVenue({
        venueId,
      }),

      loadCurrentCommunityHappeningsForVenue({
        venueId,

        viewerUserId,
      }),
    ])

    return NextResponse.json(
      {
        place_signals:
          placeSignals,

        happenings,
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  } catch (error) {
    console.error(
      '[community-signals/live][GET] Failed to load place intelligence:',
      {
        venueId,
        error,
      }
    )

    return NextResponse.json(
      {
        error:
          'Could not load community signals.',
      },
      {
        status: 500,
      }
    )
  }
}