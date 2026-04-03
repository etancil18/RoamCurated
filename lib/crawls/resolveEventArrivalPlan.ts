import { DateTime } from 'luxon'

export type EventArrivalPolicy =
  | 'by_start'
  | 'midpoint_deadline'
  | 'window'
  | 'custom'

export type EventArrivalPreference =
  | 'early'
  | 'on_time'
  | 'fashionably_late'
  | 'late_ok'

export type EventArrivalPlanInput = {
  now: DateTime
  eventStartAtISO: string
  eventEndAtISO?: string | null
  eventType?: string | null
  arrivalPolicy?: EventArrivalPolicy | null
  arrivalPreference?: EventArrivalPreference | null
  timezone?: string | null
}

export type EventArrivalPlan = {
  eventStartAt: DateTime
  eventEndAt: DateTime | null
  targetArrivalAt: DateTime
  latestUsefulArrival: DateTime
  arrivalBufferMinutes: number
  hoursUntilTargetArrival: number
  resolvedArrivalPolicy: EventArrivalPolicy
  resolvedArrivalPreference: EventArrivalPreference
  isFlexibleArrival: boolean
  rationale: string
}

const STRICT_EVENT_TYPES = new Set([
  'sports',
  'concert',
  'theater',
  'comedy',
  'performance',
  'show',
])

const FLEXIBLE_MIDPOINT_EVENT_TYPES = new Set([
  'festival',
  'fair',
  'market',
])

const FLEXIBLE_WINDOW_EVENT_TYPES = new Set([
  'conference',
  'exhibition',
  'community',
  'gallery',
  'open_house',
])

export function resolveEventArrivalPlan(
  input: EventArrivalPlanInput
): EventArrivalPlan {
  const timezone: string = input.timezone ?? input.now.zoneName ?? 'UTC'

  const eventStartAt = DateTime.fromISO(input.eventStartAtISO).setZone(timezone)
  if (!eventStartAt.isValid) {
    throw new Error(
      `resolveEventArrivalPlan: invalid eventStartAtISO "${input.eventStartAtISO}"`
    )
  }

  const eventEndAt =
    input.eventEndAtISO && input.eventEndAtISO.trim().length > 0
      ? DateTime.fromISO(input.eventEndAtISO).setZone(timezone)
      : null

  const safeEventEndAt =
    eventEndAt && eventEndAt.isValid && eventEndAt > eventStartAt
      ? eventEndAt
      : null

  const resolvedArrivalPolicy = resolveArrivalPolicy({
    explicitPolicy: input.arrivalPolicy,
    eventType: input.eventType,
    hasValidEndAt: Boolean(safeEventEndAt),
  })

  const resolvedArrivalPreference = resolveArrivalPreference(
    input.arrivalPreference
  )

  const targetArrivalAt = resolveTargetArrivalAt({
    eventStartAt,
    eventEndAt: safeEventEndAt,
    policy: resolvedArrivalPolicy,
    preference: resolvedArrivalPreference,
  })

  const normalizedNow = input.now.setZone(timezone)

  const arrivalBufferMinutes = resolveArrivalBufferMinutes({
    policy: resolvedArrivalPolicy,
    preference: resolvedArrivalPreference,
    targetArrivalAt,
    now: normalizedNow,
  })

  const latestUsefulArrival = targetArrivalAt.minus({
    minutes: arrivalBufferMinutes,
  })

  return {
    eventStartAt,
    eventEndAt: safeEventEndAt,
    targetArrivalAt,
    latestUsefulArrival,
    arrivalBufferMinutes,
    hoursUntilTargetArrival: targetArrivalAt.diff(normalizedNow, 'hours').hours,
    resolvedArrivalPolicy,
    resolvedArrivalPreference,
    isFlexibleArrival:
      resolvedArrivalPolicy === 'midpoint_deadline' ||
      resolvedArrivalPolicy === 'window',
    rationale: buildRationale({
      policy: resolvedArrivalPolicy,
      preference: resolvedArrivalPreference,
      hasEndAt: Boolean(safeEventEndAt),
    }),
  }
}

function resolveArrivalPolicy({
  explicitPolicy,
  eventType,
  hasValidEndAt,
}: {
  explicitPolicy?: EventArrivalPolicy | null
  eventType?: string | null
  hasValidEndAt: boolean
}): EventArrivalPolicy {
  if (explicitPolicy) {
    if (
      (explicitPolicy === 'midpoint_deadline' ||
        explicitPolicy === 'window') &&
      !hasValidEndAt
    ) {
      return 'by_start'
    }

    return explicitPolicy
  }

  const normalizedEventType = normalizeEventType(eventType)

  if (STRICT_EVENT_TYPES.has(normalizedEventType)) {
    return 'by_start'
  }

  if (hasValidEndAt && FLEXIBLE_MIDPOINT_EVENT_TYPES.has(normalizedEventType)) {
    return 'midpoint_deadline'
  }

  if (hasValidEndAt && FLEXIBLE_WINDOW_EVENT_TYPES.has(normalizedEventType)) {
    return 'window'
  }

  return 'by_start'
}

function resolveArrivalPreference(
  explicitPreference?: EventArrivalPreference | null
): EventArrivalPreference {
  return explicitPreference ?? 'on_time'
}

function resolveTargetArrivalAt({
  eventStartAt,
  eventEndAt,
  policy,
  preference,
}: {
  eventStartAt: DateTime
  eventEndAt: DateTime | null
  policy: EventArrivalPolicy
  preference: EventArrivalPreference
}) {
  if (policy === 'by_start' || !eventEndAt) {
    return shiftStrictArrival(eventStartAt, preference)
  }

  if (policy === 'midpoint_deadline') {
    const midpoint = eventStartAt.plus({
      milliseconds: eventEndAt.diff(eventStartAt).milliseconds / 2,
    })

    return shiftFlexibleArrival({
      windowStart: eventStartAt,
      windowEnd: midpoint,
      preference,
      fallback: midpoint,
    })
  }

  if (policy === 'window') {
    return shiftFlexibleArrival({
      windowStart: eventStartAt,
      windowEnd: eventEndAt,
      preference,
      fallback: eventStartAt.plus({
        milliseconds: eventEndAt.diff(eventStartAt).milliseconds / 2,
      }),
    })
  }

  return shiftStrictArrival(eventStartAt, preference)
}

function shiftStrictArrival(
  base: DateTime,
  preference: EventArrivalPreference
) {
  if (preference === 'early') {
    return base.minus({ minutes: 30 })
  }

  if (preference === 'fashionably_late') {
    return base.plus({ minutes: 10 })
  }

  if (preference === 'late_ok') {
    return base.plus({ minutes: 20 })
  }

  return base
}

function shiftFlexibleArrival({
  windowStart,
  windowEnd,
  preference,
  fallback,
}: {
  windowStart: DateTime
  windowEnd: DateTime
  preference: EventArrivalPreference
  fallback: DateTime
}) {
  const durationMs = windowEnd.diff(windowStart).milliseconds

  if (durationMs <= 0) return fallback

  if (preference === 'early') {
    return windowStart.plus({ milliseconds: durationMs * 0.2 })
  }

  if (preference === 'on_time') {
    return windowStart.plus({ milliseconds: durationMs * 0.4 })
  }

  if (preference === 'fashionably_late') {
    return windowStart.plus({ milliseconds: durationMs * 0.65 })
  }

  return windowStart.plus({ milliseconds: durationMs * 0.8 })
}

function resolveArrivalBufferMinutes({
  policy,
  preference,
  targetArrivalAt,
  now,
}: {
  policy: EventArrivalPolicy
  preference: EventArrivalPreference
  targetArrivalAt: DateTime
  now: DateTime
}) {
  const hoursUntilArrival = targetArrivalAt.diff(now, 'hours').hours

  if (policy === 'by_start') {
    if (preference === 'early') return 30
    if (hoursUntilArrival >= 6) return 45
    if (hoursUntilArrival >= 3) return 40
    return 30
  }

  if (policy === 'midpoint_deadline') {
    if (preference === 'late_ok') return 0
    if (preference === 'fashionably_late') return 10
    return 15
  }

  if (policy === 'window') {
    if (preference === 'late_ok') return 0
    return 10
  }

  return 20
}

function buildRationale({
  policy,
  preference,
  hasEndAt,
}: {
  policy: EventArrivalPolicy
  preference: EventArrivalPreference
  hasEndAt: boolean
}) {
  if (policy === 'by_start') {
    if (preference === 'early') {
      return 'Strict-start event with early-arrival preference.'
    }
    if (preference === 'fashionably_late') {
      return 'Strict-start event with slight late-arrival tolerance.'
    }
    if (preference === 'late_ok') {
      return 'Strict-start event with relaxed late-arrival tolerance.'
    }
    return 'Strict-start event targeting arrival around start time.'
  }

  if (policy === 'midpoint_deadline') {
    return hasEndAt
      ? 'Flexible event targeting arrival before the midpoint of the event window.'
      : 'Fallback midpoint policy without a valid event end time.'
  }

  if (policy === 'window') {
    return hasEndAt
      ? 'Flexible event targeting arrival within the broader event window.'
      : 'Fallback window policy without a valid event end time.'
  }

  return 'Custom arrival policy resolved for event timing.'
}

function normalizeEventType(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}