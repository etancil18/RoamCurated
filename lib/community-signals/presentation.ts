/**
 * Community Signals presentation identity.
 *
 * This module classifies already-authorized event-shaped data for
 * presentation purposes only.
 *
 * It does NOT determine:
 * - event truth
 * - event discovery eligibility
 * - confidence
 * - freshness
 * - Active Flow eligibility
 * - map salience
 * - intervention eligibility
 *
 * Canonical Community Signals may remain events internally while being
 * presented separately from ordinary Events in the product UI.
 */

export type CommunitySignalPresentable = {
  source_type?: string | null
}

/**
 * Returns true only when the canonical presentation discriminator
 * explicitly identifies the item as a Community Signal.
 *
 * Classification is intentionally exact and fail-closed:
 * - no title inference
 * - no source inference
 * - no case normalization
 * - no fuzzy matching
 */
export function isCommunityEventSignal(
  item: CommunitySignalPresentable
): boolean {
  return item.source_type === 'community_signal'
}