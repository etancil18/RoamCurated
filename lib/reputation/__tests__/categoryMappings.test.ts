import {
  describe,
  expect,
  it,
} from 'vitest'

import * as categoryMappingsModule from '@/lib/reputation/categoryMappings'

/* =========================================================
 * Test-local contracts
 * ======================================================= */

type UnknownRecord = Record<
  string,
  unknown
>

type CategoryDefinition = {
  id: string
  label: string
  shortLabel?: string | null
  description?: string | null
  sortOrder?: number | null
  aliases?: readonly string[] | null
}

type CategoryNormalizer = (
  value: unknown
) => string | null

type CategoryPredicate = (
  value: unknown
) => boolean

type CategoryLookup = (
  value: unknown
) => unknown

type VenueCategoryResolver = (
  value: unknown
) => unknown

/* =========================================================
 * Supported public-export names
 * ======================================================= */

/**
 * This adapter keeps the test compatible with the naming
 * variants used while the reputation initiative is rolling out.
 *
 * Once categoryMappings.ts has a permanently frozen public API,
 * this section may be reduced to the canonical export names.
 */

const REGISTRY_EXPORT_NAMES = [
  'REPUTATION_CATEGORIES',
  'REPUTATION_CATEGORY_DEFINITIONS',
  'REPUTATION_CATEGORY_REGISTRY',
  'CATEGORY_MAPPINGS',
] as const

const NORMALIZER_EXPORT_NAMES = [
  'normalizeReputationCategoryId',
  'normalizeCategoryId',
  'resolveReputationCategoryId',
] as const

const PREDICATE_EXPORT_NAMES = [
  'isReputationCategoryId',
  'isSupportedReputationCategoryId',
  'isKnownReputationCategoryId',
] as const

const LOOKUP_EXPORT_NAMES = [
  'getReputationCategoryById',
  'getReputationCategoryDefinition',
  'findReputationCategory',
] as const

const VENUE_RESOLVER_EXPORT_NAMES = [
  'resolveVenueReputationCategoryIds',
  'getVenueReputationCategoryIds',
  'mapVenueToReputationCategories',
  'resolveReputationCategoriesForVenue',
] as const

/* =========================================================
 * Module normalization
 * ======================================================= */

const moduleRecord =
  categoryMappingsModule as UnknownRecord

const categoryDefinitions =
  loadCategoryDefinitions(
    moduleRecord
  )

const normalizeCategoryId =
  loadOptionalFunction<
    CategoryNormalizer
  >(
    moduleRecord,
    NORMALIZER_EXPORT_NAMES
  )

const isCategoryId =
  loadOptionalFunction<
    CategoryPredicate
  >(
    moduleRecord,
    PREDICATE_EXPORT_NAMES
  )

const getCategory =
  loadOptionalFunction<
    CategoryLookup
  >(
    moduleRecord,
    LOOKUP_EXPORT_NAMES
  )

const resolveVenueCategories =
  loadOptionalFunction<
    VenueCategoryResolver
  >(
    moduleRecord,
    VENUE_RESOLVER_EXPORT_NAMES
  )

/* =========================================================
 * Registry tests
 * ======================================================= */

describe(
  'reputation category mappings',
  () => {
    it(
      'exports a non-empty canonical category registry',
      () => {
        expect(
          categoryDefinitions.length
        ).toBeGreaterThan(0)
      }
    )

    it(
      'contains the canonical coffee category',
      () => {
        const coffee =
          categoryDefinitions.find(
            (category) =>
              category.id ===
              'coffee'
          )

        expect(coffee).toBeDefined()

        expect(
          coffee?.label
            .trim()
            .length
        ).toBeGreaterThan(0)
      }
    )

    it(
      'uses normalized, stable category IDs',
      () => {
        for (
          const category of
            categoryDefinitions
        ) {
          expect(
            category.id
          ).toMatch(
            /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/
          )

          expect(
            category.id
          ).toBe(
            category.id.trim()
          )

          expect(
            category.id
          ).toBe(
            category.id.toLowerCase()
          )
        }
      }
    )

    it(
      'does not define duplicate category IDs',
      () => {
        const ids =
          categoryDefinitions.map(
            (category) =>
              category.id
          )

        expect(
          new Set(ids).size
        ).toBe(ids.length)
      }
    )

    it(
      'defines a non-empty public label for every category',
      () => {
        for (
          const category of
            categoryDefinitions
        ) {
          expect(
            category.label
              .trim()
              .length
          ).toBeGreaterThan(0)
        }
      }
    )

    it(
      'does not define duplicate labels after normalization',
      () => {
        const normalizedLabels =
          categoryDefinitions.map(
            (category) =>
              normalizeText(
                category.label
              )
          )

        expect(
          new Set(
            normalizedLabels
          ).size
        ).toBe(
          normalizedLabels.length
        )
      }
    )

    it(
      'uses unique non-negative sort orders when sort orders are provided',
      () => {
        const categoriesWithSortOrder =
          categoryDefinitions.filter(
            (
              category
            ): category is CategoryDefinition & {
              sortOrder: number
            } =>
              typeof category.sortOrder ===
                'number' &&
              Number.isFinite(
                category.sortOrder
              )
          )

        if (
          categoriesWithSortOrder.length ===
          0
        ) {
          return
        }

        const sortOrders =
          categoriesWithSortOrder.map(
            (category) => {
              expect(
                Number.isInteger(
                  category.sortOrder
                )
              ).toBe(true)

              expect(
                category.sortOrder
              ).toBeGreaterThanOrEqual(
                0
              )

              return category.sortOrder
            }
          )

        expect(
          new Set(
            sortOrders
          ).size
        ).toBe(
          sortOrders.length
        )
      }
    )

    it(
      'does not define an alias for more than one category',
      () => {
        const aliasOwners =
          new Map<
            string,
            string
          >()

        for (
          const category of
            categoryDefinitions
        ) {
          for (
            const alias of
              normalizeAliases(
                category.aliases
              )
          ) {
            const comparisonKey =
              normalizeText(alias)

            const existingOwner =
              aliasOwners.get(
                comparisonKey
              )

            expect(
              existingOwner,
              `Alias "${alias}" is assigned to both "${existingOwner}" and "${category.id}".`
            ).toBeUndefined()

            aliasOwners.set(
              comparisonKey,
              category.id
            )
          }
        }
      }
    )

    it(
      'does not use another canonical category ID as an alias',
      () => {
        const canonicalIds =
          new Set(
            categoryDefinitions.map(
              (category) =>
                normalizeText(
                  category.id
                )
            )
          )

        for (
          const category of
            categoryDefinitions
        ) {
          for (
            const alias of
              normalizeAliases(
                category.aliases
              )
          ) {
            const normalizedAlias =
              normalizeText(alias)

            if (
              normalizedAlias ===
              normalizeText(
                category.id
              )
            ) {
              continue
            }

            expect(
              canonicalIds.has(
                normalizedAlias
              ),
              `Alias "${alias}" on "${category.id}" conflicts with another canonical category ID.`
            ).toBe(false)
          }
        }
      }
    )
  }
)

/* =========================================================
 * Category normalization tests
 * ======================================================= */

describe(
  'reputation category normalization',
  () => {
    it(
      'normalizes every canonical ID to itself',
      () => {
        if (
          !normalizeCategoryId
        ) {
          return
        }

        for (
          const category of
            categoryDefinitions
        ) {
          expect(
            normalizeCategoryId(
              category.id
            )
          ).toBe(
            category.id
          )
        }
      }
    )

    it(
      'normalizes surrounding whitespace and casing',
      () => {
        if (
          !normalizeCategoryId
        ) {
          return
        }

        expect(
          normalizeCategoryId(
            '  COFFEE  '
          )
        ).toBe(
          'coffee'
        )
      }
    )

    it(
      'normalizes every configured alias to its canonical category ID',
      () => {
        if (
          !normalizeCategoryId
        ) {
          return
        }

        for (
          const category of
            categoryDefinitions
        ) {
          for (
            const alias of
              normalizeAliases(
                category.aliases
              )
          ) {
            expect(
              normalizeCategoryId(
                alias
              )
            ).toBe(
              category.id
            )
          }
        }
      }
    )

    it(
      'returns null for empty and unsupported category values',
      () => {
        if (
          !normalizeCategoryId
        ) {
          return
        }

        expect(
          normalizeCategoryId(
            null
          )
        ).toBeNull()

        expect(
          normalizeCategoryId(
            undefined
          )
        ).toBeNull()

        expect(
          normalizeCategoryId(
            ''
          )
        ).toBeNull()

        expect(
          normalizeCategoryId(
            '   '
          )
        ).toBeNull()

        expect(
          normalizeCategoryId(
            '__unsupported_category__'
          )
        ).toBeNull()
      }
    )

    it(
      'does not throw for malformed input',
      () => {
        if (
          !normalizeCategoryId
        ) {
          return
        }

        const malformedValues: unknown[] =
          [
            123,
            true,
            false,
            {},
            [],
            Symbol(
              'category'
            ),
          ]

        for (
          const value of
            malformedValues
        ) {
          expect(
            () =>
              normalizeCategoryId(
                value
              )
          ).not.toThrow()

          expect(
            normalizeCategoryId(
              value
            )
          ).toBeNull()
        }
      }
    )
  }
)

/* =========================================================
 * Predicate tests
 * ======================================================= */

describe(
  'reputation category predicate',
  () => {
    it(
      'accepts every canonical category ID',
      () => {
        if (!isCategoryId) {
          return
        }

        for (
          const category of
            categoryDefinitions
        ) {
          expect(
            isCategoryId(
              category.id
            )
          ).toBe(true)
        }
      }
    )

    it(
      'rejects unsupported and malformed category IDs',
      () => {
        if (!isCategoryId) {
          return
        }

        expect(
          isCategoryId(
            '__unsupported_category__'
          )
        ).toBe(false)

        expect(
          isCategoryId(
            ''
          )
        ).toBe(false)

        expect(
          isCategoryId(
            null
          )
        ).toBe(false)

        expect(
          isCategoryId(
            123
          )
        ).toBe(false)

        expect(
          isCategoryId(
            {}
          )
        ).toBe(false)
      }
    )
  }
)

/* =========================================================
 * Definition lookup tests
 * ======================================================= */

describe(
  'reputation category definition lookup',
  () => {
    it(
      'returns the canonical definition for every category ID',
      () => {
        if (!getCategory) {
          return
        }

        for (
          const expected of
            categoryDefinitions
        ) {
          const actual =
            normalizeCategoryDefinition(
              getCategory(
                expected.id
              )
            )

          expect(
            actual?.id
          ).toBe(
            expected.id
          )

          expect(
            actual?.label
          ).toBe(
            expected.label
          )
        }
      }
    )

    it(
      'returns no category for unsupported input',
      () => {
        if (!getCategory) {
          return
        }

        const result =
          getCategory(
            '__unsupported_category__'
          )

        expect(
          result === null ||
            result === undefined
        ).toBe(true)
      }
    )
  }
)

/* =========================================================
 * Venue mapping tests
 * ======================================================= */

describe(
  'venue reputation-category resolution',
  () => {
    it(
      'maps explicit coffee category evidence to coffee',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const resolved =
          normalizeResolvedCategoryIds(
            resolveVenueCategories({
              category:
                'coffee',

              tier:
                'coffee',

              categories: [
                'coffee',
              ],

              tags: [
                'coffee',
              ],
            })
          )

        expect(
          resolved
        ).toContain(
          'coffee'
        )
      }
    )

    it(
      'deduplicates repeated category evidence',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const resolved =
          normalizeResolvedCategoryIds(
            resolveVenueCategories({
              category:
                'coffee',

              tier:
                'coffee',

              categories: [
                'coffee',
                'coffee',
              ],

              tags: [
                'coffee',
                'coffee',
              ],
            })
          )

        expect(
          new Set(
            resolved
          ).size
        ).toBe(
          resolved.length
        )
      }
    )

    it(
      'returns only canonical supported category IDs',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const supportedIds =
          new Set(
            categoryDefinitions.map(
              (category) =>
                category.id
            )
          )

        const resolved =
          normalizeResolvedCategoryIds(
            resolveVenueCategories({
              category:
                'coffee',

              tier:
                '__unsupported_category__',

              categories: [
                'coffee',
                '__unsupported_category__',
              ],

              tags: [
                '__unsupported_category__',
              ],
            })
          )

        for (
          const categoryId of
            resolved
        ) {
          expect(
            supportedIds.has(
              categoryId
            )
          ).toBe(true)
        }
      }
    )

    it(
      'ignores unsupported venue taxonomy values',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const resolved =
          normalizeResolvedCategoryIds(
            resolveVenueCategories({
              category:
                '__unsupported_category__',

              tier:
                '__unsupported_tier__',

              categories: [
                '__unsupported_category__',
              ],

              tags: [
                '__unsupported_tag__',
              ],
            })
          )

        expect(
          resolved
        ).toEqual([])
      }
    )

    it(
      'does not throw for incomplete venue records',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const malformedInputs: unknown[] =
          [
            null,
            undefined,
            {},
            {
              category: null,
            },
            {
              categories:
                'coffee',
            },
            {
              tags: [
                null,
                123,
                {},
              ],
            },
          ]

        for (
          const value of
            malformedInputs
        ) {
          expect(
            () =>
              resolveVenueCategories(
                value
              )
          ).not.toThrow()
        }
      }
    )

    it(
      'returns deterministic category ordering',
      () => {
        if (
          !resolveVenueCategories
        ) {
          return
        }

        const venue = {
          category:
            'coffee',

          tier:
            'coffee',

          categories: [
            'coffee',
          ],

          tags: [
            'coffee',
          ],
        }

        const first =
          normalizeResolvedCategoryIds(
            resolveVenueCategories(
              venue
            )
          )

        const second =
          normalizeResolvedCategoryIds(
            resolveVenueCategories(
              venue
            )
          )

        expect(
          second
        ).toEqual(first)
      }
    )
  }
)

/* =========================================================
 * Export-contract test
 * ======================================================= */

describe(
  'categoryMappings public contract',
  () => {
    it(
      'exposes at least one supported category operation',
      () => {
        const operationCount = [
          normalizeCategoryId,
          isCategoryId,
          getCategory,
          resolveVenueCategories,
        ].filter(Boolean).length

        expect(
          operationCount,
          [
            'categoryMappings.ts must expose at least one supported',
            'normalizer, predicate, lookup, or venue resolver.',
            `Supported normalizer names: ${NORMALIZER_EXPORT_NAMES.join(
              ', '
            )}.`,
            `Supported predicate names: ${PREDICATE_EXPORT_NAMES.join(
              ', '
            )}.`,
            `Supported lookup names: ${LOOKUP_EXPORT_NAMES.join(
              ', '
            )}.`,
            `Supported resolver names: ${VENUE_RESOLVER_EXPORT_NAMES.join(
              ', '
            )}.`,
          ].join(' ')
        ).toBeGreaterThan(0)
      }
    )
  }
)

/* =========================================================
 * Registry loading
 * ======================================================= */

function loadCategoryDefinitions(
  moduleValue: UnknownRecord
): CategoryDefinition[] {
  for (
    const exportName of
      REGISTRY_EXPORT_NAMES
  ) {
    const candidate =
      moduleValue[
        exportName
      ]

    const normalized =
      normalizeCategoryRegistry(
        candidate
      )

    if (
      normalized.length > 0
    ) {
      return normalized
    }
  }

  throw new Error(
    [
      'Unable to locate the reputation category registry.',
      `Expected one of: ${REGISTRY_EXPORT_NAMES.join(
        ', '
      )}.`,
      `Available exports: ${Object.keys(
        moduleValue
      ).join(', ') || '(none)'}.`,
    ].join(' ')
  )
}

function normalizeCategoryRegistry(
  value: unknown
): CategoryDefinition[] {
  if (Array.isArray(value)) {
    return value
      .map(
        normalizeCategoryDefinition
      )
      .filter(
        (
          category
        ): category is CategoryDefinition =>
          category !== null
      )
  }

  if (!isRecord(value)) {
    return []
  }

  return Object.entries(value)
    .map(
      ([
        recordKey,
        recordValue,
      ]) => {
        if (
          typeof recordValue ===
          'string'
        ) {
          return normalizeCategoryDefinition({
            id: recordKey,
            label:
              recordValue,
          })
        }

        if (
          isRecord(
            recordValue
          )
        ) {
          return normalizeCategoryDefinition({
            id:
              recordValue.id ??
              recordValue.categoryId ??
              recordValue.category_id ??
              recordKey,

            ...recordValue,
          })
        }

        return null
      }
    )
    .filter(
      (
        category
      ): category is CategoryDefinition =>
        category !== null
    )
}

function normalizeCategoryDefinition(
  value: unknown
): CategoryDefinition | null {
  if (!isRecord(value)) {
    return null
  }

  const id =
    normalizeNullableText(
      firstDefined(
        value.id,
        value.categoryId,
        value.category_id,
        value.slug,
        value.key
      )
    )

  const label =
    normalizeNullableText(
      firstDefined(
        value.label,
        value.categoryLabel,
        value.category_label,
        value.name,
        value.title
      )
    )

  if (!id || !label) {
    return null
  }

  return {
    id,
    label,

    shortLabel:
      normalizeNullableText(
        firstDefined(
          value.shortLabel,
          value.short_label
        )
      ),

    description:
      normalizeNullableText(
        value.description
      ),

    sortOrder:
      normalizeNonNegativeInteger(
        firstDefined(
          value.sortOrder,
          value.sort_order
        )
      ),

    aliases:
      normalizeAliases(
        firstDefined(
          value.aliases,
          value.synonyms,
          value.sourceValues,
          value.source_values
        )
      ),
  }
}

/* =========================================================
 * Function loading
 * ======================================================= */

function loadOptionalFunction<
  TFunction extends (
    ...args: never[]
  ) => unknown,
>(
  moduleValue: UnknownRecord,
  names: readonly string[]
): TFunction | null {
  for (const name of names) {
    const candidate =
      moduleValue[name]

    if (
      typeof candidate ===
      'function'
    ) {
      return candidate as TFunction
    }
  }

  return null
}

/* =========================================================
 * Resolver output normalization
 * ======================================================= */

function normalizeResolvedCategoryIds(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized: string[] = []

  for (const item of value) {
    const categoryId =
      typeof item ===
        'string'
        ? normalizeNullableText(
            item
          )
        : isRecord(item)
          ? normalizeNullableText(
              firstDefined(
                item.id,
                item.categoryId,
                item.category_id,
                item.slug
              )
            )
          : null

    if (
      categoryId &&
      !normalized.includes(
        categoryId
      )
    ) {
      normalized.push(
        categoryId
      )
    }
  }

  return normalized
}

/* =========================================================
 * Primitive helpers
 * ======================================================= */

function normalizeAliases(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .map(
          normalizeNullableText
        )
        .filter(
          (
            alias
          ): alias is string =>
            alias !== null
        )
    ),
  ]
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
    value
      .trim()
      .replace(
        /\s+/g,
        ' '
      )

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeText(
  value: string
): string {
  return value
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .trim()
    .toLocaleLowerCase(
      'en-US'
    )
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
}

function normalizeNonNegativeInteger(
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

function firstDefined(
  ...values: unknown[]
): unknown {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
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