// /pages/api/logRoute.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // DO NOT expose this key client-side
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const {
    userId,
    crawlTheme,
    origin,
    destination,
    waypoints,
    routeDuration,
    routeDistance,
    routeGeometry,
    routeMetadata,
  } = req.body

  console.log('Incoming logRoute payload:', {
    userId,
    crawlTheme,
    origin,
    destination,
    waypoints,
    routeDuration,
    routeDistance,
    routeGeometry,
  })

  if (
    !userId ||
    !crawlTheme ||
    !origin?.lat ||
    !origin?.lng ||
    !destination?.lat ||
    !destination?.lng ||
    typeof routeDuration !== 'number' ||
    typeof routeDistance !== 'number' ||
    !Array.isArray(routeGeometry) ||
    routeGeometry.length < 2
  ) {
    return res.status(400).json({ error: 'Missing or invalid route parameters' })
  }

  try {
    const insertPayload = {
      user_id: userId,
      crawl_theme: crawlTheme,
      origin: `SRID=4326;POINT(${origin.lng} ${origin.lat})`,
      destination: `SRID=4326;POINT(${destination.lng} ${destination.lat})`,
      waypoints,
      route_geometry: `SRID=4326;LINESTRING(${routeGeometry
        .map(([lng, lat]: [number, number]) => `${lng} ${lat}`)
        .join(', ')})`,
      route_duration_seconds: routeDuration,
      route_distance_meters: routeDistance,
      route_metadata: routeMetadata ?? {},
    }

    const { error } = await supabase.from('route_requests').insert([insertPayload])

    if (error) {
      console.error('❌ Supabase insert error:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('❌ logRoute API error:', err)
    return res.status(500).json({ error: err.message || 'Unknown error occurred' })
  }
}
