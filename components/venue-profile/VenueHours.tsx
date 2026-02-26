'use client'

import React, { useState } from 'react'
import { VenueHours as VenueHoursType } from '@/types/venue-profile'

type Props = {
  hours?: VenueHoursType
  isOpen?: boolean
}

export default function VenueHours({ hours, isOpen }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!hours) return null

  // get lowercased weekday like "monday"
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
  }).toLowerCase()

  // format time string like "14:00" or "2:00" into proper 12-hour with AM/PM
  const formatTime = (time: string) => {
  if (!time) return 'Closed'

  // If already contains AM/PM, just normalize spacing
  if (/AM|PM/i.test(time)) {
    return time.replace(/\s+/, ' ').toUpperCase()
  }

  // fallback: parse "HH:MM" 24-hour numeric strings
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

    if (!slot || Object.keys(slot).length === 0) {
      return (
        <li
          key={day}
          className={`flex justify-between text-sm ${
            day === today
              ? 'font-semibold text-blue-600 dark:text-blue-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          <span className="capitalize">{day}</span>
          <span>Closed</span>
        </li>
      )
    }

    const now = new Date()
    const pairs: string[] = []

// handle single-slot (open/close)
if (slot.open && slot.close) {
  pairs.push(`${formatTime(slot.open)} – ${formatTime(slot.close)}`)

  if (day === today) {
    const [openH, openM] = slot.open.split(':').map(Number)
    const [closeH, closeM] = slot.close.split(':').map(Number)
    const now = new Date()
    const openDate = new Date()
    openDate.setHours(openH, openM, 0, 0)
    const closeDate = new Date()
    closeDate.setHours(closeH, closeM, 0, 0)
    if (closeDate <= openDate) closeDate.setDate(closeDate.getDate() + 1)
    if (now >= openDate && now <= closeDate) isOpen = true
  }
}

// handle multi-slot (open1/close1, open2/close2...)
Object.keys(slot).forEach((key) => {
  if (key.startsWith('open') && key !== 'open') {
    const index = key.replace('open', '')
    const closeKey = `close${index}`
    const openTime = slot[key]
    const closeTime = slot[closeKey]
    if (!openTime || !closeTime) return
    pairs.push(`${formatTime(openTime)} – ${formatTime(closeTime)}`)

    if (day === today) {
      const [openH, openM] = openTime.split(':').map(Number)
      const [closeH, closeM] = closeTime.split(':').map(Number)
      const now = new Date()
      const openDate = new Date()
      openDate.setHours(openH, openM, 0, 0)
      const closeDate = new Date()
      closeDate.setHours(closeH, closeM, 0, 0)
      if (closeDate <= openDate) closeDate.setDate(closeDate.getDate() + 1)
      if (now >= openDate && now <= closeDate) isOpen = true
    }
  }
})

    return (
      <li
        key={day}
        className={`flex justify-between text-sm ${
          day === today
            ? 'font-semibold text-blue-600 dark:text-blue-400'
            : 'text-gray-700 dark:text-gray-300'
        }`}
      >
        <span className="capitalize">{day}</span>
        <span>{pairs.length > 0 ? pairs.join(', ') : 'Closed'}</span>
      </li>
    )
  }

  // Get the correct line for today before expanding
  const todayLine = renderLine(today)

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