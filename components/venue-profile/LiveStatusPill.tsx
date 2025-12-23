'use client'

import React from 'react'
import { VenueLiveStatus } from '@/types/venue-profile'

type Props = {
  status?: VenueLiveStatus | null
}

export default function LiveStatusPill({ status }: Props) {
  if (!status) return null

  const {
    is_open_for_dropins,
    status_tags = [],
  } = status

  const pillColor = is_open_for_dropins
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'

  const pillText = is_open_for_dropins
    ? 'Open for drop-ins'
    : 'Closed for drop-ins'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Main Status */}
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full ${pillColor}`}
        >
          {pillText}
        </span>

        {/* Status Tags */}
        {status_tags.map((tag) => (
          <span
            key={tag}
            className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
