// /pages/api/mapbox.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { getRouteFromMapbox } from '@/utils/mapbox'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { origin, destination, waypoints, travelMode = 'walking' } = req.body

    if (!origin || !destination || !Array.isArray(waypoints)) {
      return res.status(400).json({ error: 'Missing or invalid route parameters' })
    }

    const result = await getRouteFromMapbox({ origin, destination, waypoints, travelMode })
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Mapbox API error:', error)
    return res.status(500).json({ error: error.message || 'Unknown error occurred' })
  }
}