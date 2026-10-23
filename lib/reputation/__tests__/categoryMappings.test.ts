
import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  REPUTATION_CATEGORY_IDS,
  isReputationCategoryId,
} from '@/lib/reputation/types'

import {
  MAX_REPUTATION_CATEGORY_MAPPING_WEIGHT,
  MAX_VENUE_TYPE_KEY_LENGTH,
  MIN_REPUTATION_CATEGORY_MAPPING_WEIGHT,
  aggregateVenueTypeCategoryMappings,
  buildVenueCategoryMappingIndex,
  getReputationCategoryMappingsForVenueType,
  getVenueCategoryMappings,
  hasVenueCategoryMapping,
  isVenueCategoryMapping,
  mapVenueTypeToReputationCategories,
  normalizeCategoryMappingWeight,
  normalizeVenueCategoryMapping,
  normalizeVenueCategoryMappings,
  normalizeVenueCategoryMappingsDetailed,
  normalizeVenueReputationCategoryMappings,
  normalizeVenueTypeKey,
} from '@/lib/reputation/categoryMappings'

/* =========================================================
 * Canonical fixtures
 * ======================================================= */

const RAW_MAPPINGS = [
  {
    venue_type:
      'Coffee Shop',

    category_id:
      'coffee',

    mapping_weight:
      1,

    sort_order:
      1,
  },
  {
    venue_type:
      'Coffee Shop',

    category_id:
      'bakeries_desserts',

    mapping_weight:
      0.5,

    sort_order:
      2,
  },
  {
    venue_type:
      'Wine Bar',

    category_id:
      'wine_bars',

    mapping_weight:
      1,

    sort_order:
      1,
  },
  {
    venue_type:
      'Wine Bar',

    category_id:
      'restaurants',

    mapping_weight:
      0.25,

    sort_order:
      2,
  },
] as const

/* =========================================================
 * Canonical category identity
 * ======================================================= */

describe(
  'reputation category registry',
  () => {
    it(
      'defines the canonical reputation categories',
      () => {
        expect(
          REPUTATION_CATEGORY_IDS
        ).toHaveLength(14)

        expect(
          REPUTATION_CATEGORY_IDS
        ).toContain('coffee')

        expect(
          REPUTATION_CATEGORY_IDS
        ).toContain('restaurants')
      }
    )

    it(
      'uses unique and normalized category IDs',
      () => {
        expect(
          new Set(
            REPUTATION_CATEGORY_IDS
          ).size
        ).toBe(
          REPUTATION_CATEGORY_IDS.length
        )

        for (
          const categoryId of
            REPUTATION_CATEGORY_IDS
        ) {
          expect(
            categoryId
          ).toMatch(
            /^[a-z0-9]+(?:_[a-z0-9]+)*$/
          )

          expect(
            categoryId
          ).toBe(
            categoryId.trim()
          )
        }
      }
    )

    it(
      'recognizes every canonical category',
      () => {
        for (
          const categoryId of
            REPUTATION_CATEGORY_IDS
        ) {
          expect(
            isReputationCategoryId(
              categoryId
            )
          ).toBe(true)
        }
      }
    )

    it(
      'rejects unsupported category identifiers',
      () => {
        for (
          const value of [
            '__unsupported_category__',
            '',
            null,
            undefined,
            123,
            {},
          ]
        ) {
          expect(
            isReputationCategoryId(
              value
            )
          ).toBe(false)
        }
      }
    )
  }
)

/* =========================================================
 * Venue type normalization
 * ======================================================= */

describe(
  'venue type normalization',
  () => {
    it(
      'normalizes whitespace, punctuation, and casing',
      () => {
        expect(
          normalizeVenueTypeKey(
            '  Coffee Shop  '
          )
        ).toBe('coffee_shop')

        expect(
          normalizeVenueTypeKey(
            'coffee-shop'
          )
        ).toBe('coffee_shop')

        expect(
          normalizeVenueTypeKey(
            'NIGHT CLUB'
          )
        ).toBe('night_club')

        expect(
          normalizeVenueTypeKey(
            "Chef's Table"
          )
        ).toBe('chefs_table')
      }
    )

    it(
      'normalizes accented characters',
      () => {
        expect(
          normalizeVenueTypeKey(
            'Café'
          )
        ).toBe('cafe')
      }
    )

    it(
      'rejects unusable values',
      () => {
        for (
          const value of [
            null,
            undefined,
            '',
            '   ',
            '!!!',
            123,
            {},
            [],
          ]
        ) {
          expect(
            normalizeVenueTypeKey(
              value
            )
          ).toBeNull()
        }
      }
    )

    it(
      'enforces the maximum venue type length',
      () => {
        const normalized =
          normalizeVenueTypeKey(
            'a'.repeat(
              MAX_VENUE_TYPE_KEY_LENGTH +
                100
            )
          )

        expect(
          normalized
        ).not.toBeNull()

        expect(
          normalized!.length
        ).toBeLessThanOrEqual(
          MAX_VENUE_TYPE_KEY_LENGTH
        )
      }
    )
  }
)

/* =========================================================
 * Mapping weight normalization
 * ======================================================= */

describe(
  'category mapping weights',
  () => {
    it(
      'uses a positive mapping weight range capped at one',
      () => {
        expect(
          MIN_REPUTATION_CATEGORY_MAPPING_WEIGHT
        ).toBeGreaterThan(0)

        expect(
          MAX_REPUTATION_CATEGORY_MAPPING_WEIGHT
        ).toBe(1)
      }
    )

    it(
      'accepts valid numeric and numeric-string weights',
      () => {
        expect(
          normalizeCategoryMappingWeight(
            1
          )
        ).toBe(1)

        expect(
          normalizeCategoryMappingWeight(
            0.75
          )
        ).toBe(0.75)

        expect(
          normalizeCategoryMappingWeight(
            '0.5'
          )
        ).toBe(0.5)
      }
    )

    it(
      'rejects zero, negative, and excessive weights',
      () => {
        for (
          const value of [
            0,
            -0.25,
            1.01,
            Number.NaN,
            Number.POSITIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            'not-a-number',
            null,
            undefined,
          ]
        ) {
          expect(
            normalizeCategoryMappingWeight(
              value
            )
          ).toBeNull()
        }
      }
    )
  }
)

/* =========================================================
 * Single mapping normalization
 * ======================================================= */

describe(
  'single venue category mapping',
  () => {
    it(
      'normalizes snake_case database rows',
      () => {
        expect(
          normalizeVenueCategoryMapping({
            venue_type:
              'Coffee Shop',

            category_id:
              'coffee',

            mapping_weight:
              0.75,

            sort_order:
              3,
          })
        ).toEqual({
          venueType:
            'coffee_shop',

          categoryId:
            'coffee',

          weight:
            0.75,

          sortOrder:
            3,
        })
      }
    )

    it(
      'normalizes camelCase application rows',
      () => {
        expect(
          normalizeVenueCategoryMapping({
            venueType:
              'Wine Bar',

            categoryId:
              'wine_bars',

            mappingWeight:
              1,

            sortOrder:
              2,
          })
        ).toEqual({
          venueType:
            'wine_bar',

          categoryId:
            'wine_bars',

          weight:
            1,

          sortOrder:
            2,
        })
      }
    )

    it(
      'defaults missing sort order to zero',
      () => {
        const result =
          normalizeVenueCategoryMapping({
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              1,
          })

        expect(
          result?.sortOrder
        ).toBe(0)
      }
    )

    it(
      'normalizes negative and fractional sort orders',
      () => {
        const negative =
          normalizeVenueCategoryMapping({
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              1,

            sortOrder:
              -5,
          })

        const fractional =
          normalizeVenueCategoryMapping({
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              1,

            sortOrder:
              2.9,
          })

        expect(
          negative?.sortOrder
        ).toBe(0)

        expect(
          fractional?.sortOrder
        ).toBe(2)
      }
    )

    it(
      'rejects explicitly inactive mappings',
      () => {
        for (
          const inactiveField of [
            {
              active: false,
            },
            {
              isActive: false,
            },
            {
              is_active: false,
            },
          ]
        ) {
          expect(
            normalizeVenueCategoryMapping({
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                1,

              ...inactiveField,
            })
          ).toBeNull()
        }
      }
    )

    it(
      'rejects invalid category IDs and weights',
      () => {
        expect(
          normalizeVenueCategoryMapping({
            venueType:
              'coffee_shop',

            categoryId:
              'unknown_category',

            weight:
              1,
          })
        ).toBeNull()

        expect(
          normalizeVenueCategoryMapping({
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              0,
          })
        ).toBeNull()
      }
    )

    it(
      'does not throw on malformed inputs',
      () => {
        for (
          const value of [
            null,
            undefined,
            123,
            false,
            'coffee',
            [],
          ]
        ) {
          expect(
            () =>
              normalizeVenueCategoryMapping(
                value
              )
          ).not.toThrow()

          expect(
            normalizeVenueCategoryMapping(
              value
            )
          ).toBeNull()
        }
      }
    )

    it(
      'provides a canonical mapping predicate',
      () => {
        expect(
          isVenueCategoryMapping({
            venueType:
              'Coffee Shop',

            categoryId:
              'coffee',

            weight:
              1,
          })
        ).toBe(true)

        expect(
          isVenueCategoryMapping({
            venueType:
              'Coffee Shop',

            categoryId:
              'unsupported',

            weight:
              1,
          })
        ).toBe(false)
      }
    )
  }
)

/* =========================================================
 * Batch normalization
 * ======================================================= */

describe(
  'venue category mapping batches',
  () => {
    it(
      'normalizes and sorts multiple mappings',
      () => {
        const result =
          normalizeVenueCategoryMappings(
            RAW_MAPPINGS
          )

        expect(
          result
        ).toHaveLength(4)

        expect(
          result.map(
            (
              mapping
            ) =>
              mapping.venueType
          )
        ).toEqual([
          'coffee_shop',
          'coffee_shop',
          'wine_bar',
          'wine_bar',
        ])

        expect(
          result.map(
            (
              mapping
            ) =>
              mapping.categoryId
          )
        ).toEqual([
          'coffee',
          'bakeries_desserts',
          'wine_bars',
          'restaurants',
        ])
      }
    )

    it(
      'deduplicates by venue type and category ID',
      () => {
        const result =
          normalizeVenueCategoryMappings([
            {
              venueType:
                'Coffee Shop',

              categoryId:
                'coffee',

              weight:
                0.3,

              sortOrder:
                1,
            },
            {
              venueType:
                'coffee-shop',

              categoryId:
                'coffee',

              weight:
                0.9,

              sortOrder:
                5,
            },
            {
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                0.6,

              sortOrder:
                2,
            },
          ])

        expect(
          result
        ).toEqual([
          {
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              0.9,

            sortOrder:
              5,
          },
        ])
      }
    )

    it(
      'prefers the lowest sort order when duplicate weights match',
      () => {
        const result =
          normalizeVenueCategoryMappings([
            {
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                0.75,

              sortOrder:
                9,
            },
            {
              venueType:
                'Coffee Shop',

              categoryId:
                'coffee',

              weight:
                0.75,

              sortOrder:
                2,
            },
          ])

        expect(
          result
        ).toEqual([
          {
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              0.75,

            sortOrder:
              2,
          },
        ])
      }
    )

    it(
      'returns deterministic results regardless of input order',
      () => {
        const forward =
          normalizeVenueCategoryMappings(
            RAW_MAPPINGS
          )

        const reversed =
          normalizeVenueCategoryMappings(
            [
              ...RAW_MAPPINGS,
            ].reverse()
          )

        expect(
          reversed
        ).toEqual(
          forward
        )
      }
    )

    it(
      'reports rejection reasons and source indexes',
      () => {
        const result =
          normalizeVenueCategoryMappingsDetailed([
            null,
            {
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                1,

              active:
                false,
            },
            {
              venueType:
                '!!!',

              categoryId:
                'coffee',

              weight:
                1,
            },
            {
              venueType:
                'coffee_shop',

              categoryId:
                'unsupported',

              weight:
                1,
            },
            {
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                0,
            },
            {
              venueType:
                'coffee_shop',

              categoryId:
                'coffee',

              weight:
                1,
            },
          ])

        expect(
          result.mappings
        ).toHaveLength(1)

        expect(
          result.rejected.map(
            ({
              index,
              reason,
            }) => ({
              index,
              reason,
            })
          )
        ).toEqual([
          {
            index: 0,
            reason: 'invalid_record',
          },
          {
            index: 1,
            reason: 'inactive',
          },
          {
            index: 2,
            reason: 'invalid_venue_type',
          },
          {
            index: 3,
            reason: 'invalid_category_id',
          },
          {
            index: 4,
            reason: 'invalid_weight',
          },
        ])
      }
    )

    it(
      'handles non-array batch input defensively',
      () => {
        expect(
          normalizeVenueCategoryMappings(
            null
          )
        ).toEqual([])

        expect(
          normalizeVenueCategoryMappingsDetailed(
            null
          )
        ).toEqual({
          mappings: [],
          rejected: [
            {
              index: -1,
              value: null,
              reason: 'invalid_record',
            },
          ],
        })
      }
    )

    it(
      'preserves the compatibility alias',
      () => {
        expect(
          normalizeVenueReputationCategoryMappings(
            RAW_MAPPINGS
          )
        ).toEqual(
          normalizeVenueCategoryMappings(
            RAW_MAPPINGS
          )
        )
      }
    )
  }
)

/* =========================================================
 * Indexing and lookup
 * ======================================================= */

describe(
  'venue category mapping index and lookup',
  () => {
    it(
      'builds an index using canonical venue keys',
      () => {
        const index =
          buildVenueCategoryMappingIndex(
            RAW_MAPPINGS
          )

        expect(
          index.has(
            'coffee_shop'
          )
        ).toBe(true)

        expect(
          index.has(
            'wine_bar'
          )
        ).toBe(true)

        expect(
          index.get(
            'coffee_shop'
          )
        ).toHaveLength(2)

        expect(
          index.has(
            'unsupported_type'
          )
        ).toBe(false)
      }
    )

    it(
      'freezes stored mapping arrays',
      () => {
        const index =
          buildVenueCategoryMappingIndex(
            RAW_MAPPINGS
          )

        const mappings =
          index.get(
            'coffee_shop'
          )

        expect(
          mappings
        ).toBeDefined()

        expect(
          Object.isFrozen(
            mappings
          )
        ).toBe(true)
      }
    )

    it(
      'resolves contributions from raw mappings',
      () => {
        const result =
          mapVenueTypeToReputationCategories({
            venueType:
              '  COFFEE SHOP  ',

            mappings:
              RAW_MAPPINGS,
          })

        expect(
          result
        ).toEqual([
          {
            categoryId:
              'coffee',

            weight:
              1,
          },
          {
            categoryId:
              'bakeries_desserts',

            weight:
              0.5,
          },
        ])
      }
    )

    it(
      'resolves the same contributions using a prebuilt index',
      () => {
        const index =
          buildVenueCategoryMappingIndex(
            RAW_MAPPINGS
          )

        expect(
          getReputationCategoryMappingsForVenueType({
            venueType:
              'coffee-shop',

            index,
          })
        ).toEqual(
          mapVenueTypeToReputationCategories({
            venueType:
              'coffee_shop',

            mappings:
              RAW_MAPPINGS,
          })
        )
      }
    )

    it(
      'retrieves complete normalized mapping rows',
      () => {
        const index =
          buildVenueCategoryMappingIndex(
            RAW_MAPPINGS
          )

        expect(
          getVenueCategoryMappings({
            venueType:
              'Wine Bar',

            index,
          })
        ).toEqual([
          {
            venueType:
              'wine_bar',

            categoryId:
              'wine_bars',

            weight:
              1,

            sortOrder:
              1,
          },
          {
            venueType:
              'wine_bar',

            categoryId:
              'restaurants',

            weight:
              0.25,

            sortOrder:
              2,
          },
        ])
      }
    )

    it(
      'checks category membership accurately',
      () => {
        const index =
          buildVenueCategoryMappingIndex(
            RAW_MAPPINGS
          )

        expect(
          hasVenueCategoryMapping({
            venueType:
              'Coffee Shop',

            categoryId:
              'coffee',

            index,
          })
        ).toBe(true)

        expect(
          hasVenueCategoryMapping({
            venueType:
              'Coffee Shop',

            categoryId:
              'wine_bars',

            index,
          })
        ).toBe(false)

        expect(
          hasVenueCategoryMapping({
            venueType:
              'Coffee Shop',

            categoryId:
              'unsupported',

            index,
          })
        ).toBe(false)
      }
    )

    it(
      'returns no mappings for unknown or invalid venue types',
      () => {
        expect(
          mapVenueTypeToReputationCategories({
            venueType:
              'unsupported_type',

            mappings:
              RAW_MAPPINGS,
          })
        ).toEqual([])

        expect(
          mapVenueTypeToReputationCategories({
            venueType:
              null,

            mappings:
              RAW_MAPPINGS,
          })
        ).toEqual([])

        expect(
          getVenueCategoryMappings({
            venueType:
              'unsupported_type',

            mappings:
              RAW_MAPPINGS,
          })
        ).toEqual([])
      }
    )
  }
)

/* =========================================================
 * Aggregation
 * ======================================================= */

describe(
  'venue type category aggregation',
  () => {
    it(
      'combines weights across distinct venue types',
      () => {
        const mappings = [
          {
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              0.75,

            sortOrder:
              0,
          },
          {
            venueType:
              'cafe',

            categoryId:
              'coffee',

            weight:
              0.5,

            sortOrder:
              0,
          },
          {
            venueType:
              'cafe',

            categoryId:
              'bakeries_desserts',

            weight:
              0.25,

            sortOrder:
              1,
          },
        ]

        expect(
          aggregateVenueTypeCategoryMappings({
            venueTypes: [
              'Coffee Shop',
              'Cafe',
            ],

            mappings,
          })
        ).toEqual([
          {
            categoryId:
              'coffee',

            weight:
              1.25,
          },
          {
            categoryId:
              'bakeries_desserts',

            weight:
              0.25,
          },
        ])
      }
    )

    it(
      'ignores duplicate venue types',
      () => {
        const mappings = [
          {
            venueType:
              'coffee_shop',

            categoryId:
              'coffee',

            weight:
              0.75,
          },
        ]

        expect(
          aggregateVenueTypeCategoryMappings({
            venueTypes: [
              'Coffee Shop',
              'coffee-shop',
              'coffee_shop',
            ],

            mappings,
          })
        ).toEqual([
          {
            categoryId:
              'coffee',

            weight:
              0.75,
          },
        ])
      }
    )

    it(
      'sorts aggregated categories by descending weight',
      () => {
        const result =
          aggregateVenueTypeCategoryMappings({
            venueTypes: [
              'Coffee Shop',
              'Wine Bar',
            ],

            mappings:
              RAW_MAPPINGS,
          })

        expect(
          result
        ).toEqual([
          {
            categoryId:
              'coffee',

            weight:
              1,
          },
          {
            categoryId:
              'wine_bars',

            weight:
              1,
          },
          {
            categoryId:
              'bakeries_desserts',

            weight:
              0.5,
          },
          {
            categoryId:
              'restaurants',

            weight:
              0.25,
          },
        ])
      }
    )

    it(
      'handles malformed venue-type collections',
      () => {
        expect(
          aggregateVenueTypeCategoryMappings({
            venueTypes:
              null as unknown as readonly unknown[],

            mappings:
              RAW_MAPPINGS,
          })
        ).toEqual([])
      }
    )
  }
)

/* =========================================================
 * Public contract
 * ======================================================= */

describe(
  'categoryMappings public contract',
  () => {
    it(
      'exports the canonical mapping operations',
      () => {
        expect(
          normalizeVenueCategoryMapping
        ).toBeTypeOf('function')

        expect(
          normalizeVenueCategoryMappings
        ).toBeTypeOf('function')

        expect(
          normalizeVenueCategoryMappingsDetailed
        ).toBeTypeOf('function')

        expect(
          buildVenueCategoryMappingIndex
        ).toBeTypeOf('function')

        expect(
          mapVenueTypeToReputationCategories
        ).toBeTypeOf('function')

        expect(
          aggregateVenueTypeCategoryMappings
        ).toBeTypeOf('function')
      }
    )
  }
)
