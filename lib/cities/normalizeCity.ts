// lib/cities/normalizeCity.ts

import {
  CITY_CONFIGS,
} from '@/config/cities'

const CITY_ALIASES:
  Record<
    string,
    string
  > = {
  atl:
    'atl',
  atlanta:
    'atl',
  'atlanta ga':
    'atl',
  'atlanta georgia':
    'atl',

  nyc:
    'nyc',
  'new york':
    'nyc',
  'new york city':
    'nyc',
  manhattan:
    'nyc',

  la:
    'la',
  'los angeles':
    'la',
  hollywood:
    'la',
  weho:
    'la',
  'west hollywood':
    'la',

  mia:
    'mia',
  miami:
    'mia',
  'miami fl':
    'mia',
  'miami florida':
    'mia',

  london:
    'london',
  londres:
    'london',

  lisbon:
    'lisbon',
  lisboa:
    'lisbon',

  porto:
    'porto',
  oporto:
    'porto',

  rome:
    'rome',
  roma:
    'rome',

  paris:
    'paris',
}

export type SupportedCityKey =
  keyof typeof CITY_CONFIGS

export const SUPPORTED_CITIES =
  Object.entries(
    CITY_CONFIGS
  ).map(
    ([
      value,
      city,
    ]) => ({
      value:
        value as SupportedCityKey,

      label:
        city.name,
    })
  )

export function normalizeCityKey(
  input?:
    string | null
): string {
  const raw =
    normalizeCityInput(
      input
    )

  if (
    !raw
  ) {
    return ''
  }

  return (
    CITY_ALIASES[
      raw
    ] ??
    raw
  )
}

export function isSupportedCityKey(
  input:
    unknown
): input is SupportedCityKey {
  if (
    typeof input !==
      'string'
  ) {
    return false
  }

  const normalized =
    normalizeCityKey(
      input
    )

  return normalized in
    CITY_CONFIGS
}

export function getCityLabel(
  input?:
    string | null
): string | null {
  const normalized =
    normalizeCityKey(
      input
    )

  if (
    !normalized
  ) {
    return null
  }

  if (
    isSupportedCityKey(
      normalized
    )
  ) {
    return (
      CITY_CONFIGS[
        normalized
      ]?.name ??
      normalized
    )
  }

  return normalized
}

function normalizeCityInput(
  input?:
    string | null
): string {
  return (
    input ??
    ''
  )
    .trim()
    .toLocaleLowerCase(
      'en-US'
    )
    .replace(
      /[.,]/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
}