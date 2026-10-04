import type { EventArchetype } from '@/lib/outings/eventArchetypes'

export type ActiveFlowContextualFit =
  | 'compatible'
  | 'insufficient_context'
  | 'incompatible'

export type ActiveFlowVenueSemantics = {
  venueId: string
  name: string | null
  types: string[]
  vibes: string[]
  tags: string[]
  timeCategories: string[]
}

export type ActiveFlowEventSemantics = {
  eventId: string
  title: string
  description: string | null
  archetype: EventArchetype | null
  tags: string[]
  startsAt: string
  endsAt: string | null
  venue: ActiveFlowVenueSemantics
}

export type ActiveFlowDeclaredIntent = {
  title: string | null
  themeId: string | null
  source: string | null
  sourceId: string | null
  travelMode: string | null
}

export type ActiveFlowSemanticRouteStop = {
  flowStopId: string
  executionIndex: number
  kind: 'base' | 'detour'
  venue: ActiveFlowVenueSemantics
}

export type ActiveFlowLocalSemanticContext = {
  currentStop: ActiveFlowSemanticRouteStop | null
  previousStop: ActiveFlowSemanticRouteStop | null
  nextStop: ActiveFlowSemanticRouteStop | null
}

export type ActiveFlowSemanticContext = {
  flow: ActiveFlowDeclaredIntent
  route: {
    remainingStops: ActiveFlowSemanticRouteStop[]
  }
  local: ActiveFlowLocalSemanticContext
  event: ActiveFlowEventSemantics
}

function normalizeSemanticValues(
  values: readonly string[] | null | undefined,
): string[] {
  if (!values?.length) {
    return []
  }

  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return [...new Set(normalized)].sort()
}

export function createActiveFlowVenueSemantics(input: {
  venueId: string
  name?: string | null
  types?: readonly string[] | null
  vibes?: readonly string[] | null
  tags?: readonly string[] | null
  timeCategories?: readonly string[] | null
}): ActiveFlowVenueSemantics {
  return {
    venueId: input.venueId,
    name: input.name?.trim() || null,
    types: normalizeSemanticValues(input.types),
    vibes: normalizeSemanticValues(input.vibes),
    tags: normalizeSemanticValues(input.tags),
    timeCategories: normalizeSemanticValues(input.timeCategories),
  }
}

export function hasActiveFlowVenueSemanticEvidence(
  venue: ActiveFlowVenueSemantics,
): boolean {
  return (
    venue.types.length > 0 ||
    venue.vibes.length > 0 ||
    venue.tags.length > 0 ||
    venue.timeCategories.length > 0
  )
}

export function getActiveFlowVenueSemanticTokens(
  venue: ActiveFlowVenueSemantics,
): string[] {
  return [
    ...new Set([
      ...venue.types,
      ...venue.vibes,
      ...venue.tags,
      ...venue.timeCategories,
    ]),
  ].sort()
}

export function getActiveFlowSharedSemanticTokens(
  left: ActiveFlowVenueSemantics,
  right: ActiveFlowVenueSemantics,
): string[] {
  const rightTokens = new Set(getActiveFlowVenueSemanticTokens(right))

  return getActiveFlowVenueSemanticTokens(left).filter((token) =>
    rightTokens.has(token),
  )
}

export function createActiveFlowSemanticRouteStop(input: {
  flowStopId: string
  executionIndex: number
  kind: 'base' | 'detour'
  venue: ActiveFlowVenueSemantics
}): ActiveFlowSemanticRouteStop {
  return {
    flowStopId: input.flowStopId,
    executionIndex: input.executionIndex,
    kind: input.kind,
    venue: input.venue,
  }
}