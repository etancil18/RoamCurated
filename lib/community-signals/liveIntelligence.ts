/**
 * Normalized read contract for Community Signals live intelligence.
 *
 * Important:
 *
 * This is a consumption seam, not a shared persistence model.
 *
 * Events and place signals retain their independent truth systems:
 *
 * EVENT
 * report → occurrence → confidence → canonicalization → discovery
 *
 * PLACE SIGNAL
 * observation → contributor evidence → freshness → current signal
 *
 * Downstream consumers may inspect `kind` to preserve those semantics.
 */

export type CommunityEventConfidenceBand =
  | 'supported'
  | 'strong'

export type CommunityPlaceSignalType =
  | 'line'
  | 'temporary_closure'

export type CommunityPlaceSignalState =
  | 'present'
  | 'absent'

export type CommunityPlaceSignalPosture =
  | 'single'
  | 'corroborated'
  | 'contested'

export type CommunityEventIntelligence = {
  kind: 'event'
  intelligenceId: `event:${string}`
  venueId: string
  eventId: string
  occurrenceId: string
  confidenceBand:
    CommunityEventConfidenceBand
  confirmingContributors: number
  title: string
  startsAt: string
  endsAt: string | null
  timezone: string | null
}

export type CommunityPlaceSignalIntelligence = {
  kind: 'place_signal'
  intelligenceId:
    `place_signal:${string}:${CommunityPlaceSignalType}`
  venueId: string
  signalType:
    CommunityPlaceSignalType
  signalState:
    CommunityPlaceSignalState
  posture:
    CommunityPlaceSignalPosture
  supportingContributors: number
  observedAt: string
  expiresAt: string
}

export type CommunityLiveIntelligence =
  | CommunityEventIntelligence
  | CommunityPlaceSignalIntelligence

export function buildCommunityEventIntelligenceId(
  eventId: string
): CommunityEventIntelligence['intelligenceId'] {
  return `event:${eventId}`
}

export function buildCommunityPlaceSignalIntelligenceId({
  venueId,
  signalType,
}: {
  venueId: string
  signalType: CommunityPlaceSignalType
}): CommunityPlaceSignalIntelligence['intelligenceId'] {
  return `place_signal:${venueId}:${signalType}`
}

export function isCommunityEventConfidenceBand(
  value: unknown
): value is CommunityEventConfidenceBand {
  return (
    value === 'supported' ||
    value === 'strong'
  )
}

export function isCommunityPlaceSignalType(
  value: unknown
): value is CommunityPlaceSignalType {
  return (
    value === 'line' ||
    value === 'temporary_closure'
  )
}

export function isCommunityPlaceSignalState(
  value: unknown
): value is CommunityPlaceSignalState {
  return (
    value === 'present' ||
    value === 'absent'
  )
}

export function isCommunityPlaceSignalPosture(
  value: unknown
): value is CommunityPlaceSignalPosture {
  return (
    value === 'single' ||
    value === 'corroborated' ||
    value === 'contested'
  )
}