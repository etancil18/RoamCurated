// lib/roam/getRoamDay.ts

import { DateTime } from 'luxon'

import { CITY_CONFIGS } from '@/config/cities'

export function getRoamDay(
  timestamp: string,
  city: string
): string | null {
  const timezone =
    CITY_CONFIGS[city]?.timezone

  if (!timezone) {
    return null
  }

  const localTime =
    DateTime
      .fromISO(timestamp, {
        setZone: true,
      })
      .setZone(timezone)

  if (!localTime.isValid) {
    return null
  }

  return (
    localTime
      .minus({
        hours: 3,
      })
      .toISODate()
  )
}