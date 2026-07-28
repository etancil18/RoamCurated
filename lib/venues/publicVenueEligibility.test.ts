import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  PUBLIC_VENUE_PROFILE_STATUSES,
  evaluatePublicVenueEligibility,
  getEligiblePublicVenueIdentities,
  isPublicVenueEligible,
  type PublicVenueEligibilityInput,
} from './publicVenueEligibility'

const VALID_VENUE_ID =
  '11111111-1111-4111-8111-111111111111'

const SECOND_VALID_VENUE_ID =
  '22222222-2222-4222-8222-222222222222'

function createValidVenue(
  overrides: Partial<PublicVenueEligibilityInput> = {}
): PublicVenueEligibilityInput {
  return {
    id: VALID_VENUE_ID,
    name: 'Roam Test Venue',
    lat: 33.749,
    lon: -84.388,
    profile_status: 'draft',
    ...overrides,
  }
}

describe(
  'publicVenueEligibility',
  () => {
    describe(
      'PUBLIC_VENUE_PROFILE_STATUSES',
      () => {
        it(
          'contains only the current explicitly approved legacy status',
          () => {
            expect([
              ...PUBLIC_VENUE_PROFILE_STATUSES,
            ]).toEqual([
              'draft',
            ])
          }
        )
      }
    )

    describe(
      'evaluatePublicVenueEligibility',
      () => {
        it(
          'accepts a structurally valid draft venue',
          () => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue()
              )

            expect(result).toEqual({
              eligible: true,
              venue: {
                id:
                  VALID_VENUE_ID,
                name:
                  'Roam Test Venue',
                lat:
                  33.749,
                lon:
                  -84.388,
                profileStatus:
                  'draft',
              },
            })
          }
        )

        it(
          'normalizes UUID casing, venue-name whitespace, and profile-status casing',
          () => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  id:
                    VALID_VENUE_ID.toUpperCase(),

                  name:
                    '  Roam   Test   Venue  ',

                  profile_status:
                    '  DrAfT  ',
                })
              )

            expect(result).toEqual({
              eligible: true,
              venue: {
                id:
                  VALID_VENUE_ID,
                name:
                  'Roam Test Venue',
                lat:
                  33.749,
                lon:
                  -84.388,
                profileStatus:
                  'draft',
              },
            })
          }
        )

        it.each([
          {
            label:
              'null',
            value:
              null,
          },
          {
            label:
              'undefined',
            value:
              undefined,
          },
          {
            label:
              'empty string',
            value:
              '',
          },
          {
            label:
              'whitespace-only string',
            value:
              '   ',
          },
          {
            label:
              'unknown status',
            value:
              'published',
          },
          {
            label:
              'archived status',
            value:
              'archived',
          },
          {
            label:
              'hidden status',
            value:
              'hidden',
          },
          {
            label:
              'inactive status',
            value:
              'inactive',
          },
          {
            label:
              'unpublished status',
            value:
              'unpublished',
          },
          {
            label:
              'rejected status',
            value:
              'rejected',
          },
          {
            label:
              'numeric value',
            value:
              1,
          },
          {
            label:
              'boolean value',
            value:
              true,
          },
          {
            label:
              'object value',
            value:
              {},
          },
        ])(
          'fails closed for $label profile status',
          ({
            value,
          }) => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  profile_status:
                    value,
                })
              )

            expect(result).toEqual({
              eligible: false,
              reason:
                'profile_status_not_public',
            })
          }
        )

        it.each([
          {
            label:
              'null',
            value:
              null,
          },
          {
            label:
              'undefined',
            value:
              undefined,
          },
          {
            label:
              'empty string',
            value:
              '',
          },
          {
            label:
              'whitespace-only string',
            value:
              '   ',
          },
          {
            label:
              'non-UUID string',
            value:
              'venue-123',
          },
          {
            label:
              'truncated UUID',
            value:
              '11111111-1111-4111-8111',
          },
          {
            label:
              'UUID with invalid character',
            value:
              'g1111111-1111-4111-8111-111111111111',
          },
          {
            label:
              'number',
            value:
              123,
          },
          {
            label:
              'object',
            value:
              {},
          },
        ])(
          'rejects $label as an invalid venue id',
          ({
            value,
          }) => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  id:
                    value,
                })
              )

            expect(result).toEqual({
              eligible: false,
              reason:
                'invalid_id',
            })
          }
        )

        it.each([
          {
            label:
              'null',
            value:
              null,
          },
          {
            label:
              'undefined',
            value:
              undefined,
          },
          {
            label:
              'empty string',
            value:
              '',
          },
          {
            label:
              'whitespace-only string',
            value:
              '   ',
          },
          {
            label:
              'number',
            value:
              123,
          },
          {
            label:
              'object',
            value:
              {},
          },
        ])(
          'rejects $label as an invalid venue name',
          ({
            value,
          }) => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  name:
                    value,
                })
              )

            expect(result).toEqual({
              eligible: false,
              reason:
                'invalid_name',
            })
          }
        )

        it.each([
          {
            label:
              'latitude below minimum',
            lat:
              -90.000001,
            lon:
              -84.388,
          },
          {
            label:
              'latitude above maximum',
            lat:
              90.000001,
            lon:
              -84.388,
          },
          {
            label:
              'longitude below minimum',
            lat:
              33.749,
            lon:
              -180.000001,
          },
          {
            label:
              'longitude above maximum',
            lat:
              33.749,
            lon:
              180.000001,
          },
          {
            label:
              'null latitude',
            lat:
              null,
            lon:
              -84.388,
          },
          {
            label:
              'undefined latitude',
            lat:
              undefined,
            lon:
              -84.388,
          },
          {
            label:
              'string latitude',
            lat:
              '33.749',
            lon:
              -84.388,
          },
          {
            label:
              'null longitude',
            lat:
              33.749,
            lon:
              null,
          },
          {
            label:
              'undefined longitude',
            lat:
              33.749,
            lon:
              undefined,
          },
          {
            label:
              'string longitude',
            lat:
              33.749,
            lon:
              '-84.388',
          },
          {
            label:
              'NaN latitude',
            lat:
              Number.NaN,
            lon:
              -84.388,
          },
          {
            label:
              'positive infinite longitude',
            lat:
              33.749,
            lon:
              Number.POSITIVE_INFINITY,
          },
          {
            label:
              'negative infinite latitude',
            lat:
              Number.NEGATIVE_INFINITY,
            lon:
              -84.388,
          },
        ])(
          'rejects $label as invalid coordinates',
          ({
            lat,
            lon,
          }) => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  lat,
                  lon,
                })
              )

            expect(result).toEqual({
              eligible: false,
              reason:
                'invalid_coordinates',
            })
          }
        )

        it.each([
          {
            lat:
              -90,
            lon:
              -180,
          },
          {
            lat:
              90,
            lon:
              180,
          },
          {
            lat:
              0,
            lon:
              0,
          },
        ])(
          'accepts boundary coordinates lat=$lat lon=$lon',
          ({
            lat,
            lon,
          }) => {
            const result =
              evaluatePublicVenueEligibility(
                createValidVenue({
                  lat,
                  lon,
                })
              )

            expect(
              result.eligible
            ).toBe(true)

            if (
              !result.eligible
            ) {
              throw new Error(
                `Expected boundary coordinates ${lat}, ${lon} to be eligible.`
              )
            }

            expect(
              result.venue.lat
            ).toBe(lat)

            expect(
              result.venue.lon
            ).toBe(lon)
          }
        )

        it(
          'ignores presentation-only fields such as slug and cover',
          () => {
            const venue = {
              ...createValidVenue(),
              slug:
                null,
              cover:
                null,
              description:
                null,
              city:
                null,
              hours:
                null,
            }

            const result =
              evaluatePublicVenueEligibility(
                venue
              )

            expect(
              result.eligible
            ).toBe(true)
          }
        )

        it(
          'evaluates validation failures in a stable fail-closed order',
          () => {
            expect(
              evaluatePublicVenueEligibility({
                id:
                  'invalid-id',

                name:
                  '',

                lat:
                  Number.NaN,

                lon:
                  Number.NaN,

                profile_status:
                  'published',
              })
            ).toEqual({
              eligible: false,
              reason:
                'invalid_id',
            })

            expect(
              evaluatePublicVenueEligibility({
                id:
                  VALID_VENUE_ID,

                name:
                  '',

                lat:
                  Number.NaN,

                lon:
                  Number.NaN,

                profile_status:
                  'published',
              })
            ).toEqual({
              eligible: false,
              reason:
                'invalid_name',
            })

            expect(
              evaluatePublicVenueEligibility({
                id:
                  VALID_VENUE_ID,

                name:
                  'Valid Venue',

                lat:
                  Number.NaN,

                lon:
                  Number.NaN,

                profile_status:
                  'published',
              })
            ).toEqual({
              eligible: false,
              reason:
                'invalid_coordinates',
            })

            expect(
              evaluatePublicVenueEligibility({
                id:
                  VALID_VENUE_ID,

                name:
                  'Valid Venue',

                lat:
                  33.749,

                lon:
                  -84.388,

                profile_status:
                  'published',
              })
            ).toEqual({
              eligible: false,
              reason:
                'profile_status_not_public',
            })
          }
        )
      }
    )

    describe(
      'isPublicVenueEligible',
      () => {
        it(
          'returns true for an eligible venue',
          () => {
            expect(
              isPublicVenueEligible(
                createValidVenue()
              )
            ).toBe(true)
          }
        )

        it(
          'returns false for an ineligible venue',
          () => {
            expect(
              isPublicVenueEligible(
                createValidVenue({
                  profile_status:
                    'archived',
                })
              )
            ).toBe(false)
          }
        )
      }
    )

    describe(
      'getEligiblePublicVenueIdentities',
      () => {
        it(
          'returns only normalized identities for eligible venues',
          () => {
            const result =
              getEligiblePublicVenueIdentities([
                createValidVenue({
                  id:
                    VALID_VENUE_ID.toUpperCase(),

                  name:
                    '  First   Venue  ',

                  profile_status:
                    ' DRAFT ',
                }),

                createValidVenue({
                  id:
                    SECOND_VALID_VENUE_ID,

                  name:
                    'Second Venue',

                  lat:
                    34.0522,

                  lon:
                    -118.2437,

                  profile_status:
                    'draft',
                }),

                createValidVenue({
                  id:
                    'invalid-id',

                  name:
                    'Invalid Venue',
                }),

                createValidVenue({
                  id:
                    '33333333-3333-4333-8333-333333333333',

                  name:
                    'Archived Venue',

                  profile_status:
                    'archived',
                }),

                createValidVenue({
                  id:
                    '44444444-4444-4444-8444-444444444444',

                  name:
                    'Invalid Coordinates',

                  lat:
                    120,
                }),
              ])

            expect(result).toEqual([
              {
                id:
                  VALID_VENUE_ID,
                name:
                  'First Venue',
                lat:
                  33.749,
                lon:
                  -84.388,
                profileStatus:
                  'draft',
              },

              {
                id:
                  SECOND_VALID_VENUE_ID,
                name:
                  'Second Venue',
                lat:
                  34.0522,
                lon:
                  -118.2437,
                profileStatus:
                  'draft',
              },
            ])
          }
        )

        it(
          'preserves the input order of eligible venues',
          () => {
            const result =
              getEligiblePublicVenueIdentities([
                createValidVenue({
                  id:
                    SECOND_VALID_VENUE_ID,

                  name:
                    'Second',
                }),

                createValidVenue({
                  id:
                    VALID_VENUE_ID,

                  name:
                    'First',
                }),
              ])

            expect(
              result.map(
                (venue) =>
                  venue.id
              )
            ).toEqual([
              SECOND_VALID_VENUE_ID,
              VALID_VENUE_ID,
            ])
          }
        )

        it(
          'returns an empty array when no venues are eligible',
          () => {
            const result =
              getEligiblePublicVenueIdentities([
                createValidVenue({
                  id:
                    'invalid-id',
                }),

                createValidVenue({
                  profile_status:
                    'archived',
                }),

                createValidVenue({
                  lat:
                    null,
                }),
              ])

            expect(result).toEqual([])
          }
        )

        it(
          'does not mutate the input array or venue objects',
          () => {
            const firstVenue =
              createValidVenue({
                name:
                  '  Venue One  ',
              })

            const secondVenue =
              createValidVenue({
                id:
                  SECOND_VALID_VENUE_ID,

                name:
                  'Venue Two',
              })

            const venues = [
              firstVenue,
              secondVenue,
            ]

            const originalArray =
              [...venues]

            const originalFirstVenue = {
              ...firstVenue,
            }

            const originalSecondVenue = {
              ...secondVenue,
            }

            getEligiblePublicVenueIdentities(
              venues
            )

            expect(venues).toEqual(
              originalArray
            )

            expect(
              firstVenue
            ).toEqual(
              originalFirstVenue
            )

            expect(
              secondVenue
            ).toEqual(
              originalSecondVenue
            )
          }
        )
      }
    )
  }
)