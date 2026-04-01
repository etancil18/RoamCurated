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
}

export function normalizeCityKey(input?: string | null) {
  const raw = (input ?? '').trim().toLowerCase()
  return CITY_ALIASES[raw] ?? raw
}