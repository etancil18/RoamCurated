'use client'

import React from 'react'

type TimeSelectorProps = {
  value: string
  onChange: (val: string) => void
}

export default function TimeSelector({ value, onChange }: TimeSelectorProps) {
  const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
    const hours = Math.floor(i / 4)
    const minutes = (i % 4) * 15
    const period = hours >= 12 ? 'pm' : 'am'
    const displayHour = hours % 12 === 0 ? 12 : hours % 12
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`
  })

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
    >
      <option value="">—</option>
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  )
}
