import {
  loadEnvConfig,
} from '@next/env'

import {
  rebuildReputationRankings,
  type RebuildReputationRankingsResult,
  type ReputationRankingPopulation,
} from '@/lib/reputation/rebuildReputationRankings'

import {
  REPUTATION_POLICY_VERSION,
} from '@/lib/reputation/policy'

import {
  isReputationCategoryId,
  isReputationScope,
  type ReputationCategoryId,
  type ReputationScope,
} from '@/lib/reputation/types'

import {
  isSupportedCityKey,
  normalizeCityKey,
} from '@/lib/cities/normalizeCity'

/**
 * Trusted administrative script for rebuilding canonical
 * reputation ranking populations.
 *
 * Source of truth:
 *
 *   public.creator_reputation_stats
 *
 * Persisted output:
 *
 *   public.creator_reputation_category_stats
 *
 * This script intentionally does not:
 *
 * - read venue visits
 * - rebuild creator reputation scores
 * - modify creator_reputation_stats
 * - persist individual creator ranks
 * - generate public profile labels
 * - publish percentile claims directly
 *
 * Run a complete rebuild:
 *
 *   npx tsx scripts/rebuild-reputation-rankings.ts
 *
 * Rebuild Atlanta Coffee:
 *
 *   npx tsx scripts/rebuild-reputation-rankings.ts \
 *     --category=coffee \
 *     --scope=city \
 *     --city=atl
 *
 * Rebuild global Coffee:
 *
 *   npx tsx scripts/rebuild-reputation-rankings.ts \
 *     --category=coffee \
 *     --scope=global
 */

/* =========================================================
 * Configuration
 * ======================================================= */

const DEFAULT_PREVIEW_LIMIT =
  20

const MAX_PREVIEW_LIMIT =
  100

type ScriptConfiguration = {
  categoryId:
    ReputationCategoryId | null

  scope:
    ReputationScope | null

  cityKey:
    string | null

  policyVersion:
    number

  calculatedAt:
    string

  previewLimit:
    number

  showRankings:
    boolean

  showPopulations:
    boolean

  json:
    boolean
}

/* =========================================================
 * Main execution
 * ======================================================= */

async function main():
  Promise<void> {
  loadEnvConfig(
    process.cwd(),
    process.env.NODE_ENV !==
      'production'
  )

  const configuration =
    parseConfiguration(
      process.argv.slice(
        2
      )
    )

  const startedAt =
    Date.now()

  printConfiguration({
    configuration,

    startedAt:
      new Date(
        startedAt
      ).toISOString(),
  })

  const result =
    await rebuildReputationRankings({
      policyVersion:
        configuration
          .policyVersion,

      categoryId:
        configuration
          .categoryId,

      scope:
        configuration
          .scope,

      cityKey:
        configuration
          .cityKey,

      calculatedAt:
        configuration
          .calculatedAt,
    })

  const durationMilliseconds =
    Date.now() -
    startedAt

  if (
    configuration.json
  ) {
    printJsonResult({
      result,
      durationMilliseconds,
    })

    return
  }

  printSummary({
    result,
    durationMilliseconds,
  })

  if (
    configuration
      .showPopulations
  ) {
    printPopulationPreview({
      populations:
        result.populations,

      limit:
        configuration
          .previewLimit,
    })
  }

  if (
    configuration
      .showRankings
  ) {
    printRankingPreview({
      result,

      limit:
        configuration
          .previewLimit,
    })
  }

  verifyResult(
    result
  )

  console.log(
    [
      '',
      'Reputation ranking rebuild completed successfully.',
      '',
    ].join(
      '\n'
    )
  )
}

/* =========================================================
 * Result verification
 * ======================================================= */

function verifyResult(
  result:
    RebuildReputationRankingsResult
): void {
  if (
    result
      .sourceCounts
      .representedPopulations !==
    result.populations.length
  ) {
    throw new Error(
      [
        '[rebuild-reputation-rankings]',
        'Population-count verification failed.',
        `Source count=${result.sourceCounts.representedPopulations},`,
        `result count=${result.populations.length}.`,
      ].join(
        ' '
      )
    )
  }

  if (
    result
      .sourceCounts
      .eligibleRankingRows !==
    result.rankings.length
  ) {
    throw new Error(
      [
        '[rebuild-reputation-rankings]',
        'Ranking-count verification failed.',
        `Source count=${result.sourceCounts.eligibleRankingRows},`,
        `result count=${result.rankings.length}.`,
      ].join(
        ' '
      )
    )
  }

  if (
    result
      .persistence
      .upsertedPopulationCount !==
    result.populations.length
  ) {
    throw new Error(
      [
        '[rebuild-reputation-rankings]',
        'Persisted population-count verification failed.',
        `Upserted=${result.persistence.upsertedPopulationCount},`,
        `calculated=${result.populations.length}.`,
      ].join(
        ' '
      )
    )
  }

  const malformedCityPopulation =
    result.populations.find(
      (
        population
      ) =>
        population.scope ===
          'city' &&
        !population.cityKey
    )

  if (
    malformedCityPopulation
  ) {
    throw new Error(
      [
        '[rebuild-reputation-rankings]',
        'A city-scoped population was produced without a city key.',
        `Category=${malformedCityPopulation.categoryId}.`,
      ].join(
        ' '
      )
    )
  }

  const malformedGlobalPopulation =
    result.populations.find(
      (
        population
      ) =>
        population.scope ===
          'global' &&
        population.cityKey !==
          null
    )

  if (
    malformedGlobalPopulation
  ) {
    throw new Error(
      [
        '[rebuild-reputation-rankings]',
        'A global population was produced with a city key.',
        `Category=${malformedGlobalPopulation.categoryId}.`,
      ].join(
        ' '
      )
    )
  }

  for (
    const population of
    result.populations
  ) {
    const levelTotal =
      population
        .levelCounts
        .unranked +
      population
        .levelCounts
        .emerging +
      population
        .levelCounts
        .established +
      population
        .levelCounts
        .expert +
      population
        .levelCounts
        .elite

    if (
      levelTotal !==
      population.totalUserCount
    ) {
      throw new Error(
        [
          '[rebuild-reputation-rankings]',
          'Population level counts do not equal total users.',
          `Population=${formatPopulationIdentity(population)},`,
          `levels=${levelTotal},`,
          `total=${population.totalUserCount}.`,
        ].join(
          ' '
        )
      )
    }

    const earnedLevelTotal =
      population
        .levelCounts
        .emerging +
      population
        .levelCounts
        .established +
      population
        .levelCounts
        .expert +
      population
        .levelCounts
        .elite

    if (
      earnedLevelTotal !==
      population.earnedUserCount
    ) {
      throw new Error(
        [
          '[rebuild-reputation-rankings]',
          'Earned level counts do not equal earned users.',
          `Population=${formatPopulationIdentity(population)},`,
          `earned levels=${earnedLevelTotal},`,
          `earned users=${population.earnedUserCount}.`,
        ].join(
          ' '
        )
      )
    }

    if (
      population
        .eligibleUserCount >
      population
        .earnedUserCount
    ) {
      throw new Error(
        [
          '[rebuild-reputation-rankings]',
          'Eligible users exceed earned users.',
          `Population=${formatPopulationIdentity(population)}.`,
        ].join(
          ' '
        )
      )
    }
  }

  verifyRankingSequences(
    result
  )
}

function verifyRankingSequences(
  result:
    RebuildReputationRankingsResult
): void {
  const ranksByPopulation =
    new Map<
      string,
      number[]
    >()

  for (
    const ranking of
    result.rankings
  ) {
    const key =
      createPopulationKey({
        categoryId:
          ranking.categoryId,

        scope:
          ranking.scope,

        cityKey:
          ranking.cityKey,
      })

    const ranks =
      ranksByPopulation.get(
        key
      ) ??
      []

    ranks.push(
      ranking.rank
    )

    ranksByPopulation.set(
      key,
      ranks
    )
  }

  for (
    const [
      populationKey,
      ranks,
    ] of ranksByPopulation
  ) {
    const sortedRanks =
      [
        ...ranks,
      ].sort(
        (
          first,
          second
        ) =>
          first -
          second
      )

    for (
      let index =
        0;
      index <
        sortedRanks.length;
      index +=
        1
    ) {
      const expectedRank =
        index +
        1

      if (
        sortedRanks[
          index
        ] !==
        expectedRank
      ) {
        throw new Error(
          [
            '[rebuild-reputation-rankings]',
            'Ranking sequence verification failed.',
            `Population=${populationKey},`,
            `expected rank=${expectedRank},`,
            `received=${sortedRanks[index]}.`,
          ].join(
            ' '
          )
        )
      }
    }
  }
}

/* =========================================================
 * Output
 * ======================================================= */

function printConfiguration({
  configuration,
  startedAt,
}: {
  configuration:
    ScriptConfiguration

  startedAt:
    string
}): void {
  if (
    configuration.json
  ) {
    return
  }

  console.log(
    [
      '',
      '=========================================================',
      ' Rebuilding reputation ranking populations',
      '=========================================================',
      '',
      `Environment:        ${process.env.NODE_ENV ?? 'development'}`,
      `Started:            ${startedAt}`,
      `Policy version:     ${configuration.policyVersion}`,
      `Category:           ${configuration.categoryId ?? 'all categories'}`,
      `Scope:              ${configuration.scope ?? 'global and city'}`,
      `City:               ${configuration.cityKey ?? 'all applicable cities'}`,
      `Calculated at:      ${configuration.calculatedAt}`,
      '',
    ].join(
      '\n'
    )
  )
}

function printSummary({
  result,
  durationMilliseconds,
}: {
  result:
    RebuildReputationRankingsResult

  durationMilliseconds:
    number
}): void {
  const publishableRankPopulations =
    result.populations.filter(
      (
        population
      ) =>
        population
          .publication
          .canPublishRank
    ).length

  const publishablePercentilePopulations =
    result.populations.filter(
      (
        population
      ) =>
        population
          .publication
          .canPublishPercentile
    ).length

  const topOnePercentPopulations =
    result.populations.filter(
      (
        population
      ) =>
        population
          .publication
          .canPublishTop1Percent
    ).length

  console.log(
    [
      '',
      'Rebuild summary',
      '---------------------------------------------------------',
      `Policy version:                  ${result.policyVersion}`,
      `Canonical aggregate rows read:   ${result.sourceCounts.aggregateRows.toLocaleString('en-US')}`,
      `Populations represented:         ${result.sourceCounts.representedPopulations.toLocaleString('en-US')}`,
      `Eligible ranking rows:           ${result.sourceCounts.eligibleRankingRows.toLocaleString('en-US')}`,
      `Population rows upserted:        ${result.persistence.upsertedPopulationCount.toLocaleString('en-US')}`,
      `Stale population rows deleted:   ${result.persistence.deletedStalePopulationCount.toLocaleString('en-US')}`,
      `Rank-publishable populations:    ${publishableRankPopulations.toLocaleString('en-US')}`,
      `Percentile-ready populations:    ${publishablePercentilePopulations.toLocaleString('en-US')}`,
      `Top 1% ready populations:        ${topOnePercentPopulations.toLocaleString('en-US')}`,
      `Duration:                        ${formatDuration(durationMilliseconds)}`,
    ].join(
      '\n'
    )
  )
}

function printPopulationPreview({
  populations,
  limit,
}: {
  populations:
    ReputationRankingPopulation[]

  limit:
    number
}): void {
  if (
    populations.length ===
    0
  ) {
    console.log(
      [
        '',
        'No ranking populations were produced.',
        '',
      ].join(
        '\n'
      )
    )

    return
  }

  const displayedPopulations =
    populations.slice(
      0,
      limit
    )

  console.log(
    [
      '',
      `Population preview (${displayedPopulations.length.toLocaleString('en-US')} of ${populations.length.toLocaleString('en-US')})`,
      '---------------------------------------------------------',
    ].join(
      '\n'
    )
  )

  for (
    const population of
    displayedPopulations
  ) {
    console.log(
      [
        `- ${formatPopulationIdentity(population)}`,
        `  total users:       ${population.totalUserCount.toLocaleString('en-US')}`,
        `  earned users:      ${population.earnedUserCount.toLocaleString('en-US')}`,
        `  eligible users:    ${population.eligibleUserCount.toLocaleString('en-US')}`,
        `  score range:       ${formatNullableNumber(population.scoreDistribution.minimumEligibleScore)} – ${formatNullableNumber(population.scoreDistribution.maximumEligibleScore)}`,
        `  median score:      ${formatNullableNumber(population.scoreDistribution.medianEligibleScore)}`,
        `  publish rank:      ${population.publication.canPublishRank}`,
        `  publish percentile:${population.publication.canPublishPercentile}`,
      ].join(
        '\n'
      )
    )
  }
}

function printRankingPreview({
  result,
  limit,
}: {
  result:
    RebuildReputationRankingsResult

  limit:
    number
}): void {
  if (
    result.rankings.length ===
    0
  ) {
    console.log(
      [
        '',
        'No eligible ranking rows were produced.',
        '',
      ].join(
        '\n'
      )
    )

    return
  }

  const displayedRankings =
    result.rankings.slice(
      0,
      limit
    )

  console.log(
    [
      '',
      `Ranking preview (${displayedRankings.length.toLocaleString('en-US')} of ${result.rankings.length.toLocaleString('en-US')})`,
      '---------------------------------------------------------',
    ].join(
      '\n'
    )
  )

  for (
    const ranking of
    displayedRankings
  ) {
    console.log(
      [
        `- ${ranking.scope}:${ranking.cityKey ?? 'global'}:${ranking.categoryId}`,
        `  rank:        #${ranking.rank.toLocaleString('en-US')} of ${ranking.eligibleUserCount.toLocaleString('en-US')}`,
        `  user:        ${ranking.userId}`,
        `  score:       ${ranking.score.toLocaleString('en-US')}`,
        `  level:       ${ranking.level}`,
        `  percentile:  ${ranking.percentile.toLocaleString('en-US', {
          maximumFractionDigits:
            2,
        })}`,
      ].join(
        '\n'
      )
    )
  }
}

function printJsonResult({
  result,
  durationMilliseconds,
}: {
  result:
    RebuildReputationRankingsResult

  durationMilliseconds:
    number
}): void {
  console.log(
    JSON.stringify(
      {
        ...result,

        durationMilliseconds,
      },
      null,
      2
    )
  )
}

/* =========================================================
 * Configuration parsing
 * ======================================================= */

function parseConfiguration(
  argumentsList:
    string[]
): ScriptConfiguration {
  const argumentsMap =
    parseArguments(
      argumentsList
    )

  if (
    argumentsMap.has(
      'help'
    )
  ) {
    printHelp()

    process.exit(
      0
    )
  }

  const rawCategoryId =
    argumentsMap.get(
      'category'
    ) ??
    process.env
      .REPUTATION_RANKING_CATEGORY

  const categoryId =
    parseOptionalCategoryId(
      rawCategoryId
    )

  const rawScope =
    argumentsMap.get(
      'scope'
    ) ??
    process.env
      .REPUTATION_RANKING_SCOPE

  const scope =
    parseOptionalScope(
      rawScope
    )

  const rawCityKey =
    argumentsMap.get(
      'city'
    ) ??
    process.env
      .REPUTATION_RANKING_CITY

  const cityKey =
    parseOptionalCityKey(
      rawCityKey
    )

  const policyVersion =
    parsePositiveInteger({
      value:
        argumentsMap.get(
          'policy-version'
        ) ??
        process.env
          .REPUTATION_POLICY_VERSION,

      fallback:
        REPUTATION_POLICY_VERSION,

      fieldName:
        'policy-version',
    })

  const calculatedAt =
    parseTimestamp({
      value:
        argumentsMap.get(
          'calculated-at'
        ) ??
        process.env
          .REPUTATION_RANKING_CALCULATED_AT,

      fallback:
        new Date().toISOString(),

      fieldName:
        'calculated-at',
    })

  const previewLimit =
    clampInteger({
      value:
        argumentsMap.get(
          'limit'
        ) ??
        process.env
          .REPUTATION_RANKING_PREVIEW_LIMIT,

      fallback:
        DEFAULT_PREVIEW_LIMIT,

      minimum:
        1,

      maximum:
        MAX_PREVIEW_LIMIT,
    })

  validateScopeAndCity({
    scope,
    cityKey,
  })

  return {
    categoryId,
    scope,
    cityKey,
    policyVersion,
    calculatedAt,
    previewLimit,

    showRankings:
      argumentsMap.has(
        'show-rankings'
      ) ||
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_SHOW_RANKINGS,
        false
      ),

    showPopulations:
      !argumentsMap.has(
        'hide-populations'
      ) &&
      parseBooleanEnvironmentValue(
        process.env
          .REPUTATION_SHOW_POPULATIONS,
        true
      ),

    json:
      argumentsMap.has(
        'json'
      ),
  }
}

function parseArguments(
  argumentsList:
    string[]
): Map<
  string,
  string
> {
  const result =
    new Map<
      string,
      string
    >()

  for (
    let index =
      0;
    index <
      argumentsList.length;
    index +=
      1
  ) {
    const argument =
      argumentsList[
        index
      ]

    if (
      !argument.startsWith(
        '--'
      )
    ) {
      continue
    }

    const normalizedArgument =
      argument.slice(
        2
      )

    const equalsIndex =
      normalizedArgument.indexOf(
        '='
      )

    if (
      equalsIndex >=
      0
    ) {
      const key =
        normalizedArgument
          .slice(
            0,
            equalsIndex
          )
          .trim()

      const value =
        normalizedArgument
          .slice(
            equalsIndex +
              1
          )
          .trim()

      if (
        key
      ) {
        result.set(
          key,
          value
        )
      }

      continue
    }

    const key =
      normalizedArgument
        .trim()

    const nextArgument =
      argumentsList[
        index +
          1
      ]

    if (
      nextArgument &&
      !nextArgument.startsWith(
        '--'
      )
    ) {
      result.set(
        key,
        nextArgument
      )

      index +=
        1

      continue
    }

    result.set(
      key,
      'true'
    )
  }

  return result
}

function parseOptionalCategoryId(
  value:
    unknown
): ReputationCategoryId | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null
  }

  if (
    !isReputationCategoryId(
      value
    )
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] Invalid category: ${String(value)}.`
    )
  }

  return value
}

function parseOptionalScope(
  value:
    unknown
): ReputationScope | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null
  }

  if (
    !isReputationScope(
      value
    )
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] Invalid scope: ${String(value)}.`
    )
  }

  return value
}

function parseOptionalCityKey(
  value:
    unknown
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return null
  }

  if (
    typeof value !==
    'string'
  ) {
    throw new Error(
      '[rebuild-reputation-rankings] City must be a string.'
    )
  }

  const normalizedCityKey =
    normalizeCityKey(
      value
    )

  if (
    !isSupportedCityKey(
      normalizedCityKey
    )
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] Unsupported city: ${value}.`
    )
  }

  return normalizedCityKey
}

function validateScopeAndCity({
  scope,
  cityKey,
}: {
  scope:
    ReputationScope | null

  cityKey:
    string | null
}): void {
  if (
    scope ===
      'city' &&
    !cityKey
  ) {
    throw new Error(
      '[rebuild-reputation-rankings] --city is required when --scope=city.'
    )
  }

  if (
    scope ===
      'global' &&
    cityKey
  ) {
    throw new Error(
      '[rebuild-reputation-rankings] --city cannot be used with --scope=global.'
    )
  }
}

function parsePositiveInteger({
  value,
  fallback,
  fieldName,
}: {
  value:
    unknown

  fallback:
    number

  fieldName:
    string
}): number {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return fallback
  }

  const parsed =
    typeof value ===
      'number'
      ? value
      : Number(
          value
        )

  if (
    !Number.isFinite(
      parsed
    ) ||
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      1
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] ${fieldName} must be a positive integer.`
    )
  }

  return parsed
}

function parseTimestamp({
  value,
  fallback,
  fieldName,
}: {
  value:
    unknown

  fallback:
    string

  fieldName:
    string
}): string {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
  ) {
    return fallback
  }

  if (
    typeof value !==
    'string'
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] ${fieldName} must be an ISO timestamp.`
    )
  }

  const timestamp =
    Date.parse(
      value
    )

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    throw new Error(
      `[rebuild-reputation-rankings] ${fieldName} is invalid.`
    )
  }

  return new Date(
    timestamp
  ).toISOString()
}

/* =========================================================
 * Formatting helpers
 * ======================================================= */

function formatPopulationIdentity(
  population: {
    categoryId:
      ReputationCategoryId

    scope:
      ReputationScope

    cityKey:
      string | null
  }
): string {
  return [
    population.scope,

    population.scope ===
      'city'
      ? population.cityKey ??
        'missing-city'
      : 'global',

    population.categoryId,
  ].join(
    ' · '
  )
}

function createPopulationKey(
  population: {
    categoryId:
      ReputationCategoryId

    scope:
      ReputationScope

    cityKey:
      string | null
  }
): string {
  return [
    population.categoryId,
    population.scope,
    population.scope ===
      'city'
      ? population.cityKey ??
        '__missing_city__'
      : '__global__',
  ].join(
    ':'
  )
}

function formatNullableNumber(
  value:
    number | null
): string {
  if (
    value ===
    null
  ) {
    return 'n/a'
  }

  return value.toLocaleString(
    'en-US',
    {
      maximumFractionDigits:
        4,
    }
  )
}

function formatDuration(
  milliseconds:
    number
): string {
  const normalizedMilliseconds =
    Math.max(
      0,
      Math.trunc(
        milliseconds
      )
    )

  if (
    normalizedMilliseconds <
    1000
  ) {
    return `${normalizedMilliseconds.toLocaleString('en-US')} ms`
  }

  const seconds =
    normalizedMilliseconds /
    1000

  if (
    seconds <
    60
  ) {
    return `${seconds.toFixed(2)} seconds`
  }

  const minutes =
    Math.floor(
      seconds /
      60
    )

  const remainingSeconds =
    Math.round(
      seconds %
      60
    )

  return `${minutes.toLocaleString('en-US')}m ${remainingSeconds.toLocaleString('en-US')}s`
}

function clampInteger({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value:
    unknown

  fallback:
    number

  minimum:
    number

  maximum:
    number
}): number {
  const parsed =
    typeof value ===
      'number'
      ? value
      : typeof value ===
          'string' &&
        value.trim()
          .length >
          0
        ? Number(
            value
          )
        : Number.NaN

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback
  }

  return Math.min(
    maximum,
    Math.max(
      minimum,
      Math.trunc(
        parsed
      )
    )
  )
}

function parseBooleanEnvironmentValue(
  value:
    string | undefined,
  fallback:
    boolean
): boolean {
  if (
    typeof value !==
    'string'
  ) {
    return fallback
  }

  const normalized =
    value
      .trim()
      .toLocaleLowerCase(
        'en-US'
      )

  if (
    [
      '1',
      'true',
      'yes',
      'on',
    ].includes(
      normalized
    )
  ) {
    return true
  }

  if (
    [
      '0',
      'false',
      'no',
      'off',
    ].includes(
      normalized
    )
  ) {
    return false
  }

  return fallback
}

function printHelp():
  void {
  console.log(`
Rebuild canonical reputation ranking populations.

Usage:
  npx tsx scripts/rebuild-reputation-rankings.ts [options]

Options:
  --category=<id>
      Rebuild one reputation category.

  --scope=<global|city>
      Rebuild only one scope.

  --city=<city-key>
      Rebuild one canonical city. Required with --scope=city.

  --policy-version=<number>
      Reputation policy version to rebuild.
      Default: active application policy version.

  --calculated-at=<ISO timestamp>
      Stable calculation timestamp.

  --limit=<number>
      Maximum preview rows.
      Default: ${DEFAULT_PREVIEW_LIMIT}

  --show-rankings
      Print individual ranking previews.

  --hide-populations
      Suppress population previews.

  --json
      Print the complete result as JSON.

  --help
      Show this message.

Examples:
  npm run reputation:rebuild-rankings

  npm run reputation:rebuild-rankings -- \\
    --category=coffee \\
    --scope=city \\
    --city=atl

  npm run reputation:rebuild-rankings -- \\
    --category=restaurants \\
    --scope=global \\
    --show-rankings
`)
}

/* =========================================================
 * Process boundary
 * ======================================================= */

void main()
  .catch(
    (
      error:
        unknown
    ) => {
      console.error(
        [
          '',
          'Reputation ranking rebuild failed.',
          '',
          error instanceof
          Error
            ? error.stack ??
              error.message
            : String(
                error
              ),
          '',
        ].join(
          '\n'
        )
      )

      process.exitCode =
        1
    }
  )