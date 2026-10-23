import {
  describe,
  expect,
  it,
} from 'vitest'

import * as calculationModule from '@/lib/reputation/calculateCreatorReputation'

/* =========================================================
 * Test-local contracts
 * ======================================================= */

type UnknownRecord = Record<
  string,
  unknown
>

type ReputationLevel =
  | 'unranked'
  | 'emerging'
  | 'established'
  | 'expert'
  | 'elite'

type CalculationFunction = (
  input: unknown,
  ...rest: unknown[]
) => unknown

type NormalizedCalculation = {
  reputationScore: number
  reputationLevel: ReputationLevel

  verifiedVenueCount: number
  weightedVenueCount: number
  publicCollectionCount: number
  curatedVenueCount: number
  publicSnapshotCount: number
  completedFlowCount: number
  cityCount: number

  eligible: boolean | null
}

/* =========================================================
 * Supported export names
 * ======================================================= */

/**
 * Keep this adapter narrow and explicit.
 *
 * Once the calculation module's public API is permanently frozen,
 * reduce this list to the single canonical export.
 */
const CALCULATION_EXPORT_NAMES = [
  'calculateCreatorReputation',
  'calculateReputation',
  'buildCreatorReputation',
] as const

const moduleRecord =
  calculationModule as UnknownRecord

const calculateCreatorReputation =
  loadRequiredFunction(
    moduleRecord,
    CALCULATION_EXPORT_NAMES
  )


/* =========================================================
 * Canonical fixture factory
 * ======================================================= */

const USER_ID =
  'b25fbdac-8385-48fa-8133-fe57f03bd4e2'

const CALCULATED_AT =
  '2026-07-29T12:00:00.000Z'

const EVIDENCE_AT =
  '2026-07-20T12:00:00.000Z'

function createInput(
  overrides: UnknownRecord = {}
): UnknownRecord {
  return {
    userId:
      USER_ID,

    primaryCityKey:
      'atl',

    venueEvidence:
      [],

    publicCollectionContributions:
      [],

    publicSnapshotContributions:
      [],

    completedFlowContributions:
      [],

    calculatedAt:
      CALCULATED_AT,

    ...overrides,
  }
}

function createEvidenceInput(
  evidence: UnknownRecord,
  overrides: UnknownRecord = {}
): UnknownRecord {
  const count = (
    value: unknown
  ): number =>
    typeof value === 'number' &&
    Number.isFinite(value)
      ? Math.max(
          0,
          Math.trunc(value)
        )
      : 0

  const verifiedVenueCount =
    count(
      evidence.verifiedVenueCount
    )

  const weightedVenueCount =
    count(
      evidence.weightedVenueCount
    )

  const publicCollectionCount =
    count(
      evidence.publicCollectionCount
    )

  const curatedVenueCount =
    count(
      evidence.curatedVenueCount
    )

  const publicSnapshotCount =
    count(
      evidence.publicSnapshotCount
    )

  const completedFlowCount =
    count(
      evidence.completedFlowCount
    )

  const venueEvidence =
    Array.from(
      {
        length:
          verifiedVenueCount,
      },
      (_, index) => ({
        venueId:
          `verified-venue-${index + 1}`,

        categoryId:
          'coffee',

        cityKey:
          'atl',

        attributionWeight:
          index <
          weightedVenueCount
            ? 1
            : 0,

        occurredAt:
          EVIDENCE_AT,
      })
    )

  const curatedVenueIds =
    Array.from(
      {
        length:
          curatedVenueCount,
      },
      (_, index) =>
        `curated-venue-${index + 1}`
    )

  const publicCollectionContributions =
    Array.from(
      {
        length:
          publicCollectionCount,
      },
      (_, index) => ({
        collectionId:
          `public-collection-${index + 1}`,

        categoryId:
          'coffee',

        cityKey:
          'atl',

        venueIds:
          index === 0
            ? curatedVenueIds
            : [],
      })
    )

  const publicSnapshotContributions =
    Array.from(
      {
        length:
          publicSnapshotCount,
      },
      (_, index) => ({
        snapshotId:
          `public-snapshot-${index + 1}`,

        categoryId:
          'coffee',

        cityKey:
          'atl',
      })
    )

  const completedFlowContributions =
    Array.from(
      {
        length:
          completedFlowCount,
      },
      (_, index) => ({
        flowId:
          `completed-flow-${index + 1}`,

        categoryId:
          'coffee',

        cityKey:
          'atl',
      })
    )

  return createInput({
    venueEvidence,

    publicCollectionContributions,

    publicSnapshotContributions,

    completedFlowContributions,

    ...overrides,
  })
}

/* =========================================================
 * Baseline behavior
 * ======================================================= */

describe(
  'calculateCreatorReputation',
  () => {
    it(
      'exports the canonical reputation calculation function',
      () => {
        expect(
          calculateCreatorReputation
        ).toBeTypeOf(
          'function'
        )
      }
    )

    it(
      'returns a deterministic result for identical input',
      async () => {
        const input =
          createInput()

        const first =
          await runCalculation(
            input
          )

        const second =
          await runCalculation(
            input
          )

        expect(
          second
        ).toEqual(first)
      }
    )

    it(
      'returns a finite non-negative score',
      async () => {
        const result =
          await runNormalizedCalculation(
            createInput()
          )

        expect(
          Number.isFinite(
            result.reputationScore
          )
        ).toBe(true)

        expect(
          result.reputationScore
        ).toBeGreaterThanOrEqual(
          0
        )
      }
    )

    it(
      'returns a supported reputation level',
      async () => {
        const result =
          await runNormalizedCalculation(
            createInput()
          )

        expect(
          [
            'unranked',
            'emerging',
            'established',
            'expert',
            'elite',
          ]
        ).toContain(
          result.reputationLevel
        )
      }
    )

    it(
      'returns unranked for zero evidence',
      async () => {
        const result =
          await runNormalizedCalculation(
            createInput()
          )

        expect(
          result.reputationLevel
        ).toBe(
          'unranked'
        )
      }
    )

    it(
      'does not award a negative score for zero evidence',
      async () => {
        const result =
          await runNormalizedCalculation(
            createInput()
          )

        expect(
          result.reputationScore
        ).toBeGreaterThanOrEqual(
          0
        )
      }
    )
  }
)


/* =========================================================
 * Evidence preservation
 * ======================================================= */

describe(
  'evidence preservation',
  () => {
    it(
      'preserves normalized canonical evidence counts',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                7,

              weightedVenueCount:
                7,

              publicCollectionCount:
                3,

              curatedVenueCount:
                18,

              publicSnapshotCount:
                4,

              completedFlowCount:
                5,

              cityCount:
                1,
            })
          )

        expect(
          result.verifiedVenueCount
        ).toBe(7)

        expect(
          result.weightedVenueCount
        ).toBe(7)

        expect(
          result.publicCollectionCount
        ).toBe(3)

        expect(
          result.curatedVenueCount
        ).toBe(18)

        expect(
          result.publicSnapshotCount
        ).toBe(4)

        expect(
          result.completedFlowCount
        ).toBe(5)

        expect(
          result.cityCount
        ).toBe(1)
      }
    )

    it(
      'normalizes fractional attribution weights to finite, bounded values',
      async () => {
        const result =
          await runNormalizedCalculation(
            createInput({
              venueEvidence: [
                {
                  venueId:
                    'fractional-venue-1',

                  categoryId:
                    'coffee',

                  cityKey:
                    'atl',

                  attributionWeight:
                    0.75,

                  occurredAt:
                    EVIDENCE_AT,
                },

                {
                  venueId:
                    'fractional-venue-2',

                  categoryId:
                    'coffee',

                  cityKey:
                    'atl',

                  attributionWeight:
                    0.5,

                  occurredAt:
                    EVIDENCE_AT,
                },
              ],
            })
          )

        expect(
          result.verifiedVenueCount
        ).toBe(2)

        expect(
          Number.isFinite(
            result.weightedVenueCount
          )
        ).toBe(true)

        expect(
          result.weightedVenueCount
        ).toBe(1.25)
      }
    )
  }
)

/* =========================================================
 * Invalid-input defense
 * ======================================================= */

describe(
  'invalid evidence handling',
  () => {
    it(
      'does not allow negative evidence to produce negative normalized counts',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                -10,

              weightedVenueCount:
                -4,

              publicCollectionCount:
                -3,

              curatedVenueCount:
                -20,

              publicSnapshotCount:
                -2,

              completedFlowCount:
                -7,

              cityCount:
                -1,
            })
          )

        expect(
          result.verifiedVenueCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.weightedVenueCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.publicCollectionCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.curatedVenueCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.publicSnapshotCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.completedFlowCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.cityCount
        ).toBeGreaterThanOrEqual(
          0
        )

        expect(
          result.reputationScore
        ).toBeGreaterThanOrEqual(
          0
        )
      }
    )

    it(
      'does not allow NaN or Infinity to escape into the result',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                Number.NaN,

              weightedVenueCount:
                Number.POSITIVE_INFINITY,

              publicCollectionCount:
                Number.NEGATIVE_INFINITY,

              curatedVenueCount:
                Number.NaN,

              publicSnapshotCount:
                Number.POSITIVE_INFINITY,

              completedFlowCount:
                Number.NEGATIVE_INFINITY,

              cityCount:
                Number.NaN,

              recencyScore:
                Number.POSITIVE_INFINITY,

              qualityScore:
                Number.NaN,
            })
          )

        expectFiniteNonNegativeResult(
          result
        )
      }
    )

    it(
      'does not throw when optional evidence values are null or undefined',
      async () => {
        const input =
          createEvidenceInput({
            verifiedVenueCount:
              null,

            weightedVenueCount:
              undefined,

            publicCollectionCount:
              null,

            curatedVenueCount:
              undefined,

            publicSnapshotCount:
              null,

            completedFlowCount:
              undefined,

            cityCount:
              null,

            recencyScore:
              undefined,

            qualityScore:
              null,
          })

        await expect(
          runCalculation(
            input
          )
        ).resolves.toBeDefined()
      }
    )
  }
)

/* =========================================================
 * Monotonicity
 * ======================================================= */

describe(
  'score monotonicity',
  () => {
    it(
      'does not reduce reputation score when verified venue evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                2,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                8,
            })
          )

        expect(
          higher.reputationScore
        ).toBeGreaterThanOrEqual(
          lower.reputationScore
        )
      }
    )

    it(
      'does not reduce reputation score when weighted venue evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              weightedVenueCount:
                2,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              weightedVenueCount:
                12,
            })
          )

        expect(
          higher.reputationScore
        ).toBeGreaterThanOrEqual(
          lower.reputationScore
        )
      }
    )

    it(
      'does not reduce reputation score when public collection evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              publicCollectionCount:
                1,

              curatedVenueCount:
                4,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              publicCollectionCount:
                5,

              curatedVenueCount:
                20,
            })
          )

        expect(
          higher.reputationScore
        ).toBeGreaterThanOrEqual(
          lower.reputationScore
        )
      }
    )

    it(
      'does not reduce reputation score when public snapshot evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              publicSnapshotCount:
                1,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              publicSnapshotCount:
                6,
            })
          )

        expect(
          higher.reputationScore
        ).toBeGreaterThanOrEqual(
          lower.reputationScore
        )
      }
    )

    it(
      'does not reduce reputation score when completed-flow evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              completedFlowCount:
                1,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              completedFlowCount:
                9,
            })
          )

        expect(
          higher.reputationScore
        ).toBeGreaterThanOrEqual(
          lower.reputationScore
        )
      }
    )

    it(
      'does not reduce reputation level when total evidence increases',
      async () => {
        const lower =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                2,

              weightedVenueCount:
                2,

              publicCollectionCount:
                0,

              curatedVenueCount:
                0,

              publicSnapshotCount:
                0,

              completedFlowCount:
                0,

              cityCount:
                1,
            })
          )

        const higher =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                20,

              weightedVenueCount:
                28,

              publicCollectionCount:
                8,

              curatedVenueCount:
                50,

              publicSnapshotCount:
                10,

              completedFlowCount:
                12,

              cityCount:
                4,
            })
          )

        expect(
          levelRank(
            higher.reputationLevel
          )
        ).toBeGreaterThanOrEqual(
          levelRank(
            lower.reputationLevel
          )
        )
      }
    )
  }
)

/* =========================================================
 * Evidence separation
 * ======================================================= */

describe(
  'evidence separation',
  () => {
    it(
      'does not invent verified visits from collection-only evidence',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                0,

              publicCollectionCount:
                5,

              curatedVenueCount:
                30,
            })
          )

        expect(
          result.verifiedVenueCount
        ).toBe(0)
      }
    )

    it(
      'does not invent collection evidence from verified visits',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                12,

              publicCollectionCount:
                0,

              curatedVenueCount:
                0,
            })
          )

        expect(
          result.publicCollectionCount
        ).toBe(0)

        expect(
          result.curatedVenueCount
        ).toBe(0)
      }
    )

    it(
      'does not invent snapshot or completed-flow counts',
      async () => {
        const result =
          await runNormalizedCalculation(
            createEvidenceInput({
              verifiedVenueCount:
                10,

              publicSnapshotCount:
                0,

              completedFlowCount:
                0,
            })
          )

        expect(
          result.publicSnapshotCount
        ).toBe(0)

        expect(
          result.completedFlowCount
        ).toBe(0)
      }
    )
  }
)

/* =========================================================
 * Level consistency
 * ======================================================= */

describe(
  'reputation level consistency',
  () => {
    it(
      'never returns a lower-tier level for a strictly higher score produced by the same policy',
      async () => {
        const fixtures = [
          createEvidenceInput({
            verifiedVenueCount:
              0,
          }),

          createEvidenceInput({
            verifiedVenueCount:
              2,

            weightedVenueCount:
              2,
          }),

          createEvidenceInput({
            verifiedVenueCount:
              5,

            weightedVenueCount:
              7,

            publicCollectionCount:
              1,

            curatedVenueCount:
              5,
          }),

          createEvidenceInput({
            verifiedVenueCount:
              12,

            weightedVenueCount:
              18,

            publicCollectionCount:
              4,

            curatedVenueCount:
              25,

            publicSnapshotCount:
              3,

            completedFlowCount:
              4,
          }),

          createEvidenceInput({
            verifiedVenueCount:
              30,

            weightedVenueCount:
              45,

            publicCollectionCount:
              10,

            curatedVenueCount:
              75,

            publicSnapshotCount:
              12,

            completedFlowCount:
              15,

            cityCount:
              5,
          }),
        ]

        const results =
          await Promise.all(
            fixtures.map(
              runNormalizedCalculation
            )
          )

        const byScore = [
          ...results,
        ].sort(
          (first, second) =>
            first.reputationScore -
            second.reputationScore
        )

        for (
          let index = 1;
          index <
          byScore.length;
          index += 1
        ) {
          const previous =
            byScore[index - 1]

          const current =
            byScore[index]

          if (
            current.reputationScore ===
            previous.reputationScore
          ) {
            continue
          }

          expect(
            levelRank(
              current.reputationLevel
            )
          ).toBeGreaterThanOrEqual(
            levelRank(
              previous.reputationLevel
            )
          )
        }
      }
    )
  }
)

/* =========================================================
 * Mutation safety
 * ======================================================= */

describe(
  'calculation purity',
  () => {
    it(
      'does not mutate its input object',
      async () => {
        const input =
          createEvidenceInput({
            verifiedVenueCount:
              5,

            weightedVenueCount:
              7,

            publicCollectionCount:
              2,

            curatedVenueCount:
              12,

            publicSnapshotCount:
              3,

            completedFlowCount:
              4,

            cityCount:
              2,
          })

        const before =
          structuredClone(input)

        await runCalculation(
          input
        )

        expect(
          input
        ).toEqual(before)
      }
    )
  }
)

/* =========================================================
 * Calculation runner
 * ======================================================= */

async function runCalculation(
  input: UnknownRecord
): Promise<unknown> {
  return await Promise.resolve(
    calculateCreatorReputation(
      input
    )
  )
}

async function runNormalizedCalculation(
  input: UnknownRecord
): Promise<NormalizedCalculation> {
  const rawResult =
    await runCalculation(
      input
    )

  return normalizeCalculationResult(
    rawResult
  )
}

/* =========================================================
 * Result normalization
 * ======================================================= */


function normalizeCalculationResult(
  value: unknown
): NormalizedCalculation {
  if (!isRecord(value)) {
    throw new Error(
      'calculateCreatorReputation must return an object.'
    )
  }

  const summary =
    isRecord(value.summary)
      ? value.summary
      : null

  if (!summary) {
    throw new Error(
      'Calculation result is missing the canonical summary.'
    )
  }

  const reputationScore =
    normalizeFiniteNumber(
      summary.overallScore
    )

  if (
    reputationScore === null
  ) {
    throw new Error(
      'Calculation summary is missing a finite overallScore.'
    )
  }

  const reputationLevel =
    normalizeLevel(
      summary.overallLevel
    )

  const globalCategories =
    Array.isArray(
      value.globalCategories
    )
      ? value.globalCategories
      : []

  const globalCoffeeCategory =
    globalCategories.find(
      (category) =>
        isRecord(category) &&
        category.categoryId ===
          'coffee' &&
        category.scope ===
          'global'
    )

  const components =
    isRecord(
      globalCoffeeCategory
    ) &&
    isRecord(
      globalCoffeeCategory.components
    )
      ? globalCoffeeCategory.components
      : {}

  return {
    reputationScore,

    reputationLevel,

    verifiedVenueCount:
      normalizeCount(
        summary.totalVerifiedVenueCount
      ),

    weightedVenueCount:
      normalizeFiniteNumber(
        components.weightedVenueCount
      ) ?? 0,

    publicCollectionCount:
      normalizeCount(
        summary.totalPublicCollectionCount
      ),

    curatedVenueCount:
      normalizeCount(
        summary.totalCuratedVenueCount
      ),

    publicSnapshotCount:
      normalizeCount(
        summary.totalPublicSnapshotCount
      ),

    completedFlowCount:
      normalizeCount(
        summary.totalCompletedFlowCount
      ),

    cityCount:
      normalizeCount(
        summary.qualifyingCityCount
      ),

    eligible:
      null,
  }
}

/* =========================================================
 * Assertions
 * ======================================================= */

function expectFiniteNonNegativeResult(
  result: NormalizedCalculation
): void {
  const numericValues = [
    result.reputationScore,
    result.verifiedVenueCount,
    result.weightedVenueCount,
    result.publicCollectionCount,
    result.curatedVenueCount,
    result.publicSnapshotCount,
    result.completedFlowCount,
    result.cityCount,
  ]

  for (
    const value of
      numericValues
  ) {
    expect(
      Number.isFinite(value)
    ).toBe(true)

    expect(value).toBeGreaterThanOrEqual(
      0
    )
  }
}

/* =========================================================
 * Module loading
 * ======================================================= */

function loadRequiredFunction(
  moduleValue: UnknownRecord,
  exportNames: readonly string[]
): CalculationFunction {
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
      return candidate as CalculationFunction
    }
  }

  throw new Error(
    [
      'Unable to locate the creator-reputation calculation function.',
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
 * Primitive helpers
 * ======================================================= */

function normalizeLevel(
  value: unknown
): ReputationLevel {
  if (
    typeof value !==
    'string'
  ) {
    throw new Error(
      [
        'Calculation result is missing a supported reputation level.',
        'Expected one of:',
        'unranked, emerging, established, expert, elite.',
      ].join(' ')
    )
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
      'unranked' ||
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

  throw new Error(
    `Unsupported reputation level returned: "${value}".`
  )
}

function levelRank(
  level: ReputationLevel
): number {
  switch (level) {
    case 'unranked':
      return 0

    case 'emerging':
      return 1

    case 'established':
      return 2

    case 'expert':
      return 3

    case 'elite':
      return 4
  }
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

function normalizeNullableBoolean(
  value: unknown
): boolean | null {
  return typeof value ===
    'boolean'
    ? value
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

function describeValue(
  value: unknown
): string {
  if (value === null) {
    return 'null'
  }

  if (
    value === undefined
  ) {
    return 'undefined'
  }

  if (
    typeof value ===
    'string'
  ) {
    return JSON.stringify(
      value
    )
  }

  return typeof value
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