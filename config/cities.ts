export type CityConfig = {
  name: string
  center: [number, number]
  zoom: number
  timezone: string // 🔥 NEW: Canonical IANA timezone
}

export const CITY_CONFIGS: Record<string, CityConfig> = {
  // 🇺🇸 United States

  atl: {
    name: 'Atlanta',
    center: [33.749, -84.388],
    zoom: 12,
    timezone: 'America/New_York',
  },

  nyc: {
    name: 'New York City',
    center: [40.73061, -73.935242],
    zoom: 12,
    timezone: 'America/New_York',
  },

  la: {
    name: 'Los Angeles',
    center: [34.0522, -118.2437],
    zoom: 12,
    timezone: 'America/Los_Angeles',
  },

  mia: {
    name: 'Miami',
    center: [25.7617, -80.1918],
    zoom: 12,
    timezone: 'America/New_York',
  },


  // 🇬🇧 United Kingdom

  london: {
    name: 'London',
    center: [51.5072, -0.1276],
    zoom: 12,
    timezone: 'Europe/London',
  },

  // 🇵🇹 Portugal

  lisbon: {
    name: 'Lisbon',
    center: [38.7223, -9.1393],
    zoom: 12,
    timezone: 'Europe/Lisbon',
  },

  porto: {
    name: 'Porto',
    center: [41.1579, -8.6291],
    zoom: 10,
    timezone: 'Europe/Lisbon',
  },


  rome: {
    name: 'Rome',
    center: [41.9028, 12.4964],
    zoom: 12,
    timezone: 'Europe/Rome',
  },

  // 🇫🇷 France

  paris: {
    name: 'Paris',
    center: [48.8566, 2.3522],
    zoom: 12,
    timezone: 'Europe/Paris',
  },
}