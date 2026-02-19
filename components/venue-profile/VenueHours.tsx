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

  const formatTime = (time: string) => {
    if (!time) return 'Closed'
    const [hourStr, minStr] = time.split(':')
    const hour = parseInt(hourStr, 10)
    const min = parseInt(minStr, 10)
    if (isNaN(hour) || isNaN(min)) return 'Invalid'
    const date = new Date()
    date.setHours(hour, min)
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const renderLine = (day: string) => {
    // type slot as a flexible object to allow open1/close1 keys
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

    // Collect all open/close pairs dynamically
    const pairs: string[] = []
    Object.keys(slot).forEach((key) => {
      if (key.startsWith('open')) {
        const index = key.replace('open', '')
        const closeKey = `close${index}`
        if (slot[closeKey]) {
          pairs.push(`${formatTime(slot[key])} – ${formatTime(slot[closeKey])}`)
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

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hours</h2>

      {typeof isOpen === 'boolean' && (
        <p className={`text-sm font-medium ${isOpen ? 'text-green-600' : 'text-red-500'}`}>
          {isOpen ? 'Open now' : 'Closed now'}
        </p>
      )}

      {!expanded ? (
        <ul>{renderLine(today)}</ul>
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
