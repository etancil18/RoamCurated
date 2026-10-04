import { describe, expect, it } from 'vitest'

import {
  createActiveFlowSemanticRouteStop,
  createActiveFlowVenueSemantics,
  getActiveFlowSharedSemanticTokens,
  getActiveFlowVenueSemanticTokens,
  hasActiveFlowVenueSemanticEvidence,
} from './contextualIntelligence'

describe('Active Flow contextual intelligence model', () => {
  it('normalizes semantic arrays deterministically', () => {
    const venue = createActiveFlowVenueSemantics({
      venueId: 'venue-1',
      name: '  Example Venue  ',
      types: ['Bar', ' restaurant ', 'BAR'],
      vibes: ['Romantic', ' intimate '],
      tags: ['Cocktails', 'Late Night', 'cocktails'],
      timeCategories: ['Evening', ' evening '],
    })

    expect(venue).toEqual({
      venueId: 'venue-1',
      name: 'Example Venue',
      types: ['bar', 'restaurant'],
      vibes: ['intimate', 'romantic'],
      tags: ['cocktails', 'late night'],
      timeCategories: ['evening'],
    })
  })

  it('treats missing semantic data as absence of evidence', () => {
    const venue = createActiveFlowVenueSemantics({
      venueId: 'venue-1',
      name: 'Unknown Venue',
    })

    expect(hasActiveFlowVenueSemanticEvidence(venue)).toBe(false)
    expect(getActiveFlowVenueSemanticTokens(venue)).toEqual([])
  })

  it('recognizes available structured semantic evidence', () => {
    const venue = createActiveFlowVenueSemantics({
      venueId: 'venue-1',
      vibes: ['cozy'],
    })

    expect(hasActiveFlowVenueSemanticEvidence(venue)).toBe(true)
  })

  it('returns deterministic unique semantic tokens', () => {
    const venue = createActiveFlowVenueSemantics({
      venueId: 'venue-1',
      types: ['restaurant'],
      vibes: ['romantic'],
      tags: ['restaurant', 'date-night'],
      timeCategories: ['evening'],
    })

    expect(getActiveFlowVenueSemanticTokens(venue)).toEqual([
      'date-night',
      'evening',
      'restaurant',
      'romantic',
    ])
  })

  it('finds exact shared semantic evidence without inventing synonyms', () => {
    const flowVenue = createActiveFlowVenueSemantics({
      venueId: 'flow-venue',
      types: ['bar'],
      vibes: ['social'],
      tags: ['cocktails'],
    })

    const candidateVenue = createActiveFlowVenueSemantics({
      venueId: 'candidate',
      types: ['music venue'],
      vibes: ['social'],
      tags: ['cocktails', 'live music'],
    })

    expect(
      getActiveFlowSharedSemanticTokens(flowVenue, candidateVenue),
    ).toEqual(['cocktails', 'social'])
  })

  it('does not treat related words as equivalent semantic evidence', () => {
    const left = createActiveFlowVenueSemantics({
      venueId: 'left',
      types: ['cocktail bar'],
    })

    const right = createActiveFlowVenueSemantics({
      venueId: 'right',
      types: ['bar'],
    })

    expect(getActiveFlowSharedSemanticTokens(left, right)).toEqual([])
  })

  it('preserves immutable runtime stop identity and execution order', () => {
    const venue = createActiveFlowVenueSemantics({
      venueId: 'venue-1',
      types: ['restaurant'],
    })

    const stop = createActiveFlowSemanticRouteStop({
      flowStopId: 'flow-stop-1',
      executionIndex: 3,
      kind: 'detour',
      venue,
    })

    expect(stop).toEqual({
      flowStopId: 'flow-stop-1',
      executionIndex: 3,
      kind: 'detour',
      venue,
    })
  })
})