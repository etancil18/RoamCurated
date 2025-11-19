// app/api/generate-theme/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { themeById } from '@/lib/crawlConfig'
import { generateThemeRoute } from '@/lib/theme-engine'
import type { Venue } from '@/types/venue'

/**
 * Per‑city distance thresholds for “tightness”
 * All values are maximum allowed meters between stops.
 */
const CITY_DISTANCE_THRESHOLDS = {
  atl: {
    tight: 1000,
    medium: 2500,
    loose: 4500,
  },
  nyc: {
    tight: 750,
    medium: 1400,
    loose: 2100,
  },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      themeId,
      venues,
      userLat,
      userLon,
      options = {},
      city,
    } = body as {
      themeId: string
      venues: Venue[]
      userLat: number
      userLon: number
      options?: Record<string, any>
      city?: 'atl' | 'nyc'
    }

    /** ------------------ Validation ------------------ **/

    if (!themeId || typeof themeId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid themeId' }, { status: 400 })
    }

    const theme = themeById[themeId]
    if (!theme) {
      return NextResponse.json({ error: `Theme not found: ${themeId}` }, { status: 404 })
    }

    if (!Array.isArray(venues) || venues.length === 0) {
      return NextResponse.json({ error: 'Venues must be a non-empty array.' }, { status: 400 })
    }

    if (
      typeof userLat !== 'number' ||
      typeof userLon !== 'number' ||
      isNaN(userLat) ||
      isNaN(userLon)
    ) {
      return NextResponse.json({ error: 'Invalid or missing user location.' }, { status: 400 })
    }

    if (!city || (city !== 'atl' && city !== 'nyc')) {
      return NextResponse.json(
        { error: 'Missing or invalid city (must be atl or nyc).' },
        { status: 400 }
      )
    }

    /** ------------------ Tightness → Max Distance ------------------ **/

    const tightness: 'tight' | 'medium' | 'loose' = options.tightness ?? 'medium'

    const maxDistanceMeters =
      CITY_DISTANCE_THRESHOLDS[city]?.[tightness] ??
      CITY_DISTANCE_THRESHOLDS[city].medium

    console.log('📏 Route tightness:', tightness)
    console.log('📏 Max allowable hop distance (m):', maxDistanceMeters)

    /** ------------------ Custom Start Logic ------------------ **/

    const startTime = options.startTime ? new Date(options.startTime) : new Date()
    const customLat = options.customStart?.lat
    const customLon = options.customStart?.lon

    const originLat =
      typeof customLat === 'number' && !isNaN(customLat) ? customLat : userLat
    const originLon =
      typeof customLon === 'number' && !isNaN(customLon) ? customLon : userLon

    console.log('🎨 Theme‑based route input:', {
      theme: theme.name,
      startLat: originLat,
      startLon: originLon,
      totalVenues: venues.length,
      options,
    })

    /** ------------------ Primary Route Attempt ------------------ **/

    const route = await generateThemeRoute({
      themeId,
      venues,
      userLat: originLat,
      userLon: originLon,
      maxStops: options.maxStops ?? 6,
      filterOpen: options.filterOpen ?? true,
      maxDistanceMeters, // NEW 🧠
    })

    if (!route || route.length === 0) {
      console.warn('⚠️ Primary theme route generation failed. Attempting fallback without open filter…')

      /** ------------------ Fallback Attempt ------------------ **/
      const fallbackRoute = await generateThemeRoute({
        themeId,
        venues,
        userLat: originLat,
        userLon: originLon,
        maxStops: options.maxStops ?? 6,
        filterOpen: false,
        maxDistanceMeters, // STILL enforce distance rules 🔥
      })

      if (!fallbackRoute || fallbackRoute.length === 0) {
        return NextResponse.json(
          { error: 'No valid route could be generated, even with fallback.' },
          { status: 422 }
        )
      }

      console.log(`✅ Fallback theme route generated with ${fallbackRoute.length} stops`)
      return NextResponse.json({ route: fallbackRoute, fallbackUsed: true })
    }

    /** ------------------ Success ------------------ **/

    console.log(`✅ Theme route generated with ${route.length} stops`)
    return NextResponse.json({ route, fallbackUsed: false })

  } catch (err: any) {
    console.error('❌ Theme route generation failed:', err)
    return NextResponse.json(
      {
        error: 'Route generation failed.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
