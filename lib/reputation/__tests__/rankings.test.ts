import {
  describe,
  expect,
  it,
} from 'vitest'

import * as rankingsModule from '@/lib/reputation/rebuildReputationRankings'

/* =========================================================
 * Test-local contracts
 * ======================================================= */

type UnknownRecord = Record<
  string,
  unknown
>

type RankingCandidate = {
  userId: string
  reputationScore: number
  verifiedVenueCount: number
  weightedVenueCount: number
  reputationLevel:
    | 'unranked'
    | 'emerging'
    | 'established'
    | 'expert'
    | 'elite'
}

type RankedCandidate =
  RankingCandidate & {
    rank: number | null
    eligibleCreatorCount: number
    topPercent: number | null
  }

type RankingFunction = (
  input: unknown,
  ...rest: unknown[]
) => unknown

/* =========================================================
 * Supported public-export names
 * ======================================================= */

/**
 * This test intentionally supports the narrow naming variants
 * used during the reputation rollout.
 *
 * Once the ranking module API is permanently frozen, reduce this
 * list to the single canonical export.
 */
const RANKING_EXPORT_NAMES = [
  'rankReputationCandidates',
  'calculateReputationRankings',
  'buildReputationRankings',
  'rankCreatorReputationRows',
] as const

const moduleRecord =
  rankingsModule as UnknownRecord

const rankCandidates =
  loadRequiredFunction(
    moduleRecord,
    RANKING_EXPORT_NAMES
  )

/* =========================================================
 * Canonical fixtures
 * ======================================================= */

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
    RankingCandidate
  > = {}
): RankingCandidate {
  return {
    userId:
      USER_A,

    reputationScore:
      0,

    verifiedVenueCount:
      0,

    weightedVenueCount:
      0,

    reputationLevel:
      'unranked',

    ...overrides,
  }
}

function createRankingInput(
  candidates:
    readonly RankingCandidate[]
): UnknownRecord {
  return {
    categoryId:
      'coffee',

    scope:
      'city',

    cityKey:
      'atl',

    policyVersion:
      1,

    calculatedAt:
      '2026-01-01T00:00:00.000Z',

    candidates,
    rows:
      candidates,

    reputationRows:
      candidates,
  }
}

/* =========================================================
 * Export contract
 * ======================================================= */

describe(
  'reputation rankings export contract',
  () => {
    it(
      'exports the canonical ranking function',
      () => {
        expect(
          rankCandidates
        ).toBeTypeOf(
          'function'
        )
      }
    )
  }
)

/* =========================================================
 * Empty and single-candidate behavior
 * ======================================================= */

describe(
  'empty and minimal ranking populations',
  () => {
    it(
      'returns an empty ranking population for no candidates',
      async () => {
        const ranked =
          await runRankings([])

        expect(
          ranked
        ).toEqual([])
      }
    )

    it(
      'assigns rank one to the only eligible creator',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                25,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                7,

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          ranked
        ).toHaveLength(1)

        expect(
          ranked[0]
        ).toMatchObject({
          userId:
            USER_A,

          rank:
            1,

          eligibleCreatorCount:
            1,
        })

        expect(
          ranked[0]
            .topPercent
        ).toBe(100)
      }
    )
  }
)

/* =========================================================
 * Eligibility filtering
 * ======================================================= */

describe(
  'ranking eligibility',
  () => {
    it(
      'does not rank unranked creators',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                100,

              verifiedVenueCount:
                20,

              weightedVenueCount:
                25,

              reputationLevel:
                'unranked',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                20,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                6,

              reputationLevel:
                'emerging',
            }),
          ])

        const unranked =
          ranked.find(
            (candidate) =>
              candidate.userId ===
              USER_A
          )

        const eligible =
          ranked.find(
            (candidate) =>
              candidate.userId ===
              USER_B
          )

        expect(
          unranked?.rank ??
            null
        ).toBeNull()

        expect(
          eligible?.rank
        ).toBe(1)

        expect(
          eligible
            ?.eligibleCreatorCount
        ).toBe(1)
      }
    )

    it(
      'counts only eligible creators in the ranking population',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                30,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                20,

              reputationLevel:
                'established',
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                999,

              reputationLevel:
                'unranked',
            }),
          ])

        const eligibleRows =
          ranked.filter(
            (candidate) =>
              candidate.rank !==
              null
          )

        expect(
          eligibleRows
        ).toHaveLength(2)

        for (
          const candidate of
            eligibleRows
        ) {
          expect(
            candidate
              .eligibleCreatorCount
          ).toBe(2)
        }
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
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                10,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                50,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                30,

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          rankedEligibleUserIds(
            ranked
          )
        ).toEqual([
          USER_B,
          USER_C,
          USER_A,
        ])
      }
    )

    it(
      'uses verified venue count as the first score tie-breaker',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                10,

              reputationLevel:
                'emerging',
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

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          rankedEligibleUserIds(
            ranked
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses weighted venue count after verified venue count',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                9,

              reputationLevel:
                'emerging',
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

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          rankedEligibleUserIds(
            ranked
          )
        ).toEqual([
          USER_B,
          USER_A,
        ])
      }
    )

    it(
      'uses user ID as the final deterministic tie-breaker',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_D,

              reputationScore:
                40,

              verifiedVenueCount:
                8,

              weightedVenueCount:
                12,

              reputationLevel:
                'emerging',
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

              reputationLevel:
                'emerging',
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

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          rankedEligibleUserIds(
            ranked
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
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                30,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                20,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                10,

              reputationLevel:
                'emerging',
            }),
          ])

        expect(
          ranked
            .filter(
              (
                candidate
              ): candidate is RankedCandidate & {
                rank: number
              } =>
                candidate.rank !==
                null
            )
            .map(
              (candidate) =>
                candidate.rank
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
 * Percentile and top-percent math
 * ======================================================= */

describe(
  'ranking percentile math',
  () => {
    it(
      'calculates top percent from rank divided by eligible population',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                40,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                30,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_C,

              reputationScore:
                20,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_D,

              reputationScore:
                10,

              reputationLevel:
                'emerging',
            }),
          ])

        const first =
          ranked.find(
            (candidate) =>
              candidate.rank ===
              1
          )

        const second =
          ranked.find(
            (candidate) =>
              candidate.rank ===
              2
          )

        const fourth =
          ranked.find(
            (candidate) =>
              candidate.rank ===
              4
          )

        expect(
          first?.topPercent
        ).toBe(25)

        expect(
          second?.topPercent
        ).toBe(50)

        expect(
          fourth?.topPercent
        ).toBe(100)
      }
    )

    it(
      'never returns top percent below zero or above one hundred',
      async () => {
        const candidates =
          Array.from(
            {
              length: 20,
            },
            (
              _,
              index
            ) =>
              createCandidate({
                userId:
                  createUuid(
                    index + 1
                  ),

                reputationScore:
                  100 -
                  index,

                reputationLevel:
                  'emerging',
              })
          )

        const ranked =
          await runRankings(
            candidates
          )

        for (
          const candidate of
            ranked
        ) {
          if (
            candidate.rank ===
            null
          ) {
            expect(
              candidate
                .topPercent
            ).toBeNull()

            continue
          }

          expect(
            candidate
              .topPercent
          ).not.toBeNull()

          expect(
            candidate
              .topPercent as number
          ).toBeGreaterThanOrEqual(
            0
          )

          expect(
            candidate
              .topPercent as number
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
      async () => {
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
          await runRankings(
            candidates
          )

        const second =
          await runRankings(
            candidates
          )

        expect(
          second
        ).toEqual(first)
      }
    )

    it(
      'returns the same rankings regardless of input order',
      async () => {
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

            reputationLevel:
              'emerging',
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

            reputationLevel:
              'expert',
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

            reputationLevel:
              'established',
          }),
        ]

        const forward =
          await runRankings(
            candidates
          )

        const reversed =
          await runRankings(
            [
              ...candidates,
            ].reverse()
          )

        expect(
          normalizeComparableRanking(
            reversed
          )
        ).toEqual(
          normalizeComparableRanking(
            forward
          )
        )
      }
    )

    it(
      'does not mutate the candidate input array or rows',
      async () => {
        const candidates = [
          createCandidate({
            userId:
              USER_A,

            reputationScore:
              30,

            reputationLevel:
              'emerging',
          }),

          createCandidate({
            userId:
              USER_B,

            reputationScore:
              20,

            reputationLevel:
              'established',
          }),
        ]

        const before =
          structuredClone(
            candidates
          )

        await runRankings(
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
 * Invalid numeric input
 * ======================================================= */

describe(
  'invalid ranking evidence',
  () => {
    it(
      'does not allow NaN or Infinity to escape into ranking output',
      async () => {
        const ranked =
          await runRankings([
            createCandidate({
              userId:
                USER_A,

              reputationScore:
                Number.NaN,

              verifiedVenueCount:
                Number.POSITIVE_INFINITY,

              weightedVenueCount:
                Number.NEGATIVE_INFINITY,

              reputationLevel:
                'emerging',
            }),

            createCandidate({
              userId:
                USER_B,

              reputationScore:
                10,

              verifiedVenueCount:
                5,

              weightedVenueCount:
                6,

              reputationLevel:
                'emerging',
            }),
          ])

        for (
          const candidate of
            ranked
        ) {
          expect(
            Number.isFinite(
              candidate
                .reputationScore
            )
          ).toBe(true)

          expect(
            Number.isFinite(
              candidate
                .verifiedVenueCount
            )
          ).toBe(true)

          expect(
            Number.isFinite(
              candidate
                .weightedVenueCount
            )
          ).toBe(true)

          expect(
            Number.isFinite(
              candidate
                .eligibleCreatorCount
            )
          ).toBe(true)

          if (
            candidate
              .topPercent !==
            null
          ) {
            expect(
              Number.isFinite(
                candidate
                  .topPercent
              )
            ).toBe(true)
          }
        }
      }
    )
  }
)

/* =========================================================
 * Ranking runner
 * ======================================================= */

async function runRankings(
  candidates:
    readonly RankingCandidate[]
): Promise<RankedCandidate[]> {
  const rawResult =
    await Promise.resolve(
      rankCandidates(
        createRankingInput(
          candidates
        )
      )
    )

  return normalizeRankingResult(
    rawResult,
    candidates
  )
}

/* =========================================================
 * Result normalization
 * ======================================================= */

function normalizeRankingResult(
  value: unknown,
  sourceCandidates:
    readonly RankingCandidate[]
): RankedCandidate[] {
  const rawRows =
    extractRankingRows(
      value
    )

  if (
    rawRows.length === 0 &&
    sourceCandidates.length >
      0
  ) {
    throw new Error(
      [
        'Ranking function returned no rows for a non-empty population.',
        'Expected an array or an object containing rows, rankings,',
        'candidates, results, or data.',
      ].join(' ')
    )
  }

  const sourceByUserId =
    new Map(
      sourceCandidates.map(
        (candidate) => [
          candidate.userId,
          candidate,
        ]
      )
    )

  return rawRows.map(
    (row) => {
      if (!isRecord(row)) {
        throw new Error(
          'Each ranking result must be an object.'
        )
      }

      const userId =
        normalizeNullableText(
          firstDefined(
            row.userId,
            row.user_id,
            row.id
          )
        )

      if (!userId) {
        throw new Error(
          'Ranking result is missing userId or user_id.'
        )
      }

      const source =
        sourceByUserId.get(
          userId
        )

      const reputationScore =
        normalizeFiniteNumber(
          firstDefined(
            row.reputationScore,
            row.reputation_score,
            row.score,
            source
              ?.reputationScore
          )
        ) ?? 0

      const verifiedVenueCount =
        normalizeCount(
          firstDefined(
            row.verifiedVenueCount,
            row.verified_venue_count,
            source
              ?.verifiedVenueCount
          )
        )

      const weightedVenueCount =
        normalizeCount(
          firstDefined(
            row.weightedVenueCount,
            row.weighted_venue_count,
            source
              ?.weightedVenueCount
          )
        )

      const reputationLevel =
        normalizeLevel(
          firstDefined(
            row.reputationLevel,
            row.reputation_level,
            row.level,
            source
              ?.reputationLevel
          )
        )

      const rank =
        normalizePositiveInteger(
          firstDefined(
            row.rank,
            row.ranking,
            row.position
          )
        )

      const eligibleCreatorCount =
        normalizeCount(
          firstDefined(
            row.eligibleCreatorCount,
            row.eligible_creator_count,
            row.population,
            row.populationSize,
            row.population_size
          )
        )

      const topPercent =
        normalizePercentage(
          firstDefined(
            row.topPercent,
            row.top_percent,
            row.percentile,
            row.percentileRank,
            row.percentile_rank
          )
        )

      return {
        userId,
        reputationScore,
        verifiedVenueCount,
        weightedVenueCount,
        reputationLevel,
        rank,
        eligibleCreatorCount,
        topPercent,
      }
    }
  )
}

function extractRankingRows(
  value: unknown
): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (!isRecord(value)) {
    return []
  }

  const candidates = [
    value.rows,
    value.rankings,
    value.candidates,
    value.results,
    value.data,
  ]

  for (
    const candidate of
      candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate
    }
  }

  return []
}

/* =========================================================
 * Comparison helpers
 * ======================================================= */

function rankedEligibleUserIds(
  ranked:
    readonly RankedCandidate[]
): string[] {
  return ranked
    .filter(
      (
        candidate
      ): candidate is RankedCandidate & {
        rank: number
      } =>
        candidate.rank !==
        null
    )
    .sort(
      (
        first,
        second
      ) =>
        first.rank -
        second.rank
    )
    .map(
      (candidate) =>
        candidate.userId
    )
}

function normalizeComparableRanking(
  ranked:
    readonly RankedCandidate[]
) {
  return [
    ...ranked,
  ]
    .sort(
      (
        first,
        second
      ) =>
        first.userId.localeCompare(
          second.userId
        )
    )
    .map(
      (candidate) => ({
        userId:
          candidate.userId,

        rank:
          candidate.rank,

        eligibleCreatorCount:
          candidate
            .eligibleCreatorCount,

        topPercent:
          candidate
            .topPercent,
      })
    )
}

/* =========================================================
 * Module loading
 * ======================================================= */

function loadRequiredFunction(
  moduleValue: UnknownRecord,
  exportNames:
    readonly string[]
): RankingFunction {
  for (
    const exportName of
      exportNames
  ) {
    const candidate =
      moduleValue[
        exportName
      ]

    if (
      typeof candidate ===
      'function'
    ) {
      return candidate as RankingFunction
    }
  }

  throw new Error(
    [
      'Unable to locate the reputation ranking function.',
      `Expected one of: ${exportNames.join(
        ', '
      )}.`,
      `Available exports: ${Object.keys(
        moduleValue
      ).join(', ') || '(none)'}.`,
    ].join(' ')
  )
}

/* =========================================================
 * Primitive normalization
 * ======================================================= */

function normalizeLevel(
  value: unknown
): RankingCandidate['reputationLevel'] {
  if (
    typeof value !==
    'string'
  ) {
    return 'unranked'
  }

  const normalized =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[\s-]+/g,
        '_'
      )

  if (
    normalized ===
      'emerging' ||
    normalized ===
      'established' ||
    normalized ===
      'expert' ||
    normalized ===
      'elite'
  ) {
    return normalized
  }

  return 'unranked'
}

function normalizeCount(
  value: unknown
): number {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return 0
  }

  return Math.trunc(
    normalized
  )
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized <= 0
  ) {
    return null
  }

  return Math.trunc(
    normalized
  )
}

function normalizePercentage(
  value: unknown
): number | null {
  const normalized =
    normalizeFiniteNumber(
      value
    )

  if (
    normalized === null ||
    normalized < 0
  ) {
    return null
  }

  return Math.min(
    100,
    normalized
  )
}

function normalizeFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value ===
      'number' &&
    Number.isFinite(
      value
    )
  ) {
    return value
  }

  if (
    typeof value ===
      'string' &&
    value.trim().length >
      0
  ) {
    const parsed =
      Number(value)

    return Number.isFinite(
      parsed
    )
      ? parsed
      : null
  }

  return null
}

function normalizeNullableText(
  value: unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized.length >
    0
    ? normalized
    : null
}

function firstDefined(
  ...values: unknown[]
): unknown {
  for (
    const value of
      values
  ) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
}

function createUuid(
  value: number
): string {
  const suffix =
    Math.max(
      1,
      Math.trunc(value)
    )
      .toString(16)
      .padStart(
        12,
        '0'
      )

  return `00000000-0000-4000-8000-${suffix}`
}

function isRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}