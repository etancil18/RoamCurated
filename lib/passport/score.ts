export type PassportStats = {
  hostedCrawls: number
  joinedCrawls: number
  pastCrawls: number
  savedProperties: number
  completedFlows: number
  completedFlowStops: number
  hostedFlowStops: number
  completedHostedFlows: number

  /**
   * Creator replay attribution:
   *
   * Canonical replay stop/completion counts attributed to this
   * user because another user completed their public replayable
   * Flow snapshot.
   *
   * These remain optional so existing PassportStats producers
   * continue to work unchanged until they are wired to the
   * creator_replay_attribution_totals aggregate.
   */
  replayedFlowStops?: number
  completedReplayedFlows?: number

  venueVisits: number
  eventXp: number
  eventCheckins?: number
}


const XP_PER_LEVEL = 250


const XP_PER_HOSTED_CRAWL = 75
const XP_PER_JOINED_CRAWL = 25
const XP_PER_PAST_CRAWL = 100
const XP_PER_SAVED_PROPERTY = 10
const XP_PER_COMPLETED_FLOW = 100
const XP_PER_COMPLETED_FLOW_STOP = 25
const XP_PER_HOSTED_FLOW_STOP = 25
const XP_PER_COMPLETED_HOSTED_FLOW = 100


/**
 * Creator replay attribution:
 *
 * A creator earns the same stop/completion value when another
 * user physically executes their public replayable snapshot.
 *
 * The attribution ledger is responsible for:
 *
 * - preventing self-replay credit;
 * - preventing duplicate stop credit;
 * - preventing duplicate completion credit;
 * - requiring canonical verified replay evidence.
 *
 * score.ts therefore remains a pure deterministic calculation
 * over already-canonical aggregate counts.
 */
const XP_PER_REPLAYED_FLOW_STOP = 10
const XP_PER_COMPLETED_REPLAYED_FLOW = 50


// Passport XP is awarded only for the first recorded visit
// to each unique venue.
const XP_PER_UNIQUE_VENUE_VISIT = 5


export function calculatePassportXp(
  stats: PassportStats
): number {
  return (
    normalizeXp(stats.eventXp) +
    normalizeCount(stats.hostedCrawls) *
      XP_PER_HOSTED_CRAWL +
    normalizeCount(stats.joinedCrawls) *
      XP_PER_JOINED_CRAWL +
    normalizeCount(stats.pastCrawls) *
      XP_PER_PAST_CRAWL +
    normalizeCount(stats.savedProperties) *
      XP_PER_SAVED_PROPERTY +
    normalizeCount(stats.completedFlows) *
      XP_PER_COMPLETED_FLOW +
    normalizeCount(stats.completedFlowStops) *
      XP_PER_COMPLETED_FLOW_STOP +
    normalizeCount(stats.hostedFlowStops) *
      XP_PER_HOSTED_FLOW_STOP +
    normalizeCount(stats.completedHostedFlows) *
      XP_PER_COMPLETED_HOSTED_FLOW +
    normalizeCount(
      stats.replayedFlowStops ??
        0
    ) *
      XP_PER_REPLAYED_FLOW_STOP +
    normalizeCount(
      stats.completedReplayedFlows ??
        0
    ) *
      XP_PER_COMPLETED_REPLAYED_FLOW +
    normalizeCount(stats.venueVisits) *
      XP_PER_UNIQUE_VENUE_VISIT
  )
}


export function calculatePassportLevel(
  xp: number
): number {
  const normalizedXp = normalizeXp(xp)


  return Math.max(
    1,
    Math.floor(normalizedXp / XP_PER_LEVEL) + 1
  )
}


export function calculateProgressToNextLevel(
  xp: number
): number {
  return normalizeXp(xp) % XP_PER_LEVEL
}


export function calculateProgressPercent(
  xp: number
): number {
  return (
    calculateProgressToNextLevel(xp) /
    XP_PER_LEVEL
  ) * 100
}


export function getPassportSnapshot(
  stats: PassportStats
) {
  const xp = calculatePassportXp(stats)
  const level = calculatePassportLevel(xp)
  const progressToNextLevel =
    calculateProgressToNextLevel(xp)
  const progressPercent =
    calculateProgressPercent(xp)


  return {
    xp,
    level,
    progressToNextLevel,
    progressPercent,
  }
}


function normalizeCount(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0
  }


  return Math.floor(value)
}


function normalizeXp(
  value: number
): number {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 0
  }


  return value
}