// lib/maps/basemaps.ts

export const CARTO_DARK_BASEMAP_URL =
  `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY}`

export const CARTO_BASEMAP_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; CARTO'