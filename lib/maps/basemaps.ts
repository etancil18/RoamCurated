// lib/maps/basemaps.ts

const CARTO_BASEMAP_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY

if (!CARTO_BASEMAP_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_CARTO_BASEMAP_KEY environment variable'
  )
}

export const CARTO_DARK_BASEMAP_URL =
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASEMAP_KEY}`

export const CARTO_BASEMAP_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO'