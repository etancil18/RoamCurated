// lib/view-models/buildNearbyEventVM.ts

/* ------------------------------------------------ */
/* Public input types                               */
/* ------------------------------------------------ */

export type NearbyEventInput = {
  id: string

  venueId?: string | null
  venue_id?: string | null

  title?: string | null
  source?: string | null
  permalink?: string | null

  startsAt?: string | Date | null
  starts_at?: string | Date | null

  endsAt?: string | Date | null
  ends_at?: string | Date | null

  description?: string | null
  tags?: string[] | null

  priceInfo?: string | null
  price_info?: string | null

  sourceType?: string | null
  source_type?: string | null

  timezone?: string | null

  isActive?: boolean | null
  is_active?: boolean | null

  ticketLink?: string | null
  ticket_link?: string | null

  socialGroupId?: string | null
  social_group_id?: string | null

  xpReward?: number | string | null
  xp_reward?: number | string | null

  checkinEnabled?: boolean | null
  checkin_enabled?: boolean | null

  archetype?: string | null
}

export type NearbyEventVenueInput = {
  id: string
  name: string

  city?: string | null
  slug?: string | null
  link?: string | null

  address?: string | null
  cover?: string | null
  description?: string | null
  type?: string | string[] | null

  lat?: number | string | null
  lon?: number | string | null

  distanceMeters?: number | string | null
  distance_meters?: number | string | null
}

export type BuildNearbyEventVMParams = {
  event: NearbyEventInput
  venue: NearbyEventVenueInput

  /**
   * Timestamp used to determine labels such as Today, Tonight, Tomorrow,
   * Live now, and Ended.
   */
  now?: Date

  /**
   * Fallback timezone used when the event does not provide one.
   */
  defaultTimezone?: string | null

  /**
   * Locale used for date and time formatting.
   */
  locale?: string

  /**
   * Maximum number of non-system tags converted into chips.
   */
  maxTagChips?: number
}

/* ------------------------------------------------ */
/* Public output types                              */
/* ------------------------------------------------ */

export type NearbyEventStatus =
  | 'upcoming'
  | 'live'
  | 'ended'
  | 'unscheduled'
  | 'inactive'

export type NearbyEventTiming = {
  status: NearbyEventStatus

  startsAt: string | null
  endsAt: string | null
  timezone: string | null

  dateLabel: string | null
  timeLabel: string | null
  endTimeLabel: string | null
  dateTimeLabel: string | null

  relativeLabel: string | null
  accessibilityLabel: string | null

  isToday: boolean
  isTonight: boolean
  isTomorrow: boolean
  isLive: boolean
  hasEnded: boolean

  startsInMinutes: number | null
  durationMinutes: number | null
}

export type NearbyEventVenueVM = {
  id: string
  name: string

  href: string
  city: string | null
  address: string | null

  cover: string | null
  typeLabel: string | null

  lat: number | null
  lon: number | null

  distanceMeters: number | null
  distanceLabel: string | null
}

export type NearbyEventVM = {
  id: string
  venueId: string

  title: string
  description: string | null

  source: string | null
  sourceType: string | null

  permalink: string | null
  ticketLink: string | null
  primaryHref: string

  priceInfo: string | null
  isFree: boolean

  tags: string[]
  archetype: string | null

  xpReward: number
  checkinEnabled: boolean
  isActive: boolean

  socialGroupId: string | null

  timing: NearbyEventTiming
  venue: NearbyEventVenueVM

  chips: string[]

  ctaLabel: string
  secondaryCtaLabel: string | null
}

/* ------------------------------------------------ */
/* Constants                                        */
/* ------------------------------------------------ */

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_MAX_TAG_CHIPS = 3

const TONIGHT_START_HOUR = 17
const TONIGHT_END_HOUR = 23

const MILLISECONDS_PER_MINUTE = 60_000
const MILLISECONDS_PER_DAY = 86_400_000

const FREE_PRICE_PATTERNS = [
  /^free$/i,
  /^free admission$/i,
  /^no cover$/i,
  /^complimentary$/i,
  /^\$0(?:\.00)?$/i,
  /^0(?:\.00)?$/,
]

/* ------------------------------------------------ */
/* Public builder                                   */
/* ------------------------------------------------ */

/**
 * Converts one normalized nearby event and its resolved venue into a
 * presentation-ready view model.
 *
 * This function is intentionally pure:
 *
 * - no database access
 * - no routing side effects
 * - no analytics
 * - no guide-specific state
 * - no crawl or journey generation
 */
export function buildNearbyEventVM({
  event,
  venue,
  now = new Date(),
  defaultTimezone = null,
  locale = DEFAULT_LOCALE,
  maxTagChips = DEFAULT_MAX_TAG_CHIPS,
}: BuildNearbyEventVMParams): NearbyEventVM {
  const eventId = requireText(
    event.id,
    'buildNearbyEventVM requires a valid event id.'
  )

  const venueId = requireText(
    firstDefined(event.venueId, event.venue_id, venue.id),
    `Event "${eventId}" requires a valid venue id.`
  )

  const venueName = requireText(
    venue.name,
    `Event "${eventId}" requires a valid venue name.`
  )

  const title =
    cleanText(event.title) ??
    `Event at ${venueName}`

  const normalizedNow = normalizeDate(now) ?? new Date()

  const timezone = resolveTimezone(
    event.timezone,
    defaultTimezone
  )

  const startsAt = normalizeDate(
    firstDefined(
      event.startsAt,
      event.starts_at
    )
  )

  const endsAt = normalizeDate(
    firstDefined(
      event.endsAt,
      event.ends_at
    )
  )

  const isActive = normalizeBoolean(
    firstDefined(
      event.isActive,
      event.is_active
    ),
    true
  )

  const timing = buildTiming({
    startsAt,
    endsAt,
    now: normalizedNow,
    timezone,
    locale,
    isActive,
  })

  const priceInfo = cleanText(
    firstDefined(
      event.priceInfo,
      event.price_info
    )
  )

  const isFree = isFreeEvent(priceInfo)

  const xpReward = normalizeNonNegativeInteger(
    firstDefined(
      event.xpReward,
      event.xp_reward
    ),
    0
  )

  const checkinEnabled = normalizeBoolean(
    firstDefined(
      event.checkinEnabled,
      event.checkin_enabled
    ),
    false
  )

  const tags = normalizeTags(event.tags)

  const archetype = cleanText(event.archetype)

  const permalink = normalizeHref(event.permalink)

  const ticketLink = normalizeHref(
    firstDefined(
      event.ticketLink,
      event.ticket_link
    )
  )

  const venueHref =
    normalizeHref(venue.link) ??
    `/venue-profile/${encodeURIComponent(venueId)}`

  const primaryHref =
    ticketLink ??
    permalink ??
    venueHref

  const venueVM = buildVenueVM({
    venue: {
      ...venue,
      id: venueId,
      name: venueName,
    },
    href: venueHref,
  })

  const chips = buildEventChips({
    timing,
    isFree,
    priceInfo,
    xpReward,
    checkinEnabled,
    archetype,
    tags,
    maxTagChips,
  })

  return {
    id: eventId,
    venueId,

    title,
    description: cleanText(event.description),

    source: cleanText(event.source),
    sourceType: cleanText(
      firstDefined(
        event.sourceType,
        event.source_type
      )
    ),

    permalink,
    ticketLink,
    primaryHref,

    priceInfo,
    isFree,

    tags,
    archetype,

    xpReward,
    checkinEnabled,
    isActive,

    socialGroupId: cleanText(
      firstDefined(
        event.socialGroupId,
        event.social_group_id
      )
    ),

    timing,
    venue: venueVM,

    chips,

    ctaLabel: resolvePrimaryCtaLabel({
      ticketLink,
      permalink,
      status: timing.status,
    }),

    secondaryCtaLabel:
      primaryHref !== venueHref
        ? 'View Venue'
        : null,
  }
}

/* ------------------------------------------------ */
/* Timing                                           */
/* ------------------------------------------------ */

function buildTiming({
  startsAt,
  endsAt,
  now,
  timezone,
  locale,
  isActive,
}: {
  startsAt: Date | null
  endsAt: Date | null
  now: Date
  timezone: string | null
  locale: string
  isActive: boolean
}): NearbyEventTiming {
  if (!isActive) {
    return {
      status: 'inactive',

      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
      timezone,

      dateLabel: startsAt
        ? formatDateLabel({
            date: startsAt,
            now,
            timezone,
            locale,
          })
        : null,

      timeLabel: startsAt
        ? formatTime({
            date: startsAt,
            timezone,
            locale,
          })
        : null,

      endTimeLabel: endsAt
        ? formatTime({
            date: endsAt,
            timezone,
            locale,
          })
        : null,

      dateTimeLabel: startsAt
        ? formatDateTimeLabel({
            startsAt,
            endsAt,
            now,
            timezone,
            locale,
          })
        : null,

      relativeLabel: 'Unavailable',
      accessibilityLabel: 'This event is currently unavailable.',

      isToday: false,
      isTonight: false,
      isTomorrow: false,
      isLive: false,
      hasEnded: false,

      startsInMinutes: startsAt
        ? calculateMinutesBetween(now, startsAt)
        : null,

      durationMinutes: calculateDurationMinutes(
        startsAt,
        endsAt
      ),
    }
  }

  if (!startsAt) {
    return {
      status: 'unscheduled',

      startsAt: null,
      endsAt: endsAt?.toISOString() ?? null,
      timezone,

      dateLabel: null,
      timeLabel: null,
      endTimeLabel: endsAt
        ? formatTime({
            date: endsAt,
            timezone,
            locale,
          })
        : null,
      dateTimeLabel: null,

      relativeLabel: 'Date to be announced',
      accessibilityLabel:
        'Event date and time have not been announced.',

      isToday: false,
      isTonight: false,
      isTomorrow: false,
      isLive: false,
      hasEnded: false,

      startsInMinutes: null,
      durationMinutes: null,
    }
  }

  const effectiveEnd =
    endsAt && endsAt.getTime() >= startsAt.getTime()
      ? endsAt
      : null

  const isLive =
    startsAt.getTime() <= now.getTime() &&
    effectiveEnd !== null &&
    effectiveEnd.getTime() > now.getTime()

  const hasEnded =
    effectiveEnd !== null
      ? effectiveEnd.getTime() <= now.getTime()
      : startsAt.getTime() < now.getTime()

  const status: NearbyEventStatus = isLive
    ? 'live'
    : hasEnded
      ? 'ended'
      : 'upcoming'

  const isToday = isSameCalendarDay({
    first: startsAt,
    second: now,
    timezone,
  })

  const isTomorrow = isNextCalendarDay({
    date: startsAt,
    now,
    timezone,
  })

  const eventHour = getDateParts(
    startsAt,
    timezone
  ).hour

  const isTonight =
    isToday &&
    eventHour >= TONIGHT_START_HOUR &&
    eventHour <= TONIGHT_END_HOUR

  const startsInMinutes = calculateMinutesBetween(
    now,
    startsAt
  )

  const dateLabel = formatDateLabel({
    date: startsAt,
    now,
    timezone,
    locale,
  })

  const timeLabel = formatTime({
    date: startsAt,
    timezone,
    locale,
  })

  const endTimeLabel = effectiveEnd
    ? formatTime({
        date: effectiveEnd,
        timezone,
        locale,
      })
    : null

  const dateTimeLabel = formatDateTimeLabel({
    startsAt,
    endsAt: effectiveEnd,
    now,
    timezone,
    locale,
  })

  const relativeLabel = buildRelativeTimingLabel({
    status,
    startsInMinutes,
    isToday,
    isTonight,
    isTomorrow,
    dateLabel,
  })

  return {
    status,

    startsAt: startsAt.toISOString(),
    endsAt: effectiveEnd?.toISOString() ?? null,
    timezone,

    dateLabel,
    timeLabel,
    endTimeLabel,
    dateTimeLabel,

    relativeLabel,
    accessibilityLabel:
      buildTimingAccessibilityLabel({
        titlePrefix: 'Event',
        status,
        dateTimeLabel,
      }),

    isToday,
    isTonight,
    isTomorrow,
    isLive,
    hasEnded,

    startsInMinutes,
    durationMinutes: calculateDurationMinutes(
      startsAt,
      effectiveEnd
    ),
  }
}

/* ------------------------------------------------ */
/* Venue VM                                         */
/* ------------------------------------------------ */

function buildVenueVM({
  venue,
  href,
}: {
  venue: NearbyEventVenueInput
  href: string
}): NearbyEventVenueVM {
  const distanceMeters = toFiniteNumber(
    firstDefined(
      venue.distanceMeters,
      venue.distance_meters
    )
  )

  return {
    id: venue.id,
    name: venue.name,

    href,
    city: cleanText(venue.city),
    address: cleanText(venue.address),

    cover: normalizeAssetPath(venue.cover),
    typeLabel: getPrimaryVenueType(venue.type),

    lat: toFiniteNumber(venue.lat),
    lon: toFiniteNumber(venue.lon),

    distanceMeters:
      distanceMeters !== null
        ? Math.max(0, Math.round(distanceMeters))
        : null,

    distanceLabel:
      distanceMeters !== null
        ? formatDistance(distanceMeters)
        : null,
  }
}

/* ------------------------------------------------ */
/* Chips                                            */
/* ------------------------------------------------ */

function buildEventChips({
  timing,
  isFree,
  priceInfo,
  xpReward,
  checkinEnabled,
  archetype,
  tags,
  maxTagChips,
}: {
  timing: NearbyEventTiming
  isFree: boolean
  priceInfo: string | null
  xpReward: number
  checkinEnabled: boolean
  archetype: string | null
  tags: string[]
  maxTagChips: number
}): string[] {
  const chips: string[] = []

  if (timing.status === 'live') {
    chips.push('Live now')
  } else if (timing.isTonight) {
    chips.push('Tonight')
  } else if (timing.isTomorrow) {
    chips.push('Tomorrow')
  } else if (timing.isToday) {
    chips.push('Today')
  } else if (timing.dateLabel) {
    chips.push(timing.dateLabel)
  }

  if (isFree) {
    chips.push('Free')
  } else if (priceInfo) {
    chips.push(priceInfo)
  }

  if (xpReward > 0) {
    chips.push(`${xpReward} XP`)
  }

  if (checkinEnabled) {
    chips.push('Check-in')
  }

  if (archetype) {
    chips.push(humanizeLabel(archetype))
  }

  const normalizedLimit = normalizeIntegerWithinRange({
    value: maxTagChips,
    fallback: DEFAULT_MAX_TAG_CHIPS,
    minimum: 0,
    maximum: 10,
  })

  for (const tag of tags.slice(0, normalizedLimit)) {
    chips.push(humanizeLabel(tag))
  }

  return uniqueStrings(chips)
}

/* ------------------------------------------------ */
/* CTA resolution                                   */
/* ------------------------------------------------ */

function resolvePrimaryCtaLabel({
  ticketLink,
  permalink,
  status,
}: {
  ticketLink: string | null
  permalink: string | null
  status: NearbyEventStatus
}): string {
  if (status === 'ended') {
    return 'View Event'
  }

  if (ticketLink) {
    return 'Get Tickets'
  }

  if (permalink) {
    return 'View Event'
  }

  return 'View Venue'
}

/* ------------------------------------------------ */
/* Timing labels                                    */
/* ------------------------------------------------ */

function buildRelativeTimingLabel({
  status,
  startsInMinutes,
  isToday,
  isTonight,
  isTomorrow,
  dateLabel,
}: {
  status: NearbyEventStatus
  startsInMinutes: number | null
  isToday: boolean
  isTonight: boolean
  isTomorrow: boolean
  dateLabel: string | null
}): string | null {
  if (status === 'live') {
    return 'Live now'
  }

  if (status === 'ended') {
    return 'Ended'
  }

  if (status === 'inactive') {
    return 'Unavailable'
  }

  if (status === 'unscheduled') {
    return 'Date to be announced'
  }

  if (
    startsInMinutes !== null &&
    startsInMinutes >= 0 &&
    startsInMinutes < 60
  ) {
    if (startsInMinutes <= 1) {
      return 'Starting now'
    }

    return `Starts in ${Math.ceil(startsInMinutes)} min`
  }

  if (
    startsInMinutes !== null &&
    startsInMinutes >= 60 &&
    startsInMinutes < 360
  ) {
    const hours = Math.round(
      startsInMinutes / 60
    )

    return `Starts in ${hours} ${
      hours === 1 ? 'hour' : 'hours'
    }`
  }

  if (isTonight) {
    return 'Tonight'
  }

  if (isToday) {
    return 'Today'
  }

  if (isTomorrow) {
    return 'Tomorrow'
  }

  return dateLabel
}

function formatDateLabel({
  date,
  now,
  timezone,
  locale,
}: {
  date: Date
  now: Date
  timezone: string | null
  locale: string
}): string {
  if (
    isSameCalendarDay({
      first: date,
      second: now,
      timezone,
    })
  ) {
    return 'Today'
  }

  if (
    isNextCalendarDay({
      date,
      now,
      timezone,
    })
  ) {
    return 'Tomorrow'
  }

  const dayDifference =
    calendarDayDifference({
      from: now,
      to: date,
      timezone,
    })

  if (
    dayDifference > 1 &&
    dayDifference < 7
  ) {
    return safeDateTimeFormat(
      locale,
      {
        weekday: 'long',
        timeZone: timezone ?? undefined,
      },
      date
    )
  }

  const sameYear =
    getDateParts(date, timezone).year ===
    getDateParts(now, timezone).year

  return safeDateTimeFormat(
    locale,
    {
      month: 'short',
      day: 'numeric',
      year: sameYear ? undefined : 'numeric',
      timeZone: timezone ?? undefined,
    },
    date
  )
}

function formatDateTimeLabel({
  startsAt,
  endsAt,
  now,
  timezone,
  locale,
}: {
  startsAt: Date
  endsAt: Date | null
  now: Date
  timezone: string | null
  locale: string
}): string {
  const dateLabel = formatDateLabel({
    date: startsAt,
    now,
    timezone,
    locale,
  })

  const startTimeLabel = formatTime({
    date: startsAt,
    timezone,
    locale,
  })

  if (!endsAt) {
    return `${dateLabel} · ${startTimeLabel}`
  }

  const endTimeLabel = formatTime({
    date: endsAt,
    timezone,
    locale,
  })

  const sameDay = isSameCalendarDay({
    first: startsAt,
    second: endsAt,
    timezone,
  })

  if (sameDay) {
    return `${dateLabel} · ${startTimeLabel}–${endTimeLabel}`
  }

  const endDateLabel = formatDateLabel({
    date: endsAt,
    now,
    timezone,
    locale,
  })

  return `${dateLabel} · ${startTimeLabel} – ${endDateLabel} · ${endTimeLabel}`
}

function formatTime({
  date,
  timezone,
  locale,
}: {
  date: Date
  timezone: string | null
  locale: string
}): string {
  return safeDateTimeFormat(
    locale,
    {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone ?? undefined,
    },
    date
  )
}

function buildTimingAccessibilityLabel({
  titlePrefix,
  status,
  dateTimeLabel,
}: {
  titlePrefix: string
  status: NearbyEventStatus
  dateTimeLabel: string | null
}): string | null {
  if (status === 'live') {
    return dateTimeLabel
      ? `${titlePrefix} is live now. ${dateTimeLabel}.`
      : `${titlePrefix} is live now.`
  }

  if (status === 'ended') {
    return dateTimeLabel
      ? `${titlePrefix} has ended. ${dateTimeLabel}.`
      : `${titlePrefix} has ended.`
  }

  if (status === 'unscheduled') {
    return `${titlePrefix} date and time have not been announced.`
  }

  if (status === 'inactive') {
    return `${titlePrefix} is currently unavailable.`
  }

  return dateTimeLabel
    ? `${titlePrefix} scheduled for ${dateTimeLabel}.`
    : null
}

/* ------------------------------------------------ */
/* Calendar helpers                                 */
/* ------------------------------------------------ */

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function getDateParts(
  date: Date,
  timezone: string | null
): DateParts {
  const formatter = createSafeFormatter(
    'en-US',
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: timezone ?? undefined,
    }
  )

  const parts = formatter.formatToParts(date)

  const partMap = new Map(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  )

  return {
    year: Number.parseInt(
      partMap.get('year') ?? '0',
      10
    ),
    month: Number.parseInt(
      partMap.get('month') ?? '0',
      10
    ),
    day: Number.parseInt(
      partMap.get('day') ?? '0',
      10
    ),
    hour: Number.parseInt(
      partMap.get('hour') ?? '0',
      10
    ),
    minute: Number.parseInt(
      partMap.get('minute') ?? '0',
      10
    ),
  }
}

function isSameCalendarDay({
  first,
  second,
  timezone,
}: {
  first: Date
  second: Date
  timezone: string | null
}): boolean {
  const firstParts = getDateParts(
    first,
    timezone
  )

  const secondParts = getDateParts(
    second,
    timezone
  )

  return (
    firstParts.year === secondParts.year &&
    firstParts.month === secondParts.month &&
    firstParts.day === secondParts.day
  )
}

function isNextCalendarDay({
  date,
  now,
  timezone,
}: {
  date: Date
  now: Date
  timezone: string | null
}): boolean {
  return (
    calendarDayDifference({
      from: now,
      to: date,
      timezone,
    }) === 1
  )
}

function calendarDayDifference({
  from,
  to,
  timezone,
}: {
  from: Date
  to: Date
  timezone: string | null
}): number {
  const fromParts = getDateParts(
    from,
    timezone
  )

  const toParts = getDateParts(
    to,
    timezone
  )

  const fromUtcDate = Date.UTC(
    fromParts.year,
    fromParts.month - 1,
    fromParts.day
  )

  const toUtcDate = Date.UTC(
    toParts.year,
    toParts.month - 1,
    toParts.day
  )

  return Math.round(
    (toUtcDate - fromUtcDate) /
      MILLISECONDS_PER_DAY
  )
}

/* ------------------------------------------------ */
/* Price helpers                                    */
/* ------------------------------------------------ */

function isFreeEvent(
  priceInfo: string | null
): boolean {
  if (!priceInfo) {
    return false
  }

  const normalized = priceInfo
    .trim()
    .replace(/\s+/g, ' ')

  return FREE_PRICE_PATTERNS.some(
    (pattern) => pattern.test(normalized)
  )
}

/* ------------------------------------------------ */
/* Venue helpers                                    */
/* ------------------------------------------------ */

function getPrimaryVenueType(
  value: string | string[] | null | undefined
): string | null {
  if (Array.isArray(value)) {
    const first = value.find(
      (entry) => cleanText(entry) !== null
    )

    return first
      ? humanizeLabel(first)
      : null
  }

  const normalized = cleanText(value)

  if (!normalized) {
    return null
  }

  const first = normalized
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean)

  return first
    ? humanizeLabel(first)
    : null
}

function formatDistance(
  distanceMeters: number
): string {
  const normalizedDistance =
    Math.max(0, distanceMeters)

  if (normalizedDistance < 1_000) {
    return `${Math.round(
      normalizedDistance / 10
    ) * 10} m away`
  }

  const kilometers =
    normalizedDistance / 1_000

  return `${formatCompactNumber(
    kilometers,
    kilometers < 10 ? 1 : 0
  )} km away`
}

/* ------------------------------------------------ */
/* Tag helpers                                      */
/* ------------------------------------------------ */

function normalizeTags(
  value: string[] | null | undefined
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return uniqueStrings(
    value
      .map(cleanText)
      .filter(
        (tag): tag is string =>
          tag !== null
      )
  )
}

/* ------------------------------------------------ */
/* Date normalization                               */
/* ------------------------------------------------ */

function normalizeDate(
  value: unknown
): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? new Date(value.getTime())
      : null
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null
  }

  const date = new Date(value)

  return Number.isFinite(date.getTime())
    ? date
    : null
}

function calculateMinutesBetween(
  from: Date,
  to: Date
): number {
  return Math.round(
    (to.getTime() - from.getTime()) /
      MILLISECONDS_PER_MINUTE
  )
}

function calculateDurationMinutes(
  startsAt: Date | null,
  endsAt: Date | null
): number | null {
  if (
    !startsAt ||
    !endsAt ||
    endsAt.getTime() < startsAt.getTime()
  ) {
    return null
  }

  return Math.round(
    (endsAt.getTime() -
      startsAt.getTime()) /
      MILLISECONDS_PER_MINUTE
  )
}

/* ------------------------------------------------ */
/* Timezone and formatting safety                   */
/* ------------------------------------------------ */

function resolveTimezone(
  eventTimezone: unknown,
  fallbackTimezone: unknown
): string | null {
  const suppliedTimezone =
    cleanText(eventTimezone) ??
    cleanText(fallbackTimezone)

  if (!suppliedTimezone) {
    return null
  }

  return isValidTimezone(suppliedTimezone)
    ? suppliedTimezone
    : null
}

function isValidTimezone(
  timezone: string
): boolean {
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
    }).format(new Date())

    return true
  } catch {
    return false
  }
}

function createSafeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(
      locale,
      options
    )
  } catch {
    const {
      timeZone: _discardedTimezone,
      ...safeOptions
    } = options

    try {
      return new Intl.DateTimeFormat(
        DEFAULT_LOCALE,
        safeOptions
      )
    } catch {
      return new Intl.DateTimeFormat(
        DEFAULT_LOCALE
      )
    }
  }
}

function safeDateTimeFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  date: Date
): string {
  return createSafeFormatter(
    locale,
    options
  ).format(date)
}

/* ------------------------------------------------ */
/* Generic helpers                                  */
/* ------------------------------------------------ */

function requireText(
  value: unknown,
  errorMessage: string
): string {
  const normalized = cleanText(value)

  if (!normalized) {
    throw new Error(errorMessage)
  }

  return normalized
}

function cleanText(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')

  return normalized.length > 0
    ? normalized
    : null
}

function normalizeHref(
  value: unknown
): string | null {
  const href = cleanText(value)

  if (!href) {
    return null
  }

  if (
    href.startsWith('/') ||
    href.startsWith('https://') ||
    href.startsWith('http://')
  ) {
    return href
  }

  return null
}

function normalizeAssetPath(
  value: unknown
): string | null {
  const path = cleanText(value)

  if (!path) {
    return null
  }

  if (
    path.startsWith('/') ||
    path.startsWith('https://') ||
    path.startsWith('http://')
  ) {
    return path
  }

  return `/${path}`
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .toLowerCase()

    if (
      normalized === 'true' ||
      normalized === '1' ||
      normalized === 'yes'
    ) {
      return true
    }

    if (
      normalized === 'false' ||
      normalized === '0' ||
      normalized === 'no'
    ) {
      return false
    }
  }

  return fallback
}

function normalizeNonNegativeInteger(
  value: unknown,
  fallback: number
): number {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.max(
    0,
    Math.trunc(numericValue)
  )
}

function toFiniteNumber(
  value: unknown
): number | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(
      value.trim()
    )

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  return null
}

function normalizeIntegerWithinRange({
  value,
  fallback,
  minimum,
  maximum,
}: {
  value: number | undefined
  fallback: number
  minimum: number
  maximum: number
}): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return clamp(
      Math.trunc(fallback),
      minimum,
      maximum
    )
  }

  return clamp(
    Math.trunc(value),
    minimum,
    maximum
  )
}

function humanizeLabel(
  value: string
): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
}

function uniqueStrings(
  values: string[]
): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const normalized = cleanText(value)

    if (!normalized) {
      continue
    }

    const comparisonKey =
      normalized.toLowerCase()

    if (seen.has(comparisonKey)) {
      continue
    }

    seen.add(comparisonKey)
    output.push(normalized)
  }

  return output
}

function formatCompactNumber(
  value: number,
  maximumFractionDigits: number
): string {
  return new Intl.NumberFormat(
    DEFAULT_LOCALE,
    {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }
  ).format(value)
}

function firstDefined<T>(
  ...values: Array<T | null | undefined>
): T | null {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined
    ) {
      return value
    }
  }

  return null
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  )
}