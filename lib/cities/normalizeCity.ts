// lib/cities/normalizeCity.ts

const CITY_ALIASES: Record<string, string> = {
  atl: 'atl',
  atlanta: 'atl',
  'atlanta ga': 'atl',

  nyc: 'nyc',
  'new york': 'nyc',
  'new york city': 'nyc',
  manhattan: 'nyc',

  porto: 'porto',
  oporto: 'porto',

  lisbon: 'lisbon',
  lisboa: 'lisbon',

  london: 'london',
  londres: 'london',

  la: 'la',
  'los angeles': 'la',
  hollywood: 'la',
  weho: 'la',
  'west hollywood': 'la',
}

export const SUPPORTED_CITIES = [
  {
    value: 'atl',
    label: 'Atlanta',
  },
  {
    value: 'nyc',
    label: 'New York City',
  },
  {
    value: 'porto',
    label: 'Porto',
  },
  {
    value: 'lisbon',
    label: 'Lisbon',
  },
  {
    value: 'london',
    label: 'London',
  },
  {
    value: 'la',
    label: 'Los Angeles',
  },
] as const

export type SupportedCityKey =
  (typeof SUPPORTED_CITIES)[number]['value']

export function normalizeCityKey(
  input?: string | null
): string {
  const raw = (input ?? '')
    .trim()
    .toLowerCase()

  return CITY_ALIASES[raw] ?? raw
}

export function isSupportedCityKey(
  input: unknown
): input is SupportedCityKey {
  if (typeof input !== 'string') {
    return false
  }

  const normalized =
    normalizeCityKey(input)

  return SUPPORTED_CITIES.some(
    (city) =>
      city.value === normalized
  )
}

export function getCityLabel(
  input?: string | null
): string | null {
  const normalized =
    normalizeCityKey(input)

  if (!normalized) {
    return null
  }

  return (
    SUPPORTED_CITIES.find(
      (city) =>
        city.value === normalized
    )?.label ?? normalized
  )
}