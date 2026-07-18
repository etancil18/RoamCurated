// lib/venues/normalizeVenue.ts

import type {
  DateEvent,
  HoursNumeric,
  Venue,
  VenueMarkerTemporalProfile,
} from '@/types/venue'

type UnknownRecord =
  Record<string, unknown>

export type VenueNormalizationIssueCode =
  | 'invalid-record'
  | 'missing-id'
  | 'missing-name'
  | 'missing-link'
  | 'invalid-latitude'
  | 'invalid-longitude'
  | 'legacy-types-field'
  | 'truncated-hours-intervals'
  | 'invalid-hours-interval'

export type VenueNormalizationIssue = {
  code:
    VenueNormalizationIssueCode
  message:
    string
  venueId?:
    string
  field?:
    string
  value?:
    unknown
}

export type NormalizeVenueContext = {
  /**
   * Used only when the raw venue does not already provide a city.
   */
  city?:
    string

  /**
   * Optional diagnostics callback for malformed or legacy data.
   */
  onIssue?: (
    issue:
      VenueNormalizationIssue
  ) => void
}

const TEMPORAL_PROFILES =
  new Set<VenueMarkerTemporalProfile>([
    'coffee-dining',
    'coffee-wine',
  ])

function isRecord(
  value:
    unknown
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function reportIssue(
  context:
    NormalizeVenueContext,
  issue:
    VenueNormalizationIssue
): void {
  context.onIssue?.(
    issue
  )
}

function normalizeRequiredString(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized
    ? normalized
    : null
}

function normalizeOptionalString(
  value:
    unknown
): string | undefined {
  if (
    typeof value !==
    'string'
  ) {
    return undefined
  }

  const normalized =
    value.trim()

  return normalized ||
    undefined
}

function normalizeFiniteNumber(
  value:
    unknown
): number | undefined {
  if (
    typeof value ===
      'number'
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : undefined
  }

  if (
    typeof value !==
      'string'
  ) {
    return undefined
  }

  const normalized =
    value.trim()

  if (!normalized) {
    return undefined
  }

  const parsed =
    Number(normalized)

  return Number.isFinite(
    parsed
  )
    ? parsed
    : undefined
}

function normalizeCoordinate(
  value:
    unknown,
  minimum:
    number,
  maximum:
    number
): number | null {
  const numeric =
    normalizeFiniteNumber(
      value
    )

  if (
    numeric === undefined ||
    numeric < minimum ||
    numeric > maximum
  ) {
    return null
  }

  return numeric
}

function collectNormalizedStrings(
  ...values:
    unknown[]
): string[] {
  const normalized:
    string[] = []

  const seen =
    new Set<string>()

  const append = (
    value:
      unknown
  ): void => {
    if (
      typeof value ===
        'string'
    ) {
      for (
        const part of
        value.split(',')
      ) {
        const item =
          part.trim()

        if (
          item &&
          !seen.has(item)
        ) {
          seen.add(item)
          normalized.push(
            item
          )
        }
      }

      return
    }

    if (
      Array.isArray(
        value
      )
    ) {
      for (
        const item of
        value
      ) {
        append(item)
      }
    }
  }

  for (
    const value of
    values
  ) {
    append(value)
  }

  return normalized
}

function normalizeStringField(
  ...values:
    unknown[]
): string |
  string[] |
  undefined {
  const normalized =
    collectNormalizedStrings(
      ...values
    )

  if (
    normalized.length ===
    0
  ) {
    return undefined
  }

  return normalized.length ===
    1
    ? normalized[0]
    : normalized
}

function normalizeStringArray(
  value:
    unknown
): string[] | undefined {
  const normalized =
    collectNormalizedStrings(
      value
    )

  return normalized.length >
    0
    ? normalized
    : undefined
}

function normalizeBoolean(
  value:
    unknown
): boolean | undefined {
  if (
    typeof value ===
      'boolean'
  ) {
    return value
  }

  if (
    typeof value ===
      'number'
  ) {
    if (value === 1) {
      return true
    }

    if (value === 0) {
      return false
    }

    return undefined
  }

  if (
    typeof value !==
      'string'
  ) {
    return undefined
  }

  switch (
    value
      .trim()
      .toLowerCase()
  ) {
    case 'true':
    case 'open':
    case 'yes':
    case '1':
      return true

    case 'false':
    case 'closed':
    case 'no':
    case '0':
      return false

    default:
      return undefined
  }
}

function normalizeStringRecord(
  value:
    unknown
): Record<
  string,
  string
> | undefined {
  if (
    !isRecord(value)
  ) {
    return undefined
  }

  const normalized:
    Record<
      string,
      string
    > = {}

  for (
    const [
      key,
      rawValue,
    ] of Object.entries(
      value
    )
  ) {
    const normalizedKey =
      key.trim()

    const normalizedValue =
      normalizeOptionalString(
        rawValue
      )

    if (
      normalizedKey &&
      normalizedValue
    ) {
      normalized[
        normalizedKey
      ] =
        normalizedValue
    }
  }

  return Object.keys(
    normalized
  ).length > 0
    ? normalized
    : undefined
}

function normalizeHoursPair(
  value:
    unknown
): {
  open:
    number
  close:
    number
} | null {
  if (
    !isRecord(value)
  ) {
    return null
  }

  const open =
    normalizeFiniteNumber(
      value.open
    )

  const close =
    normalizeFiniteNumber(
      value.close
    )

  if (
    open === undefined ||
    close === undefined
  ) {
    return null
  }

  return {
    open,
    close,
  }
}

function normalizeHoursNumeric(
  value:
    unknown,
  context:
    NormalizeVenueContext,
  venueId:
    string
): HoursNumeric | undefined {
  if (
    !isRecord(value)
  ) {
    return undefined
  }

  const normalized:
    HoursNumeric = {}

  let hasEntries =
    false

  for (
    const [
      rawDay,
      rawHours,
    ] of Object.entries(
      value
    )
  ) {
    const day =
      rawDay.trim()

    if (!day) {
      continue
    }

    if (
      rawHours ===
      null
    ) {
      normalized[day] =
        null

      hasEntries = true
      continue
    }

    let candidate:
      unknown =
      rawHours

    if (
      Array.isArray(
        rawHours
      )
    ) {
      candidate =
        rawHours[0]

      if (
        rawHours.length >
        1
      ) {
        reportIssue(
          context,
          {
            code:
              'truncated-hours-intervals',
            message:
              `Venue "${venueId}" has multiple hours intervals for "${day}", but HoursNumeric currently supports one interval per day.`,
            venueId,
            field:
              `hoursNumeric.${day}`,
            value:
              rawHours,
          }
        )
      }
    }

    const pair =
      normalizeHoursPair(
        candidate
      )

    if (!pair) {
      reportIssue(
        context,
        {
          code:
            'invalid-hours-interval',
          message:
            `Venue "${venueId}" has an invalid hours interval for "${day}".`,
          venueId,
          field:
            `hoursNumeric.${day}`,
          value:
            rawHours,
        }
      )

      continue
    }

    normalized[day] =
      pair

    hasEntries = true
  }

  return hasEntries
    ? normalized
    : undefined
}

function normalizeDateEvent(
  value:
    unknown
): DateEvent | null {
  if (
    !isRecord(value)
  ) {
    return null
  }

  const date =
    normalizeRequiredString(
      value.date
    )

  const title =
    normalizeRequiredString(
      value.title
    )

  const time =
    normalizeRequiredString(
      value.time
    )

  if (
    !date ||
    !title ||
    !time
  ) {
    return null
  }

  return {
    date,
    title,
    time,
  }
}

function normalizeDateEvents(
  value:
    unknown
): DateEvent[] | undefined {
  if (
    !Array.isArray(
      value
    )
  ) {
    return undefined
  }

  const events =
    value
      .map(
        normalizeDateEvent
      )
      .filter(
        (
          event
        ): event is DateEvent =>
          event !== null
      )

  return events.length >
    0
    ? events
    : undefined
}

function normalizeTemporalProfile(
  value:
    unknown
): VenueMarkerTemporalProfile |
  undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined
  }

  const normalized =
    value.trim() as
      VenueMarkerTemporalProfile

  return TEMPORAL_PROFILES.has(
    normalized
  )
    ? normalized
    : undefined
}

/**
 * Returns the canonical normalized category list for a Venue.
 *
 * Rendering code should consume only Venue.type after ingestion.
 */
export function normalizeVenueTypes(
  value:
    Venue['type']
): string[] {
  return collectNormalizedStrings(
    value
  )
}

/**
 * Converts an unknown raw venue record into a canonical Venue.
 *
 * This is the only supported boundary for:
 * - validating required venue identity
 * - coercing static string coordinates
 * - translating legacy `types` into canonical `type`
 * - normalizing explicit marker temporal profiles
 *
 * It never invents an ID from slug or name.
 */
export function normalizeRawVenue(
  input:
    unknown,
  context:
    NormalizeVenueContext = {}
): Venue | null {
  if (
    !isRecord(input)
  ) {
    reportIssue(
      context,
      {
        code:
          'invalid-record',
        message:
          'Venue input must be an object.',
        value:
          input,
      }
    )

    return null
  }

  const id =
    normalizeRequiredString(
      input.id
    )

  if (!id) {
    reportIssue(
      context,
      {
        code:
          'missing-id',
        message:
          'Venue is missing its required canonical id.',
        field:
          'id',
        value:
          input.id,
      }
    )

    return null
  }

  const name =
    normalizeRequiredString(
      input.name
    )

  if (!name) {
    reportIssue(
      context,
      {
        code:
          'missing-name',
        message:
          `Venue "${id}" is missing its required name.`,
        venueId:
          id,
        field:
          'name',
        value:
          input.name,
      }
    )

    return null
  }

  const link =
    normalizeRequiredString(
      input.link
    )

  if (!link) {
    reportIssue(
      context,
      {
        code:
          'missing-link',
        message:
          `Venue "${id}" is missing its required link.`,
        venueId:
          id,
        field:
          'link',
        value:
          input.link,
      }
    )

    return null
  }

  const lat =
    normalizeCoordinate(
      input.lat,
      -90,
      90
    )

  if (lat === null) {
    reportIssue(
      context,
      {
        code:
          'invalid-latitude',
        message:
          `Venue "${id}" has an invalid latitude.`,
        venueId:
          id,
        field:
          'lat',
        value:
          input.lat,
      }
    )

    return null
  }

  const lon =
    normalizeCoordinate(
      input.lon,
      -180,
      180
    )

  if (lon === null) {
    reportIssue(
      context,
      {
        code:
          'invalid-longitude',
        message:
          `Venue "${id}" has an invalid longitude.`,
        venueId:
          id,
        field:
          'lon',
        value:
          input.lon,
      }
    )

    return null
  }

  const legacyTypes =
    input.types

  if (
    legacyTypes !==
    undefined
  ) {
    reportIssue(
      context,
      {
        code:
          'legacy-types-field',
        message:
          `Venue "${id}" uses legacy "types"; it was normalized into canonical "type".`,
        venueId:
          id,
        field:
          'types',
        value:
          legacyTypes,
      }
    )
  }

  const type =
    normalizeStringField(
      input.type,
      legacyTypes
    )

  const city =
    normalizeOptionalString(
      input.city
    ) ??
    normalizeOptionalString(
      context.city
    )

  const venue:
    Venue = {
    id,
    name,
    lat,
    lon,
    link,
  }

  const slug =
    normalizeOptionalString(
      input.slug
    )

  if (slug) {
    venue.slug =
      slug
  }

  const vibe =
    normalizeStringField(
      input.vibe
    )

  if (vibe) {
    venue.vibe =
      vibe
  }

  if (type) {
    venue.type =
      type
  }

  const cover =
    normalizeOptionalString(
      input.cover
    )

  if (cover) {
    venue.cover =
      cover
  }

  const instagramHandle =
    normalizeOptionalString(
      input.instagram_handle
    )

  if (
    instagramHandle
  ) {
    venue.instagram_handle =
      instagramHandle
  }

  const tags =
    normalizeStringField(
      input.tags
    )

  if (tags) {
    venue.tags =
      tags
  }

  const tier =
    normalizeOptionalString(
      input.tier
    )

  if (tier) {
    venue.tier =
      tier
  }

  if (city) {
    venue.city =
      city
  }

  const neighborhood =
    normalizeOptionalString(
      input.neighborhood
    )

  if (neighborhood) {
    venue.neighborhood =
      neighborhood
  }

  const markerTemporalProfile =
    normalizeTemporalProfile(
      input.markerTemporalProfile
    )

  if (
    markerTemporalProfile
  ) {
    venue.markerTemporalProfile =
      markerTemporalProfile
  }

  const openNow =
    normalizeBoolean(
      input.openNow
    )

  if (
    openNow !==
    undefined
  ) {
    venue.openNow =
      openNow
  }

  const hours =
    normalizeStringArray(
      input.hours
    )

  if (hours) {
    venue.hours =
      hours
  }

  const hoursNumeric =
    normalizeHoursNumeric(
      input.hoursNumeric,
      context,
      id
    )

  if (hoursNumeric) {
    venue.hoursNumeric =
      hoursNumeric
  }

  const dayParts =
    normalizeStringRecord(
      input.dayParts
    )

  if (dayParts) {
    venue.dayParts =
      dayParts
  }

  const timeCategory =
    normalizeStringField(
      input.timeCategory
    )

  if (timeCategory) {
    venue.timeCategory =
      timeCategory
  }

  const energyRamp =
    normalizeFiniteNumber(
      input.energyRamp
    )

  if (
    energyRamp !==
    undefined
  ) {
    venue.energyRamp =
      energyRamp
  }

  const price =
    normalizeOptionalString(
      input.price
    )

  if (price) {
    venue.price =
      price
  }

  const duration =
    normalizeFiniteNumber(
      input.duration
    )

  if (
    duration !==
    undefined
  ) {
    venue.duration =
      duration
  }

  const dateEvents =
    normalizeDateEvents(
      input.dateEvents
    )

  if (dateEvents) {
    venue.dateEvents =
      dateEvents
  }

  const hasUpcomingEvents =
    normalizeBoolean(
      input._has_upcoming_events
    )

  if (
    hasUpcomingEvents !==
    undefined
  ) {
    venue._has_upcoming_events =
      hasUpcomingEvents
  }

  const liveEvent =
    normalizeBoolean(
      input.liveEvent
    )

  if (
    liveEvent !==
    undefined
  ) {
    venue.liveEvent =
      liveEvent
  }

  const eventId =
    normalizeOptionalString(
      input.event_id
    )

  if (eventId) {
    venue.event_id =
      eventId
  }

  const eventCategory =
    normalizeOptionalString(
      input.eventCategory
    )

  if (eventCategory) {
    venue.eventCategory =
      eventCategory
  }

  const startsAt =
    normalizeOptionalString(
      input.starts_at
    )

  if (startsAt) {
    venue.starts_at =
      startsAt
  }

  const endsAt =
    normalizeOptionalString(
      input.ends_at
    )

  if (endsAt) {
    venue.ends_at =
      endsAt
  }

  const score =
    normalizeFiniteNumber(
      input._score
    )

  if (
    score !==
    undefined
  ) {
    venue._score =
      score
  }

  const eventBoost =
    normalizeFiniteNumber(
      input._eventBoost
    )

  if (
    eventBoost !==
    undefined
  ) {
    venue._eventBoost =
      eventBoost
  }

  const scoreBoost =
    normalizeFiniteNumber(
      input.scoreBoost
    )

  if (
    scoreBoost !==
    undefined
  ) {
    venue.scoreBoost =
      scoreBoost
  }

  return venue
}