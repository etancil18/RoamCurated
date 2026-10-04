import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  ACTIVE_FLOW_COMMUNITY_SIGNAL_RADIUS_METERS,
  activeFlowHaversineDistanceMeters,
  evaluateActiveFlowCommunitySignalBoundary,
  type ActiveFlowCommunitySignalBoundaryStop,
} from '@/lib/active-flow/communitySignalBoundary'

const METERS_PER_LATITUDE_DEGREE =
  111_194.92664455874

function latitudeOffsetForMeters(
  meters: number
): number {
  return (
    meters /
    METERS_PER_LATITUDE_DEGREE
  )
}

function stop({
  id,
  metersNorth,
}: {
  id: string
  metersNorth: number
}): ActiveFlowCommunitySignalBoundaryStop {
  return {
    id,

    venue: {
      lat:
        latitudeOffsetForMeters(
          metersNorth
        ),

      lon: 0,
    },
  }
}

describe(
  'evaluateActiveFlowCommunitySignalBoundary',
  () => {
    it(
      'accepts a signal at the same venue coordinates',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              stop({
                id: 'same',
                metersNorth: 0,
              }),
            ],
          })

        expect(
          result
        ).toEqual({
          eligible: true,
          nearestStopId:
            'same',
          distanceMeters: 0,
          reason: null,
        })
      }
    )

    it(
      'accepts a signal inside the 350 meter boundary',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              stop({
                id: 'inside',
                metersNorth: 349,
              }),
            ],
          })

        expect(
          result.eligible
        ).toBe(true)

        expect(
          result.reason
        ).toBeNull()

        expect(
          result.nearestStopId
        ).toBe(
          'inside'
        )
      }
    )

    it(
      'treats exactly 350 meters as eligible using the unrounded distance',
      () => {
        const signalVenue = {
          lat: 0,
          lon: 0,
        }

        const exactBoundaryStop =
          stop({
            id: 'boundary',
            metersNorth:
              ACTIVE_FLOW_COMMUNITY_SIGNAL_RADIUS_METERS,
          })

        const exactDistance =
          activeFlowHaversineDistanceMeters(
            {
              lat:
                signalVenue.lat,
              lon:
                signalVenue.lon,
            },
            {
              lat:
                exactBoundaryStop
                  .venue
                  .lat as number,

              lon:
                exactBoundaryStop
                  .venue
                  .lon as number,
            }
          )

        expect(
          exactDistance
        ).toBeCloseTo(
          ACTIVE_FLOW_COMMUNITY_SIGNAL_RADIUS_METERS,
          6
        )

        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue,
            remainingStops: [
              exactBoundaryStop,
            ],
          })

        expect(
          result.eligible
        ).toBe(true)

        expect(
          result.reason
        ).toBeNull()
      }
    )

    it(
      'rejects a signal outside the 350 meter boundary even when rounded distance is 350',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              stop({
                id: 'outside',
                metersNorth:
                  350.4,
              }),
            ],
          })

        expect(
          result.eligible
        ).toBe(false)

        expect(
          result.reason
        ).toBe(
          'outside_350m'
        )

        /**
         * Diagnostic rounding must not control eligibility.
         */
        expect(
          result.distanceMeters
        ).toBe(350)
      }
    )

    it(
      'uses the nearest valid remaining runtime stop',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              stop({
                id: 'far',
                metersNorth: 900,
              }),

              stop({
                id: 'near',
                metersNorth: 200,
              }),

              stop({
                id: 'middle',
                metersNorth: 500,
              }),
            ],
          })

        expect(
          result.eligible
        ).toBe(true)

        expect(
          result.nearestStopId
        ).toBe(
          'near'
        )

        expect(
          result.distanceMeters
        ).toBe(200)
      }
    )

    it(
      'rejects when every valid remaining stop is outside 350 meters',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              stop({
                id: 'one',
                metersNorth: 351,
              }),

              stop({
                id: 'two',
                metersNorth: 800,
              }),
            ],
          })

        expect(
          result.eligible
        ).toBe(false)

        expect(
          result.nearestStopId
        ).toBe(
          'one'
        )

        expect(
          result.reason
        ).toBe(
          'outside_350m'
        )
      }
    )

    it(
      'ignores a remaining stop with missing coordinates when another stop is usable',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              {
                id:
                  'missing',

                venue: {
                  lat: null,
                  lon: null,
                },
              },

              stop({
                id: 'valid',
                metersNorth: 100,
              }),
            ],
          })

        expect(
          result.eligible
        ).toBe(true)

        expect(
          result.nearestStopId
        ).toBe(
          'valid'
        )
      }
    )

    it(
      'fails closed when no remaining stop has usable coordinates',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [
              {
                id: 'missing',
                venue: {
                  lat: null,
                  lon: null,
                },
              },

              {
                id: 'invalid',
                venue: {
                  lat: 91,
                  lon: 0,
                },
              },
            ],
          })

        expect(
          result
        ).toEqual({
          eligible: false,
          nearestStopId: null,
          distanceMeters: null,
          reason:
            'no_remaining_stop_coordinates',
        })
      }
    )

    it(
      'fails closed when signal coordinates are missing or invalid',
      () => {
        for (
          const signalVenue of
            [
              {
                lat: null,
                lon: null,
              },
              {
                lat: 91,
                lon: 0,
              },
              {
                lat: 0,
                lon: 181,
              },
            ]
        ) {
          const result =
            evaluateActiveFlowCommunitySignalBoundary({
              signalVenue,

              remainingStops: [
                stop({
                  id: 'valid',
                  metersNorth: 10,
                }),
              ],
            })

          expect(
            result
          ).toEqual({
            eligible: false,
            nearestStopId: null,
            distanceMeters: null,
            reason:
              'missing_signal_coordinates',
          })
        }
      }
    )

    it(
      'fails closed when there are no remaining executable stops',
      () => {
        const result =
          evaluateActiveFlowCommunitySignalBoundary({
            signalVenue: {
              lat: 0,
              lon: 0,
            },

            remainingStops: [],
          })

        expect(
          result
        ).toEqual({
          eligible: false,
          nearestStopId: null,
          distanceMeters: null,
          reason:
            'no_remaining_stops',
        })
      }
    )
  }
)