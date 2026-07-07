// lib/routes/arrivalTime.ts

import { DateTime } from 'luxon'

export type ArrivalTimeTravelMode = 'walking' | 'cycling' | 'driving'

export type ArrivalVenue = {
  id?: string | null
  name?: string | null
  lat?: number | null
  lon?: number | null
}

export type ArrivalEstimate = {
  departAt: Date
  arriveAt: Date
  dwellMinutes: number
  travelMinutes: number
  distanceMeters: number | null
  travelMode: ArrivalTimeTravelMode
}

export type EstimateArrivalParams = {
  fromVenue?: ArrivalVenue | null
  toVenue: ArrivalVenue
  startAt: Date | string
  dwellMinutes?: number
  travelMode?: ArrivalTimeTravelMode
  fallbackTravelMinutes?: number
}

const DEFAULT_DWELL_MINUTES = 45

const DEFAULT_FALLBACK_TRAVEL_MINUTES_BY_MODE: Record<
  ArrivalTimeTravelMode,
  number
> = {
  walking: 12,
  cycling: 8,
  driving: 10,
}

const METERS_PER_MINUTE_BY_MODE: Record<ArrivalTimeTravelMode, number> = {
  walking: 80,
  cycling: 240,
  driving: 500,
}

export function estimateArrivalTime({
  fromVenue = null,
  toVenue,
  startAt,
  dwellMinutes = DEFAULT_DWELL_MINUTES,
  travelMode = 'walking',
  fallbackTravelMinutes = DEFAULT_FALLBACK_TRAVEL_MINUTES_BY_MODE[travelMode],
}: EstimateArrivalParams): ArrivalEstimate {
  const safeStartAt = coerceDate(startAt)
  const safeDwellMinutes = sanitizeMinutes(dwellMinutes, DEFAULT_DWELL_MINUTES)

  const distanceMeters =
    fromVenue && hasValidCoordinates(fromVenue) && hasValidCoordinates(toVenue)
      ? calculateDistanceMeters({
          fromLat: fromVenue.lat as number,
          fromLon: fromVenue.lon as number,
          toLat: toVenue.lat as number,
          toLon: toVenue.lon as number,
        })
      : null

  const travelMinutes =
    distanceMeters !== null
      ? estimateTravelMinutes(distanceMeters, travelMode)
      : sanitizeMinutes(
          fallbackTravelMinutes,
          DEFAULT_FALLBACK_TRAVEL_MINUTES_BY_MODE[travelMode]
        )

  const departAt = addMinutes(safeStartAt, safeDwellMinutes)
  const arriveAt = addMinutes(departAt, travelMinutes)

  return {
    departAt,
    arriveAt,
    dwellMinutes: safeDwellMinutes,
    travelMinutes,
    distanceMeters,
    travelMode,
  }
}

export function estimateNextArrivalFromPreviousEstimate({
  previousEstimate,
  previousVenue,
  nextVenue,
  previousStopDwellMinutes = DEFAULT_DWELL_MINUTES,
  travelMode = 'walking',
  fallbackTravelMinutes = DEFAULT_FALLBACK_TRAVEL_MINUTES_BY_MODE[travelMode],
}: {
  previousEstimate: ArrivalEstimate
  previousVenue: ArrivalVenue
  nextVenue: ArrivalVenue
  previousStopDwellMinutes?: number
  travelMode?: ArrivalTimeTravelMode
  fallbackTravelMinutes?: number
}): ArrivalEstimate {
  return estimateArrivalTime({
    fromVenue: previousVenue,
    toVenue: nextVenue,
    startAt: previousEstimate.arriveAt,
    dwellMinutes: previousStopDwellMinutes,
    travelMode,
    fallbackTravelMinutes,
  })
}

export function estimateTravelMinutes(
  distanceMeters: number,
  travelMode: ArrivalTimeTravelMode = 'walking'
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 1

  const metersPerMinute = METERS_PER_MINUTE_BY_MODE[travelMode]
  return Math.max(1, Math.round(distanceMeters / metersPerMinute))
}

export function addMinutes(date: Date | string, minutes: number): Date {
  const safeDate = coerceDate(date)
  const safeMinutes = sanitizeMinutes(minutes, 0)

  return new Date(safeDate.getTime() + safeMinutes * 60 * 1000)
}

export function minutesBetween(start: Date | string, end: Date | string): number {
  const safeStart = coerceDate(start)
  const safeEnd = coerceDate(end)

  return Math.round((safeEnd.getTime() - safeStart.getTime()) / 60000)
}

export function calculateDistanceMeters({
  fromLat,
  fromLon,
  toLat,
  toLon,
}: {
  fromLat: number
  fromLon: number
  toLat: number
  toLon: number
}): number {
  const earthRadiusMeters = 6371000

  const fromLatRad = degreesToRadians(fromLat)
  const toLatRad = degreesToRadians(toLat)
  const deltaLatRad = degreesToRadians(toLat - fromLat)
  const deltaLonRad = degreesToRadians(toLon - fromLon)

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(fromLatRad) *
      Math.cos(toLatRad) *
      Math.sin(deltaLonRad / 2) *
      Math.sin(deltaLonRad / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusMeters * c
}

export function hasValidCoordinates(
  venue: ArrivalVenue | null | undefined
): boolean {
  return (
    typeof venue?.lat === 'number' &&
    Number.isFinite(venue.lat) &&
    Math.abs(venue.lat) <= 90 &&
    typeof venue?.lon === 'number' &&
    Number.isFinite(venue.lon) &&
    Math.abs(venue.lon) <= 180
  )
}

export function coerceDate(value: Date | string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

export function getLocalHour(
  date: Date | string,
  timezone: string | null = null
): number {
  const safeDate = coerceDate(date)

  if (!timezone) {
    return safeDate.getHours()
  }

  const zoned = DateTime.fromJSDate(safeDate).setZone(timezone)

  return zoned.isValid ? zoned.hour : safeDate.getHours()
}

export function getLocalDayKey(
  date: Date | string,
  timezone: string | null = null
):
  | 'sun'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat' {
  const safeDate = coerceDate(date)

  const dayIndex = timezone
    ? DateTime.fromJSDate(safeDate).setZone(timezone).weekday % 7
    : safeDate.getDay()

  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][
    Number.isFinite(dayIndex) ? dayIndex : safeDate.getDay()
  ] as 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'
}

function sanitizeMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.round(value))
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180
}