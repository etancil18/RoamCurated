import 'server-only'

import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  loadCurrentCommunityPlaceIntelligenceForVenue,
} from '@/lib/community-signals/liveIntelligence.server'

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
    const placeSignals =
      await loadCurrentCommunityPlaceIntelligenceForVenue({
        venueId,
      })

    return NextResponse.json(
      {
        place_signals:
          placeSignals,
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