export type CityConfig = {
  name: string
  center: [number, number]
  zoom: number
}

export const CITY_CONFIGS: Record<string, CityConfig> = {
  atl: {
    name: 'Atlanta',
    center: [33.749, -84.388],
    zoom: 12,
  },
  nyc: {
    name: 'New York City',
    center: [40.73061, -73.935242],
    zoom: 12,
  },
  la: {
    name: 'Los Angeles',
    center: [34.0522, -118.2437],
    zoom: 12,
  },
  mia: {
    name: 'Miami',
    center: [25.7617, -80.1918],
    zoom: 12,
  },
  chi: {
    name: 'Chicago',
    center: [41.8781, -87.6298],
    zoom: 12,
  },
  sf: {
    name: 'San Francisco',
    center: [37.7749, -122.4194],
    zoom: 12,
  },
}
