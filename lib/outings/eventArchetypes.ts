export const EVENT_ARCHETYPES = [
  { value: 'social_sports', label: 'Social Sports' },
  { value: 'music', label: 'Music / Concert' },
  { value: 'networking', label: 'Networking' },
  { value: 'food_drink', label: 'Food & Drink' },
  { value: 'arts_culture', label: 'Arts & Culture' },
  { value: 'wellness', label: 'Wellness' },
  { value: 'nightlife', label: 'Nightlife' },
  { value: 'community', label: 'Community' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'market', label: 'Market / Festival' },
  { value: 'other', label: 'Other' },
] as const

export type EventArchetype = typeof EVENT_ARCHETYPES[number]['value']

export function isEventArchetype(value: unknown): value is EventArchetype {
  return EVENT_ARCHETYPES.some((archetype) => archetype.value === value)
}

export function getEventArchetypeLabel(value: string | null | undefined): string {
  return EVENT_ARCHETYPES.find((archetype) => archetype.value === value)?.label ?? 'Other'
}

export function normalizeEventArchetypeForStorage(
  value: unknown
): EventArchetype {
  return isEventArchetype(value) ? value : 'other'
}

export function normalizeEventArchetypeForPlanner(
  value: string | null | undefined
): string {
  if (value === 'arts_culture') return 'art'
  if (value === 'social_sports') return 'sports'
  if (value === 'other') return 'general'

  return value ?? 'general'
}