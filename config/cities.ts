export type CityPlanningConfig = {
  distances: {
    beforeInterstopMeters: {
      strict: number
      relaxed: number
    }
    afterInterstopMeters: {
      strict: number
      relaxed: number
    }
    maxAnchorDistanceMeters: {
      walk: number
      short_ride: number
      any: number
    }
  }
}

export type CityConfig = {
  name: string
  center: [number, number]
  zoom: number
  timezone: string // 🔥 NEW: Canonical IANA timezone
  planning: CityPlanningConfig
}

export const CITY_CONFIGS: Record<string, CityConfig> = {
  // 🇺🇸 United States

  atl: {
    name: 'Atlanta',
    center: [33.749, -84.388],
    zoom: 13.8,
    timezone: 'America/New_York',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 3500, relaxed: 4500 },
        afterInterstopMeters: { strict: 1600, relaxed: 2200 },
        maxAnchorDistanceMeters: {
          walk: 1400,
          short_ride: 2800,
          any: 4500,
        },
      },
    },
  },

  nyc: {
    name: 'New York City',
    center: [40.720894, -74.002213],
    zoom: 13.9,
    timezone: 'America/New_York',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 1800, relaxed: 2600 },
        afterInterstopMeters: { strict: 900, relaxed: 1400 },
        maxAnchorDistanceMeters: {
          walk: 900,
          short_ride: 1800,
          any: 3000,
        },
      },
    },
  },

  la: {
    name: 'Los Angeles',
    center: [34.0522, -118.2437],
    zoom: 13.85,
    timezone: 'America/Los_Angeles',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 5000, relaxed: 6500 },
        afterInterstopMeters: { strict: 2600, relaxed: 3600 },
        maxAnchorDistanceMeters: {
          walk: 1600,
          short_ride: 3800,
          any: 6000,
        },
      },
    },
  },

  mia: {
    name: 'Miami',
    center: [25.7617, -80.1918],
    zoom: 12.75,
    timezone: 'America/New_York',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 3200, relaxed: 4200 },
        afterInterstopMeters: { strict: 1500, relaxed: 2200 },
        maxAnchorDistanceMeters: {
          walk: 1400,
          short_ride: 2800,
          any: 4500,
        },
      },
    },
  },

  // 🇬🇧 United Kingdom

  london: {
    name: 'London',
    center: [51.5072, -0.1276],
    zoom: 13.8,
    timezone: 'Europe/London',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 2000, relaxed: 3000 },
        afterInterstopMeters: { strict: 1000, relaxed: 1600 },
        maxAnchorDistanceMeters: {
          walk: 1000,
          short_ride: 2000,
          any: 3200,
        },
      },
    },
  },

  // 🇵🇹 Portugal

  lisbon: {
    name: 'Lisbon',
    center: [38.7223, -9.1393],
    zoom: 13.8,
    timezone: 'Europe/Lisbon',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 2200, relaxed: 3200 },
        afterInterstopMeters: { strict: 1100, relaxed: 1700 },
        maxAnchorDistanceMeters: {
          walk: 1100,
          short_ride: 2200,
          any: 3500,
        },
      },
    },
  },

  porto: {
    name: 'Porto',
    center: [41.1579, -8.6291],
    zoom: 13.8,
    timezone: 'Europe/Lisbon',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 2400, relaxed: 3400 },
        afterInterstopMeters: { strict: 1200, relaxed: 1800 },
        maxAnchorDistanceMeters: {
          walk: 1100,
          short_ride: 2400,
          any: 3600,
        },
      },
    },
  },

  rome: {
    name: 'Rome',
    center: [41.9028, 12.4964],
    zoom: 12.75,
    timezone: 'Europe/Rome',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 2500, relaxed: 3600 },
        afterInterstopMeters: { strict: 1300, relaxed: 1900 },
        maxAnchorDistanceMeters: {
          walk: 1200,
          short_ride: 2600,
          any: 4000,
        },
      },
    },
  },

  // 🇫🇷 France

  paris: {
    name: 'Paris',
    center: [48.8566, 2.3522],
    zoom: 12.75,
    timezone: 'Europe/Paris',
    planning: {
      distances: {
        beforeInterstopMeters: { strict: 2000, relaxed: 3000 },
        afterInterstopMeters: { strict: 1000, relaxed: 1500 },
        maxAnchorDistanceMeters: {
          walk: 900,
          short_ride: 2000,
          any: 3200,
        },
      },
    },
  },
}