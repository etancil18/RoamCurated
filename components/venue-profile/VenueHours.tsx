'use client'

import React, { useState } from 'react'
import { VenueHours as VenueHoursType } from '@/types/venue-profile'

type Props = {
  hours?: VenueHoursType
  isOpen?: boolean
}

const DAY_ALIASES: Record<string, string> = {
  sunday: 'sunday',
  sun: 'sunday',
  monday: 'monday',
  mon: 'monday',
  tuesday: 'tuesday',
  tue: 'tuesday',
  tues: 'tuesday',
  wednesday: 'wednesday',
  wed: 'wednesday',
  thursday: 'thursday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  friday: 'friday',
  fri: 'friday',
  saturday: 'saturday',
  sat: 'saturday',
}

function normalizeDayKey(value: string) {
  const cleaned = value.trim().toLowerCase().replace(/\./g, '')
  return DAY_ALIASES[cleaned] ?? cleaned
}

export default function VenueHours({ hours, isOpen }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!hours) return null

  const rawToday = new Date()
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase()

  const normalizedToday = normalizeDayKey(rawToday)

  const actualTodayKey =
    Object.keys(hours).find((day) => normalizeDayKey(day) === normalizedToday) ??
    rawToday

  const formatTime = (time: string) => {
    if (!time) return 'Closed'

    if (/AM|PM/i.test(time)) {
      return time.replace(/\s+/, ' ').toUpperCase()
    }

    const [hourStr, minStr] = time.split(':')
    let hour = parseInt(hourStr, 10)
    const min = parseInt(minStr || '0', 10)

    if (isNaN(hour) || isNaN(min)) return 'Invalid'

    const ampm = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12
    if (hour === 0) hour = 12

    return `${hour}:${min.toString().padStart(2, '0')} ${ampm}`
  }

  const renderLine = (day: string) => {
    const slot: Record<string, string> | undefined = hours[day] as any
    const isToday = normalizeDayKey(day) === normalizedToday

    if (!slot || Object.keys(slot).length === 0) {
      return (
        <li
          key={day}
          className={`flex justify-between text-sm ${
            isToday
              ? 'font-semibold text-blue-600 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          <span className="capitalize">{day}</span>
          <span>Closed</span>
        </li>
      )
    }

    const pairs: string[] = []

    if (slot.open && slot.close) {
      pairs.push(`${formatTime(slot.open)} – ${formatTime(slot.close)}`)
    }

    Object.keys(slot).forEach((key) => {
      if (key.startsWith('open') && key !== 'open') {
        const index = key.replace('open', '')
        const closeKey = `close${index}`
        const openTime = slot[key]
        const closeTime = slot[closeKey]
        if (!openTime || !closeTime) return

        pairs.push(`${formatTime(openTime)} – ${formatTime(closeTime)}`)
      }
    })

    return (
      <li
        key={day}
        className={`flex justify-between text-sm ${
          isToday
            ? 'font-semibold text-blue-600 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        <span className="capitalize">{day}</span>
        <span>{pairs.length > 0 ? pairs.join(', ') : 'Closed'}</span>
      </li>
    )
  }

  const todayLine = renderLine(actualTodayKey)

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hours</h2>

      {typeof isOpen === 'boolean' && (
        <p className={`text-sm font-medium ${isOpen ? 'text-green-600' : 'text-red-500'}`}>
          {isOpen ? 'Open now' : 'Closed now'}
        </p>
      )}

      {!expanded ? (
        <ul>{todayLine}</ul>
      ) : (
        <ul className="space-y-1">
          {Object.keys(hours).map((day) => renderLine(day))}
        </ul>
      )}

      <button
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide full hours' : 'View full week'}
      </button>
    </div>
  )
}