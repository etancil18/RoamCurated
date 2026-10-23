
import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  EXPLORE_TRENDING_WINDOW_DAYS,
  EXPLORE_TRENDING_LOOKBACK_DAYS,
  EXPLORE_TRENDING_MIN_UNIQUE_VISITORS,
  EXPLORE_TRENDING_MIN_VERIFIED_VISITS,
  EXPLORE_TRENDING_RECENT_HOURS,
  calculateExploreTrendingGrowth,
  evaluateExploreTrendingVenues,
  isExploreVenueTrending,
  rankExploreTrendingVenues,
  scoreExploreTrendingVenue,
  type ExploreTrendingVenueAggregate,
  type ExploreTrendingOptions,
} from './trending'

/* =========================================================
 * Fixed clock and fixtures
 * ======================================================= */

const NOW = '2026-10-23T18:00:00.000Z'

const NOW_MS = Date.parse(NOW)

const HOUR_MS = 60 * 60 * 1000

const DAY_MS = 24 * HOUR_MS

const VENUE_A =
  '11111111-1111-4111-8111-111111111111'

const VENUE_B =
  '22222222-2222-4222-8222-222222222222'

const VENUE_C =
  '33333333-3333-4333-8333-333333333333'

const VENUE_D =
  '44444444-4444-4444-8444-444444444444'

function hoursAgo(hours: number): string {
  return new Date(
    NOW_MS - hours * HOUR_MS
  ).toISOString()
}

function daysAgo(days: number): string {
  return new Date(
    NOW_MS - days * DAY_MS
  ).toISOString()
}

function createAggregate(
  overrides: Partial<ExploreTrendingVenueAggregate> = {}
): ExploreTrendingVenueAggregate {
  return {
    venueId: VENUE_A,
    currentUniqueVisitors: 12,
    previousUniqueVisitors: 6,
    currentVerifiedVisits: 15,
    previousVerifiedVisits: 8,
    recentVerifiedVisits: 4,
    lastVerifiedVisitAt: hoursAgo(2),
    ...overrides,
  }
}

function scoringOptions(
  overrides: Partial<ExploreTrendingOptions> = {}
): ExploreTrendingOptions {
  return {
    now: NOW,
    ...overrides,
  }
}

/* =========================================================
 * Tests
 * ======================================================= */

describe('Explore trending scoring', () => {
  describe('configuration', () => {
    it('uses a seven-day scoring window', () => {
      expect(EXPLORE_TRENDING_WINDOW_DAYS).toBe(7)
    })

    it('uses fourteen days for week-over-week comparison', () => {
      expect(EXPLORE_TRENDING_LOOKBACK_DAYS).toBe(14)
    })

    it('requires five unique verified visitors by default', () => {
      expect(EXPLORE_TRENDING_MIN_UNIQUE_VISITORS).toBe(5)
    })

    it('requires five verified visits by default', () => {
      expect(EXPLORE_TRENDING_MIN_VERIFIED_VISITS).toBe(5)
    })

    it('defines recent activity as the final 48 hours', () => {
      expect(EXPLORE_TRENDING_RECENT_HOURS).toBe(48)
    })
  })

  /* =======================================================
   * Scoring
   * ===================================================== */

  describe('scoreExploreTrendingVenue', () => {
    it('qualifies a venue with sufficient verified activity', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate(),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.venueId).toBe(VENUE_A)
      expect(result.score).toBeGreaterThan(0)
      expect(result.insufficientReason).toBeNull()
    })

    it('preserves the aggregated evidence in the result', () => {
      const aggregate = createAggregate()

      const result = scoreExploreTrendingVenue(
        aggregate,
        scoringOptions()
      )

      expect(result).toMatchObject({
        venueId: VENUE_A,
        currentUniqueVisitors: 12,
        previousUniqueVisitors: 6,
        currentVerifiedVisits: 15,
        previousVerifiedVisits: 8,
        recentVerifiedVisits: 4,
        lastVerifiedVisitAt: aggregate.lastVerifiedVisitAt,
      })
    })

    it('returns the five numeric scoring components', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate(),
        scoringOptions()
      )

      expect(Object.keys(result.breakdown).sort()).toEqual([
        'growth',
        'recency',
        'recentActivity',
        'repeatVisits',
        'uniqueVisitors',
      ])

      for (const value of Object.values(result.breakdown)) {
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
      }

      expect(result.score).toBeCloseTo(
        Object.values(result.breakdown).reduce(
          (total, value) => total + value,
          0
        ),
        2
      )
    })

    it('is deterministic for the same input and time', () => {
      const aggregate = createAggregate()
      const options = scoringOptions()

      expect(
        scoreExploreTrendingVenue(aggregate, options)
      ).toEqual(
        scoreExploreTrendingVenue(aggregate, options)
      )
    })

    it('does not mutate the input aggregate', () => {
      const aggregate = Object.freeze(createAggregate())
      const snapshot = { ...aggregate }

      scoreExploreTrendingVenue(
        aggregate,
        scoringOptions()
      )

      expect(aggregate).toEqual(snapshot)
    })

    it('accepts Date, ISO string, and numeric evaluation times', () => {
      const aggregate = createAggregate()

      const asString = scoreExploreTrendingVenue(
        aggregate,
        { now: NOW }
      )

      const asDate = scoreExploreTrendingVenue(
        aggregate,
        { now: new Date(NOW) }
      )

      const asNumber = scoreExploreTrendingVenue(
        aggregate,
        { now: NOW_MS }
      )

      expect(asDate).toEqual(asString)
      expect(asNumber).toEqual(asString)
    })
  })

  /* =======================================================
   * Minimum verified evidence
   * ===================================================== */

  describe('minimum verified evidence', () => {
    it('rejects fewer than five unique visitors', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 4,
          currentVerifiedVisits: 10,
        }),
        scoringOptions()
      )

      expect(result).toMatchObject({
        status: 'insufficient_data',
        score: 0,
        insufficientReason: 'insufficient_unique_visitors',
      })
    })

    it('accepts exactly five unique visitors and five verified visits', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 5,
          currentVerifiedVisits: 5,
          recentVerifiedVisits: 2,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
    })

    it('never invents trending for an empty aggregate', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 0,
          previousUniqueVisitors: 0,
          currentVerifiedVisits: 0,
          previousVerifiedVisits: 0,
          recentVerifiedVisits: 0,
          lastVerifiedVisitAt: null,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('insufficient_data')
      expect(result.score).toBe(0)
    })

    it('supports a stricter unique-visitor threshold', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 7,
          currentVerifiedVisits: 9,
        }),
        scoringOptions({
          minimumUniqueVisitors: 8,
        })
      )

      expect(result.insufficientReason).toBe(
        'insufficient_unique_visitors'
      )
    })

    it('supports a stricter verified-visit threshold', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 8,
          currentVerifiedVisits: 9,
        }),
        scoringOptions({
          minimumVerifiedVisits: 10,
        })
      )

      expect(result.insufficientReason).toBe(
        'insufficient_verified_visits'
      )
    })

    it('rejects thresholds below protected defaults', () => {
      expect(() =>
        scoreExploreTrendingVenue(
          createAggregate(),
          scoringOptions({
            minimumUniqueVisitors: 4,
          })
        )
      ).toThrow(RangeError)

      expect(() =>
        scoreExploreTrendingVenue(
          createAggregate(),
          scoringOptions({
            minimumVerifiedVisits: 4,
          })
        )
      ).toThrow(RangeError)
    })
  })

  /* =======================================================
   * Unique visitors and repeat activity
   * ===================================================== */

  describe('unique visitor dominance', () => {
    it('rewards broad participation over repeat-heavy check-ins', () => {
      /**
       * Both aggregates must be internally valid:
       * previous unique visitors <= previous verified visits.
       *
       * FIX 1:
       * Explicit previousVerifiedVisits prevents the scorer
       * from rejecting broadParticipation as invalid.
       */
      const broadParticipation = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 20,
          previousUniqueVisitors: 10,
          currentVerifiedVisits: 20,
          previousVerifiedVisits: 10,
          recentVerifiedVisits: 5,
        }),
        scoringOptions()
      )

      const repeatHeavy = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 5,
          previousUniqueVisitors: 3,
          currentVerifiedVisits: 100,
          previousVerifiedVisits: 8,
          recentVerifiedVisits: 25,
        }),
        scoringOptions()
      )

      expect(broadParticipation.status).toBe('trending')
      expect(repeatHeavy.status).toBe('trending')

      expect(broadParticipation.score).toBeGreaterThan(
        repeatHeavy.score
      )
    })

    it('caps the repeat-visit bonus', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 5,
          currentVerifiedVisits: 1000,
          recentVerifiedVisits: 200,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.breakdown.repeatVisits).toBe(6)
    })

    it('gives no repeat bonus when each visitor checks in once', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 10,
          currentVerifiedVisits: 10,
          recentVerifiedVisits: 4,
        }),
        scoringOptions()
      )

      expect(result.breakdown.repeatVisits).toBe(0)
    })

    it('adds a modest repeat bonus without changing unique reach', () => {
      const base = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 10,
          currentVerifiedVisits: 10,
          recentVerifiedVisits: 2,
        }),
        scoringOptions()
      )

      const repeat = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 10,
          currentVerifiedVisits: 13,
          recentVerifiedVisits: 2,
        }),
        scoringOptions()
      )

      expect(repeat.breakdown.uniqueVisitors).toBe(
        base.breakdown.uniqueVisitors
      )

      expect(repeat.breakdown.repeatVisits).toBeGreaterThan(
        base.breakdown.repeatVisits
      )
    })
  })

  /* =======================================================
   * Week-over-week growth
   * ===================================================== */

  describe('calculateExploreTrendingGrowth', () => {
    it('calculates positive visitor growth', () => {
      expect(calculateExploreTrendingGrowth(15, 10)).toEqual({
        absoluteChange: 5,
        percentageChange: 50,
        newActivity: false,
      })
    })

    it('calculates declining visitor activity', () => {
      expect(calculateExploreTrendingGrowth(5, 10)).toEqual({
        absoluteChange: -5,
        percentageChange: -50,
        newActivity: false,
      })
    })

    it('calculates unchanged visitor activity', () => {
      expect(calculateExploreTrendingGrowth(10, 10)).toEqual({
        absoluteChange: 0,
        percentageChange: 0,
        newActivity: false,
      })
    })

    it('handles zero previous visitors without dividing by zero', () => {
      expect(calculateExploreTrendingGrowth(10, 0)).toEqual({
        absoluteChange: 10,
        percentageChange: null,
        newActivity: true,
      })
    })

    it('does not call zero-to-zero activity new', () => {
      expect(calculateExploreTrendingGrowth(0, 0)).toEqual({
        absoluteChange: 0,
        percentageChange: null,
        newActivity: false,
      })
    })

    it('does not award unlimited growth for a zero baseline', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 50,
          previousUniqueVisitors: 0,
          currentVerifiedVisits: 55,
          recentVerifiedVisits: 10,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.growth.percentageChange).toBeNull()
      expect(result.growth.newActivity).toBe(true)
      expect(result.breakdown.growth).toBeLessThanOrEqual(9)
    })

    it('caps extreme positive momentum', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 100,
          previousUniqueVisitors: 1,
          currentVerifiedVisits: 100,
          recentVerifiedVisits: 10,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.breakdown.growth).toBe(18)
    })

    it('does not reward declining visitor growth', () => {
      /**
       * FIX 2:
       * A previous week with 20 unique visitors
       * requires at least 20 previous verified visits.
       */
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: 6,
          previousUniqueVisitors: 20,
          currentVerifiedVisits: 6,
          previousVerifiedVisits: 20,
          recentVerifiedVisits: 2,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.breakdown.growth).toBe(0)
      expect(result.growth.absoluteChange).toBe(-14)
    })
  })

  /* =======================================================
   * Recency and timestamp validation
   * ===================================================== */

  describe('recency and time boundaries', () => {
    it('rewards more recent check-ins', () => {
      const recent = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: hoursAgo(1),
          recentVerifiedVisits: 2,
        }),
        scoringOptions()
      )

      const older = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: daysAgo(4),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(recent.breakdown.recency).toBeGreaterThan(
        older.breakdown.recency
      )

      expect(recent.score).toBeGreaterThan(older.score)
    })

    it('scores activity exactly at now', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: NOW,
          recentVerifiedVisits: 1,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.breakdown.recency).toBe(12)
    })

    it('rejects future-dated activity', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt:
            new Date(NOW_MS + HOUR_MS).toISOString(),
        }),
        scoringOptions()
      )

      expect(result).toMatchObject({
        status: 'insufficient_data',
        score: 0,
        insufficientReason: 'invalid_aggregate',
      })
    })

    it('rejects activity older than seven days', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: daysAgo(8),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(result.insufficientReason).toBe('invalid_aggregate')
    })

    it('rejects activity exactly at the seven-day lower boundary', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: daysAgo(7),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('insufficient_data')
      expect(result.score).toBe(0)
      expect(result.insufficientReason).toBe(
        'no_recent_activity'
      )
    })

    it('accepts activity just inside the seven-day window', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: new Date(
            NOW_MS - 7 * DAY_MS + 1
          ).toISOString(),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
    })

    it('rejects inconsistent counts at the 48-hour boundary', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: hoursAgo(48),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(result.insufficientReason).toBe('invalid_aggregate')
    })

    it('accepts activity just outside the 48-hour window', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: new Date(
            NOW_MS - 48 * HOUR_MS - 1
          ).toISOString(),
          recentVerifiedVisits: 0,
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
    })

    it('rejects recent timestamp with zero recent visits', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          recentVerifiedVisits: 0,
          lastVerifiedVisitAt: hoursAgo(2),
        }),
        scoringOptions()
      )

      expect(result.insufficientReason).toBe('invalid_aggregate')
    })

    it('rejects recent counts with an older latest timestamp', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          recentVerifiedVisits: 2,
          lastVerifiedVisitAt: daysAgo(4),
        }),
        scoringOptions()
      )

      expect(result.insufficientReason).toBe('invalid_aggregate')
    })

    it('accepts zero recent visits when activity is older', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          recentVerifiedVisits: 0,
          lastVerifiedVisitAt: daysAgo(3),
        }),
        scoringOptions()
      )

      expect(result.status).toBe('trending')
      expect(result.breakdown.recentActivity).toBe(0)
    })

    it('rejects invalid visit timestamps', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          lastVerifiedVisitAt: 'not-a-date',
        }),
        scoringOptions()
      )

      expect(result.insufficientReason).toBe('invalid_aggregate')
    })

    it('rejects an invalid evaluation timestamp', () => {
      expect(() =>
        scoreExploreTrendingVenue(
          createAggregate(),
          scoringOptions({
            now: 'not-a-date',
          })
        )
      ).toThrow(RangeError)
    })
  })

  /* =======================================================
   * Aggregate consistency safeguards
   * ===================================================== */

  describe('invalid aggregate rejection', () => {
    it.each([
      {
        label: 'negative current unique visitors',
        changes: { currentUniqueVisitors: -1 },
      },
      {
        label: 'fractional verified visits',
        changes: { currentVerifiedVisits: 6.5 },
      },
      {
        label: 'NaN current visits',
        changes: { currentVerifiedVisits: Number.NaN },
      },
      {
        label: 'infinite current visitors',
        changes: {
          currentUniqueVisitors: Number.POSITIVE_INFINITY,
        },
      },
      {
        label: 'negative previous visits',
        changes: { previousVerifiedVisits: -1 },
      },
      {
        label: 'negative recent visits',
        changes: { recentVerifiedVisits: -1 },
      },
      {
        label: 'unsafe integer visitor count',
        changes: {
          currentUniqueVisitors: Number.MAX_SAFE_INTEGER + 1,
        },
      },
      {
        label: 'current unique visitors exceed visits',
        changes: {
          currentUniqueVisitors: 20,
          currentVerifiedVisits: 10,
        },
      },
      {
        label: 'previous unique visitors exceed visits',
        changes: {
          previousUniqueVisitors: 20,
          previousVerifiedVisits: 10,
        },
      },
      {
        label: 'recent visits exceed current visits',
        changes: {
          recentVerifiedVisits: 20,
          currentVerifiedVisits: 15,
        },
      },
      {
        label: 'blank venue ID',
        changes: { venueId: '  ' },
      },
      {
        label: 'missing timestamp despite current visits',
        changes: { lastVerifiedVisitAt: null },
      },
      {
        label: 'timestamp present without current visits',
        changes: {
          currentUniqueVisitors: 0,
          currentVerifiedVisits: 0,
          recentVerifiedVisits: 0,
        },
      },
    ])('rejects $label', ({ changes }) => {
      const result = scoreExploreTrendingVenue(
        createAggregate(changes),
        scoringOptions()
      )

      expect(result).toMatchObject({
        status: 'insufficient_data',
        score: 0,
        insufficientReason: 'invalid_aggregate',
      })
    })

    it('does not expose invalid growth calculations', () => {
      const result = scoreExploreTrendingVenue(
        createAggregate({
          currentUniqueVisitors: Number.NaN,
        }),
        scoringOptions()
      )

      expect(result.growth).toEqual({
        absoluteChange: 0,
        percentageChange: null,
        newActivity: false,
      })

      expect(result.score).toBe(0)
    })
  })

  /* =======================================================
   * Rankings
   * ===================================================== */

  describe('rankExploreTrendingVenues', () => {
    it('returns no rankings for empty input', () => {
      expect(
        rankExploreTrendingVenues(
          [],
          scoringOptions()
        )
      ).toEqual([])
    })

    it('excludes insufficient-data venues from rankings', () => {
      const aggregates = [
        createAggregate({
          venueId: VENUE_A,
          currentUniqueVisitors: 2,
          currentVerifiedVisits: 3,
          recentVerifiedVisits: 1,
        }),
        createAggregate({
          venueId: VENUE_B,
          currentUniqueVisitors: 0,
          previousUniqueVisitors: 0,
          currentVerifiedVisits: 0,
          previousVerifiedVisits: 0,
          recentVerifiedVisits: 0,
          lastVerifiedVisitAt: null,
        }),
      ]

      expect(
        rankExploreTrendingVenues(
          aggregates,
          scoringOptions()
        )
      ).toEqual([])
    })

    it('ranks venues in descending score order', () => {
      /**
       * FIX 3:
       * VENUE_B's previous window now has 10 visits
       * supporting its 10 unique visitors.
       */
      const aggregates = [
        createAggregate({
          venueId: VENUE_A,
          currentUniqueVisitors: 5,
          currentVerifiedVisits: 5,
          recentVerifiedVisits: 1,
        }),
        createAggregate({
          venueId: VENUE_B,
          currentUniqueVisitors: 30,
          previousUniqueVisitors: 10,
          currentVerifiedVisits: 35,
          previousVerifiedVisits: 10,
          recentVerifiedVisits: 8,
        }),
        createAggregate({
          venueId: VENUE_C,
          currentUniqueVisitors: 12,
          currentVerifiedVisits: 15,
          recentVerifiedVisits: 4,
        }),
      ]

      const results = rankExploreTrendingVenues(
        aggregates,
        scoringOptions()
      )

      expect(results).toHaveLength(3)
      expect(results[0].venueId).toBe(VENUE_B)

      expect(results.every(
        (result) => result.status === 'trending'
      )).toBe(true)

      const scores = results.map((result) => result.score)

      expect(scores).toEqual(
        [...scores].sort((a, b) => b - a)
      )
    })

    it('assigns sequential ranks beginning at one', () => {
      const results = rankExploreTrendingVenues(
        [
          createAggregate({ venueId: VENUE_C }),
          createAggregate({ venueId: VENUE_A }),
          createAggregate({ venueId: VENUE_B }),
        ],
        scoringOptions()
      )

      expect(results.map((result) => result.rank)).toEqual([
        1,
        2,
        3,
      ])
    })

    it('breaks completely equal ties by venue ID', () => {
      const results = rankExploreTrendingVenues(
        [
          createAggregate({ venueId: VENUE_C }),
          createAggregate({ venueId: VENUE_A }),
          createAggregate({ venueId: VENUE_B }),
        ],
        scoringOptions()
      )

      expect(results.map((result) => result.venueId)).toEqual([
        VENUE_A,
        VENUE_B,
        VENUE_C,
      ])
    })

    it('breaks equal scores using unique visitor counts', () => {
      const results = rankExploreTrendingVenues(
        [
          createAggregate({
            venueId: VENUE_A,
            currentUniqueVisitors: 200,
            previousUniqueVisitors: 200,
            currentVerifiedVisits: 200,
            previousVerifiedVisits: 200,
            recentVerifiedVisits: 20,
          }),
          createAggregate({
            venueId: VENUE_B,
            currentUniqueVisitors: 300,
            previousUniqueVisitors: 300,
            currentVerifiedVisits: 300,
            previousVerifiedVisits: 300,
            recentVerifiedVisits: 30,
          }),
        ],
        scoringOptions()
      )

      expect(results).toHaveLength(2)
      expect(results[0].score).toBe(results[1].score)
      expect(results[0].venueId).toBe(VENUE_B)
    })

    it('breaks remaining ties using latest visit time', () => {
      const results = rankExploreTrendingVenues(
        [
          createAggregate({
            venueId: VENUE_A,
            currentUniqueVisitors: 200,
            previousUniqueVisitors: 200,
            currentVerifiedVisits: 200,
            previousVerifiedVisits: 200,
            recentVerifiedVisits: 20,
            lastVerifiedVisitAt: hoursAgo(1.02),
          }),
          createAggregate({
            venueId: VENUE_B,
            currentUniqueVisitors: 200,
            previousUniqueVisitors: 200,
            currentVerifiedVisits: 200,
            previousVerifiedVisits: 200,
            recentVerifiedVisits: 20,
            lastVerifiedVisitAt: hoursAgo(1),
          }),
        ],
        scoringOptions()
      )

      expect(results[0].venueId).toBe(VENUE_B)
    })

    it('honors the ranking limit', () => {
      const results = rankExploreTrendingVenues(
        [
          createAggregate({ venueId: VENUE_A }),
          createAggregate({ venueId: VENUE_B }),
          createAggregate({ venueId: VENUE_C }),
          createAggregate({ venueId: VENUE_D }),
        ],
        scoringOptions({
          limit: 2,
        })
      )

      expect(results).toHaveLength(2)
      expect(results.map((result) => result.rank)).toEqual([
        1,
        2,
      ])
    })

    it('returns no results for a zero limit', () => {
      expect(
        rankExploreTrendingVenues(
          [createAggregate()],
          scoringOptions({
            limit: 0,
          })
        )
      ).toEqual([])
    })

    it('rejects invalid ranking limits', () => {
      for (const limit of [-1, 101, 1.5]) {
        expect(() =>
          rankExploreTrendingVenues(
            [createAggregate()],
            scoringOptions({ limit })
          )
        ).toThrow(RangeError)
      }
    })

    it('does not mutate aggregate records or input order', () => {
      const first = Object.freeze(
        createAggregate({ venueId: VENUE_C })
      )

      const second = Object.freeze(
        createAggregate({ venueId: VENUE_A })
      )

      const input = Object.freeze([first, second])

      const originalIds = input.map(
        (aggregate) => aggregate.venueId
      )

      rankExploreTrendingVenues(
        input,
        scoringOptions()
      )

      expect(input.map(
        (aggregate) => aggregate.venueId
      )).toEqual(originalIds)
    })

    it('produces the same ranking regardless of input order', () => {
      const aggregates = [
        createAggregate({
          venueId: VENUE_C,
          currentUniqueVisitors: 6,
          currentVerifiedVisits: 7,
        }),
        createAggregate({
          venueId: VENUE_A,
          currentUniqueVisitors: 20,
          currentVerifiedVisits: 24,
        }),
        createAggregate({
          venueId: VENUE_B,
          currentUniqueVisitors: 10,
          currentVerifiedVisits: 13,
        }),
      ]

      const forward = rankExploreTrendingVenues(
        aggregates,
        scoringOptions()
      )

      const backward = rankExploreTrendingVenues(
        [...aggregates].reverse(),
        scoringOptions()
      )

      expect(backward).toEqual(forward)
    })
  })

  /* =======================================================
   * Batch evaluation
   * ===================================================== */

  describe('evaluateExploreTrendingVenues', () => {
    it('includes insufficient-data results in batch evaluation', () => {
      const results = evaluateExploreTrendingVenues(
        [
          createAggregate({
            venueId: VENUE_A,
          }),
          createAggregate({
            venueId: VENUE_B,
            currentUniqueVisitors: 2,
            currentVerifiedVisits: 2,
          }),
        ],
        scoringOptions()
      )

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('trending')
      expect(results[1].status).toBe('insufficient_data')
    })

    it('returns an empty array for empty input', () => {
      expect(
        evaluateExploreTrendingVenues(
          [],
          scoringOptions()
        )
      ).toEqual([])
    })
  })

  /* =======================================================
   * Boolean convenience helper
   * ===================================================== */

  describe('isExploreVenueTrending', () => {
    it('returns true for sufficient verified activity', () => {
      expect(
        isExploreVenueTrending(
          createAggregate(),
          scoringOptions()
        )
      ).toBe(true)
    })

    it('returns false for too few unique visitors', () => {
      expect(
        isExploreVenueTrending(
          createAggregate({
            currentUniqueVisitors: 2,
            currentVerifiedVisits: 3,
          }),
          scoringOptions()
        )
      ).toBe(false)
    })

    it('returns false for invalid aggregate evidence', () => {
      expect(
        isExploreVenueTrending(
          createAggregate({
            recentVerifiedVisits: 100,
          }),
          scoringOptions()
        )
      ).toBe(false)
    })
  })
})
