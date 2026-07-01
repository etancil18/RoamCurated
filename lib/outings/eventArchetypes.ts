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

export type EventAnchorPosition = 'start' | 'middle' | 'end'

export type EventArchetypePlanningProfile = {
  value: EventArchetype
  label: string
  plannerKey: EventArchetype
  anchorPosition: EventAnchorPosition
  beforeSemanticRoles: string[]
  afterSemanticRoles: string[]
  preferredBeforeVenueTypes: string[]
  preferredAfterVenueTypes: string[]
  discouragedVenueTypes: string[]
  preferredVibes: string[]
  walkRadiusMeters: number
  rideRadiusMeters: number
}

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
): EventArchetype {
  return normalizeEventArchetypeForStorage(value)
}

export const EVENT_ARCHETYPE_PLANNING_PROFILES: Record<
  EventArchetype,
  EventArchetypePlanningProfile
> = {
  social_sports: {
    value: 'social_sports',
    label: 'Social Sports',
    plannerKey: 'social_sports',
    anchorPosition: 'middle',
    beforeSemanticRoles: [
      'pre_match_coffee',
      'pre_match_breakfast',
      'group_warmup',
    ],
    afterSemanticRoles: [
      'post_match_brunch',
      'casual_food',
      'group_drinks',
    ],
    preferredBeforeVenueTypes: [
      'coffee',
      'cafe',
      'café',
      'bakery',
      'breakfast',
      'brunch',
      'tea',
      'juice',
      'restaurant',
      'lunch',
      'sports bar',
      'brewery',
      'bar',
    ],
    preferredAfterVenueTypes: [
      'brunch',
      'lunch',
      'food hall',
      'sports bar',
      'brewery',
      'bar',
      'pub',
      'patio',
      'beer garden',
      'casual food',
    ],
    discouragedVenueTypes: [
      'spa',
      'library',
      'showroom',
      'gallery',
      'museum',
      'fine dining',
      'speakeasy',
      'club',
    ],
    preferredVibes: [
      'lively',
      'casual',
      'group-friendly',
      'daytime',
      'watch-party',
      'patio',
      'walkable',
      'local',
    ],
    walkRadiusMeters: 1600,
    rideRadiusMeters: 4500,
  },

  music: {
    value: 'music',
    label: 'Music / Concert',
    plannerKey: 'music',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['pre_show_dinner', 'pre_show_drinks'],
    afterSemanticRoles: ['post_show_drinks', 'late_night_food'],
    preferredBeforeVenueTypes: ['lunch', 'dinner', 'cocktail', 'wine bar', 'bar'],
    preferredAfterVenueTypes: ['bar', 'cocktail', 'lounge', 'rooftop', 'club', 'late night', 'dessert'],
    discouragedVenueTypes: ['breakfast', 'library', 'spa', 'gallery', 'museum'],
    preferredVibes: ['lively', 'social', 'high-energy'],
    walkRadiusMeters: 1200,
    rideRadiusMeters: 4000,
  },

  networking: {
    value: 'networking',
    label: 'Networking',
    plannerKey: 'networking',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['conversation_warmup', 'low_pressure_meal'],
    afterSemanticRoles: ['conversation_continuation', 'relationship_followup'],
    preferredBeforeVenueTypes: ['coffee', 'cafe', 'lunch', 'dinner', 'coworking', 'wine bar'],
    preferredAfterVenueTypes: ['cocktail', 'wine bar', 'bar', 'lounge', 'rooftop', 'hotel bar'],
    discouragedVenueTypes: ['club', 'sports bar', 'fitness', 'spa', 'library', 'showroom'],
    preferredVibes: ['conversation', 'professional', 'polished', 'quiet', 'social'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  food_drink: {
    value: 'food_drink',
    label: 'Food & Drink',
    plannerKey: 'food_drink',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['appetite_builder', 'aperitif'],
    afterSemanticRoles: ['digestif', 'dessert_finish'],
    preferredBeforeVenueTypes: ['wine bar', 'cocktail', 'bar', 'cafe', 'bakery'],
    preferredAfterVenueTypes: ['dessert', 'wine bar', 'cocktail', 'lounge', 'bar'],
    discouragedVenueTypes: ['fitness', 'library', 'showroom'],
    preferredVibes: ['culinary', 'cozy', 'date-night', 'social'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  arts_culture: {
    value: 'arts_culture',
    label: 'Arts & Culture',
    plannerKey: 'arts_culture',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['cultural_warmup', 'gallery_drinks'],
    afterSemanticRoles: ['post_gallery_dinner', 'reflective_lounge'],
    preferredBeforeVenueTypes: ['gallery', 'museum', 'bookstore', 'wine bar', 'cocktail'],
    preferredAfterVenueTypes: ['restaurant', 'dinner', 'wine bar', 'cocktail', 'lounge', 'dessert'],
    discouragedVenueTypes: ['sports bar', 'club', 'fitness'],
    preferredVibes: ['creative', 'intimate', 'cultured', 'date-night'],
    walkRadiusMeters: 1200,
    rideRadiusMeters: 3500,
  },

  wellness: {
    value: 'wellness',
    label: 'Wellness',
    plannerKey: 'wellness',
    anchorPosition: 'start',
    beforeSemanticRoles: ['light_fuel', 'calm_start'],
    afterSemanticRoles: ['healthy_refuel', 'outdoor_reset'],
    preferredBeforeVenueTypes: ['coffee', 'tea', 'cafe', 'juice', 'smoothie', 'bakery'],
    preferredAfterVenueTypes: ['healthy', 'salad', 'juice', 'smoothie', 'coffee', 'park', 'garden'],
    discouragedVenueTypes: ['club', 'sports bar', 'dive bar', 'cocktail', 'speakeasy'],
    preferredVibes: ['healthy', 'calm', 'outdoors', 'low-alcohol'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 2500,
  },

  nightlife: {
    value: 'nightlife',
    label: 'Nightlife',
    plannerKey: 'nightlife',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['pre_game_drinks', 'night_out_dinner'],
    afterSemanticRoles: ['energy_extension', 'late_night_close'],
    preferredBeforeVenueTypes: ['cocktail', 'bar', 'restaurant', 'dinner', 'rooftop'],
    preferredAfterVenueTypes: ['club', 'bar', 'cocktail', 'lounge', 'speakeasy', 'late night'],
    discouragedVenueTypes: ['breakfast', 'library', 'spa'],
    preferredVibes: ['high-energy', 'lively', 'social'],
    walkRadiusMeters: 1200,
    rideRadiusMeters: 4500,
  },

  community: {
    value: 'community',
    label: 'Community',
    plannerKey: 'community',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['casual_meetup', 'neighborhood_warmup'],
    afterSemanticRoles: ['group_debrief', 'casual_social_stop'],
    preferredBeforeVenueTypes: ['coffee', 'cafe', 'restaurant', 'park', 'bookstore'],
    preferredAfterVenueTypes: ['restaurant', 'bar', 'brewery', 'coffee', 'dessert'],
    discouragedVenueTypes: ['club', 'speakeasy'],
    preferredVibes: ['casual', 'local', 'group-friendly'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },

  comedy: {
    value: 'comedy',
    label: 'Comedy',
    plannerKey: 'comedy',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['pre_show_dinner', 'pre_show_drinks'],
    afterSemanticRoles: ['post_show_drinks', 'late_night_food'],
    preferredBeforeVenueTypes: ['restaurant', 'dinner', 'bar', 'cocktail', 'brewery'],
    preferredAfterVenueTypes: ['bar', 'cocktail', 'lounge', 'dessert', 'late night'],
    discouragedVenueTypes: ['breakfast', 'library', 'spa'],
    preferredVibes: ['fun', 'social', 'casual'],
    walkRadiusMeters: 1200,
    rideRadiusMeters: 4000,
  },

  market: {
    value: 'market',
    label: 'Market / Festival',
    plannerKey: 'market',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['coffee_before_market', 'light_bite'],
    afterSemanticRoles: ['brunch_after_market', 'neighborhood_exploration'],
    preferredBeforeVenueTypes: ['coffee', 'cafe', 'bakery', 'breakfast', 'brunch'],
    preferredAfterVenueTypes: ['brunch', 'lunch', 'cafe', 'bookstore', 'park', 'garden', 'gallery'],
    discouragedVenueTypes: ['club', 'speakeasy', 'sports bar'],
    preferredVibes: ['daytime', 'walkable', 'local', 'casual'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 2500,
  },

  other: {
    value: 'other',
    label: 'Other',
    plannerKey: 'other',
    anchorPosition: 'middle',
    beforeSemanticRoles: ['contextual_warmup'],
    afterSemanticRoles: ['contextual_followup'],
    preferredBeforeVenueTypes: ['coffee', 'cafe', 'restaurant', 'bar'],
    preferredAfterVenueTypes: ['restaurant', 'bar', 'dessert', 'coffee'],
    discouragedVenueTypes: [],
    preferredVibes: ['social', 'convenient'],
    walkRadiusMeters: 1000,
    rideRadiusMeters: 3000,
  },
}

export function getEventArchetypePlanningProfile(
  value: string | null | undefined
): EventArchetypePlanningProfile {
  return EVENT_ARCHETYPE_PLANNING_PROFILES[
    normalizeEventArchetypeForStorage(value)
  ]
}

export function getSemanticRoleForSlot(input: {
  archetype: string | null | undefined
  phase: 'before' | 'after'
  index: number
}): string | null {
  const profile = getEventArchetypePlanningProfile(input.archetype)
  const roles =
    input.phase === 'before'
      ? profile.beforeSemanticRoles
      : profile.afterSemanticRoles

  return roles[input.index] ?? roles[roles.length - 1] ?? null
}