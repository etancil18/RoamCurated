const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN!

export const getRouteFromMapbox = async ({
  origin,
  destination,
  waypoints,
  travelMode = 'walking',
}: {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  waypoints: { lat: number; lng: number }[]
  travelMode?: 'walking' | 'cycling' | 'driving'
}) => {
  const baseUrl = 'https://api.mapbox.com/directions/v5/mapbox'
  const coords = [
    `${origin.lng},${origin.lat}`,
    ...waypoints.map((w) => `${w.lng},${w.lat}`),
    `${destination.lng},${destination.lat}`,
  ].join(';')

  const url = `${baseUrl}/${travelMode}/${coords}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`

  const response = await fetch(url)
  if (!response.ok) {
    console.error('Mapbox Directions API error', await response.text())
    throw new Error('Failed to fetch route from Mapbox')
  }

  const data = await response.json()
  const route = data.routes?.[0]

  if (!route) {
    throw new Error('No route found from Mapbox')
  }

  return {
    duration: Math.round(route.duration), // seconds
    distance: Math.round(route.distance), // meters
    geometry: route.geometry.coordinates, // [lng, lat][]
    metadata: {
      stopsCount: waypoints.length + 2,
      generator: 'auto',
      timeOfDay: new Date().toLocaleTimeString(),
    },
  }
}
