
import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  EXPLORE_EXCLUDED_CITY,
  evaluateExploreVenueEligibility,
  getEligibleExploreVenues,
  getExploreVenueCoordinates,
  isExploreCityEligible,
  isExploreVenueEligible,
  normalizeExploreCity,
  type ExploreVenueEligibilityInput,
} from './venueEligibility'

/* =========================================================
 * Fixtures
 * ======================================================= */

const VALID_VENUE_ID =
  '11111111-1111-4111-8111-111111111111'

const SECOND_VALID_VENUE_ID =
  '22222222-2222-4222-8222-222222222222'

const THIRD_VALID_VENUE_ID =
  '33333333-3333-4333-8333-333333333333'

const LIVE_CITIES = [
  'atl',
  'nyc',
  'london',
  'los angeles',
  'lisbon',
  'porto',
] as const

function createValidVenue(
  overrides: Partial<ExploreVenueEligibilityInput> = {}
): ExploreVenueEligibilityInput {
  return {
    id: VALID_VENUE_ID,
    name: 'Roam Test Venue',
    city: 'atl',
    lat: 33.749,
    lon: -84.388,
    profile_status: 'draft',
    ...overrides,
  }
}

/* =========================================================
 * Configuration
 * ======================================================= */

describe('Explore venue eligibility', () => {
  describe('EXPLORE_EXCLUDED_CITY', () => {
    it('defines oob as the excluded city classification', () => {
      expect(
        EXPLORE_EXCLUDED_CITY
      ).toBe('oob')
    })
  })

  /* =======================================================
   * City eligibility
   * ===================================================== */

  describe('isExploreCityEligible', () => {
    it.each(LIVE_CITIES)(
      'accepts live city classification %s',
      (city) => {
        expect(
          isExploreCityEligible(city)
        ).toBe(true)
      }
    )

    it.each([
      'oob',
      'OOB',
      'OoB',
      ' oob ',
      '\tOOB\n',
    ])(
      'rejects OOB classification %j',
      (city) => {
        expect(
          isExploreCityEligible(city)
        ).toBe(false)
      }
    )

    it.each([
      null,
      undefined,
      '',
      ' ',
      '\t\n',
      123,
      false,
      [],
      {},
    ])(
      'rejects invalid city input %j',
      (city) => {
        expect(
          isExploreCityEligible(city)
        ).toBe(false)
      }
    )

    it('allows future live cities without a hardcoded allowlist', () => {
      expect(
        isExploreCityEligible('chicago')
      ).toBe(true)

      expect(
        isExploreCityEligible('tokyo')
      ).toBe(true)
    })
  })

  describe('normalizeExploreCity', () => {
    it('trims whitespace while preserving stored city spelling', () => {
      expect(
        normalizeExploreCity('  los angeles  ')
      ).toBe('los angeles')

      expect(
        normalizeExploreCity('  New York  ')
      ).toBe('New York')
    })

    it('does not silently convert database city values to map codes', () => {
      expect(
        normalizeExploreCity('los angeles')
      ).toBe('los angeles')

      expect(
        normalizeExploreCity('nyc')
      ).toBe('nyc')
    })

    it.each([
      null,
      undefined,
      '',
      '   ',
      42,
      [],
      {},
    ])(
      'returns null for invalid city input %j',
      (city) => {
        expect(
          normalizeExploreCity(city)
        ).toBeNull()
      }
    )
  })

  /* =======================================================
   * Coordinate validation
   * ===================================================== */

  describe('getExploreVenueCoordinates', () => {
    it('accepts valid numeric coordinates', () => {
      expect(
        getExploreVenueCoordinates({
          lat: 33.749,
          lon: -84.388,
        })
      ).toEqual({
        lat: 33.749,
        lon: -84.388,
      })
    })

    it('accepts finite numeric strings', () => {
      expect(
        getExploreVenueCoordinates({
          lat: ' 33.749 ',
          lon: ' -84.388 ',
        })
      ).toEqual({
        lat: 33.749,
        lon: -84.388,
      })
    })

    it('accepts legitimate geographic boundary coordinates', () => {
      expect(
        getExploreVenueCoordinates({
          lat: -90,
          lon: -180,
        })
      ).toEqual({
        lat: -90,
        lon: -180,
      })

      expect(
        getExploreVenueCoordinates({
          lat: 90,
          lon: 180,
        })
      ).toEqual({
        lat: 90,
        lon: 180,
      })
    })

    it('accepts the geographic origin as valid coordinates', () => {
      expect(
        getExploreVenueCoordinates({
          lat: 0,
          lon: 0,
        })
      ).toEqual({
        lat: 0,
        lon: 0,
      })
    })

    it.each([
      {
        label: 'missing latitude',
        lat: undefined,
        lon: -84.388,
      },
      {
        label: 'missing longitude',
        lat: 33.749,
        lon: undefined,
      },
      {
        label: 'null latitude',
        lat: null,
        lon: -84.388,
      },
      {
        label: 'null longitude',
        lat: 33.749,
        lon: null,
      },
      {
        label: 'empty latitude string',
        lat: '',
        lon: -84.388,
      },
      {
        label: 'whitespace-only longitude',
        lat: 33.749,
        lon: '   ',
      },
      {
        label: 'non-numeric latitude',
        lat: 'north',
        lon: -84.388,
      },
      {
        label: 'non-numeric longitude',
        lat: 33.749,
        lon: 'west',
      },
      {
        label: 'latitude above maximum',
        lat: 90.0001,
        lon: 0,
      },
      {
        label: 'latitude below minimum',
        lat: -90.0001,
        lon: 0,
      },
      {
        label: 'longitude above maximum',
        lat: 0,
        lon: 180.0001,
      },
      {
        label: 'longitude below minimum',
        lat: 0,
        lon: -180.0001,
      },
      {
        label: 'NaN latitude',
        lat: Number.NaN,
        lon: 0,
      },
      {
        label: 'infinite latitude',
        lat: Number.POSITIVE_INFINITY,
        lon: 0,
      },
      {
        label: 'negative infinite longitude',
        lat: 0,
        lon: Number.NEGATIVE_INFINITY,
      },
      {
        label: 'boolean latitude',
        lat: true,
        lon: 0,
      },
    ])(
      'rejects $label',
      ({ lat, lon }) => {
        expect(
          getExploreVenueCoordinates({
            lat,
            lon,
          })
        ).toBeNull()
      }
    )
  })

  /* =======================================================
   * Primary eligibility evaluator
   * ===================================================== */

  describe('evaluateExploreVenueEligibility', () => {
    it('accepts a valid live venue and normalizes its identity', () => {
      expect(
        evaluateExploreVenueEligibility(
          createValidVenue()
        )
      ).toEqual({
        eligible: true,
        venue: {
          id: VALID_VENUE_ID,
          name: 'Roam Test Venue',
          city: 'atl',
          coordinates: {
            lat: 33.749,
            lon: -84.388,
          },
          supportsDistance: true,
        },
      })
    })

    it.each(LIVE_CITIES)(
      'accepts venues in %s',
      (city) => {
        const result =
          evaluateExploreVenueEligibility(
            createValidVenue({
              city,
            })
          )

        expect(
          result.eligible
        ).toBe(true)

        if (result.eligible) {
          expect(
            result.venue.city
          ).toBe(city)
        }
      }
    )

    it('preserves the legacy draft status as eligible for Explore', () => {
      const result =
        evaluateExploreVenueEligibility(
          createValidVenue({
            profile_status: 'draft',
          })
        )

      expect(
        result.eligible
      ).toBe(true)
    })

    it.each([
      null,
      undefined,
      '',
      'draft',
      'published',
      'archived',
      'unknown',
    ])(
      'does not use profile_status %j as an Explore publication gate',
      (status) => {
        const result =
          evaluateExploreVenueEligibility(
            createValidVenue({
              profile_status: status,
            })
          )

        expect(
          result.eligible
        ).toBe(true)
      }
    )

    it.each([
      'oob',
      'OOB',
      ' OoB ',
      '\toob\n',
    ])(
      'rejects venue with OOB city %j',
      (city) => {
        expect(
          evaluateExploreVenueEligibility(
            createValidVenue({
              city,
            })
          )
        ).toEqual({
          eligible: false,
          reason: 'out_of_bounds',
        })
      }
    )

    it.each([
      null,
      undefined,
      '',
      ' ',
      42,
      {},
    ])(
      'rejects invalid city classification %j',
      (city) => {
        expect(
          evaluateExploreVenueEligibility(
            createValidVenue({
              city,
            })
          )
        ).toEqual({
          eligible: false,
          reason: 'invalid_city',
        })
      }
    )

    it('normalizes UUID casing, name whitespace, and city whitespace', () => {
      expect(
        evaluateExploreVenueEligibility(
          createValidVenue({
            id: VALID_VENUE_ID.toUpperCase(),
            name: '  Roam   Test \n Venue  ',
            city: '  atl  ',
          })
        )
      ).toEqual({
        eligible: true,
        venue: {
          id: VALID_VENUE_ID,
          name: 'Roam Test Venue',
          city: 'atl',
          coordinates: {
            lat: 33.749,
            lon: -84.388,
          },
          supportsDistance: true,
        },
      })
    })

    it.each([
      null,
      undefined,
      '',
      'not-a-uuid',
      '11111111-1111-1111-1111-111111111111',
      123,
      {},
    ])(
      'rejects invalid canonical venue ID %j',
      (id) => {
        expect(
          evaluateExploreVenueEligibility(
            createValidVenue({
              id,
            })
          )
        ).toEqual({
          eligible: false,
          reason: 'invalid_id',
        })
      }
    )

    it.each([
      null,
      undefined,
      '',
      '  ',
      123,
      {},
    ])(
      'rejects invalid venue name %j',
      (name) => {
        expect(
          evaluateExploreVenueEligibility(
            createValidVenue({
              name,
            })
          )
        ).toEqual({
          eligible: false,
          reason: 'invalid_name',
        })
      }
    )

    it('keeps a live venue discoverable when coordinates are missing', () => {
      expect(
        evaluateExploreVenueEligibility(
          createValidVenue({
            lat: null,
            lon: null,
          })
        )
      ).toEqual({
        eligible: true,
        venue: {
          id: VALID_VENUE_ID,
          name: 'Roam Test Venue',
          city: 'atl',
          coordinates: null,
          supportsDistance: false,
        },
      })
    })

    it('disables distance support for out-of-range coordinates', () => {
      const result =
        evaluateExploreVenueEligibility(
          createValidVenue({
            lat: 100,
            lon: -84.388,
          })
        )

      expect(
        result
      ).toEqual({
        eligible: true,
        venue: {
          id: VALID_VENUE_ID,
          name: 'Roam Test Venue',
          city: 'atl',
          coordinates: null,
          supportsDistance: false,
        },
      })
    })

    it('does not mistake missing coordinates for (0, 0)', () => {
      const result =
        evaluateExploreVenueEligibility(
          createValidVenue({
            lat: '',
            lon: '',
          })
        )

      expect(
        result.eligible
      ).toBe(true)

      if (result.eligible) {
        expect(
          result.venue.coordinates
        ).toBeNull()

        expect(
          result.venue.supportsDistance
        ).toBe(false)
      }
    })

    it('does not forward sensitive or unrelated database fields', () => {
      const input = {
        ...createValidVenue(),
        access_token: 'private-token',
        contact: ['private-contact'],
        internal_notes: 'Do not expose',
        description: 'Public description',
        tags: ['coffee'],
      }

      const result =
        evaluateExploreVenueEligibility(
          input
        )

      expect(
        result.eligible
      ).toBe(true)

      if (result.eligible) {
        expect(
          Object.keys(result.venue).sort()
        ).toEqual([
          'city',
          'coordinates',
          'id',
          'name',
          'supportsDistance',
        ])

        expect(
          'access_token' in result.venue
        ).toBe(false)

        expect(
          'contact' in result.venue
        ).toBe(false)

        expect(
          'internal_notes' in result.venue
        ).toBe(false)
      }
    })

    it('returns validation failures in a stable order', () => {
      expect(
        evaluateExploreVenueEligibility({
          id: 'invalid-id',
          name: '',
          city: 'oob',
          lat: Number.NaN,
          lon: Number.NaN,
        })
      ).toEqual({
        eligible: false,
        reason: 'invalid_id',
      })

      expect(
        evaluateExploreVenueEligibility({
          id: VALID_VENUE_ID,
          name: '',
          city: 'oob',
          lat: Number.NaN,
          lon: Number.NaN,
        })
      ).toEqual({
        eligible: false,
        reason: 'invalid_name',
      })

      expect(
        evaluateExploreVenueEligibility({
          id: VALID_VENUE_ID,
          name: 'Valid Venue',
          city: '',
          lat: Number.NaN,
          lon: Number.NaN,
        })
      ).toEqual({
        eligible: false,
        reason: 'invalid_city',
      })

      expect(
        evaluateExploreVenueEligibility({
          id: VALID_VENUE_ID,
          name: 'Valid Venue',
          city: 'oob',
          lat: Number.NaN,
          lon: Number.NaN,
        })
      ).toEqual({
        eligible: false,
        reason: 'out_of_bounds',
      })
    })
  })

  /* =======================================================
   * Boolean convenience wrapper
   * ===================================================== */

  describe('isExploreVenueEligible', () => {
    it('returns true for a valid live venue', () => {
      expect(
        isExploreVenueEligible(
          createValidVenue()
        )
      ).toBe(true)
    })

    it('returns false for an OOB venue', () => {
      expect(
        isExploreVenueEligible(
          createValidVenue({
            city: 'oob',
          })
        )
      ).toBe(false)
    })

    it('returns true for a live venue without coordinates', () => {
      expect(
        isExploreVenueEligible(
          createValidVenue({
            lat: null,
            lon: null,
          })
        )
      ).toBe(true)
    })
  })

  /* =======================================================
   * Collection filtering and safe projection
   * ===================================================== */

  describe('getEligibleExploreVenues', () => {
    it('returns only eligible normalized venue identities', () => {
      const venues = [
        createValidVenue({
          id: VALID_VENUE_ID.toUpperCase(),
          name: '  First  Venue  ',
          city: 'atl',
        }),

        createValidVenue({
          id: SECOND_VALID_VENUE_ID,
          name: 'Second Venue',
          city: 'nyc',
          lat: 40.7128,
          lon: -74.006,
        }),

        createValidVenue({
          id: THIRD_VALID_VENUE_ID,
          name: 'OOB Venue',
          city: 'oob',
        }),

        createValidVenue({
          id: 'invalid-id',
          name: 'Invalid ID',
          city: 'lisbon',
        }),

        createValidVenue({
          id: '44444444-4444-4444-8444-444444444444',
          name: 'No Coordinates Venue',
          city: 'porto',
          lat: null,
          lon: null,
        }),
      ]

      expect(
        getEligibleExploreVenues(
          venues
        )
      ).toEqual([
        {
          id: VALID_VENUE_ID,
          name: 'First Venue',
          city: 'atl',
          coordinates: {
            lat: 33.749,
            lon: -84.388,
          },
          supportsDistance: true,
        },
        {
          id: SECOND_VALID_VENUE_ID,
          name: 'Second Venue',
          city: 'nyc',
          coordinates: {
            lat: 40.7128,
            lon: -74.006,
          },
          supportsDistance: true,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'No Coordinates Venue',
          city: 'porto',
          coordinates: null,
          supportsDistance: false,
        },
      ])
    })

    it('returns an empty array when no venues are eligible', () => {
      expect(
        getEligibleExploreVenues([
          createValidVenue({
            city: 'oob',
          }),
          createValidVenue({
            id: 'invalid-id',
          }),
        ])
      ).toEqual([])
    })

    it('returns an empty array for empty input', () => {
      expect(
        getEligibleExploreVenues([])
      ).toEqual([])
    })

    it('does not mutate the original input records or array', () => {
      const first = Object.freeze({
        ...createValidVenue({
          id: VALID_VENUE_ID.toUpperCase(),
          name: '  Frozen Venue  ',
        }),
      })

      const second = Object.freeze({
        ...createValidVenue({
          id: SECOND_VALID_VENUE_ID,
          city: 'oob',
        }),
      })

      const input = Object.freeze([
        first,
        second,
      ])

      const result =
        getEligibleExploreVenues(
          input
        )

      expect(result).toHaveLength(1)

      expect(result[0]).toMatchObject({
        id: VALID_VENUE_ID,
        name: 'Frozen Venue',
      })

      expect(first.id).toBe(
        VALID_VENUE_ID.toUpperCase()
      )

      expect(first.name).toBe(
        '  Frozen Venue  '
      )

      expect(second.city).toBe(
        'oob'
      )

      expect(input).toHaveLength(2)
    })

    it('returns new safe objects rather than original database rows', () => {
      const original = {
        ...createValidVenue(),
        access_token: 'secret',
        contact: ['private-contact'],
      }

      const result =
        getEligibleExploreVenues([
          original,
        ])

      expect(result).toHaveLength(1)

      expect(
        result[0]
      ).not.toBe(original)

      expect(
        Object.keys(result[0]).sort()
      ).toEqual([
        'city',
        'coordinates',
        'id',
        'name',
        'supportsDistance',
      ])
    })
  })
})
