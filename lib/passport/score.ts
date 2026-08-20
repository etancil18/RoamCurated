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

  /**
   * Competition contender attribution:
   *
   * Canonical verified downstream execution attributed to this
   * user because another explorer physically executed one of
   * their approved duel competition-entry routes.
   *
   * These are counts, not awarded XP amounts. The append-only
   * competition_entry_attribution_events ledger is responsible
   * for canonical provenance, anti-farming, self-attribution
   * prevention, and exactly-once stop/completion evidence.
   *
   * score.ts owns the XP economics over those canonical counts.
   */
  competitionAttributedStops?: number
  completedCompetitionAttributedFlows?: number

  /**
   * Competition win XP:
   *
   * Canonical XP already awarded from settled competition wins.
   *
   * This is an XP amount, not a win count, because each
   * competition owns its configured xp_reward.
   *
   * The competition XP ledger is responsible for exactly-once
   * idempotency. score.ts remains a pure deterministic
   * calculation over canonical aggregate XP.
   *
   * Optional so existing PassportStats producers continue to
   * work unchanged until the competition XP aggregate is wired
   * into the Passport rebuild path.
   */
  competitionWinXp?: number

  /**
   * Relay participant execution:
   *
   * Canonical Relay execution completed personally by this user.
   *
   * completedRelayParticipantStops counts materialized Relay team
   * slots assigned to this user that reached canonical completed
   * state through the Relay execution/check-in path.
   *
   * completedRelayTeamParticipations counts completed Relay teams
   * in which this user was a canonical participating contributor.
   *
   * These are execution counts, not downstream replay attribution.
   *
   * Participant stop XP mirrors ordinary completed Flow-stop XP.
   * Collective Relay completion XP mirrors ordinary completed
   * Flow XP and is attributable to every canonical participant
   * when the Relay team itself completes.
   *
   * The Relay database/rebuild path owns canonical membership,
   * slot completion, geo verification, team completion, and
   * exactly-once counting.
   *
   * score.ts owns only the deterministic XP economics.
   */
  completedRelayParticipantStops?: number
  completedRelayTeamParticipations?: number

  /**
   * Relay contributor attribution:
   *
   * Canonical downstream execution attributed to this user
   * because another explorer physically executed a stop that
   * this user contributed to a completed Roam Relay artifact.
   *
   * relayAttributedStops counts verified downstream execution
   * of this contributor's authored Relay stops.
   *
   * completedAttributedRelays counts canonical downstream
   * completions of collaborative Relay artifacts containing
   * this contributor's authored stop.
   *
   * These are evidence counts, not awarded XP amounts.
   *
   * The append-only
   * roam_relay_downstream_attribution_events ledger owns:
   *
   * - exact Relay artifact provenance;
   * - per-stop contributor authorship;
   * - canonical geo-verified downstream execution;
   * - self-attribution prevention;
   * - duplicate stop attribution prevention;
   * - duplicate Relay completion attribution prevention.
   *
   * score.ts owns the XP economics over those canonical counts.
   */
  relayAttributedStops?: number
  completedAttributedRelays?: number
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


/**
 * Duel competition contender attribution:
 *
 * Mirrors creator replay economics because the underlying
 * behavior is equivalent: another user physically executes
 * a route owned by this contender.
 *
 * Canonical attribution evidence is owned by
 * competition_entry_attribution_events.
 */
const XP_PER_COMPETITION_ATTRIBUTED_STOP = 10
const XP_PER_COMPLETED_COMPETITION_ATTRIBUTED_FLOW = 50


/**
 * Relay participant execution:
 *
 * A participant receives ordinary execution-equivalent Passport
 * value for personally completing their assigned Relay leg.
 *
 * When the entire Relay team completes, every canonical Relay
 * participant receives collective completion credit.
 *
 * These deliberately mirror the existing Active Flow economics:
 *
 * - personally completed Relay leg: 25 XP
 * - completed Relay team participation: 100 XP
 *
 * Canonical Relay membership, assignment, geo verification,
 * slot completion, and team completion remain database-owned.
 *
 * These values do not replace or alter downstream Relay
 * attribution economics.
 */
const XP_PER_COMPLETED_RELAY_PARTICIPANT_STOP = 25
const XP_PER_COMPLETED_RELAY_TEAM_PARTICIPATION = 100


/**
 * Relay contributor attribution:
 *
 * A Relay contributor earns creator-side attribution XP when
 * another explorer physically executes the contributor's
 * authored stop inside the completed collaborative Relay.
 *
 * A completed downstream Relay execution also earns the
 * contributor collaborative completion attribution XP.
 *
 * This deliberately mirrors the existing creator replay and
 * duel contender economics:
 *
 * - attributed Relay stop: 10 XP
 * - completed attributed Relay: 50 XP
 *
 * Explorer execution XP remains separate.
 * Competition winner XP remains separate.
 *
 * Canonical attribution evidence is owned by
 * roam_relay_downstream_attribution_events.
 */
const XP_PER_RELAY_ATTRIBUTED_STOP = 10
const XP_PER_COMPLETED_ATTRIBUTED_RELAY = 50


// Passport XP is awarded only for the first recorded visit
// to each unique venue.
const XP_PER_UNIQUE_VENUE_VISIT = 5


export function calculatePassportXp(
  stats: PassportStats
): number {
  return (
    normalizeXp(stats.eventXp) +
    normalizeXp(
      stats.competitionWinXp ??
        0
    ) +
    normalizeCount(
      stats.competitionAttributedStops ??
        0
    ) *
      XP_PER_COMPETITION_ATTRIBUTED_STOP +
    normalizeCount(
      stats.completedCompetitionAttributedFlows ??
        0
    ) *
      XP_PER_COMPLETED_COMPETITION_ATTRIBUTED_FLOW +
    normalizeCount(
      stats.completedRelayParticipantStops ??
        0
    ) *
      XP_PER_COMPLETED_RELAY_PARTICIPANT_STOP +
    normalizeCount(
      stats.completedRelayTeamParticipations ??
        0
    ) *
      XP_PER_COMPLETED_RELAY_TEAM_PARTICIPATION +
    normalizeCount(
      stats.relayAttributedStops ??
        0
    ) *
      XP_PER_RELAY_ATTRIBUTED_STOP +
    normalizeCount(
      stats.completedAttributedRelays ??
        0
    ) *
      XP_PER_COMPLETED_ATTRIBUTED_RELAY +
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