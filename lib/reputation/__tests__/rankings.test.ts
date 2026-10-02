import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  rankReputationCandidates,
  type ReputationRankingCandidate,
} from '@/lib/reputation/rebuildReputationRankings'

/* =========================================================
 * Canonical fixtures
 * ======================================================= */

const CALCULATED_AT =
  '2026-01-01T00:00:00.000Z'

const USER_A =
  '00000000-0000-4000-8000-000000000001'

const USER_B =
  '00000000-0000-4000-8000-000000000002'

const USER_C =
  '00000000-0000-4000-8000-000000000003'

const USER_D =
  '00000000-0000-4000-8000-000000000004'

function createCandidate(
  overrides: Partial<
    ReputationRankingCandidate
  > = {}
): ReputationRankingCandidate {
  return {
    userId:
      USER_A,

    categoryId:
      'coffee',

    scope:
      'city',

    cityKey:
      'atl',

    verifiedVenueCount:
      5,

    weightedVenueCount:
      4,

    cityCount:
      1,

    publicCollectionCount:
      0,

    curatedVenueCount:
      0,

    publicSnapshotCount:
      0,

    completedFlowCount:
      0,

    recencyScore:
      0,

    qualityScore:
      0,

    reputationScore:
      50,

    reputationLevel:
      'emerging',

    policyVersion:
      2,

    calculatedAt:
      CALCULATED_AT,

    ...overrides,
  }
}

function runRankings(
  candidates:
    readonly ReputationRankingCandidate[]
) {
  return rankReputationCandidates({
    candidates,

    calculatedAt:
      CALCULATED_AT,
  })
}

/* =========================================================
 * Empty and single-candidate behavior
 * ======================================================= */

describe(
  'empty and minimal ranking populations',
  () => {
    it(
      'returns empty eligible candidates and rankings for no candidates',
      () => {
        const result =
          runRankings([])

        expect(
          result.eligibleCandidates
        ).toEqual([])

        expect(
          result.rankings
        ).toEqual([])
      }
    )

    it(
      'assigns rank one to the only eligible creator',
      () => {
        const {
          eligibleCandidates,
          rankings,
        } =
          runRankings([
            createCandidate(),
          ])

        expect(
          eligibleCandidates
        ).toHaveLength(1)

        expect(
          rankings
        ).toHaveLength(1)

        expect(
          rankings[0]
        ).toMatchObject({
          userId:
            USER_A,

          categoryId:
            'coffee',

          scope:
            'city',

          cityKey:
            'atl',

          rank:
            1,

          eligibleUserCount:
            1,

          percentile:
            0,

          score:
            50,

          level:
            'emerging',

          calculatedAt:
            CALCULATED_AT,
        })
      }
    )
  }
)

/* =========================================================
 * Eligibility
 * ======================================================= */

describe(
  'ranking eligibility',
  () => {
    it(
      'excludes creators below the verified venue requirement',
      () => {
        const {
          eligibleCandidates,
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              verifiedVenueCount:
                4,

              weightedVenueCount:
                100,

              reputationScore:
                500,
            }),

            createCandidate({
              userId:
                USER_B,
            }),
          ])

        expect(
          eligibleCandidates.map(
            (candidate) =>
              candidate.userId
          )
        ).toEqual([
          USER_B,
        ])

        expect(
          rankings
        ).toHaveLength(1)

        expect(
          rankings[0]
        ).toMatchObject({
          userId:
            USER_B,

          rank:
            1,

          eligibleUserCount:
            1,
        })
      }
    )

    it(
      'excludes creators below the weighted venue requirement',
      () => {
        const {
          eligibleCandidates,
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              verifiedVenueCount:
                100,

              weightedVenueCount:
                3.99,

              reputationScore:
                500,
            }),

            createCandidate({
              userId:
                USER_B,
            }),
          ])

        expect(
          eligibleCandidates.map(
            (candidate) =>
              candidate.userId
          )
        ).toEqual([
          USER_B,
        ])

        expect(
          rankings.map(
            (ranking) =>
              ranking.userId
          )
        ).toEqual([
          USER_B,
        ])
      }
    )

    it(
      'uses category-specific leaderboard requirements',
      () => {
        const {
          eligibleCandidates,
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              categoryId:
                'outdoors',

              verifiedVenueCount:
                5,

              weightedVenueCount:
                4,
            }),

            createCandidate({
              userId:
                USER_B,

              categoryId:
                'outdoors',

              verifiedVenueCount:
                6,

              weightedVenueCount:
                4,
            }),
          ])

        expect(
          eligibleCandidates.map(
            (candidate) =>
              candidate.userId
          )
        ).toEqual([
          USER_B,
        ])

        expect(
          rankings
        ).toHaveLength(1)

        expect(
          rankings[0]
            .userId
        ).toBe(
          USER_B
        )
      }
    )

    it(
      'counts only eligible creators in the ranking population',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                30,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                20,
            }),

            createCandidate({
              userId:
                USER_C,

              verifiedVenueCount:
                4,

              reputationScore:
                999,
            }),
          ])

        expect(
          rankings
        ).toHaveLength(2)

        for (
          const ranking of
            rankings
        ) {
          expect(
            ranking
              .eligibleUserCount
          ).toBe(2)
        }

        expect(
          rankings.some(
            (ranking) =>
              ranking.userId ===
              USER_C
          )
        ).toBe(false)
      }
    )
  }
)

/* =========================================================
 * Canonical ordering
 * ======================================================= */

describe(
  'canonical ranking order',
  () => {
    it(
      'orders higher reputation scores first',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                10,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                50,
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                30,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_C,
          USER_A,
        ])
      }
    )

    it(
      'uses verified venue count after reputation score',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                10,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                8,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses weighted venue count after verified venue count',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                9,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses public collection count after weighted venue count',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                2,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses curated venue count after public collection count',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,

              curatedVenueCount:
                3,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,

              curatedVenueCount:
                9,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses user ID as the final deterministic tie-breaker',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_D,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,

              curatedVenueCount:
                9,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,

              curatedVenueCount:
                9,
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              publicCollectionCount:
                5,

              curatedVenueCount:
                9,
            }),
          ])

        expect(
          rankedUserIds(
            rankings
          )
        ).toEqual([
          USER_B,
          USER_C,
          USER_D,
        ])
      }
    )

    it(
      'produces contiguous ordinal ranks',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                30,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                20,
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                10,
            }),
          ])

        expect(
          rankings.map(
            (ranking) =>
              ranking.rank
          )
        ).toEqual([
          1,
          2,
          3,
        ])
      }
    )
  }
)

/* =========================================================
 * Percentile standing
 * ======================================================= */

describe(
  'ranking percentile standing',
  () => {
    it(
      'calculates percentile standing from ordinal rank',
      () => {
        const {
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                30,
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                20,
            }),

            createCandidate({
              userId:
                USER_D,

              reputationScore:
                10,
            }),
          ])

        expect(
          rankings[0]
            .percentile
        ).toBe(75)

        expect(
          rankings[1]
            .percentile
        ).toBe(50)

        expect(
          rankings[2]
            .percentile
        ).toBe(25)

        expect(
          rankings[3]
            .percentile
        ).toBe(0)
      }
    )

    it(
      'keeps percentile standing between zero and one hundred',
      () => {
        const candidates =
          Array.from(
            {
              length:
                20,
            },

            (
              _,
              index
            ) =>
              createCandidate({
                userId:
                  createUuid(
                    index +
                      1
                  ),

                reputationScore:
                  100 -
                  index,
              })
          )

        const {
          rankings,
        } =
          runRankings(
            candidates
          )

        expect(
          rankings
        ).toHaveLength(20)

        for (
          const ranking of
            rankings
        ) {
          expect(
            ranking
              .percentile
          ).toBeGreaterThanOrEqual(
            0
          )

          expect(
            ranking
              .percentile
          ).toBeLessThanOrEqual(
            100
          )
        }
      }
    )
  }
)

/* =========================================================
 * Determinism and purity
 * ======================================================= */

describe(
  'ranking determinism and purity',
  () => {
    it(
      'returns identical rankings for identical input',
      () => {
        const candidates = [
          createCandidate({
            userId:
              USER_A,

            reputationScore:
              50,

            reputationLevel:
              'expert',
          }),

          createCandidate({
            userId:
              USER_B,

            reputationScore:
              25,

            reputationLevel:
              'established',
          }),
        ]

        const first =
          runRankings(
            candidates
          )

        const second =
          runRankings(
            candidates
          )

        expect(
          second
        ).toEqual(first)
      }
    )

    it(
      'returns the same rankings regardless of input order',
      () => {
        const candidates = [
          createCandidate({
            userId:
              USER_A,

            reputationScore:
              30,

            verifiedVenueCount:
              7,

            weightedVenueCount:
              8,
          }),

          createCandidate({
            userId:
              USER_B,

            reputationScore:
              50,

            verifiedVenueCount:
              10,

            weightedVenueCount:
              12,
          }),

          createCandidate({
            userId:
              USER_C,

            reputationScore:
              40,

            verifiedVenueCount:
              8,

            weightedVenueCount:
              9,
          }),
        ]

        const forward =
          runRankings(
            candidates
          )

        const reversed =
          runRankings(
            [
              ...candidates,
            ].reverse()
          )

        expect(
          reversed.rankings
        ).toEqual(
          forward.rankings
        )

        expect(
          reversed
            .eligibleCandidates
        ).toEqual(
          forward
            .eligibleCandidates
        )
      }
    )

    it(
      'does not mutate the candidate input array or rows',
      () => {
        const candidates = [
          createCandidate({
            userId:
              USER_A,

            reputationScore:
              30,
          }),

          createCandidate({
            userId:
              USER_B,

            reputationScore:
              20,
          }),
        ]

        const before =
          structuredClone(
            candidates
          )

        runRankings(
          candidates
        )

        expect(
          candidates
        ).toEqual(before)
      }
    )
  }
)

/* =========================================================
 * Numeric evidence normalization
 * ======================================================= */

describe(
  'invalid ranking evidence',
  () => {
    it(
      'excludes a candidate whose invalid evidence normalizes below leaderboard requirements',
      () => {
        const {
          eligibleCandidates,
          rankings,
        } =
          runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                Number.NaN,

              verifiedVenueCount:
                Number.POSITIVE_INFINITY,

              weightedVenueCount:
                Number.NEGATIVE_INFINITY,
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                10,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                4,
            }),
          ])

        expect(
          eligibleCandidates.map(
            (candidate) =>
              candidate.userId
          )
        ).toEqual([
          USER_B,
        ])

        expect(
          rankings
        ).toHaveLength(1)

        expect(
          rankings[0]
        ).toMatchObject({
          userId:
            USER_B,

          rank:
            1,

          eligibleUserCount:
            1,
        })

        expect(
          Number.isFinite(
            rankings[0]
              .score
          )
        ).toBe(true)

        expect(
          Number.isFinite(
            rankings[0]
              .percentile
          )
        ).toBe(true)
      }
    )
  }
)

/* =========================================================
 * Helpers
 * ======================================================= */

function rankedUserIds(
  rankings: readonly {
    userId: string
    rank: number
  }[]
): string[] {
  return [
    ...rankings,
  ]
    .sort(
      (
        first,
        second
      ) =>
        first.rank -
        second.rank
    )
    .map(
      (ranking) =>
        ranking.userId
    )
}

function createUuid(
  value: number
): string {
  const suffix =
    Math.max(
      1,
      Math.trunc(
        value
      )
    )
      .toString(16)
      .padStart(
        12,
        '0'
      )

  return `00000000-0000-4000-8000-${suffix}`
}