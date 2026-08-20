// lib/relay/format.ts

import type {
  RelayBatonState,
  RelayMemberStatus,
  RelayRewardMode,
  RelayRewardPolicyDisplay,
  RelaySlotSelectionMode,
  RelayStatus,
  RelayTeamReadinessBlocker,
  RelayTeamSlotStatus,
  RelayTeamStatus,
} from '@/lib/relay/types'


/* ============================================================
 * INTERNAL HELPERS
 * ============================================================
 */

function normalizeNonNegativeNumber(
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


function normalizeNonNegativeInteger(
  value: number
): number {
  return Math.floor(
    normalizeNonNegativeNumber(
      value
    )
  )
}


function formatNumber(
  value: number
): string {
  return new Intl.NumberFormat(
    'en-US'
  ).format(
    normalizeNonNegativeInteger(
      value
    )
  )
}


function parseDate(
  value: string | null
): Date | null {
  if (!value) {
    return null
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null
  }

  return date
}


function sameCalendarDay(
  left: Date,
  right: Date,
  timeZone?: string
): boolean {
  const formatter =
    new Intl.DateTimeFormat(
      'en-US',
      {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    )

  return (
    formatter.format(left) ===
    formatter.format(right)
  )
}


/* ============================================================
 * SLOT LABELS
 * ============================================================
 */

export function formatRelaySlotNumber(
  slotIndex: number
): string {
  const normalized =
    normalizeNonNegativeInteger(
      slotIndex
    )

  return normalized > 0
    ? `Stop ${normalized}`
    : 'Stop'
}


export function formatRelaySlotLabel(
  slotIndex: number,
  label:
    string | null | undefined
): string {
  const trimmedLabel =
    label?.trim() ?? ''

  if (trimmedLabel) {
    return trimmedLabel
  }

  return formatRelaySlotNumber(
    slotIndex
  )
}


export function formatRelaySlotHeading(
  slotIndex: number,
  label:
    string | null | undefined
): string {
  const normalized =
    normalizeNonNegativeInteger(
      slotIndex
    )

  const trimmedLabel =
    label?.trim() ?? ''

  if (
    normalized > 0 &&
    trimmedLabel
  ) {
    return `${normalized}. ${trimmedLabel}`
  }

  if (trimmedLabel) {
    return trimmedLabel
  }

  return formatRelaySlotNumber(
    normalized
  )
}


/* ============================================================
 * RELAY STATUS LABELS
 * ============================================================
 */

export function formatRelayStatusLabel(
  status: RelayStatus
): string {
  switch (status) {
    case 'draft':
      return 'Draft'

    case 'scheduled':
      return 'Scheduled'

    case 'live':
      return 'Live'

    case 'completed':
      return 'Completed'

    case 'cancelled':
      return 'Cancelled'
  }
}


/* ============================================================
 * TEAM STATUS LABELS
 * ============================================================
 */

export function formatRelayTeamStatusLabel(
  status: RelayTeamStatus
): string {
  switch (status) {
    case 'forming':
      return 'Forming team'

    case 'ready':
      return 'Ready'

    case 'active':
      return 'In progress'

    case 'completed':
      return 'Completed'

    case 'abandoned':
      return 'Abandoned'

    case 'disqualified':
      return 'Disqualified'
  }
}


export function formatRelayTeamStatusDescription(
  status: RelayTeamStatus
): string {
  switch (status) {
    case 'forming':
      return 'Invite teammates and assign one person to each Relay leg.'

    case 'ready':
      return 'The team is assembled and ready to begin when the Relay is live.'

    case 'active':
      return 'The Relay is underway. Only the teammate holding the baton can complete the current leg.'

    case 'completed':
      return 'Every required Relay leg has been completed.'

    case 'abandoned':
      return 'This team is no longer participating in the Relay.'

    case 'disqualified':
      return 'This team is no longer eligible to continue or receive Relay rewards.'
  }
}


/* ============================================================
 * MEMBER STATUS LABELS
 * ============================================================
 */

export function formatRelayMemberStatusLabel(
  status: RelayMemberStatus
): string {
  switch (status) {
    case 'invited':
      return 'Invited'

    case 'joined':
      return 'Joined'

    case 'declined':
      return 'Declined'

    case 'left':
      return 'Left team'

    case 'removed':
      return 'Removed'
  }
}


/* ============================================================
 * TEAM SLOT STATUS LABELS
 * ============================================================
 */

export function formatRelayTeamSlotStatusLabel(
  status: RelayTeamSlotStatus
): string {
  switch (status) {
    case 'locked':
      return 'Locked'

    case 'active':
      return 'Live now'

    case 'completed':
      return 'Completed'

    case 'skipped':
      return 'Skipped'
  }
}


export function formatRelayTeamSlotStatusDescription(
  status: RelayTeamSlotStatus
): string {
  switch (status) {
    case 'locked':
      return 'This leg will unlock when the previous Relay leg is complete.'

    case 'active':
      return 'This is the current Relay leg.'

    case 'completed':
      return 'This Relay leg has been completed and its venue is frozen.'

    case 'skipped':
      return 'This Relay leg was skipped.'
  }
}


/* ============================================================
 * SLOT SELECTION MODE COPY
 * ============================================================
 */

export function formatRelaySelectionModeLabel(
  mode: RelaySlotSelectionMode
): string {
  switch (mode) {
    case 'open':
      return 'Open choice'

    case 'category':
      return 'Category'

    case 'venue_pool':
      return 'Venue pool'

    case 'exact_venue':
      return 'Exact venue'
  }
}


export function formatRelaySelectionModeDescription(
  mode: RelaySlotSelectionMode
): string {
  switch (mode) {
    case 'open':
      return 'The teammate may choose any eligible venue.'

    case 'category':
      return 'The venue must satisfy the required category.'

    case 'venue_pool':
      return 'The venue must come from the approved venue pool.'

    case 'exact_venue':
      return 'This leg must be completed at the specified venue.'
  }
}


/* ============================================================
 * BATON COPY
 * ============================================================
 */

export function formatRelayBatonStatus(
  baton: RelayBatonState,
  options?: {
    activeUserName?:
      string | null

    activeSlotLabel?:
      string | null
  }
): string {
  switch (baton.state) {
    case 'not_started':
      return 'The baton has not started yet.'

    case 'completed':
      return 'The Relay is complete.'

    case 'unavailable':
      return 'Baton status is unavailable.'

    case 'active': {
      const activeUserName =
        options
          ?.activeUserName
          ?.trim()

      const activeSlotLabel =
        options
          ?.activeSlotLabel
          ?.trim()

      if (
        activeUserName &&
        activeSlotLabel
      ) {
        return `${activeUserName} has the baton for ${activeSlotLabel}.`
      }

      if (activeUserName) {
        return `${activeUserName} has the baton.`
      }

      if (activeSlotLabel) {
        return `The baton is live for ${activeSlotLabel}.`
      }

      return 'The baton is live.'
    }
  }
}


export function formatRelayBatonActionText(
  baton: RelayBatonState,
  viewerUserId:
    string | null
): string {
  if (
    baton.state ===
      'active' &&
    viewerUserId &&
    baton.activeUserId ===
      viewerUserId
  ) {
    return 'Your leg is live'
  }

  if (
    baton.state ===
    'active'
  ) {
    return 'Another teammate has the baton'
  }

  if (
    baton.state ===
    'completed'
  ) {
    return 'Relay complete'
  }

  if (
    baton.state ===
    'not_started'
  ) {
    return 'Waiting to start'
  }

  return 'Relay unavailable'
}


/* ============================================================
 * REWARD MODE COPY
 * ============================================================
 */

export function formatRelayRewardModeLabel(
  mode: RelayRewardMode
): string {
  switch (mode) {
    case 'per_member':
      return 'Per teammate'

    case 'team_pool':
      return 'Team pool'
  }
}


export function formatRelayRewardModeDescription(
  mode: RelayRewardMode
): string {
  switch (mode) {
    case 'per_member':
      return 'Every canonical contributor on the winning Relay receives the configured XP reward.'

    case 'team_pool':
      return 'The configured XP reward is the total team pool and is split across the canonical contributors.'
  }
}


export function formatRelayRewardPolicy(
  mode: RelayRewardMode,
  xpReward: number
): RelayRewardPolicyDisplay {
  const normalizedXpReward =
    normalizeNonNegativeInteger(
      xpReward
    )

  if (
    mode ===
    'team_pool'
  ) {
    return {
      mode:
        'team_pool',

      xpReward:
        normalizedXpReward,

      title:
        'Team XP pool',

      description:
        `${formatNumber(
          normalizedXpReward
        )} XP is shared across the canonical contributors on the winning Relay.`,

      perMemberXp:
        null,

      totalPoolXp:
        normalizedXpReward,
    }
  }

  return {
    mode:
      'per_member',

    xpReward:
      normalizedXpReward,

    title:
      'XP per winning teammate',

    description:
      `Each canonical contributor on the winning Relay earns ${formatNumber(
        normalizedXpReward
      )} XP.`,

    perMemberXp:
      normalizedXpReward,

    totalPoolXp:
      null,
  }
}


/* ============================================================
 * TEAM SIZE COPY
 * ============================================================
 */

export function formatRelayTeamSize(
  minTeamSize: number,
  maxTeamSize: number
): string {
  const min =
    normalizeNonNegativeInteger(
      minTeamSize
    )

  const max =
    normalizeNonNegativeInteger(
      maxTeamSize
    )

  if (
    min > 0 &&
    min === max
  ) {
    return `${formatNumber(
      min
    )} teammates`
  }

  if (
    min > 0 &&
    max > 0
  ) {
    return `${formatNumber(
      min
    )}–${formatNumber(
      max
    )} teammates`
  }

  if (max > 0) {
    return `Up to ${formatNumber(
      max
    )} teammates`
  }

  if (min > 0) {
    return `${formatNumber(
      min
    )}+ teammates`
  }

  return 'Team size unavailable'
}


/* ============================================================
 * RELAY SLOT COUNT COPY
 * ============================================================
 */

export function formatRelaySlotCount(
  slotCount: number
): string {
  const normalized =
    normalizeNonNegativeInteger(
      slotCount
    )

  return `${formatNumber(
    normalized
  )} ${
    normalized === 1
      ? 'stop'
      : 'stops'
  }`
}


/* ============================================================
 * TIME WINDOW FORMATTING
 * ============================================================
 */

export type RelayTimeWindowFormatOptions = {
  locale?: string
  timeZone?: string
  includeTimeZoneName?: boolean
}


export function formatRelayTimeWindow(
  startsAt: string | null,
  endsAt: string | null,
  options:
    RelayTimeWindowFormatOptions = {}
): string {
  const start =
    parseDate(
      startsAt
    )

  const end =
    parseDate(
      endsAt
    )

  if (
    !start &&
    !end
  ) {
    return 'Timing to be announced'
  }

  const locale =
    options.locale ??
    'en-US'

  const timeZone =
    options.timeZone

  const dateFormatter =
    new Intl.DateTimeFormat(
      locale,
      {
        timeZone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    )

  const dateTimeFormatter =
    new Intl.DateTimeFormat(
      locale,
      {
        timeZone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName:
          options
            .includeTimeZoneName
            ? 'short'
            : undefined,
      }
    )

  const timeFormatter =
    new Intl.DateTimeFormat(
      locale,
      {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName:
          options
            .includeTimeZoneName
            ? 'short'
            : undefined,
      }
    )

  if (
    start &&
    !end
  ) {
    return `Starts ${dateTimeFormatter.format(
      start
    )}`
  }

  if (
    !start &&
    end
  ) {
    return `Ends ${dateTimeFormatter.format(
      end
    )}`
  }

  if (
    !start ||
    !end
  ) {
    return 'Timing to be announced'
  }

  if (
    sameCalendarDay(
      start,
      end,
      timeZone
    )
  ) {
    return `${dateFormatter.format(
      start
    )}, ${timeFormatter.format(
      start
    )}–${timeFormatter.format(
      end
    )}`
  }

  return `${dateTimeFormatter.format(
    start
  )} – ${dateTimeFormatter.format(
    end
  )}`
}


/* ============================================================
 * RELATIVE WINDOW COPY
 * ============================================================
 *
 * Presentation only.
 *
 * Do not use this helper to decide whether a database transition
 * is valid. RPC/database window checks remain authoritative.
 * ============================================================
 */

export type RelayWindowState =
  | 'unscheduled'
  | 'upcoming'
  | 'live'
  | 'ended'


export function getRelayWindowState(
  startsAt: string | null,
  endsAt: string | null,
  now:
    Date = new Date()
): RelayWindowState {
  const start =
    parseDate(
      startsAt
    )

  const end =
    parseDate(
      endsAt
    )

  if (
    !start &&
    !end
  ) {
    return 'unscheduled'
  }

  if (
    start &&
    now.getTime() <
      start.getTime()
  ) {
    return 'upcoming'
  }

  if (
    end &&
    now.getTime() >=
      end.getTime()
  ) {
    return 'ended'
  }

  return 'live'
}


export function formatRelayWindowStateLabel(
  state: RelayWindowState
): string {
  switch (state) {
    case 'unscheduled':
      return 'Timing to be announced'

    case 'upcoming':
      return 'Coming up'

    case 'live':
      return 'Live now'

    case 'ended':
      return 'Ended'
  }
}


/* ============================================================
 * READINESS BLOCKER COPY
 * ============================================================
 */

export function formatRelayReadinessBlocker(
  blocker:
    RelayTeamReadinessBlocker
): string {
  switch (blocker) {
    case 'team_not_forming':
      return 'This team is no longer in the formation stage.'

    case 'relay_not_available':
      return 'This Relay is not currently available for team readiness.'

    case 'relay_window_ended':
      return 'The Relay execution window has ended.'

    case 'no_slots':
      return 'This Relay does not have a valid slot template.'

    case 'slot_template_mismatch':
      return 'The team slot structure does not match the Relay template.'

    case 'team_size_below_minimum':
      return 'The team needs more joined teammates.'

    case 'team_size_above_maximum':
      return 'The team exceeds the Relay team-size limit.'

    case 'member_slot_count_mismatch':
      return 'The joined teammate count must match the Relay slot count.'

    case 'unassigned_slot':
      return 'Every Relay leg must be assigned.'

    case 'duplicate_assignment':
      return 'Each teammate may own only one Relay leg.'

    case 'assigned_user_not_joined':
      return 'Every assigned teammate must be a joined team member.'

    case 'joined_member_without_slot':
      return 'Every joined teammate must own exactly one Relay leg.'
  }
}


/* ============================================================
 * COMPACT SUMMARY HELPERS
 * ============================================================
 */

export function formatRelayReadinessSummary(
  blockers:
    RelayTeamReadinessBlocker[]
): string {
  if (
    blockers.length ===
    0
  ) {
    return 'Your team is ready.'
  }

  if (
    blockers.length ===
    1
  ) {
    return formatRelayReadinessBlocker(
      blockers[0]
    )
  }

  return `${formatNumber(
    blockers.length
  )} things need attention before your team is ready.`
}


export function formatRelayProgress(
  completedStops: number,
  totalStops: number
): string {
  const completed =
    normalizeNonNegativeInteger(
      completedStops
    )

  const total =
    normalizeNonNegativeInteger(
      totalStops
    )

  if (
    total <= 0
  ) {
    return 'No Relay stops'
  }

  const boundedCompleted =
    Math.min(
      completed,
      total
    )

  return `${formatNumber(
    boundedCompleted
  )} of ${formatNumber(
    total
  )} stops complete`
}


/* ============================================================
 * PARTNER PRESENTATION COPY
 * ============================================================
 */

export function formatRelayPartnerLabel(
  hasPartnerCampaign: boolean
): string | null {
  return hasPartnerCampaign
    ? 'Partner Relay'
    : null
}


/* ============================================================
 * PUBLIC VISIBILITY COPY
 * ============================================================
 *
 * Pure copy helpers only.
 *
 * Actual visibility/authorization must come from canonical DB
 * fields and RLS.
 * ============================================================
 */

export function formatRelayReplayAvailability(
  canReplay: boolean
): string {
  return canReplay
    ? 'Roam this Relay'
    : 'Replay unavailable'
}